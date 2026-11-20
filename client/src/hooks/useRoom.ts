import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import type { RoomView } from "../lib/types";

/**
 * Subscribes the current socket to a room channel and returns the latest
 * server-serialized room view. Every mutation event is pushed by the server.
 */
export function useRoom(code?: string) {
  const { socket, connected } = useSocket();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !code) return;
    const upper = code.toUpperCase();
    let active = true;

    const onState = (view: RoomView) => {
      if (active && view.code === upper) {
        setRoom(view);
        setError(null);
      }
    };
    const enter = () => {
      socket.emit("room:enter", { code: upper }, (ack: { ok?: boolean; error?: string; room?: RoomView }) => {
        if (!active) return;
        if (ack?.ok && ack.room) {
          setRoom(ack.room);
          setError(null);
        } else {
          setError(ack?.error ?? "Could not subscribe to this room.");
        }
      });
    };

    socket.on("game:state", onState);
    socket.on("connect", enter);
    if (socket.connected) enter();
    else setError("Connecting to the game server…");

    return () => {
      active = false;
      socket.off("game:state", onState);
      socket.off("connect", enter);
    };
  }, [socket, code]);

  return { room, setRoom, error, connected };
}
