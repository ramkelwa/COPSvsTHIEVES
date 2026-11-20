import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Button } from "../components/Button";
import { Alert, Card, PageHeader, Spinner } from "../components/ui";
import { loadPrefs } from "../lib/prefs";
import type { RoomView } from "../lib/types";
import { ACCURACY_META, accuracyLevel, requestFix, type GeoFix } from "../utils/gps";

const BANDS = [
  { label: "Excellent", range: "0–10 m", tone: "bg-emerald-400" },
  { label: "Good", range: "11–25 m", tone: "bg-emerald-400" },
  { label: "Moderate", range: "26–50 m", tone: "bg-amber-400" },
  { label: "Poor", range: "> 50 m", tone: "bg-rose-400" },
];

export function GpsAccuracyScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const initialFix = (location.state as { fix?: GeoFix } | null)?.fix;
  const next = params.get("next") || "";

  const [fix, setFix] = useState<GeoFix | null>(initialFix ?? null);
  const [checking, setChecking] = useState(!initialFix);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastRecorded = useRef<string | null>(null);

  const threshold = room?.settings.maxAccuracyM ?? loadPrefs().maxAccuracyM;

  useEffect(() => {
    api
      .myRoom()
      .then((current) => setRoom(current))
      .catch(() => {
        /* Not in a room yet is fine. */
      });
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    setSaveState("idle");
    try {
      const result = await requestFix();
      setFix(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get a GPS fix.");
      setFix(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!initialFix) check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record the check for the lobby so the server can gate the match start.
  useEffect(() => {
    if (!fix || !room || room.status !== "lobby") return;
    const key = `${room.code}:${fix.timestamp}:${fix.accuracy}`;
    if (lastRecorded.current === key) return;
    lastRecorded.current = key;
    setSaveState("saving");
    setSaveError(null);
    let active = true;
    api
      .recordGpsCheck(room.code, fix.accuracy)
      .then(() => {
        if (active) setSaveState("saved");
      })
      .catch((err) => {
        if (active) {
          setSaveState("error");
          setSaveError(err instanceof Error ? err.message : "Could not save the GPS check.");
        }
      });
    return () => {
      active = false;
    };
  }, [fix, room]);

  const level = fix ? accuracyLevel(fix.accuracy) : null;
  const meta = level ? ACCURACY_META[level] : null;
  const passes = Boolean(fix && fix.accuracy <= threshold);
  const backTarget = next || (room?.status === "lobby" ? `/lobby/${room.code}` : "/dashboard");

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="GPS accuracy check"
        subtitle="A fair match needs a usable fix. Stand still outdoors while we look for your best location."
      />

      <Card>
        {checking ? (
          <div className="flex flex-col items-center py-10">
            <Spinner className="h-12 w-12" />
            <p className="mt-4 text-sm text-slate-400">Acquiring GPS signal…</p>
            <p className="mt-1 text-xs text-slate-500">This can take a few seconds outdoors.</p>
          </div>
        ) : fix && meta && level ? (
          <div className="text-center">
            <div className={`mx-auto flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 ${meta.border} ${meta.bg}`}>
              <span className={`text-4xl font-black ${meta.text}`}>{Math.round(fix.accuracy)}</span>
              <span className="text-xs text-slate-400">metres accuracy</span>
            </div>
            <div className="mt-4">
              <span className={`text-lg font-semibold ${meta.text}`}>{meta.label}</span>
              <p className="mt-1 text-xs text-slate-400">{meta.help}</p>
            </div>
            <div className="mx-auto mt-4 max-w-xs rounded-xl border border-white/10 bg-ink-900/60 p-2.5 text-xs text-slate-400">
              Host threshold: <span className="font-semibold text-slate-200">±{threshold} m</span>
              <span className={passes ? "text-emerald-300" : "text-rose-300"}>
                {" "}
                — {passes ? "passes" : "too poor to start"}
              </span>
            </div>
            {!passes && (
              <div className="mx-auto mt-3 max-w-sm rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left text-xs leading-relaxed text-amber-100">
                Your device is only reporting an approximate location. On a phone, enable Precise/Exact Location
                for this site and try outdoors with Battery Saver off. Many laptops have no GPS receiver and may
                not reach this threshold; use a phone with precise location enabled.
              </div>
            )}
            <div className="mt-3 text-[11px] text-slate-500">
              {saveState === "saving" && "Saving check to the lobby…"}
              {saveState === "saved" && "Check saved. The host can now start once everyone passes."}
              {saveState === "error" && saveError}
              {!room && "Not in a room yet — this check only applies once you join or create one."}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">
            {error ?? "No GPS fix yet."}
          </div>
        )}

        {error && fix && (
          <Alert tone="error" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={check} disabled={checking}>
            {checking ? "Checking…" : "Check GPS again"}
          </Button>
          <Button onClick={() => navigate(backTarget)} disabled={!passes}>
            {next ? "Continue" : room ? "Back to lobby" : "Continue"}
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          {BANDS.map((band) => (
            <div key={band.label} className="flex items-center gap-2 rounded-lg border border-white/5 bg-ink-900/40 px-2.5 py-2">
              <span className={`h-2 w-2 rounded-full ${band.tone}`} />
              <span className="text-slate-300">{band.label}</span>
              <span className="ml-auto text-slate-500">{band.range}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          GPS accuracy is an estimate, not a guarantee. Your reported position may differ from where you stand, and
          accuracy can change between checks.
        </p>
      </Card>
    </div>
  );
}
