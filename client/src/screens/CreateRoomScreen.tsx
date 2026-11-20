import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { GameMap } from "../components/GameMap";
import { Alert, Badge, Card, Field, PageHeader, Select } from "../components/ui";
import type { Boundary, GameMode, LatLng, SafeZone } from "../lib/types";
import { getPolygonCenter } from "../utils/geo";
import { requestFix } from "../utils/gps";
import { zoomForRadius } from "../lib/mapTiles";
import { lastCenter, loadPrefs, saveLastCenter, savePrefs } from "../lib/prefs";

export function CreateRoomScreen() {
  const navigate = useNavigate();
  const prefs = useMemo(loadPrefs, []);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("classic");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [policeCount, setPoliceCount] = useState(2);
  const [durationMin, setDurationMin] = useState(Math.round(prefs.durationSec / 60));
  const [headStartSec, setHeadStartSec] = useState(0);

  const [boundaryType, setBoundaryType] = useState<"circle" | "polygon">("circle");
  const [center, setCenter] = useState<LatLng | null>(null);
  const [radiusM, setRadiusM] = useState(prefs.boundaryRadiusM);
  const [polygon, setPolygon] = useState<LatLng[]>([]);
  const [safePlacement, setSafePlacement] = useState(false);
  const [safeZonesOn, setSafeZonesOn] = useState(false);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);

  const [scanCooldown, setScanCooldown] = useState(prefs.scanCooldownSec);
  const [policeReveal, setPoliceReveal] = useState(prefs.policeRevealSec);
  const [captureRadius, setCaptureRadius] = useState(prefs.captureRadiusM);
  const [maxAccuracy, setMaxAccuracy] = useState(prefs.maxAccuracyM);
  const [boundaryGrace, setBoundaryGrace] = useState(prefs.boundaryGraceSec);
  const [radar, setRadar] = useState(true);
  const [abilities, setAbilities] = useState(true);

  const [locating, setLocating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reuse the last play area if there is one. Location is only read when the
    // host explicitly presses "Use my location" so no permission prompt fires
    // before they consent.
    const stored = lastCenter();
    if (stored) setCenter(stored);
  }, []);

  const polygonCenter = polygon.length >= 3 ? getPolygonCenter(polygon) : null;
  const mapCenter = center ?? polygonCenter ?? null;
  const zoom = !mapCenter ? 2 : boundaryType === "circle" ? zoomForRadius(radiusM) : 14;

  const locate = async () => {
    setLocating(true);
    setError(null);
    try {
      const fix = await requestFix();
      const point = { lat: fix.lat, lng: fix.lng };
      setCenter(point);
      saveLastCenter(point);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read your location.");
    } finally {
      setLocating(false);
    }
  };

  const handleMapClick = (point: LatLng) => {
    if (safePlacement) {
      if (!safeZonesOn) {
        setSafeZonesOn(true);
      }
      if (safeZones.length >= 5) return;
      setSafeZones((prev) => [...prev, { id: `zone-${Date.now()}`, ...point, radiusM: 60 }]);
      return;
    }
    if (boundaryType === "circle") {
      setCenter(point);
      saveLastCenter(point);
      return;
    }
    setPolygon((prev) => (prev.length >= 20 ? prev : [...prev, point]));
  };

  const boundary = (): Boundary | null => {
    if (boundaryType === "circle") {
      return center ? { type: "circle", center, radiusM } : null;
    }
    return polygon.length >= 3 ? { type: "polygon", points: polygon } : null;
  };

  const create = async () => {
    setError(null);
    const area = boundary();
    if (!area) {
      setError(
        boundaryType === "circle"
          ? "Tap the map or use your location to place the play area."
          : "Add at least 3 polygon points to outline the play area.",
      );
      return;
    }
    setCreating(true);
    try {
      savePrefs({
        scanCooldownSec: scanCooldown,
        policeRevealSec: policeReveal,
        captureRadiusM: captureRadius,
        maxAccuracyM: maxAccuracy,
        boundaryGraceSec: boundaryGrace,
        boundaryRadiusM: radiusM,
        durationSec: durationMin * 60,
      });
      const room = await api.createRoom({
        name: name.trim() || undefined,
        isPrivate: true,
        settings: {
          mode,
          maxPlayers,
          durationSec: durationMin * 60,
          policeCount: mode === "classic" ? 1 : policeCount,
          scanCooldownSec: scanCooldown,
          policeRevealSec: policeReveal,
          captureRadiusM: captureRadius,
          maxAccuracyM: maxAccuracy,
          accuracyToleranceM: 15,
          boundaryGraceSec: boundaryGrace,
          headStartSec,
          boundary: area,
          radar,
          abilities,
          safeZones: safeZonesOn,
          safeZoneList: safeZonesOn ? safeZones : [],
        },
      });
      navigate(`/lobby/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Create a room"
        subtitle="Set the arena, rules and power-ups. Everything is validated again on the server."
        actions={<Badge tone="cyan">Host controls</Badge>}
      />

      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Match basics</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Room name" className="sm:col-span-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Friday night hunt"
                  maxLength={40}
                />
              </Field>
              <Field label="Mode">
                <Select value={mode} onChange={(e) => setMode(e.target.value as GameMode)}>
                  <option value="classic">Classic — 1 police</option>
                  <option value="team">Team — multiple police</option>
                  <option value="survival">Survival — thieves outlast timer</option>
                </Select>
              </Field>
              <Field label="Player limit">
                <Select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
                  {[2, 4, 6, 8, 10, 12, 16, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} players
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Police count" hint={mode === "classic" ? "Classic mode always has one police." : undefined}>
                <Select
                  value={mode === "classic" ? 1 : policeCount}
                  onChange={(e) => setPoliceCount(Number(e.target.value))}
                  disabled={mode === "classic"}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} police
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Match duration">
                <Select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
                  {[5, 10, 15, 20, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Head start" hint="Thieves move first; police scans unlock afterwards.">
                <Select value={headStartSec} onChange={(e) => setHeadStartSec(Number(e.target.value))}>
                  <option value={0}>None</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                  <option value={120}>2 minutes</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Play area</h2>
              <div className="flex rounded-lg border border-white/10 bg-ink-900 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setBoundaryType("circle");
                    setSafePlacement(false);
                  }}
                  className={`rounded-md px-2.5 py-1 ${boundaryType === "circle" && !safePlacement ? "bg-white/10 text-white" : "text-slate-400"}`}
                >
                  Circle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBoundaryType("polygon");
                    setSafePlacement(false);
                  }}
                  className={`rounded-md px-2.5 py-1 ${boundaryType === "polygon" && !safePlacement ? "bg-white/10 text-white" : "text-slate-400"}`}
                >
                  Polygon
                </button>
              </div>
            </div>

            <div className="mt-3">
              <GameMap
                center={mapCenter}
                zoom={zoom}
                boundary={boundaryType === "circle" && center ? { type: "circle", center, radiusM } : null}
                draftPoints={boundaryType === "polygon" ? polygon : []}
                safeZones={safeZonesOn ? safeZones : []}
                className="h-72"
                showSelfAccuracy={false}
                onMapClick={handleMapClick}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={locate} disabled={locating}>
                {locating ? "Locating…" : "📍 Use my location"}
              </Button>
              <Button
                size="sm"
                variant={safePlacement ? "primary" : "secondary"}
                onClick={() => {
                  setSafePlacement((prev) => {
                    const next = !prev;
                    if (next) setSafeZonesOn(true);
                    return next;
                  });
                }}
              >
                {safePlacement ? "Placing safe zones — tap to add" : "＋ Add safe zones"}
              </Button>
              {boundaryType === "polygon" && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setPolygon((p) => p.slice(0, -1))} disabled={polygon.length === 0}>
                    Undo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPolygon([])} disabled={polygon.length === 0}>
                    Clear
                  </Button>
                </>
              )}
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              {safePlacement
                ? "Tap the map to drop a 60 m safe zone (max 5). Captures are blocked inside safe zones."
                : boundaryType === "circle"
                  ? center
                    ? "Tap the map to move the circle centre, then set the radius."
                    : "Tap the map to place the play area, or press Use my location."
                  : `Tap the map to add polygon corners (${polygon.length}/20, minimum 3).`}
            </p>

            {boundaryType === "circle" && (
              <Field label={`Radius — ${radiusM} m`} className="mt-3">
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={radiusM}
                  onChange={(e) => setRadiusM(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </Field>
            )}

            {safeZonesOn && safeZones.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {safeZones.map((zone, index) => (
                  <span key={zone.id} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                    Zone {index + 1}
                    <button
                      type="button"
                      className="text-emerald-300/70 hover:text-white"
                      onClick={() => setSafeZones((prev) => prev.filter((z) => z.id !== zone.id))}
                      aria-label={`Remove safe zone ${index + 1}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Visibility &amp; capture</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Police scan cooldown" hint="How often police can refresh thief positions.">
                <Select value={scanCooldown} onChange={(e) => setScanCooldown(Number(e.target.value))}>
                  {[10, 20, 30, 45, 60, 120].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Police reveal to thieves" hint="Thieves see the last-known police position this often.">
                <Select value={policeReveal} onChange={(e) => setPoliceReveal(Number(e.target.value))}>
                  {[30, 60, 90, 120, 180, 300].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Capture radius">
                <Select value={captureRadius} onChange={(e) => setCaptureRadius(Number(e.target.value))}>
                  {[10, 15, 20, 30, 40, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} metres
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Required GPS accuracy" hint="Every player must pass this check before starting.">
                <Select value={maxAccuracy} onChange={(e) => setMaxAccuracy(Number(e.target.value))}>
                  {[25, 30, 50, 75, 100].map((n) => (
                    <option key={n} value={n}>
                      ±{n} metres
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Out-of-bounds grace" hint="Time a player has to return before being marked OUT.">
                <Select value={boundaryGrace} onChange={(e) => setBoundaryGrace(Number(e.target.value))}>
                  {[10, 15, 20, 30, 45].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Power-ups</h2>
            <div className="mt-3 space-y-2">
              <ToggleRow
                label="Radar scan"
                hint="Police get nearby thief directions on a separate cooldown."
                checked={radar}
                onChange={setRadar}
              />
              <ToggleRow
                label="Thief abilities"
                hint="Invisibility, radar shield and decoy location."
                checked={abilities}
                onChange={setAbilities}
              />
              <ToggleRow
                label="Safe zones"
                hint="Thieves inside a safe zone cannot be captured."
                checked={safeZonesOn}
                onChange={(next) => {
                  setSafeZonesOn(next);
                  if (!next) {
                    setSafeZones([]);
                    setSafePlacement(false);
                  }
                }}
              />
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Mode" value={mode} />
              <Row label="Squad" value={`${maxPlayers} max · ${mode === "classic" ? 1 : policeCount} police`} />
              <Row
                label="Play area"
                value={
                  boundaryType === "circle"
                    ? center
                      ? `${(radiusM / 1000).toFixed(2)} km circle`
                      : "Not set"
                    : `${polygon.length} points`
                }
              />
              <Row label="Duration" value={`${durationMin} min`} />
              <Row label="Scan / reveal" value={`${scanCooldown}s / ${policeReveal}s`} />
              <Row label="Capture" value={`${captureRadius} m · ±${maxAccuracy} m GPS`} />
              <Row label="Power-ups" value={[radar && "radar", abilities && "abilities", safeZonesOn && "safe zones"].filter(Boolean).join(", ") || "off"} />
            </dl>

            <Button className="mt-4 w-full" size="lg" onClick={create} disabled={creating}>
              {creating ? "Creating room…" : "Create room & open lobby"}
            </Button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
              You become the host. Share the room code from the lobby. The match cannot start until every player
              passes the GPS check.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium capitalize text-slate-200">{value}</dd>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/5 bg-ink-900/40 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-cyan-400"
      />
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
