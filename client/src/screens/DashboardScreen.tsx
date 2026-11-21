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
  const gpsReady = typeof navigator !== "undefined" && "geolocation" in navigator;

  const statCards = [
    { label: "Matches", value: stats?.gamesPlayed ?? 0, icon: "🎮", tone: "text-white", bar: "from-cyan-400 to-cyan-400/0" },
    { label: "Wins", value: stats?.wins ?? 0, icon: "🏆", tone: "text-emerald-300", bar: "from-emerald-400 to-emerald-400/0" },
    { label: "Captures", value: stats?.captures ?? 0, icon: "🚨", tone: "text-rose-300", bar: "from-rose-400 to-rose-400/0" },
    {
      label: "Distance",
      value: formatMeters(stats?.distanceM ?? 0),
      icon: "👟",
      tone: "text-cyan-300",
      bar: "from-violet-400 to-violet-400/0",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Ready, ${user?.username ?? "player"}?`}
        subtitle="Deploy a new hunt, or punch in a code and join the chase."
        actions={
          <Badge tone={gpsReady ? "green" : "red"}>
            <span className={`h-1.5 w-1.5 rounded-full ${gpsReady ? "bg-emerald-400" : "bg-rose-400"}`} />
            {gpsReady ? "GPS online" : "No GPS support"}
          </Badge>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/12 px-3.5 py-2.5 text-sm text-rose-100">
          {error}
        </div>
      )}

      {loadingRoom ? (
        <Card className="flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <span className="text-sm text-slate-400">Checking for an active room…</span>
        </Card>
      ) : room ? (
        <div className="panel hud-corners animate-rise relative overflow-hidden border-cyan-400/40 p-5">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(34,211,238,0.16),transparent_55%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
                  <span className="font-display text-[9px] font-bold uppercase tracking-[0.24em] text-rose-200">
                    {room.status === "active" ? "Mission in progress" : room.status === "ended" ? "Mission complete" : "Squad assembling"}
                  </span>
                </span>
                <Badge tone={room.status === "active" ? "green" : room.status === "ended" ? "neutral" : "cyan"}>
                  {room.status}
                </Badge>
              </div>
              <h2 className="font-display mt-2 truncate text-lg font-bold uppercase tracking-[0.04em] text-white">
                {room.name}
              </h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded border border-white/10 bg-ink-950/60 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.2em] text-cyan-200">
                  {room.code}
                </span>
                <span>·</span>
                <span>
                  {room.players.length}/{room.settings.maxPlayers} players
                </span>
                <span>·</span>
                <span className="capitalize">{room.mode} mode</span>
              </p>
            </div>
            <Button size="lg" onClick={resume} variant={room.status === "active" ? "thief" : "primary"}>
              {room.status === "active" ? "Return to match" : room.status === "ended" ? "View results" : "Back to lobby"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel hud-corners panel-hover group relative overflow-hidden border-cyan-400/25 p-6 animate-rise">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(34,211,238,0.14),transparent_58%)]" />
          <span className="pointer-events-none absolute -bottom-8 -right-3 select-none text-[7.5rem] leading-none opacity-[0.07] transition-transform duration-500 group-hover:scale-110">
            📡
          </span>
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-xl shadow-[0_0_26px_-10px_rgba(34,211,238,0.9)]">
                🚩
              </span>
              <div>
                <div className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300">
                  Deploy
                </div>
                <h2 className="font-display text-xl font-black uppercase tracking-[0.05em] text-white">Host a match</h2>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              Pick a play area on the map, tune cooldowns and power-ups, then share the room code with your squad.
            </p>
            <Button className="mt-5 w-full" size="lg" onClick={() => navigate("/create-room")}>
              Create room
            </Button>
            <p className="font-display mt-3 text-center text-[8px] uppercase tracking-[0.16em] text-slate-500">
              Min 2 players · 1 police · 1+ thief
            </p>
          </div>
        </div>

        <div className="panel hud-corners panel-hover group relative overflow-hidden border-emerald-400/25 p-6 animate-rise delay-100">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(52,211,153,0.14),transparent_58%)]" />
          <span className="pointer-events-none absolute -bottom-8 -right-3 select-none text-[7.5rem] leading-none opacity-[0.07] transition-transform duration-500 group-hover:scale-110">
            🥷
          </span>
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-xl shadow-[0_0_26px_-10px_rgba(52,211,153,0.9)]">
                🔑
              </span>
              <div>
                <div className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-300">
                  Enlist
                </div>
                <h2 className="font-display text-xl font-black uppercase tracking-[0.05em] text-white">
                  Join with a code
                </h2>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              Got a 5-character room code from a friend? Jump straight into their lobby and get ready to run.
            </p>
            <Button variant="secondary" className="mt-5 w-full" size="lg" onClick={() => navigate("/join-room")}>
              Enter room code
            </Button>
            <p className="font-display mt-3 text-center text-[8px] uppercase tracking-[0.16em] text-slate-500">
              GPS check required before start
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="panel relative overflow-hidden p-4">
            <span className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${stat.bar}`} />
            <div className="flex items-center justify-between">
              <span className="font-display text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {stat.label}
              </span>
              <span className="text-sm opacity-70">{stat.icon}</span>
            </div>
            <div className={`font-display mt-2 text-2xl font-bold tracking-wide ${stat.tone}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Link
          to="/leaderboard"
          className="font-display rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
        >
          🏆 Leaderboard
        </Link>
        <Link
          to="/profile"
          className="font-display rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-300 transition-colors hover:border-white/25 hover:text-white"
        >
          📜 Match history
        </Link>
      </div>
    </div>
  );
}
