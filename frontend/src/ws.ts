export type WsMessage = Record<string, unknown>;
export type MessageHandler = (msg: WsMessage) => void;

export class JarvisWebSocket {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly handlers = new Map<string, Set<MessageHandler>>();
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.active = true;
    this._open();
  }

  disconnect(): void {
    this.active = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(msg: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: MessageHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _open(): void {
    if (!this.active) return;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[WS] Connected to", this.url);
        this.reconnectDelay = 1000;
        this._emit("connected", {});
      };

      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WsMessage;
          this._emit((msg.type as string) ?? "__unknown__", msg);
          this._emit("*", msg);
        } catch {
          console.warn("[WS] Non-JSON message ignored");
        }
      };

      this.ws.onclose = (ev) => {
        console.log(`[WS] Closed (code ${ev.code})`);
        this._emit("disconnected", { code: ev.code });
        this._scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire next — no need to duplicate
      };
    } catch (e) {
      console.error("[WS] Failed to open:", e);
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (!this.active) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this._open();
    }, this.reconnectDelay);
  }

  private _emit(event: string, msg: WsMessage): void {
    this.handlers.get(event)?.forEach((h) => h(msg));
  }
}
