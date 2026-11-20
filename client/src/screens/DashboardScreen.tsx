import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, PageHeader, Spinner } from "../components/ui";
import { Button } from "../components/Button";
import type { RoomView } from "../lib/types";
import { formatMeters } from "../utils/time";

export function DashboardScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .myRoom()
      .then((current) => {
        if (active) setRoom(current);
      })
      .catch(() => {
        /* no room is a normal state */
      })
      .finally(() => {
        if (active) setLoadingRoom(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resume = () => {
    if (!room) return;
    if (room.status === "active") navigate(`/game/${room.code}`);
    else if (room.status === "ended") navigate(`/results/${room.code}`);
    else navigate(`/lobby/${room.code}`);
  };

  const stats = user?.stats;

  return (
    <div>
      <PageHeader
        title={`Ready, ${user?.username ?? "player"}?`}
        subtitle="Create a room for your friends, or join one with a code."
        actions={
          <Badge tone={typeof navigator !== "undefined" && "geolocation" in navigator ? "green" : "red"}>
            {typeof navigator !== "undefined" && "geolocation" in navigator ? "GPS available" : "No GPS support"}
          </Badge>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-100">
          {error}
        </div>
      )}

      {loadingRoom ? (
        <Card className="mb-4 flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <span className="text-sm text-slate-400">Checking for an active room…</span>
        </Card>
      ) : room ? (
        <Card className="mb-4 border-cyan-500/30 bg-cyan-500/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">{room.name}</h2>
                <Badge tone={room.status === "active" ? "green" : room.status === "ended" ? "neutral" : "cyan"}>
                  {room.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Room <span className="font-mono text-slate-200">{room.code}</span> ·{" "}
                {room.players.length}/{room.settings.maxPlayers} players · {room.mode} mode
              </p>
            </div>
            <Button onClick={resume} variant={room.status === "active" ? "thief" : "primary"}>
              {room.status === "active" ? "Return to match" : room.status === "ended" ? "View results" : "Back to lobby"}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
          <h2 className="text-lg font-semibold text-white">Host a match</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            Pick a play area on the map, tune cooldowns and power-ups, then share the room code.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate("/create-room")}>
            Create room
          </Button>
          <p className="mt-2 text-center text-[11px] text-slate-500">Minimum 2 players • one police, at least one thief</p>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
          <h2 className="text-lg font-semibold text-white">Join with a code</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            Got a 5-character room code from a friend? Jump straight into their lobby.
          </p>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate("/join-room")}>
            Enter room code
          </Button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            You must pass the GPS accuracy check before the host can start.
          </p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Matches</div>
          <div className="mt-1 text-2xl font-bold text-white">{stats?.gamesPlayed ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Wins</div>
          <div className="mt-1 text-2xl font-bold text-emerald-300">{stats?.wins ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Captures</div>
          <div className="mt-1 text-2xl font-bold text-rose-300">{stats?.captures ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Distance</div>
          <div className="mt-1 text-2xl font-bold text-cyan-300">{formatMeters(stats?.distanceM ?? 0)}</div>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link to="/leaderboard" className="text-cyan-300 hover:text-cyan-200">
          View leaderboard →
        </Link>
        <span className="text-slate-600">·</span>
        <Link to="/profile" className="text-slate-400 hover:text-white">
          Match history
        </Link>
      </div>
    </div>
  );
}
