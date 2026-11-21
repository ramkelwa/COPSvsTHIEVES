import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Spinner } from "../components/ui";
import type { LeaderboardRow } from "../lib/types";
import { formatMeters } from "../utils/time";

export function LeaderboardScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .leaderboard()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the leaderboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Leaderboard"
        subtitle="Ranking by wins and captures across all finished matches."
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
          <Spinner className="h-5 w-5" /> Loading rankings…
        </div>
      ) : error ? (
        <Card>
          <p className="text-sm text-rose-300">{error}</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">No matches have been completed yet. Be the first on the board.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="font-display grid grid-cols-[36px_1.5fr_0.7fr_0.7fr_0.8fr_0.9fr] gap-2 border-b border-white/10 px-4 py-2.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Wins</span>
            <span className="text-right">Caps</span>
            <span className="text-right">Matches</span>
            <span className="text-right">Distance</span>
          </div>
          {rows.map((row) => {
            const isMe = row.id === user?.id;
            return (
              <div
                key={row.id}
                className={`grid grid-cols-[36px_1.5fr_0.7fr_0.7fr_0.8fr_0.9fr] items-center gap-2 border-b border-white/5 px-4 py-2.5 text-sm transition-colors last:border-0 hover:bg-white/[0.03] ${
                  isMe
                    ? "bg-cyan-500/[0.07]"
                    : row.rank <= 3
                      ? "bg-[linear-gradient(90deg,rgba(251,191,36,0.07),transparent_70%)]"
                      : ""
                }`}
              >
                <span
                  className={`font-display text-xs font-bold ${
                    row.rank <= 3 ? "text-amber-300 text-glow-lime" : "text-slate-500"
                  }`}
                >
                  {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-sm">
                    {row.avatar}
                  </span>
                  <span className="truncate font-medium text-white">
                    {row.username}
                    {isMe && <span className="ml-1 text-[10px] text-cyan-300">YOU</span>}
                  </span>
                </div>
                <span className="text-right font-semibold text-emerald-300">{row.wins}</span>
                <span className="text-right text-slate-300">{row.captures}</span>
                <span className="text-right text-slate-400">{row.gamesPlayed}</span>
                <span className="text-right text-slate-400">{formatMeters(row.distanceM)}</span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
