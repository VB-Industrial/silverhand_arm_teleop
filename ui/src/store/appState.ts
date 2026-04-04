import { computed, signal } from "@preact/signals";
import {
  createPreviewController,
  eulerDegFromQuaternion,
  identityQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  quaternionFromAngularVelocityDeg,
  roundEulerDeg,
  type JointVector,
  type OrientationQuaternion,
  type TcpPose,
} from "../kinematics";

export type AppTopLevelState =
  | "idle"
  | "preview"
  | "target_locked"
  | "executing"
  | "stopped"
  | "estop_active"
  | "fault";

export type ControlMode = "joint" | "tcp";
export type InputSource = "joystick" | "keyboard_mouse" | "sliders";
export type InteractionMode =
  | "idle"
  | "servo_joystick"
  | "servo_gripper"
  | "planner_gizmo"
  | "planner_joint"
  | "planner_tcp";

export type SafetyState = {
  armReady: boolean;
  controlActive: boolean;
  noFaults: boolean;
  connectionReady: boolean;
};

type TargetBundle = {
  joints: number[];
  tcp: number[];
  orientationQuaternion: OrientationQuaternion;
  gripper: number;
};

const DEFAULT_JOINTS = [0, 0, 0, 0, 0, 0];
const DEFAULT_TCP = [0, 0, 0, 0, 0, 0];
const DEFAULT_GRIPPER = 55;
const FOLDED_PRESET_JOINTS: JointVector = [0, 0, 0, 0, 0, 0];
const UNFOLDED_PRESET_JOINTS: JointVector = [0, 120, -30, 0, 90, 0];
const ORIENTATION_RATE_MAX_DEG_PER_SEC = 90;
const previewController = createPreviewController();
let orientationRateAnimationFrame = 0;
let orientationRateLastTimestamp = 0;

function cloneTarget(bundle: TargetBundle): TargetBundle {
  return {
    joints: [...bundle.joints],
    tcp: [...bundle.tcp],
    orientationQuaternion: [...bundle.orientationQuaternion] as OrientationQuaternion,
    gripper: bundle.gripper,
  };
}

function defaultTarget(): TargetBundle {
  return {
    joints: [...DEFAULT_JOINTS],
    tcp: [...DEFAULT_TCP],
    orientationQuaternion: identityQuaternion(),
    gripper: DEFAULT_GRIPPER,
  };
}

export const appState = signal<AppTopLevelState>("idle");
export const controlMode = signal<ControlMode>("joint");
export const inputSource = signal<InputSource>("joystick");
export const interactionMode = signal<InteractionMode>("idle");

export const safetyState = signal<SafetyState>({
  armReady: true,
  controlActive: true,
  noFaults: true,
  connectionReady: true,
});

export const realTarget = signal<TargetBundle>(defaultTarget());
export const previewTarget = signal<TargetBundle>(defaultTarget());
export const lockedTarget = signal<TargetBundle | null>(null);
export const tcpOrientationRates = signal<[number, number, number]>([0, 0, 0]);

export const canExecute = computed(
  () =>
    appState.value === "target_locked" &&
    safetyState.value.noFaults &&
    interactionMode.value !== "servo_joystick",
);
export const canStop = computed(() => appState.value === "executing");
export const canReset = computed(() => appState.value === "preview" || appState.value === "target_locked" || appState.value === "stopped");
export const estopActive = computed(() => appState.value === "estop_active");
export const editingDisabled = computed(() => appState.value === "executing" || appState.value === "estop_active" || appState.value === "fault");

export function setControlMode(mode: ControlMode): void {
  controlMode.value = mode;
}

export function setInputSource(source: InputSource): void {
  inputSource.value = source;
}

export function setInteractionMode(mode: InteractionMode): void {
  if (editingDisabled.value && mode !== "servo_joystick") {
    return;
  }
  interactionMode.value = mode;
}

export function startJoystickServoing(): void {
  if (appState.value === "estop_active" || appState.value === "fault") {
    return;
  }
  inputSource.value = "joystick";
  interactionMode.value = "servo_joystick";
}

