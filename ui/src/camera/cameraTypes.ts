export type CameraId = "driver" | "wrist" | "front_hemi";

export type CameraTone = "driver" | "wrist" | "auxiliary";

export type CameraStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "disabled"
  | "error"
  | "unconfigured";

export type CameraConfig = {
  id: CameraId;
  title: string;
  whepUrl: string;
  enabledByDefault: boolean;
  optional: boolean;
  reconnectDelayMs: number;
  connectTimeoutMs: number;
  tone: CameraTone;
};

export type CameraState = CameraConfig & {
  enabled: boolean;
  collapsed: boolean;
  status: CameraStatus;
  lastError: string | null;
  reconnectAttempt: number;
  connectedAt: number | null;
  lastFrameAt: number | null;
};
