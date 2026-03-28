type WHEPConnectOptions = {
  timeoutMs: number;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timeout`));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export class WHEPClient {
  private readonly whepUrl: string;
  private pc: RTCPeerConnection | null = null;
  private sessionUrl: string | null = null;

  constructor(whepUrl: string) {
    this.whepUrl = whepUrl;
  }

  async connect(options: WHEPConnectOptions): Promise<MediaStream> {
    const pc = new RTCPeerConnection();
    this.pc = pc;

    if (options.onConnectionStateChange) {
      pc.addEventListener("connectionstatechange", () => {
        options.onConnectionStateChange?.(pc.connectionState);
      });
    }

    const trackPromise = withTimeout(
      new Promise<MediaStream>((resolve, reject) => {
        pc.addEventListener("track", (event) => {
          const [stream] = event.streams;
          if (event.track.kind === "video") {
            resolve(stream ?? new MediaStream([event.track]));
          }
        });

        pc.addEventListener("iceconnectionstatechange", () => {
          if (pc.iceConnectionState === "failed") {
            reject(new Error("ICE connection failed"));
          }
        });
      }),
      options.timeoutMs,
      "WHEP track",
    );

    pc.addTransceiver("video", { direction: "recvonly" });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(this.whepUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
      },
      body: pc.localDescription?.sdp ?? offer.sdp,
    });

    if (!response.ok) {
      throw new Error(`WHEP POST failed: ${response.status}`);
    }

    const location = response.headers.get("Location");
    if (location) {
      this.sessionUrl = new URL(location, this.whepUrl).toString();
    }

    const answerSdp = await response.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    return trackPromise;
  }

  async disconnect(): Promise<void> {
    if (this.sessionUrl) {
      try {
        await fetch(this.sessionUrl, { method: "DELETE" });
      } catch {
        // Ignore teardown failures.
      }
      this.sessionUrl = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // Ignore close failures.
      }
      this.pc = null;
    }
  }
}
