import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Alert, Card, PageHeader } from "../components/ui";
import { locationPermissionState, requestFix } from "../utils/gps";

const PROMISES = [
  "Location is shared only with players inside your game room.",
  "Sharing starts when the match starts and stops the moment it ends.",
  "Your position is never visible outside an active match room.",
  "You can revoke permission at any time in your browser settings.",
];

export function GpsPermissionScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [consent, setConsent] = useState(false);
  const [permission, setPermission] = useState<PermissionState | "unsupported">("prompt");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    locationPermissionState().then(setPermission);
  }, []);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const fix = await requestFix();
      navigate(`/gps-accuracy?next=${encodeURIComponent(next)}`, { state: { fix } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not access your location.");
      setPermission(await locationPermissionState());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Location access" subtitle="Before you enter the arena, here is exactly what we do." />

      <Card>
        <ul className="space-y-2.5">
          {PROMISES.map((promise) => (
            <li key={promise} className="flex gap-2.5 text-sm text-slate-300">
              <span className="mt-0.5 text-cyan-400">✓</span>
              <span>{promise}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl border border-white/10 bg-ink-900/60 p-3 text-xs leading-relaxed text-slate-400">
          The game needs a live GPS fix because the map, capture distances, and out-of-bounds warnings all depend on
          your real position. GPS accuracy is an estimate: tunnels, dense buildings and bad weather can degrade it.
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-ink-900/40 p-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-cyan-400"
          />
          <span>
            I understand my location is shared with the players in my room, only during an active match.
          </span>
        </label>

        {permission === "denied" && (
          <Alert tone="warn" className="mt-3">
            Location permission is currently blocked in this browser. Enable it for this site, then retry.
          </Alert>
        )}
        {error && (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        )}

        <Button className="mt-4 w-full" size="lg" onClick={enable} disabled={!consent || busy}>
          {busy ? "Requesting location…" : "Allow location & run GPS check"}
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate(next)}>
          Not now
        </Button>
      </Card>
    </div>
  );
}
