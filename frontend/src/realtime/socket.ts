import { io, type Socket } from "socket.io-client";
import { getServerOrigin } from "../lib/apiBase";

type RealtimeHandler = (payload: any) => void;

let socket: Socket | null = null;
let currentToken: string | null = null;

const listeners = new Map<string, Set<RealtimeHandler>>();

function bindListeners(target: Socket) {
  for (const [event, handlers] of listeners.entries()) {
    for (const handler of handlers) {
      target.on(event, handler);
    }
  }
}

function unbindListeners(target: Socket) {
  for (const [event, handlers] of listeners.entries()) {
    for (const handler of handlers) {
      target.off(event, handler);
    }
  }
}

function disconnectSocket() {
  if (!socket) return;
  unbindListeners(socket);
  socket.disconnect();
  socket = null;
}

export function syncRealtimeToken(token: string | null | undefined) {
  const normalized = typeof token === "string" ? token.trim() : "";
  if (!normalized) {
    currentToken = null;
    disconnectSocket();
    return;
  }

  if (socket && currentToken === normalized) return;

  currentToken = normalized;
  disconnectSocket();

  const next = io(getServerOrigin(), {
    auth: { token: normalized },
    withCredentials: true,
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  bindListeners(next);
  next.on("connect_error", () => {
    // best-effort
  });

  socket = next;
}

export function subscribeRealtimeEvent(event: string, handler: RealtimeHandler) {
  const normalizedEvent = event.trim();
  if (!normalizedEvent) return () => {};

  const set = listeners.get(normalizedEvent) ?? new Set<RealtimeHandler>();
  set.add(handler);
  listeners.set(normalizedEvent, set);

  socket?.on(normalizedEvent, handler);

  return () => {
    socket?.off(normalizedEvent, handler);
    const current = listeners.get(normalizedEvent);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) listeners.delete(normalizedEvent);
  };
}