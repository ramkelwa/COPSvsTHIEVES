import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, Field, PageHeader, Spinner } from "../components/ui";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import type { HistoryEntry } from "../lib/types";
import { formatClock, formatMeters } from "../utils/time";

const AVATARS = ["😎", "🕵️", "🥷", "🚔", "👻", "🦊", "🐺", "🔥"];

export function ProfileScreen() {
  const { user, setUser } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "😎");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username);
    setAvatar(user.avatar);
  }, [user?.id, user?.username, user?.avatar]);

  useEffect(() => {
    let active = true;
    api
      .history()
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {
        /* history is optional */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateMe({ username: username.trim(), avatar });
      setUser(updated);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your profile.");
    } finally {
      setBusy(false);
    }
  };

  const stats = user?.stats;

  return (
    <div>
      <PageHeader title="Player profile" subtitle="Your identity on the map and your match history." />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-3xl">
              {user?.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-white">{user?.username}</h2>
              <p className="text-[11px] text-slate-500">Player ID {user?.id?.slice(0, 8)}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          </div>

          {saved && <p className="mt-3 text-xs text-emerald-300">Profile updated.</p>}
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          {editing && (
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <Field label="Username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
              </Field>
              <Field label="Avatar">
                <div className="grid grid-cols-8 gap-1.5">
                  {AVATARS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAvatar(option)}
                      className={`grid aspect-square place-items-center rounded-lg border text-lg ${
                        avatar === option ? "border-cyan-400/70 bg-cyan-500/15" : "border-white/10 bg-ink-900/70"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </Field>
              <Button size="sm" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </Button>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Matches" value={stats?.gamesPlayed ?? 0} />
            <Stat label="Wins" value={stats?.wins ?? 0} tone="text-emerald-300" />
            <Stat label="Captures" value={stats?.captures ?? 0} tone="text-rose-300" />
            <Stat label="Distance" value={formatMeters(stats?.distanceM ?? 0)} tone="text-cyan-300" />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Match history</h2>
          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <Spinner className="h-4 w-4" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              No finished matches yet. Create or join a room and play a round to build your history.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.slice(0, 12).map((entry) => (
                <li key={entry.id} className="rounded-xl border border-white/5 bg-ink-900/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">{entry.roomName}</span>
                    <Badge tone={entry.won ? "green" : "neutral"}>{entry.won ? "WIN" : "LOSS"}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="uppercase">{entry.role ?? "—"}</span>
                    <span>·</span>
                    <span>{entry.captures} captures</span>
                    <span>·</span>
                    <span>{formatClock(entry.survivalMs)}</span>
                    <span>·</span>
                    <span>{new Date(entry.endedAt).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}
