export type WsChannel = 'monitor' | `logs/${string}` | `rcon/${string}`;

interface WsMessage {
    type: string;
    seq?: number;
    data: unknown;
    ts?: number;
}

type MessageHandler = (msg: WsMessage) => void;

const WS_BASE = import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private channel: WsChannel;
    private handlers: Set<MessageHandler> = new Set();
    private lastSeq = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 1000;
    private maxReconnectDelay = 30000;
    private intentionalClose = false;
    private _status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
    private statusListeners: Set<(status: string) => void> = new Set();

    constructor(channel: WsChannel) {
        this.channel = channel;
    }

    get status() { return this._status; }

    private setStatus(s: typeof this._status) {
        this._status = s;
        this.statusListeners.forEach(fn => fn(s));
    }

    onStatusChange(fn: (status: string) => void) {
        this.statusListeners.add(fn);
        return () => { this.statusListeners.delete(fn); };
    }

    onMessage(fn: MessageHandler) {
        this.handlers.add(fn);
        return () => { this.handlers.delete(fn); };
    }

    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;
        this.intentionalClose = false;

        const token = localStorage.getItem('ccpanel_token') || '';
        const url = `${WS_BASE}/ws/v1/${this.channel}?token=${encodeURIComponent(token)}&last_seq=${this.lastSeq}`;

        this.setStatus(this.lastSeq > 0 ? 'reconnecting' : 'connecting');
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.setStatus('connected');
            this.reconnectDelay = 1000;
        };

        this.ws.onmessage = (event) => {
            try {
                const msg: WsMessage = JSON.parse(event.data);
                if (msg.seq && msg.seq > this.lastSeq) {
                    this.lastSeq = msg.seq;
                }
                this.handlers.forEach(fn => fn(msg));
            } catch {
                // ignore malformed messages
            }
        };

        this.ws.onclose = () => {
            if (this.intentionalClose) {
                this.setStatus('disconnected');
                return;
            }
            this.setStatus('reconnecting');
            this.scheduleReconnect();
        };

        this.ws.onerror = () => {
            this.ws?.close();
        };
    }

    send(data: unknown) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    disconnect() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close();
        this.ws = null;
        this.setStatus('disconnected');
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
        }, this.reconnectDelay);
    }

    resetSeq() {
        this.lastSeq = 0;
    }
}
