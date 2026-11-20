import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import { Badge, Card, Divider, Field, PageHeader, Select } from "../components/ui";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type MatchPrefs } from "../lib/prefs";

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const [prefs, setPrefs] = useState<MatchPrefs>(loadPrefs);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof MatchPrefs>(key: K, value: MatchPrefs[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    savePrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Defaults for new rooms and how location is handled." />

      <Card className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Gameplay defaults</h2>
        <p className="mt-1 text-xs text-slate-500">
          These values pre-fill the Create Room form. The host can still change them per room.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Default match duration">
            <Select value={prefs.durationSec / 60} onChange={(e) => set("durationSec", Number(e.target.value) * 60)}>
              {[5, 10, 15, 20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default play-area radius">
            <Select value={prefs.boundaryRadiusM} onChange={(e) => set("boundaryRadiusM", Number(e.target.value))}>
              {[100, 200, 300, 500, 1000, 2000].map((n) => (
                <option key={n} value={n}>
                  {n} metres
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Police scan cooldown">
            <Select value={prefs.scanCooldownSec} onChange={(e) => set("scanCooldownSec", Number(e.target.value))}>
              {[10, 20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n} seconds
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Police reveal to thieves">
            <Select value={prefs.policeRevealSec} onChange={(e) => set("policeRevealSec", Number(e.target.value))}>
              {[30, 60, 90, 120, 180].map((n) => (
                <option key={n} value={n}>
                  {n} seconds
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Capture radius">
            <Select value={prefs.captureRadiusM} onChange={(e) => set("captureRadiusM", Number(e.target.value))}>
              {[10, 15, 20, 30, 40].map((n) => (
                <option key={n} value={n}>
                  {n} metres
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Required GPS accuracy">
            <Select value={prefs.maxAccuracyM} onChange={(e) => set("maxAccuracyM", Number(e.target.value))}>
              {[25, 30, 50, 75, 100].map((n) => (
                <option key={n} value={n}>
                  ±{n} metres
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Out-of-bounds grace">
            <Select value={prefs.boundaryGraceSec} onChange={(e) => set("boundaryGraceSec", Number(e.target.value))}>
              {[10, 15, 20, 30, 45].map((n) => (
                <option key={n} value={n}>
                  {n} seconds
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save}>
            Save defaults
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPrefs({ ...DEFAULT_PREFS });
              savePrefs({ ...DEFAULT_PREFS });
              setSaved(true);
            }}
          >
            Reset to recommended
          </Button>
          {saved && <span className="text-xs text-emerald-300">Saved on this device.</span>}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Privacy &amp; location</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span> Positions are shared only inside your active match room.
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span> Location updates stop the moment a match ends; stopped
            positions are dropped from server memory.
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span> Thieves see police last-known positions, and police see thief
            snapshots from scans — never continuous tracking.
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span> GPS accuracy is an estimate. The server applies a tolerance
            instead of claiming perfect precision.
          </li>
        </ul>
        <Divider className="my-4" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-slate-200">Signed in as {user?.username}</div>
            <div className="text-[11px] text-slate-500">Manage your avatar and username on the profile page.</div>
          </div>
          <div className="flex gap-2">
            <Link to="/profile">
              <Button size="sm" variant="secondary">
                Edit profile
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">How a match works</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-400">
          <li>The host sets a play area and rules, then shares the room code.</li>
          <li>Every player runs the GPS accuracy check; the server blocks the start until all pass.</li>
          <li>Roles are revealed at start. Police scan, thieves survive until the timer runs out.</li>
          <li>Leaving the boundary starts a grace countdown — return before it ends or you are OUT.</li>
          <li>The server enforces cooldowns, capture distance and movement sanity. The result screen is final.</li>
        </ol>
        <div className="mt-3">
          <Badge tone="cyan">Tip</Badge>{" "}
          <span className="text-xs text-slate-500">Best played outdoors with clear sky view and a full battery.</span>
        </div>
      </Card>
    </div>
  );
}
