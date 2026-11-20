import { Badge, Button, Card, StatTile } from "../components";
import { EventFeed } from "../components/EventFeed";
import { GameMap, type MapPlayer } from "../components/GameMap";
import type { RoomView } from "../lib/types";
import { getPolygonCenter } from "../utils/geo";
import { formatAgo, formatClock } from "../utils/time";
import type { GeoFix } from "../utils/gps";

type AbilityType = "invisibility" | "radar-shield" | "decoy";

export interface ThievesDashboardProps {
  room: RoomView;
  now: number;
  fix: GeoFix | null;
  onAbility: (type: AbilityType) => Promise<void> | void;
  busyAbility: AbilityType | null;
}

const ABILITY_META: Record<AbilityType, { icon: string; label: string; desc: string }> = {
  invisibility: {
    icon: "👻",
    label: "Invisibility",
    desc: "Hidden from police scans and radar for 20s.",
  },
  "radar-shield": {
    icon: "🛡️",
    label: "Radar shield",
    desc: "Blocks radar detection for 60s.",
  },
  decoy: {
    icon: "🎭",
    label: "Decoy",
    desc: "Leaves a fake marker at your position for 45s.",
  },
};

export function ThievesDashboard({ room, now, fix, onAbility, busyAbility }: ThievesDashboardProps) {
  const me = room.me;
  const policeIntel = room.intel.players;
  const boundary = room.settings.boundary;
  const endsIn = room.endsAt ? Math.max(0, room.endsAt - now) : 0;
  const revealIn = room.intel.nextAt ? Math.max(0, room.intel.nextAt - now) : 0;
  const isOut = me?.status !== "alive";
  const mapCenter = fix
    ? { lat: fix.lat, lng: fix.lng }
    : boundary.type === "circle"
      ? boundary.center
      : getPolygonCenter(boundary.points);

  const mapPlayers: MapPlayer[] = [
    ...(fix
      ? [{ id: "self", username: "You", lat: fix.lat, lng: fix.lng, kind: "self" as const, accuracy: fix.accuracy }]
      : []),
    ...policeIntel.map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      lat: p.lat,
      lng: p.lng,
      kind: "police" as const,
      accuracy: p.accuracy,
      at: p.at,
      note: "Last-known police position — not live",
    })),
  ];

  const lastBoundaryWarning = [...room.events]
    .reverse()
    .find((event) => event.type === "boundary-warning" && event.playerId === me?.id);
  const warningRecent = lastBoundaryWarning && now - lastBoundaryWarning.at < 30_000;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Time left" value={formatClock(endsIn)} tone="text-cyan-300" />
          <StatTile label="Thieves left" value={room.remainingThieves} tone="text-emerald-300" hint={`of ${room.totalThieves}`} />
          <StatTile
            label="Your status"
            value={isOut ? "OUT" : "Alive"}
            tone={isOut ? "text-rose-300" : "text-emerald-300"}
          />
        </div>

        {warningRecent && lastBoundaryWarning && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-100">
            ⚠️ {lastBoundaryWarning.message}
            {me?.outsideGraceEndsAt && me.outsideGraceEndsAt > now ? (
              <span className="ml-1 font-semibold">
                Return within {formatClock(me.outsideGraceEndsAt - now)}.
              </span>
            ) : null}
          </div>
        )}

        <Card className="p-3">
          <GameMap
            center={mapCenter}
            zoom={16}
            boundary={boundary}
            safeZones={room.safeZones}
            players={mapPlayers}
            className="h-72 sm:h-96"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[11px] text-slate-500">Green ring is the play area. Purple/green markers are other players.</p>
            <Badge tone="amber">Police positions are last-known</Badge>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Police intel</h2>
            <span className="text-[11px] text-slate-500">
              {room.intel.at ? `Shared ${formatAgo(room.intel.at, now)}` : "Waiting for first reveal"} · next in{" "}
              {formatClock(revealIn)}
            </span>
          </div>

          {policeIntel.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-ink-900/40 px-4 py-5 text-center text-xs text-slate-500">
              No police position has been shared yet. The first reveal happens as soon as police GPS reaches the
              server, then every {room.settings.policeRevealSec}s.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {policeIntel.map((cop) => (
                <li key={cop.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-ink-900/50 px-3 py-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-500/15 text-base">{cop.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{cop.username}</div>
                    <div className="text-[11px] text-slate-500">
                      Last known {formatAgo(cop.at, now)} · ±{Math.round(cop.accuracy)} m
                    </div>
                  </div>
                  <Badge tone="blue">POLICE</Badge>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            This is a snapshot from the last reveal — police may have moved. Do not treat it as live tracking.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Abilities</h2>
          {!room.settings.abilities ? (
            <p className="mt-2 text-xs text-slate-500">Abilities are disabled for this match.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {(Object.keys(ABILITY_META) as AbilityType[]).map((type) => {
                const meta = ABILITY_META[type];
                const readyAt = me?.cooldowns?.[type] ?? 0;
                const cooldownLeft = Math.max(0, readyAt - now);
                const activeUntil =
                  type === "invisibility"
                    ? (me?.invisibilityUntil ?? 0)
                    : type === "radar-shield"
                      ? (me?.radarShieldUntil ?? 0)
                      : 0;
                const active = activeUntil > now || (type === "decoy" && Boolean(me?.decoyActive));
                return (
                  <div key={type} className="rounded-xl border border-white/5 bg-ink-900/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{meta.icon}</span>
                        <span className="text-sm font-semibold text-white">{meta.label}</span>
                        {active && <Badge tone="green">ACTIVE</Badge>}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isOut || cooldownLeft > 0 || busyAbility === type}
                        onClick={() => onAbility(type)}
                      >
                        {busyAbility === type
                          ? "…"
                          : cooldownLeft > 0
                            ? formatClock(cooldownLeft)
                            : active
                              ? "Re-use"
                              : "Use"}
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {meta.desc}
                      {active && activeUntil > now ? ` Active for ${formatClock(activeUntil - now)}.` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Capture radius is {room.settings.captureRadiusM} m. Keep moving, stay inside the boundary, and use safe
            zones if the host placed any.
          </p>
        </Card>

        {room.safeZones.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Safe zones</h2>
            <p className="mt-2 text-xs text-slate-400">
              {room.safeZones.length} safe zone{room.safeZones.length === 1 ? "" : "s"} on the map. Police cannot
              capture you inside one.
            </p>
          </Card>
        )}

        <Card>
          <EventFeed events={room.events} />
        </Card>
      </div>
    </div>
  );
}
