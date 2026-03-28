import type { CameraConfig, CameraId } from "./cameraTypes";

function envValue(key: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" ? value.trim() : "";
}

export const cameraConfigs: CameraConfig[] = [
  {
    id: "driver",
    title: "Камера водителя",
    whepUrl: envValue("VITE_CAMERA_DRIVER_WHEP_URL"),
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "driver",
  },
  {
    id: "wrist",
    title: "Камера на манипуляторе",
    whepUrl: envValue("VITE_CAMERA_WRIST_WHEP_URL"),
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "wrist",
  },
  {
    id: "diagonal",
    title: "Диагональная камера ровера",
    whepUrl: envValue("VITE_CAMERA_DIAGONAL_WHEP_URL"),
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "diagonal",
  },
  {
    id: "front_hemi",
    title: "Передняя полусфера",
    whepUrl: envValue("VITE_CAMERA_FRONT_HEMI_WHEP_URL"),
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2500,
    connectTimeoutMs: 8000,
    tone: "auxiliary",
  },
];

export const cameraConfigMap = Object.fromEntries(cameraConfigs.map((config) => [config.id, config])) as Record<
  CameraId,
  CameraConfig
>;

export const primaryCameraIds: CameraId[] = ["driver", "wrist", "diagonal", "front_hemi"];