export function stopJoystickServoing(): void {
  if (interactionMode.value === "servo_joystick") {
    interactionMode.value = "idle";
  }
}

export function updateJoint(index: number, value: number): void {
  if (editingDisabled.value) {
    return;
  }
  controlMode.value = "joint";
  interactionMode.value = "planner_joint";
  const next = cloneTarget(previewTarget.value);
  next.joints[index] = value;
  previewTarget.value = next;
  lockedTarget.value = cloneTarget(next);
  appState.value = "target_locked";
}

export function applyFoldedPreset(): void {
  applyJointPreset(FOLDED_PRESET_JOINTS);
}

export function applyUnfoldedPreset(): void {
  applyJointPreset(UNFOLDED_PRESET_JOINTS);
}

export function updateTcp(index: number, value: number): void {
  if (editingDisabled.value) {
    return;
  }
  controlMode.value = "tcp";
  interactionMode.value = "planner_tcp";
  const next = cloneTarget(previewTarget.value);
  if (index >= 3) {
    return;
  }
  next.tcp[index] = value;
  applyTcpPreview(next);
}

export function updateTcpPositionFromGizmo(position: [number, number, number]): void {
  if (editingDisabled.value) {
    return;
  }

  controlMode.value = "tcp";
  interactionMode.value = "planner_gizmo";

  const next = cloneTarget(previewTarget.value);
  next.tcp[0] = position[0];
  next.tcp[1] = position[1];
  next.tcp[2] = position[2];
  applyTcpPreview(next);
}

export function updateTcpQuaternionFromGizmo(quaternion: OrientationQuaternion): void {
  if (editingDisabled.value) {
    return;
  }

  controlMode.value = "tcp";
  interactionMode.value = "planner_gizmo";

  const next = cloneTarget(previewTarget.value);
  next.orientationQuaternion = normalizeQuaternion(quaternion);
  syncEulerReadout(next);
  applyTcpPreview(next);
}

export function syncTcpPoseFromModel(
  position: [number, number, number],
  quaternion: OrientationQuaternion,
): void {
  const normalizedQuaternion = normalizeQuaternion(quaternion);
  const currentReal = realTarget.value;
  const currentPreview = previewTarget.value;
  const sameRealPosition =
    Math.abs(currentReal.tcp[0] - position[0]) < 0.0005 &&
    Math.abs(currentReal.tcp[1] - position[1]) < 0.0005 &&
    Math.abs(currentReal.tcp[2] - position[2]) < 0.0005;
  const samePreviewPosition =
    Math.abs(currentPreview.tcp[0] - position[0]) < 0.0005 &&
    Math.abs(currentPreview.tcp[1] - position[1]) < 0.0005 &&
    Math.abs(currentPreview.tcp[2] - position[2]) < 0.0005;
  const sameRealQuaternion = currentReal.orientationQuaternion.every(
    (value, index) => Math.abs(value - normalizedQuaternion[index]) < 0.0005,
  );
  const samePreviewQuaternion = currentPreview.orientationQuaternion.every(
    (value, index) => Math.abs(value - normalizedQuaternion[index]) < 0.0005,
  );

  if (sameRealPosition && samePreviewPosition && sameRealQuaternion && samePreviewQuaternion) {
    return;
  }

  const nextReal = cloneTarget(realTarget.value);
  nextReal.tcp[0] = position[0];
  nextReal.tcp[1] = position[1];
  nextReal.tcp[2] = position[2];
  nextReal.orientationQuaternion = normalizedQuaternion;
  syncEulerReadout(nextReal);
  realTarget.value = nextReal;

  const nextPreview = cloneTarget(previewTarget.value);
  nextPreview.tcp[0] = position[0];
  nextPreview.tcp[1] = position[1];
  nextPreview.tcp[2] = position[2];
  nextPreview.orientationQuaternion = normalizedQuaternion;
  syncEulerReadout(nextPreview);
  previewTarget.value = nextPreview;
}

