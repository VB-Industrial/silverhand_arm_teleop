import { computed, signal } from "@preact/signals";

import { cameraConfigs, cameraConfigMap, primaryCameraIds } from "./cameraConfig";
import type { CameraConfig, CameraId, CameraState } from "./cameraTypes";
import { WHEPClient } from "./whepClient";

function createInitialCameraState(config: CameraConfig): CameraState {
  return {
    ...config,
    enabled: config.enabledByDefault,
    collapsed: false,
    status: config.enabledByDefault ? (config.whepUrl ? "idle" : "unconfigured") : "disabled",
    lastError: null,
    reconnectAttempt: 0,
    connectedAt: null,
    lastFrameAt: null,
  };
}

function initialStateMap(): Record<CameraId, CameraState> {
  return Object.fromEntries(cameraConfigs.map((config) => [config.id, createInitialCameraState(config)])) as Record<
    CameraId,
    CameraState
  >;
}

export const cameraStates = signal<Record<CameraId, CameraState>>(initialStateMap());

export const cameraSummary = computed(() => {
  const states = primaryCameraIds.map((id) => cameraStates.value[id]);
  const liveCount = states.filter((state) => state.status === "live").length;
  const unconfiguredCount = states.filter((state) => state.status === "unconfigured").length;
  const hasErrors = states.some((state) => state.status === "error");

  return {
    totalPrimary: states.length,
    liveCount,
    unconfiguredCount,
    hasErrors,
  };
});

export const expandedCameraIds = computed(() =>
  primaryCameraIds.filter((id) => !cameraStates.value[id].collapsed),
);

export const collapsedCameraIds = computed(() =>
  primaryCameraIds.filter((id) => cameraStates.value[id].collapsed),
);

class CameraSessionController {
  private readonly config: CameraConfig;
  private client: WHEPClient | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private connectNonce = 0;
  private reconnectAttempt = 0;

  constructor(config: CameraConfig) {
    this.config = config;
  }

  attach(element: HTMLVideoElement | null): void {
    this.videoElement = element;
    if (this.videoElement) {
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
    }
    if (this.getState().enabled) {
      void this.connect(false);
    }
  }

  detach(element: HTMLVideoElement | null): void {
    if (this.videoElement === element) {
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }
      this.videoElement = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();

    if (!enabled) {
      this.setState({
        enabled: false,
        status: "disabled",
        lastError: null,
        reconnectAttempt: 0,
      });
      void this.disconnect();
      return;
    }

    this.setState({
      enabled: true,
      status: this.config.whepUrl ? "idle" : "unconfigured",
      lastError: null,
      reconnectAttempt: 0,
    });

    if (this.videoElement) {
      void this.connect(false);
    }
  }

  reconnectNow(): void {
    if (!this.getState().enabled) {
      return;
    }
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    void this.connect(true);
  }

  private getState(): CameraState {
    return cameraStates.value[this.config.id];
  }

  private setState(patch: Partial<CameraState>): void {
    cameraStates.value = {
      ...cameraStates.value,
      [this.config.id]: {
        ...cameraStates.value[this.config.id],
        ...patch,
      },
    };
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async disconnect(): Promise<void> {
    this.connectNonce += 1;
    this.clearReconnectTimer();

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    if (this.client) {
      const client = this.client;
      this.client = null;
      await client.disconnect();
    }
  }

  private scheduleReconnect(reason: string): void {
    if (!this.getState().enabled || !this.videoElement || !this.config.whepUrl || this.reconnectTimer) {
      return;
    }

    this.reconnectAttempt += 1;
    const delay = Math.min(this.config.reconnectDelayMs * this.reconnectAttempt, 10000);
    this.setState({
      status: "reconnecting",
      lastError: reason,
      reconnectAttempt: this.reconnectAttempt,
    });

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect(true);
    }, delay);
  }

  private async connect(isReconnect: boolean): Promise<void> {
    const state = this.getState();
    if (!state.enabled || !this.videoElement) {
      return;
    }

    if (!this.config.whepUrl) {
      this.setState({
        status: "unconfigured",
        lastError: "WHEP URL не настроен",
      });
      return;
    }

    const nonce = ++this.connectNonce;
    this.clearReconnectTimer();

    if (this.client) {
      const previous = this.client;
      this.client = null;
      await previous.disconnect();
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.setState({
      status: isReconnect ? "reconnecting" : "connecting",
      lastError: null,
      reconnectAttempt: this.reconnectAttempt,
    });

    const client = new WHEPClient(this.config.whepUrl);
    this.client = client;

    try {
      const stream = await client.connect({
        timeoutMs: this.config.connectTimeoutMs,
        onConnectionStateChange: (connectionState) => {
          if (connectionState === "failed" || connectionState === "disconnected") {
            this.scheduleReconnect(`WebRTC ${connectionState}`);
          }
        },
      });

      if (nonce !== this.connectNonce) {
        await client.disconnect();
        return;
      }

      if (!this.videoElement) {
        await client.disconnect();
        this.client = null;
        return;
      }

      this.videoElement.srcObject = stream;
      void this.videoElement.play().catch(() => {
        // Autoplay may be blocked until the browser is ready.
      });

      this.reconnectAttempt = 0;
      this.setState({
        status: "live",
        lastError: null,
        reconnectAttempt: 0,
        connectedAt: Date.now(),
        lastFrameAt: Date.now(),
      });
    } catch (error: unknown) {
      if (nonce !== this.connectNonce) {
        return;
      }

      this.client = null;
      const message = error instanceof Error ? error.message : "Unknown camera error";
      this.setState({
        status: isReconnect ? "reconnecting" : "error",
        lastError: message,
        reconnectAttempt: this.reconnectAttempt,
      });
      this.scheduleReconnect(message);
    }
  }
}

const controllers = Object.fromEntries(
  cameraConfigs.map((config) => [config.id, new CameraSessionController(config)]),
) as Record<CameraId, CameraSessionController>;

export function attachCameraElement(id: CameraId, element: HTMLVideoElement | null): void {
  controllers[id].attach(element);
}

export function detachCameraElement(id: CameraId, element: HTMLVideoElement | null): void {
  controllers[id].detach(element);
}

export function reconnectCamera(id: CameraId): void {
  controllers[id].reconnectNow();
}

export function toggleCameraEnabled(id: CameraId): void {
  const state = cameraStates.value[id];
  controllers[id].setEnabled(!state.enabled);
}

export function toggleCameraCollapsed(id: CameraId): void {
  const state = cameraStates.value[id];
  const expandedCount = expandedCameraIds.value.length;

  if (!state.collapsed && expandedCount <= 1) {
    return;
  }

  cameraStates.value = {
    ...cameraStates.value,
    [id]: {
      ...state,
      collapsed: !state.collapsed,
    },
  };
}

export function enableAllConfiguredPrimaryCameras(): void {
  for (const id of primaryCameraIds) {
    if (!cameraConfigMap[id].whepUrl) {
      continue;
    }
    controllers[id].setEnabled(true);
  }
}
