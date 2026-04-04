import { signal } from "@preact/signals";
import {
  activateEstop,
  applyRemoteExecutionState,
  applyRemoteJointState,
  canExecute,
  executeTarget,
  gripperGoalPercent,
  lockedTarget,
  realTarget,
  resetEstop,
  setConnectionReady,
  setFault,
  stopExecution,
} from "../store/appState";
import { ROBOT_PROTOCOL_VERSION, type RobotProtocolMessage, type RobotGroupName } from "./protocol";
import { RobotSocketClient } from "./robotSocket";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

const STORAGE_KEY = "silverhand.robot_ws_url";
const DEFAULT_URL = (import.meta.env as { VITE_ROBOT_WS_URL?: string }).VITE_ROBOT_WS_URL ?? "ws://127.0.0.1:8765";
const HEARTBEAT_INTERVAL_MS = 3000;

export const robotConnectionUrl = signal(readInitialUrl());
export const robotConnectionState = signal<ConnectionState>("disconnected");
export const robotConnectionError = signal("");
export const robotConnectionServerName = signal("");
export const robotConnectionGroups = signal<RobotGroupName[]>([]);
export const robotLastMessageTs = signal<number | null>(null);

let client: RobotSocketClient | null = null;
let heartbeatTimer = 0;
let heartbeatCounter = 1;
let manuallyDisconnected = false;

export function initializeRobotConnection() {
  connectRobot();
  return () => {
    disconnectRobot();
  };
}

export function setRobotConnectionUrl(nextUrl: string) {
  robotConnectionUrl.value = nextUrl;
  localStorage.setItem(STORAGE_KEY, nextUrl);
}

export function connectRobot() {
  const url = robotConnectionUrl.value.trim();
  if (!url) {
    robotConnectionState.value = "error";
    robotConnectionError.value = "Не задан URL websocket.";
    return;
  }

  disconnectRobot(false);
  manuallyDisconnected = false;
  robotConnectionState.value = "connecting";
  robotConnectionError.value = "";

  client = new RobotSocketClient(url, {
    onOpen: () => {
      robotConnectionState.value = "connected";
      robotConnectionError.value = "";
      setConnectionReady(true);
      sendHello();
      startHeartbeat();
    },
    onClose: () => {
      stopHeartbeat();
      setConnectionReady(false);
      robotConnectionState.value = manuallyDisconnected ? "disconnected" : "error";
      if (!manuallyDisconnected) {
        robotConnectionError.value = "Соединение закрыто.";
      }
    },
    onError: () => {
      robotConnectionState.value = "error";
      robotConnectionError.value = "Ошибка websocket.";
      setConnectionReady(false);
    },
    onMessage: handleRobotMessage,
  });

  client.connect();
}

export function disconnectRobot(manual = true) {
  manuallyDisconnected = manual;
  stopHeartbeat();
  client?.disconnect();
  client = null;
  setConnectionReady(false);
  if (manual) {
    robotConnectionState.value = "disconnected";
  }
}

export function reconnectRobot() {
  connectRobot();
}

export function sendLockedTargetToRobot() {
  if (!client?.isConnected() || !lockedTarget.value || !canExecute.value) {
    return false;
  }

  const commandId = createCommandId("goal");
  const currentTarget = lockedTarget.value;
  const sent = client.send("set_joint_goal", {
    command_id: commandId,
    goal: {
      group_name: "arm",
      joint_names: [
        "arm_joint_1",
        "arm_joint_2",
        "arm_joint_3",
        "arm_joint_4",
        "arm_joint_5",
        "arm_joint_6",
      ],
      positions_rad: currentTarget.joints.map(degToRad),
    },
  });
  if (!sent) {
    return false;
  }

  client.send("execute", {
    command_id: createCommandId("execute"),
    group_name: "arm",
  });
  executeTarget();
  return true;
}

export function sendStopToRobot() {
  if (!client?.isConnected()) {
    stopExecution();
    return false;
  }
  const sent = client.send("stop", {
    command_id: createCommandId("stop"),
    group_name: "arm",
  });
  if (sent) {
    stopExecution();
  }
  return sent;
}

export function sendEstopToRobot() {
  if (!client?.isConnected()) {
    activateEstop();
    return false;
  }
  const sent = client.send("estop", {
    command_id: createCommandId("estop"),
  });
  activateEstop();
  return sent;
}

export function sendResetEstopToRobot() {
  if (!client?.isConnected()) {
    resetEstop();
    return false;
  }
  const sent = client.send("reset_estop", {
    command_id: createCommandId("reset-estop"),
  });
  resetEstop();
  return sent;
}

export function sendGripperGoalToRobot() {
  if (!client?.isConnected()) {
    return false;
  }

  const openingRad = (Math.max(0, Math.min(100, gripperGoalPercent.value)) / 100) * 0.01;
  const sent = client.send("set_joint_goal", {
    command_id: createCommandId("gripper-goal"),
    goal: {
      group_name: "gripper",
      joint_names: [
        "hand_left_finger_joint",
        "hand_right_finger_joint",
      ],
      positions_rad: [openingRad, openingRad],
    },
  });

  if (!sent) {
    return false;
  }

  client.send("execute", {
    command_id: createCommandId("gripper-execute"),
    group_name: "gripper",
  });
  return true;
}

export function sendGripperStopToRobot() {
  if (!client?.isConnected()) {
    return false;
  }

  const openingRad = (Math.max(0, Math.min(100, realTarget.value.gripper)) / 100) * 0.01;
  const sent = client.send("set_joint_goal", {
    command_id: createCommandId("gripper-stop"),
    goal: {
      group_name: "gripper",
      joint_names: [
        "hand_left_finger_joint",
        "hand_right_finger_joint",
      ],
      positions_rad: [openingRad, openingRad],
    },
  });

  if (!sent) {
    return false;
  }

  client.send("execute", {
    command_id: createCommandId("gripper-stop-execute"),
    group_name: "gripper",
  });
  return true;
}

function handleRobotMessage(message: RobotProtocolMessage) {
  robotLastMessageTs.value = Date.now();

  switch (message.type) {
    case "hello_ack":
      robotConnectionServerName.value = message.payload.server_name;
      robotConnectionGroups.value = message.payload.groups;
      return;
    case "pong":
      return;
    case "joint_state":
      applyRemoteJointState(message.payload.group_name, message.payload.name, message.payload.position_rad);
      return;
    case "planning_state":
      applyRemoteExecutionState(message.payload.status);
      return;
    case "execution_state":
      applyRemoteExecutionState(message.payload.status);
      return;
    case "fault_state":
      setFault(message.payload.active);
      if (message.payload.active) {
        robotConnectionError.value = message.payload.message;
      }
      return;
    default:
      return;
  }
}

function sendHello() {
  client?.send("hello", {
    protocol_version: ROBOT_PROTOCOL_VERSION,
    client_name: "silverhand_arm_teleop_ui",
    requested_groups: ["arm", "gripper"],
  });
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    client?.send("ping", {
      heartbeat_id: `hb-${heartbeatCounter++}`,
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer !== 0) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
  }
}

function readInitialUrl() {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL;
}

function createCommandId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}
