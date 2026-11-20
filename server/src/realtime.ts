import type { Server, Socket } from "socket.io";
import crypto from "node:crypto";
import { verifyToken } from "./auth.js";
import { engine } from "./game/engine.js";
import { store } from "./store.js";

type Ack = (payload: unknown) => void;

function reply(ack: unknown, payload: unknown): void {
  if (typeof ack === "function") (ack as Ack)(payload);
}

interface SocketData {
  userId: string;
  username: string;
}

export function initRealtime(io: Server): void {
  const channel = (code: string) => `room:${code}`;

  const broadcastRoom = (code: string) => {
    const room = engine.getRoom(code);
    if (!room) return;
    const socketIds = io.sockets.adapter.rooms.get(channel(code));
    if (!socketIds) return;
    for (const id of socketIds) {
      const socket = io.sockets.sockets.get(id);
      if (!socket) continue;
      socket.emit("game:state", engine.serializeRoom(room, socket.data.userId));
    }
  };

  engine.setChangeHandler(broadcastRoom);

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      next(new Error("unauthorized"));
      return;
    }
    const user = store.findUserById(payload.sub);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }
    (socket.data as SocketData).userId = user.id;
    (socket.data as SocketData).username = user.username;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket.data as SocketData).userId;
    const room = engine.roomOfUser(userId);
    if (room) {
      void socket.join(channel(room.code));
      engine.attachSocket(userId, socket.id);
      socket.emit("game:state", engine.serializeRoom(room, userId));
    } else {
      socket.emit("session:ready", { userId });
    }

    socket.on("room:enter", (payload: { code?: string }, ack?: Ack) => {
      const code = String(payload?.code || "").toUpperCase();
      const target = engine.getRoom(code);
      if (!target || !target.players.has(userId)) {
        reply(ack, { ok: false, error: "You are not a member of that room." });
        return;
      }
      void socket.join(channel(code));
      engine.attachSocket(userId, socket.id);
      const view = engine.serializeRoom(target, userId);
      socket.emit("game:state", view);
      reply(ack, { ok: true, room: view });
    });

    socket.on("room:leave", (_payload: unknown, ack?: Ack) => {
      const current = engine.roomOfUser(userId);
      if (current) {
        engine.leaveRoom(userId);
        void socket.leave(channel(current.code));
      }
      reply(ack, { ok: true });
    });

    socket.on(
      "game:location",
      (payload: { lat?: number; lng?: number; accuracy?: number; timestamp?: number }, ack?: Ack) => {
        const result = engine.handleLocation(userId, {
          lat: Number(payload?.lat),
          lng: Number(payload?.lng),
          accuracy: Number(payload?.accuracy),
          timestamp: Number(payload?.timestamp),
        });
        if (!result.ok) {
          reply(ack, { ok: false, error: result.error });
          return;
        }
        reply(ack, { ok: true, ...result.data });
      },
    );

    socket.on("game:scan", (_payload: unknown, ack?: Ack) => {
      const result = engine.scan(userId);
      reply(ack, result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error });
    });

    socket.on("game:radar", (_payload: unknown, ack?: Ack) => {
      const result = engine.radar(userId);
      reply(ack, result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error });
    });

    socket.on("game:capture", (payload: { targetId?: string }, ack?: Ack) => {
      const result = engine.capture(userId, String(payload?.targetId || ""));
      reply(ack, result.ok ? { ok: true } : { ok: false, error: result.error });
    });

    socket.on(
      "game:ability",
      (payload: { type?: string; lat?: number; lng?: number }, ack?: Ack) => {
        const type = payload?.type;
        if (type !== "invisibility" && type !== "decoy" && type !== "radar-shield") {
          reply(ack, { ok: false, error: "Unknown ability." });
          return;
        }
        const result = engine.useAbility(userId, type, { lat: payload.lat, lng: payload.lng });
        reply(ack, result.ok ? { ok: true, ...result.data } : { ok: false, error: result.error });
      },
    );

    socket.on("game:end", (_payload: unknown, ack?: Ack) => {
      const result = engine.endGameByHost(userId);
      reply(ack, result.ok ? { ok: true } : { ok: false, error: result.error });
    });

    socket.on("game:rejoin", (_payload: unknown, ack?: Ack) => {
      const current = engine.roomOfUser(userId);
      if (!current) {
        reply(ack, { ok: false, error: "No active room." });
        return;
      }
      void socket.join(channel(current.code));
      engine.attachSocket(userId, socket.id);
      reply(ack, { ok: true, room: engine.serializeRoom(current, userId) });
    });

    socket.on("disconnect", () => {
      engine.detachSocket(userId, socket.id);
    });
  });
}

/** Helper for tests/tools: a stable per-process socket id namespace. */
export const REALTIME_ID = crypto.randomUUID();