export function syncPreviewTcpPoseFromModel(
  position: [number, number, number],
  quaternion: OrientationQuaternion,
): void {
  const normalizedQuaternion = normalizeQuaternion(quaternion);
  const currentPreview = previewTarget.value;
  const samePreviewPosition =
    Math.abs(currentPreview.tcp[0] - position[0]) < 0.0005 &&
    Math.abs(currentPreview.tcp[1] - position[1]) < 0.0005 &&
    Math.abs(currentPreview.tcp[2] - position[2]) < 0.0005;
  const samePreviewQuaternion = currentPreview.orientationQuaternion.every(
    (value, index) => Math.abs(value - normalizedQuaternion[index]) < 0.0005,
  );

  if (samePreviewPosition && samePreviewQuaternion) {
    return;
  }

  const nextPreview = cloneTarget(previewTarget.value);
  nextPreview.tcp[0] = position[0];
  nextPreview.tcp[1] = position[1];
  nextPreview.tcp[2] = position[2];
  nextPreview.orientationQuaternion = normalizedQuaternion;
  syncEulerReadout(nextPreview);
  previewTarget.value = nextPreview;

  if (lockedTarget.value !== null) {
    lockedTarget.value = cloneTarget(nextPreview);
  }
}

export function setTcpOrientationRate(index: 3 | 4 | 5, value: number): void {
  if (editingDisabled.value) {
    return;
  }

  controlMode.value = "tcp";
  interactionMode.value = "planner_tcp";
  const next = [...tcpOrientationRates.value] as [number, number, number];
  next[index - 3] = value;
  tcpOrientationRates.value = next;
  ensureOrientationRateLoop();
}

export function resetTcpOrientationRate(index: 3 | 4 | 5): void {
  const next = [...tcpOrientationRates.value] as [number, number, number];
  next[index - 3] = 0;
  tcpOrientationRates.value = next;
  if (next.every((value) => Math.abs(value) < 0.0001)) {
    stopOrientationRateLoop();
  }
}

export function resetAllTcpOrientationRates(): void {
  tcpOrientationRates.value = [0, 0, 0];
  stopOrientationRateLoop();
}

export function updateGripper(value: number): void {
  if (editingDisabled.value) {
    return;
  }
  interactionMode.value = "servo_gripper";
  previewTarget.value = {
    ...previewTarget.value,
    gripper: value,
  };
  realTarget.value = {
    ...realTarget.value,
    gripper: value,
  };
  if (lockedTarget.value !== null) {
    lockedTarget.value = {
      ...lockedTarget.value,
      gripper: value,
    };
  }
}

export function executeTarget(): void {
  if (!canExecute.value || lockedTarget.value === null) {
    return;
  }
  appState.value = "executing";
  safetyState.value = {
    ...safetyState.value,
    controlActive: true,
  };
}

export function finishExecution(): void {
  if (appState.value !== "executing" || lockedTarget.value === null) {
    return;
  }
  realTarget.value = {
    ...cloneTarget(lockedTarget.value),
    gripper: realTarget.value.gripper,
  };
  previewTarget.value = {
    ...cloneTarget(lockedTarget.value),
    gripper: realTarget.value.gripper,
  };
  lockedTarget.value = null;
  interactionMode.value = "idle";
  appState.value = "idle";
}

export function stopExecution(): void {
  if (!canStop.value) {
    return;
  }
  interactionMode.value = "idle";
  appState.value = "stopped";
}

export function resetState(): void {
  if (!canReset.value) {
    return;
  }
  previewTarget.value = cloneTarget(realTarget.value);
  lockedTarget.value = null;
  interactionMode.value = "idle";
  resetAllTcpOrientationRates();
  appState.value = "idle";
}

export function activateEstop(): void {
  appState.value = "estop_active";
  previewTarget.value = cloneTarget(realTarget.value);
  lockedTarget.value = null;
  interactionMode.value = "idle";
  resetAllTcpOrientationRates();
  safetyState.value = {
    ...safetyState.value,
    controlActive: false,
  };
}

export function resetEstop(): void {
  if (!estopActive.value) {
    return;
  }
  previewTarget.value = cloneTarget(realTarget.value);
  lockedTarget.value = null;
  interactionMode.value = "idle";
  resetAllTcpOrientationRates();
  appState.value = "idle";
  safetyState.value = {
    ...safetyState.value,
    controlActive: true,
  };
}

