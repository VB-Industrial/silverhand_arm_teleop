import type {
  GUIToRobotMessage,
  ProtocolSequence,
  ProtocolTimestampSec,
  RobotProtocolMessage,
} from "./protocol";

type RobotSocketCallbacks = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onMessage?: (message: RobotProtocolMessage) => void;
};

export class RobotSocketClient {
  private socket: WebSocket | null = null;
  private suppressLifecycleCallbacks = false;
  private seq: ProtocolSequence = 1;

  constructor(
    private readonly url: string,
    private readonly callbacks: RobotSocketCallbacks,
  ) {}

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("open", () => {
      if (!this.suppressLifecycleCallbacks) {
        this.callbacks.onOpen?.();
      }
    });
    this.socket.addEventListener("close", () => {
      if (!this.suppressLifecycleCallbacks) {
        this.callbacks.onClose?.();
      }
    });
    this.socket.addEventListener("error", (event) => {
      if (!this.suppressLifecycleCallbacks) {
        this.callbacks.onError?.(event);
      }
    });
    this.socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as RobotProtocolMessage;
        this.callbacks.onMessage?.(parsed);
      } catch {
        // Ignore malformed messages in test mode.
      }
    });
  }

  disconnect() {
    if (!this.socket) {
      return;
    }
    this.suppressLifecycleCallbacks = true;
    this.socket.close();
    this.socket = null;
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send<T extends GUIToRobotMessage["type"]>(
    type: T,
    payload: Extract<GUIToRobotMessage, { type: T }>["payload"],
  ) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message: GUIToRobotMessage = {
      type,
      seq: this.nextSeq(),
      ts: nowSec(),
      payload,
    } as GUIToRobotMessage;

    this.socket.send(JSON.stringify(message));
    return true;
  }

  private nextSeq() {
    const current = this.seq;
    this.seq += 1;
    return current;
  }
}

function nowSec(): ProtocolTimestampSec {
  return Date.now() / 1000;
}
