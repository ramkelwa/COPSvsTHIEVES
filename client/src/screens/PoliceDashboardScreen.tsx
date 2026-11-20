import { useState } from "react";
import { Badge, Button, Card, StatTile } from "../components";
import { EventFeed } from "../components/EventFeed";
import { GameMap, type MapPlayer } from "../components/GameMap";
import type { RoomView } from "../lib/types";
import { getPolygonCenter } from "../utils/geo";
import { formatAgo, formatClock, formatMeters } from "../utils/time";
import type { GeoFix } from "../utils/gps";

export interface PoliceDashboardProps {
  room: RoomView;
  now: number;
  fix: GeoFix | null;
  onScan: () => Promise<void> | void;
  scanning: boolean;
  onCapture: (targetId: string) => Promise<void> | void;
  capturingId: string | null;
  onRadar: () => Promise<void> | void;
  radaring: boolean;
}

export function PoliceDashboard({
  room,
  now,
  fix,
  onScan,
  scanning,
  onCapture,
  capturingId,
  onRadar,
  radaring,
}: PoliceDashboardProps) {
  const me = room.me;
  const [focusId, setFocusId] = useState<string | null>(null);
  const thieves = room.players.filter((p) => p.role === "thief");
  const captured = thieves.filter((p) => p.status !== "alive");
  const aliveThieves = thieves.filter((p) => p.status === "alive");
  const intel = room.intel.players;
  const focus = intel.find((t) => t.id === focusId) ?? null;
  const scanIn = Math.max(0, (me?.cooldowns?.scan ?? 0) - now);
  const radarIn = Math.max(0, (me?.cooldowns?.radar ?? 0) - now);
  const captureIn = Math.max(0, (me?.cooldowns?.capture ?? 0) - now);
  const boundary = room.settings.boundary;
  const mapCenter = focus
    ? { lat: focus.lat, lng: focus.lng }
    : fix
      ? { lat: fix.lat, lng: fix.lng }
      : boundary.type === "circle"
        ? boundary.center
        : getPolygonCenter(boundary.points);

  const mapPlayers: MapPlayer[] = [
    ...(fix
      ? [{ id: "self", username: "You", lat: fix.lat, lng: fix.lng, kind: "self" as const, accuracy: fix.accuracy }]
      : []),
    ...room.players
      .filter((p) => p.role === "police" && p.id !== me?.id && p.location)
      .map((p) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        lat: p.location!.lat,
        lng: p.location!.lng,
        kind: "police" as const,
        accuracy: p.location!.accuracy,
        at: p.location!.at,
        note: "Teammate · live position",
      })),
    ...intel.map((t) => ({
      id: t.id,
      username: t.username,
      avatar: t.avatar,
      lat: t.lat,
      lng: t.lng,
      kind: (t.decoy ? "decoy" : "thief") as MapPlayer["kind"],
      accuracy: t.accuracy,
      at: t.at,
      note: t.decoy ? "Decoy signal — not necessarily the thief" : "Last scanned position",
    })),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Remaining" value={room.remainingThieves} tone="text-emerald-300" hint={`${room.totalThieves} at start`} />
          <StatTile label="Captured" value={captured.length} tone="text-rose-300" />
          <StatTile label="Your captures" value={me?.captures ?? 0} tone="text-cyan-300" />
        </div>

        <Card className="p-3">
          <GameMap
            center={mapCenter}
            zoom={focus ? 17 : 16}
            boundary={boundary}
            safeZones={room.safeZones}
            players={mapPlayers}
            className="h-72 sm:h-96"
            showSelfAccuracy
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[11px] text-slate-500">
              {focus ? `Focused on ${focus.username}` : "Thief markers are last-known positions from scans."}
            </p>
            {focus && (
              <button type="button" className="text-[11px] text-cyan-300 underline" onClick={() => setFocusId(null)}>
                Back to my position
              </button>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Thief intel ({intel.length})
            </h2>
            <span className="text-[11px] text-slate-500">
              Scan cooldown {room.settings.scanCooldownSec}s
            </span>
          </div>

          {intel.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-ink-900/40 px-4 py-6 text-center">
              <p className="text-sm text-slate-300">No thief positions yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Press Scan to reveal every active thief's latest reported position. Positions are snapshots, not live
                tracking.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {intel.map((thief) => {
                const roster = room.players.find((p) => p.id === thief.id);
                const out = roster?.status !== "alive";
                return (
                  <li
                    key={thief.id}
                    className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      focusId === thief.id ? "border-cyan-500/40 bg-cyan-500/[0.06]" : "border-white/5 bg-ink-900/50"
                    }`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-base">{thief.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className="truncate text-sm font-semibold text-white hover:text-cyan-300"
                          onClick={() => setFocusId(thief.id)}
                        >
                          {thief.username}
                        </button>
                        {thief.decoy && <Badge tone="violet">DECOY?</Badge>}
                        {out && <Badge tone="red">OUT</Badge>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {formatAgo(thief.at, now)} · ±{Math.round(thief.accuracy)} m
                        {thief.distanceM !== undefined ? ` · ${formatMeters(thief.distanceM)} away` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={out || capturingId === thief.id || captureIn > 0}
                      onClick={() => onCapture(thief.id)}
                      title={captureIn > 0 ? "Capture cooling down" : "Attempt capture"}
                    >
                      {out ? "Out" : capturingId === thief.id ? "…" : "Capture"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Captures are verified on the server: both GPS fixes must be fresh, accurate, and within{" "}
            {room.settings.captureRadiusM} m (plus a small GPS tolerance).
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Actions</h2>
          <Button className="mt-3 w-full" onClick={onScan} disabled={scanning || scanIn > 0}>
            {scanning ? "Scanning…" : scanIn > 0 ? `Scan ready in ${formatClock(scanIn)}` : "📡 Scan for thieves"}
          </Button>
          {room.settings.radar && (
            <Button
              className="mt-2 w-full"
              variant="secondary"
              onClick={onRadar}
              disabled={radaring || radarIn > 0}
            >
              {radaring
                ? "Sweeping…"
                : radarIn > 0
                  ? `Radar ready in ${formatClock(radarIn)}`
                  : `📶 Radar sweep (${room.settings.radarRadiusM} m)`}
            </Button>
          )}
          {captureIn > 0 && (
            <p className="mt-2 text-center text-[11px] text-slate-500">Capture cooldown {formatClock(captureIn)}</p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {me?.location
              ? "Your location is being shared with the room while the match runs."
              : "Waiting for your GPS fix — actions unlock once the server receives it."}
          </p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Captured ({captured.length})
          </h2>
          {captured.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">None yet. {aliveThieves.length} still out there.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              {captured.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>
                    {p.avatar} {p.username}
                  </span>
                  <Badge tone="red">OUT</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <EventFeed events={room.events} />
        </Card>
      </div>
    </div>
  );
}
