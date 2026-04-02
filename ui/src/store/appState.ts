import { computed, signal } from "@preact/signals";
import { createPreviewController, type JointVector, type TcpPose } from "../kinematics";

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
  gripper: number;
};

const DEFAULT_JOINTS = [0, 0, 0, 0, 0, 0];
const DEFAULT_TCP = [0, 0, 0, 0, 0, 0];
const DEFAULT_GRIPPER = 55;
const previewController = createPreviewController();

function cloneTarget(bundle: TargetBundle): TargetBundle {
  return {
    joints: [...bundle.joints],
    tcp: [...bundle.tcp],
    gripper: bundle.gripper,
  };
}

function defaultTarget(): TargetBundle {
  return {
    joints: [...DEFAULT_JOINTS],
    tcp: [...DEFAULT_TCP],
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

export function updateTcp(index: number, value: number): void {
  if (editingDisabled.value) {
    return;
  }
  controlMode.value = "tcp";
  interactionMode.value = "planner_tcp";
  const next = cloneTarget(previewTarget.value);
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

export function updateTcpOrientationFromGizmo(orientation: [number, number, number]): void {
  if (editingDisabled.value) {
    return;
  }

  controlMode.value = "tcp";
  interactionMode.value = "planner_gizmo";

  const next = cloneTarget(previewTarget.value);
  next.tcp[3] = orientation[0];
  next.tcp[4] = orientation[1];
  next.tcp[5] = orientation[2];
  applyTcpPreview(next);
}

export function syncTcpPoseFromModel(
  position: [number, number, number],
  orientation: [number, number, number],
): void {
  const nextReal = cloneTarget(realTarget.value);
  nextReal.tcp[0] = position[0];
  nextReal.tcp[1] = position[1];
  nextReal.tcp[2] = position[2];
  nextReal.tcp[3] = orientation[0];
  nextReal.tcp[4] = orientation[1];
  nextReal.tcp[5] = orientation[2];
  realTarget.value = nextReal;

  const nextPreview = cloneTarget(previewTarget.value);
  nextPreview.tcp[0] = position[0];
  nextPreview.tcp[1] = position[1];
  nextPreview.tcp[2] = position[2];
  nextPreview.tcp[3] = orientation[0];
  nextPreview.tcp[4] = orientation[1];
  nextPreview.tcp[5] = orientation[2];
  previewTarget.value = nextPreview;
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
  appState.value = "idle";
}

export function activateEstop(): void {
  appState.value = "estop_active";
  previewTarget.value = cloneTarget(realTarget.value);
  lockedTarget.value = null;
  interactionMode.value = "idle";
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

function toTcpPose(bundle: TargetBundle): TcpPose {
  return {
    position: {
      x: bundle.tcp[0],
      y: bundle.tcp[1],
      z: bundle.tcp[2],
    },
    orientation: {
      roll: bundle.tcp[3],
      pitch: bundle.tcp[4],
      yaw: bundle.tcp[5],
    },
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
  } else if (appState.value === "fault") {
    appState.value = "idle";
  }

  safetyState.value = {
    ...safetyState.value,
    noFaults: !active,
  };
}
