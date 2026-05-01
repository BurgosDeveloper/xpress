import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import { env } from "../utils/env";

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as any)?.token ||
      (typeof socket.handshake.headers.authorization === "string" &&
      socket.handshake.headers.authorization.startsWith("Bearer ")
        ? socket.handshake.headers.authorization.slice("Bearer ".length)
        : undefined);

    if (!token) return next(new Error("UNAUTHORIZED"));

    const result = verifyAccessToken(token);
    if (!result.ok) return next(new Error("UNAUTHORIZED"));

    socket.data.user = { id: result.payload.sub, role: result.payload.role };
    return next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user?.id as string | undefined;
    if (userId) {
      socket.join(userRoom(userId));
    }
  });

  return io;
}

export function getIOOrNull() {
  return io;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload);
}

export function emitToUsers(userIds: Iterable<string>, event: string, payload: unknown) {
  if (!io) return;

  const seen = new Set<string>();
  for (const userId of userIds) {
    const normalized = typeof userId === "string" ? userId.trim() : "";
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    io.to(userRoom(normalized)).emit(event, payload);
  }
}
