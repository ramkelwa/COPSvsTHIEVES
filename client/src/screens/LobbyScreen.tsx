import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useRoom } from "../hooks/useRoom";
import { useNow } from "../hooks/useNow";
import { Button } from "../components/Button";
import { GameMap } from "../components/GameMap";
import { Alert, Badge, Card, Divider, Field, PageHeader, Select, Spinner } from "../components/ui";
import type { Boundary, Role, RoomSettings, RoomView } from "../lib/types";
import { getPolygonCenter } from "../utils/geo";
import { formatClock } from "../utils/time";

const GPS_MAX_AGE_MS = 15 * 60_000;

export function LobbyScreen() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { room, error: roomError } = useRoom(code);
  const now = useNow(1000);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, Role>>({});
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (room?.status === "active") navigate(`/game/${room.code}`, { replace: true });
    if (room?.status === "ended") navigate(`/results/${room.code}`, { replace: true });
  }, [room?.status, room?.code, navigate]);

  const isHost = Boolean(room && user && room.hostId === user.id);
  const me = room?.me ?? null;
  const threshold = room?.settings.maxAccuracyM ?? 50;

  const gpsOk = (check: { accuracy: number; at: number } | null | undefined) =>
    Boolean(check && now - check.at < GPS_MAX_AGE_MS && check.accuracy <= threshold);

  const readiness = useMemo(() => {
    if (!room) return { allReady: false, allConnected: false, allGps: false, enoughPlayers: false, reasons: [] as string[] };
    const players = room.players;
    const enoughPlayers = players.length >= 2;
    const allReady = players.every((p) => p.isHost || p.ready);
    const allConnected = players.every((p) => p.connected);
    const missingGps = players.filter((p) => !gpsOk(p.gpsCheck));
    const reasons: string[] = [];
    if (!enoughPlayers) reasons.push("At least 2 players are needed.");
    if (!allReady) reasons.push(`Waiting for ${players.filter((p) => !p.isHost && !p.ready).map((p) => p.username).join(", ")} to ready up.`);
    if (!allConnected) reasons.push("A player is disconnected.");
    if (missingGps.length > 0)
      reasons.push(`GPS check needed for ${missingGps.map((p) => p.username).join(", ")} (≤ ${threshold} m).`);
    return { allReady, allConnected, allGps: missingGps.length === 0, enoughPlayers, reasons };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, now, threshold]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  };

  const share = async () => {
    if (!room) return;
    const url = `${window.location.origin}/join-room?code=${room.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Cops vs Thieves", text: `Join my room ${room.code}`, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    copy(url, "link");
  };

  const toggleManual = async () => {
    if (!room) return;
    if (manual) {
      setManual(false);
      await run("roles", () => api.resetRoles(room.code));
      return;
    }
    const initial = Object.fromEntries(
      room.players.map((p) => [p.id, p.role ?? (p.isHost ? "police" : "thief")]),
    ) as Record<string, Role>;
    setAssignments(initial);
    setManual(true);
  };

  const cycleRole = (playerId: string) => {
    setAssignments((prev) => ({ ...prev, [playerId]: prev[playerId] === "police" ? "thief" : "police" }));
  };

  const saveRoles = () => {
    if (!room) return;
    const police = Object.values(assignments).filter((r) => r === "police").length;
    const thieves = Object.values(assignments).filter((r) => r === "thief").length;
    if (police < 1 || thieves < 1) {
      setActionError("Assign at least one police and one thief.");
      return;
    }
    run("roles", () => api.assignRoles(room.code, assignments));
  };

  if (!room) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Spinner className="h-10 w-10" />
        <p className="mt-4 text-sm text-slate-400">{roomError ?? "Joining room channel…"}</p>
        {roomError && (
          <>
            <Button variant="secondary" className="mt-4" onClick={() => navigate("/dashboard")}>
              Back to dashboard
            </Button>
            {code && (
              <p className="mt-3 text-xs text-slate-500">
                Not in this room?{" "}
                <Link to={`/join-room?code=${code}`} className="text-cyan-300 underline">
                  Join it
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  const boundary: Boundary = room.settings.boundary;
  const mapCenter = boundary.type === "circle" ? boundary.center : getPolygonCenter(boundary.points);
  const selfHasGps = gpsOk(me?.gpsCheck);

  return (
    <div>
      <PageHeader
        title={room.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>Lobby · host {room.players.find((p) => p.isHost)?.username ?? "—"}</span>
            <Badge tone={room.status === "lobby" ? "cyan" : "green"}>{room.status}</Badge>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 font-mono text-sm font-bold tracking-[0.3em] text-cyan-200">
              {room.code}
            </span>
            <Button size="sm" variant="secondary" onClick={() => copy(room.code, "code")}>
              {copied === "code" ? "Copied" : "Copy code"}
            </Button>
          </div>
        }
      />

      {actionError && (
        <Alert tone="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {!selfHasGps && (
        <Alert tone="warn" className="mb-4">
          Your GPS check is missing or below the host threshold (±{threshold} m).{" "}
          <Link to={`/gps-permission?next=${encodeURIComponent(`/lobby/${room.code}`)}`} className="font-semibold underline">
            Run the GPS check
          </Link>{" "}
          — the host cannot start without it.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Players ({room.players.length}/{room.settings.maxPlayers})
              </h2>
              <span className="text-xs text-slate-500">
                {room.totalPolice} police · {room.totalThieves} thieves
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {room.players.map((player) => {
                const check = player.gpsCheck;
                const ok = gpsOk(check);
                const role = manual && isHost ? assignments[player.id] : player.role;
                return (
                  <li
                    key={player.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-ink-900/50 px-3 py-2.5"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-lg">
                      {player.avatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-white">{player.username}</span>
                        {player.id === user?.id && <span className="text-[10px] text-cyan-300">YOU</span>}
                        {player.isHost && <Badge tone="violet">HOST</Badge>}
                        {!player.connected && <Badge tone="red">offline</Badge>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className={player.ready || player.isHost ? "text-emerald-300" : ""}>
                          {player.ready || player.isHost ? "Ready" : "Not ready"}
                        </span>
                        <span>·</span>
                        {check ? (
                          <span className={ok ? "text-emerald-300" : "text-rose-300"}>
                            GPS ±{Math.round(check.accuracy)} m{now - check.at >= GPS_MAX_AGE_MS ? " (expired)" : ""}
                          </span>
                        ) : (
                          <span className="text-amber-300">GPS unchecked</span>
                        )}
                      </div>
                    </div>

                    {isHost && manual && !player.isHost ? (
                      <button
                        type="button"
                        onClick={() => cycleRole(player.id)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          role === "police"
                            ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                        }`}
                        title="Click to switch role"
                      >
                        {role ?? "thief"}
                      </button>
                    ) : role ? (
                      <Badge tone={role === "police" ? "blue" : "green"}>{role}</Badge>
                    ) : (
                      <Badge tone="neutral">role hidden</Badge>
                    )}
                  </li>
                );
              })}
            </ul>

            {room.players.length < 2 && (
              <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                Invite at least one more player. A match needs one police and at least one thief.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Invite</h2>
            <p className="mt-2 text-xs text-slate-500">
              Anyone with this code can join from the Join Room screen. The link opens it pre-filled.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => copy(`${window.location.origin}/join-room?code=${room.code}`, "link")}>
                {copied === "link" ? "Link copied" : "Copy invite link"}
              </Button>
              <Button size="sm" variant="secondary" onClick={share}>
                Share
              </Button>
            </div>
          </Card>

          {isHost && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Role assignment</h2>
                <Button size="sm" variant={manual ? "primary" : "secondary"} onClick={toggleManual} disabled={busy === "roles"}>
                  {manual ? "Use automatic" : "Assign manually"}
                </Button>
              </div>
              {manual ? (
                <>
                  <p className="mt-2 text-xs text-slate-500">
                    Click a player's role to switch it. Everyone must be assigned; roles are revealed when the match starts.
                  </p>
                  <Button size="sm" className="mt-3" onClick={saveRoles} disabled={busy === "roles"}>
                    {busy === "roles" ? "Saving…" : "Save roles"}
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Roles are shuffled automatically at start: {room.settings.mode === "classic" ? "1 police" : `${room.settings.policeCount} police`} and the rest thieves.
                </p>
              )}
            </Card>
          )}

          {isHost && (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Match settings</h2>
                <Button size="sm" variant="ghost" onClick={() => setShowSettings((v) => !v)}>
                  {showSettings ? "Hide" : "Edit"}
                </Button>
              </div>
              {showSettings ? (
                <HostSettings
                  room={room}
                  busy={busy === "settings"}
                  onSave={(patch) => run("settings", () => api.updateSettings(room.code, patch))}
                />
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {Math.round(room.settings.durationSec / 60)} min · scan {room.settings.scanCooldownSec}s · police reveal{" "}
                  {room.settings.policeRevealSec}s · capture {room.settings.captureRadiusM} m · GPS ±
                  {room.settings.maxAccuracyM} m · grace {room.settings.boundaryGraceSec}s
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-3">
            <GameMap
              center={mapCenter}
              zoom={boundary.type === "circle" ? 15 : 14}
              boundary={boundary}
              safeZones={room.safeZones}
              className="h-56"
              showSelfAccuracy={false}
            />
            <p className="mt-2 px-1 text-[11px] text-slate-500">
              Play area preview. No positions are shared in the lobby — tracking starts with the match.
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Match starts</span>
              <span className="font-mono text-white">{formatClock(room.settings.durationSec * 1000)}</span>
            </div>
            <Divider className="my-3" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Your role</span>
              <span className="text-white">
                {manual && isHost && user ? (assignments[user.id] ?? "—") : (me?.role ?? "auto at start")}
              </span>
            </div>
            <Divider className="my-3" />
            <div className="text-sm">
              <span className="text-slate-400">Start checklist</span>
              <ul className="mt-1.5 space-y-1 text-[11px]">
                <Check ok={readiness.enoughPlayers} label="At least 2 players" />
                <Check ok={readiness.allReady} label="Everyone ready" />
                <Check ok={readiness.allConnected} label="Everyone connected" />
                <Check ok={readiness.allGps} label={`Everyone passed GPS (≤ ${threshold} m)`} />
              </ul>
            </div>

            {isHost ? (
              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={() => run("start", () => api.startGame(room.code))}
                disabled={!readiness.enoughPlayers || !readiness.allReady || !readiness.allConnected || !readiness.allGps || busy === "start"}
              >
                {busy === "start" ? "Starting…" : "Start match"}
              </Button>
            ) : (
              <Button
                className="mt-4 w-full"
                size="lg"
                variant={me?.ready ? "secondary" : "primary"}
                onClick={() => run("ready", () => api.setReady(room.code, !me?.ready))}
                disabled={busy === "ready"}
              >
                {me?.ready ? "Cancel ready" : "Ready up"}
              </Button>
            )}

            {isHost && readiness.reasons.length > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-300/90">{readiness.reasons[0]}</p>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-slate-400"
              onClick={() => run("leave", async () => {
                await api.leaveRoom(room.code);
                navigate("/dashboard");
              })}
              disabled={busy === "leave"}
            >
              Leave room
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "text-emerald-300" : "text-slate-500"}>
      <span className="mr-1">{ok ? "✓" : "○"}</span>
      {label}
    </li>
  );
}

function HostSettings({
  room,
  busy,
  onSave,
}: {
  room: RoomView;
  busy: boolean;
  onSave: (patch: Partial<RoomSettings>) => void;
}) {
  const [durationMin, setDurationMin] = useState(Math.round(room.settings.durationSec / 60));
  const [scan, setScan] = useState(room.settings.scanCooldownSec);
  const [reveal, setReveal] = useState(room.settings.policeRevealSec);
  const [capture, setCapture] = useState(room.settings.captureRadiusM);
  const [accuracy, setAccuracy] = useState(room.settings.maxAccuracyM);
  const [grace, setGrace] = useState(room.settings.boundaryGraceSec);
  const [headStart, setHeadStart] = useState(room.settings.headStartSec);
  const [radar, setRadar] = useState(room.settings.radar);
  const [abilities, setAbilities] = useState(room.settings.abilities);

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Duration (min)">
        <Select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
          {[5, 10, 15, 20, 30, 45, 60].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Head start (sec)">
        <Select value={headStart} onChange={(e) => setHeadStart(Number(e.target.value))}>
          {[0, 30, 60, 120].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "None" : `${n}s`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Scan cooldown (sec)">
        <Select value={scan} onChange={(e) => setScan(Number(e.target.value))}>
          {[10, 20, 30, 45, 60, 120].map((n) => (
            <option key={n} value={n}>
              {n}s
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Police reveal (sec)">
        <Select value={reveal} onChange={(e) => setReveal(Number(e.target.value))}>
          {[30, 60, 90, 120, 180].map((n) => (
            <option key={n} value={n}>
              {n}s
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Capture radius (m)">
        <Select value={capture} onChange={(e) => setCapture(Number(e.target.value))}>
          {[10, 15, 20, 30, 40, 50].map((n) => (
            <option key={n} value={n}>
              {n} m
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Required accuracy">
        <Select value={accuracy} onChange={(e) => setAccuracy(Number(e.target.value))}>
          {[25, 30, 50, 75, 100].map((n) => (
            <option key={n} value={n}>
              ±{n} m
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Boundary grace (sec)">
        <Select value={grace} onChange={(e) => setGrace(Number(e.target.value))}>
          {[10, 15, 20, 30, 45].map((n) => (
            <option key={n} value={n}>
              {n}s
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end gap-4 pb-1 text-xs text-slate-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={radar} onChange={(e) => setRadar(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
          Radar
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={abilities}
            onChange={(e) => setAbilities(e.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          Abilities
        </label>
      </div>
      <Button
        className="sm:col-span-2"
        size="sm"
        disabled={busy}
        onClick={() =>
          onSave({
            durationSec: durationMin * 60,
            scanCooldownSec: scan,
            policeRevealSec: reveal,
            captureRadiusM: capture,
            maxAccuracyM: accuracy,
            boundaryGraceSec: grace,
            headStartSec: headStart,
            radar,
            abilities,
          })
        }
      >
        {busy ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
