import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

export interface AckResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  emitAck: (event: string, payload?: unknown) => Promise<AckResult>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside <SocketProvider>");
  return ctx;
}

/**
 * One authenticated Socket.IO connection per logged-in tab. The room channel is
 * joined by `useRoom` so screens only receive state for the room they render.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }
    const next = io({
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    next.on("connect", onConnect);
    next.on("disconnect", onDisconnect);
    if (next.connected) setConnected(true);
    setSocket(next);
    return () => {
      next.off("connect", onConnect);
      next.off("disconnect", onDisconnect);
      next.disconnect();
    };
  }, [token]);

  const emitAck = useCallback(
    (event: string, payload?: unknown) =>
      new Promise<AckResult>((resolve) => {
        if (!socket || !socket.connected) {
          resolve({ ok: false, error: "Not connected to the game server." });
          return;
        }
        socket.timeout(8000).emit(event, payload, (err: Error | null, response?: AckResult) => {
          if (err) {
            resolve({ ok: false, error: "The server did not respond in time." });
            return;
          }
          resolve(response ?? { ok: false, error: "Empty response from the server." });
        });
      }),
    [socket],
  );

  const value = useMemo(() => ({ socket, connected, emitAck }), [socket, connected, emitAck]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
