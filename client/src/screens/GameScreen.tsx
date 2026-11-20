import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useSocket } from "../context/SocketContext";
import { useRoom } from "../hooks/useRoom";
import { useNow } from "../hooks/useNow";
import { useGeolocation } from "../hooks/useGeolocation";
import { Badge, Button, Spinner } from "../components";
import { Alert } from "../components/ui";
import { PoliceDashboard } from "./PoliceDashboardScreen";
import { ThievesDashboard } from "./ThievesDashboardScreen";
import { formatClock } from "../utils/time";

type AbilityType = "invisibility" | "radar-shield" | "decoy";

export function GameScreen() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { room, error: roomError } = useRoom(code);
  const { emitAck } = useSocket();
  const now = useNow(500);

  const active = room?.status === "active";
  const me = room?.me ?? null;
  const alive = me?.status === "alive";
  const { fix, error: geoError, supported: geoSupported } = useGeolocation(Boolean(active && alive));

  const [revealVisible, setRevealVisible] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [radaring, setRadaring] = useState(false);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [busyAbility, setBusyAbility] = useState<AbilityType | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (room?.status === "lobby") navigate(`/lobby/${room.code}`, { replace: true });
    if (room?.status === "ended") navigate(`/results/${room.code}`, { replace: true });
  }, [room?.status, room?.code, navigate]);

  // Show the role once per match/tab.
  useEffect(() => {
    if (!room || room.status !== "active" || !room.me?.role) return;
    const key = `cvt.reveal.${room.code}.${room.me.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setRevealVisible(true);
    const timer = setTimeout(() => setRevealVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [room?.status, room?.me?.role, room?.code, room?.me?.id]);

  // Stream GPS to the server for as long as the player is alive in an active match.
  useEffect(() => {
    if (!fix || !room || room.status !== "active" || room.me?.status !== "alive") return;
    const interval = Math.max(1500, room.settings.locationIntervalMs);
    const stamp = Date.now();
    if (stamp - lastSent.current < interval) return;
    lastSent.current = stamp;
    void emitAck("game:location", {
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
      timestamp: Date.now(),
    }).then((res) => {
      setSendError(res.ok ? null : (res.error ?? "Location update rejected."));
    });
  }, [fix, room?.status, room?.code, room?.me?.status, room?.settings.locationIntervalMs, emitAck]);

  const scan = async () => {
    setScanning(true);
    setActionError(null);
    const res = await emitAck("game:scan");
    if (!res.ok) setActionError(res.error ?? "Scan failed.");
    setScanning(false);
  };

  const radar = async () => {
    setRadaring(true);
    setActionError(null);
    const res = await emitAck("game:radar");
    if (!res.ok) setActionError(res.error ?? "Radar failed.");
    setRadaring(false);
  };

  const capture = async (targetId: string) => {
    setCapturingId(targetId);
    setActionError(null);
    const res = await emitAck("game:capture", { targetId });
    if (!res.ok) setActionError(res.error ?? "Capture failed.");
    setCapturingId(null);
  };

  const ability = async (type: AbilityType) => {
    setBusyAbility(type);
    setActionError(null);
    const payload: Record<string, unknown> = { type };
    if (type === "decoy" && fix) {
      payload.lat = fix.lat;
      payload.lng = fix.lng;
    }
    const res = await emitAck("game:ability", payload);
    if (!res.ok) setActionError(res.error ?? "Ability failed.");
    setBusyAbility(null);
  };

  const leave = async () => {
    if (!room) return;
    if (!window.confirm("Leave the match? You will be marked OUT.")) return;
    try {
      await api.leaveRoom(room.code);
    } catch {
      /* leaving still navigates */
    }
    navigate("/dashboard");
  };

  if (!room) {
    return (
      <div className="py-20 text-center">
        <Spinner className="h-10 w-10" />
        <p className="mt-4 text-sm text-slate-400">{roomError ?? "Connecting to the match…"}</p>
        {roomError && (
          <Button variant="secondary" className="mt-4" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </Button>
        )}
      </div>
    );
  }

  if (!me?.role) {
    return (
      <div className="py-20 text-center">
        <Spinner className="h-10 w-10" />
        <p className="mt-4 text-sm text-slate-400">Assigning roles…</p>
      </div>
    );
  }

  const isPolice = me.role === "police";
  const endsIn = room.endsAt ? Math.max(0, room.endsAt - now) : 0;
  const graceEndsAt = me.outsideGraceEndsAt ?? 0;
  const outside = !isOut(me.status) && graceEndsAt > now;
  const headStartEnds = room.startedAt && room.settings.headStartSec > 0
    ? room.startedAt + room.settings.headStartSec * 1000
    : 0;
  const inHeadStart = headStartEnds > now;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isPolice ? "blue" : "green"}>{isPolice ? "🚔 POLICE" : "🥷 THIEF"}</Badge>
          <span className="text-xs text-slate-500">Room {room.code}</span>
          {inHeadStart && <Badge tone="amber">Head start {formatClock(headStartEnds - now)}</Badge>}
          {!geoSupported && <Badge tone="red">No GPS support</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Time left</div>
            <div className="font-mono text-lg font-bold text-white">{formatClock(endsIn)}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={leave}>
            Leave
          </Button>
        </div>
      </div>

      {geoError && (
        <Alert tone="error">
          GPS problem: {geoError} Location tracking is required during a match — enable location and reload.
        </Alert>
      )}
      {!geoError && !fix && (
        <Alert tone="info">Waiting for your first GPS fix… keep the app in the foreground.</Alert>
      )}
      {sendError && <Alert tone="warn">{sendError}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {outside && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-500/15 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-rose-100">You are outside the play area!</span>
            <span className="font-mono text-lg font-bold text-rose-100">{formatClock(graceEndsAt - now)}</span>
          </div>
          <p className="mt-1 text-xs text-rose-100/80">Return inside the boundary before the timer ends or you are OUT.</p>
        </div>
      )}

      {me.status !== "alive" && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          You are OUT of this match. You can spectate the rest of the round.
        </div>
      )}

      {isPolice ? (
        <PoliceDashboard
          room={room}
          now={now}
          fix={fix}
          onScan={scan}
          scanning={scanning}
          onCapture={capture}
          capturingId={capturingId}
          onRadar={radar}
          radaring={radaring}
        />
      ) : (
        <ThievesDashboard room={room} now={now} fix={fix} onAbility={ability} busyAbility={busyAbility} />
      )}

      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        Location sharing is active only while this match runs. It stops automatically when the game ends.
      </p>

      {revealVisible && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/95 p-5 backdrop-blur">
          <div
            className={`w-full max-w-sm rounded-3xl border p-7 text-center ${
              isPolice ? "border-blue-500/40 bg-blue-500/10" : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <div className="text-6xl">{isPolice ? "🚔" : "🥷"}</div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
              {isPolice ? "You are POLICE" : "You are a THIEF"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {isPolice
                ? `Scan every ${room.settings.scanCooldownSec}s to find thieves, then get within ${room.settings.captureRadiusM} m to capture them.`
                : `Stay inside the boundary and survive until the timer runs out. Police reveal their last-known position every ${room.settings.policeRevealSec}s.`}
            </p>
            <p className="mt-3 text-[11px] text-slate-400">
              Your role is fixed for this match. GPS sharing starts now.
            </p>
            <Button className="mt-5 w-full" size="lg" onClick={() => setRevealVisible(false)}>
              Enter the field
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function isOut(status: string): boolean {
  return status !== "alive";
}