function applyTcpPreview(next: TargetBundle): void {
  const result = previewController.computePosePreview(toTcpPose(next), asJointVector(previewTarget.value.joints));

  if (result.previewJointsDeg) {
    next.joints = [...result.previewJointsDeg];
    previewTarget.value = next;
    lockedTarget.value = cloneTarget(next);
    appState.value = "target_locked";
    return;
  }

  previewTarget.value = next;
  lockedTarget.value = null;
  appState.value = "preview";
}

function applyJointPreset(joints: JointVector): void {
  if (editingDisabled.value) {
    return;
  }

  controlMode.value = "joint";
  interactionMode.value = "planner_joint";
  const next = cloneTarget(previewTarget.value);
  next.joints = [...joints];
  previewTarget.value = next;
  lockedTarget.value = cloneTarget(next);
  appState.value = "target_locked";
}

function toTcpPose(bundle: TargetBundle): TcpPose {
  return {
    position: {
      x: bundle.tcp[0],
      y: bundle.tcp[1],
      z: bundle.tcp[2],
    },
    orientationQuaternion: bundle.orientationQuaternion,
  };
}

function asJointVector(values: number[]): JointVector {
  return [values[0], values[1], values[2], values[3], values[4], values[5]];
}

export function setFault(active: boolean): void {
  if (active) {
    appState.value = "fault";
    lockedTarget.value = null;
    interactionMode.value = "idle";
    resetAllTcpOrientationRates();
  } else if (appState.value === "fault") {
    appState.value = "idle";
  }

  safetyState.value = {
    ...safetyState.value,
    noFaults: !active,
  };
}

function ensureOrientationRateLoop(): void {
  if (orientationRateAnimationFrame !== 0) {
    return;
  }

  orientationRateLastTimestamp = 0;
  orientationRateAnimationFrame = window.requestAnimationFrame(stepOrientationRateLoop);
}

function stepOrientationRateLoop(timestamp: number): void {
  orientationRateAnimationFrame = 0;

  const currentRates = tcpOrientationRates.value;
  if (currentRates.every((value) => Math.abs(value) < 0.0001)) {
    orientationRateLastTimestamp = 0;
    return;
  }

  const dtSec = orientationRateLastTimestamp === 0 ? 1 / 60 : Math.min(0.05, (timestamp - orientationRateLastTimestamp) / 1000);
  orientationRateLastTimestamp = timestamp;

  if (!editingDisabled.value) {
    const angularVelocityDegPerSec: [number, number, number] = [
      (currentRates[0] / 180) * ORIENTATION_RATE_MAX_DEG_PER_SEC,
      (currentRates[1] / 180) * ORIENTATION_RATE_MAX_DEG_PER_SEC,
      (currentRates[2] / 180) * ORIENTATION_RATE_MAX_DEG_PER_SEC,
    ];
    const deltaQuaternion = quaternionFromAngularVelocityDeg(angularVelocityDegPerSec, dtSec);
    const next = cloneTarget(previewTarget.value);
    next.orientationQuaternion = normalizeQuaternion(multiplyQuaternions(next.orientationQuaternion, deltaQuaternion));
    syncEulerReadout(next);
    applyTcpPreview(next);
  }

  if (tcpOrientationRates.value.some((value) => Math.abs(value) >= 0.0001)) {
    orientationRateAnimationFrame = window.requestAnimationFrame(stepOrientationRateLoop);
  } else {
    stopOrientationRateLoop();
  }
}

function stopOrientationRateLoop(): void {
  if (orientationRateAnimationFrame !== 0) {
    window.cancelAnimationFrame(orientationRateAnimationFrame);
    orientationRateAnimationFrame = 0;
  }
  orientationRateLastTimestamp = 0;
}

function syncEulerReadout(bundle: TargetBundle): void {
  const [roll, pitch, yaw] = roundEulerDeg(eulerDegFromQuaternion(bundle.orientationQuaternion));
  bundle.tcp[3] = roll;
  bundle.tcp[4] = pitch;
  bundle.tcp[5] = yaw;
}
