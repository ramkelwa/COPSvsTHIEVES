import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, PageHeader, Spinner } from "../components/ui";
import { Button } from "../components/Button";
import type { GameResults } from "../lib/types";
import { formatClock, formatMeters } from "../utils/time";

const REASONS: Record<GameResults["reason"], string> = {
  "all-captured": "Every thief was captured or eliminated.",
  "time-up": "The timer expired with thieves still free.",
  "host-ended": "The host ended the match early.",
  empty: "The room ended without a result.",
};

export function ResultsScreen() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<GameResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    let active = true;
    setLoading(true);
    api
      .results(code)
      .then((data) => {
        if (active) setResults(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load results.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Spinner className="h-10 w-10" />
        <p className="mt-4 text-sm text-slate-400">Loading match results…</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-white">Results unavailable</h1>
        <p className="mt-2 text-sm text-slate-400">{error ?? "This match result has expired."}</p>
        <Button className="mt-4" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  const policeWon = results.winner === "police";
  const thievesWon = results.winner === "thieves";
  const youWon = results.players.find((p) => p.id === user?.id)?.won;
  const longestSurvival = Math.max(...results.players.map((p) => p.survivalMs), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Match results"
        subtitle={`Room ${code?.toUpperCase() ?? ""} · ended ${new Date(results.endedAt).toLocaleTimeString()}`}
        actions={<Badge tone={youWon ? "green" : "neutral"}>{youWon ? "Victory" : "Defeat"}</Badge>}
      />

      <Card
        className={`mb-4 text-center ${
          policeWon ? "border-blue-500/40 bg-blue-500/10" : thievesWon ? "border-emerald-500/40 bg-emerald-500/10" : ""
        }`}
      >
        <div className="text-5xl">{policeWon ? "🚔" : thievesWon ? "🥷" : "🏁"}</div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
          {policeWon ? "Police win!" : thievesWon ? "Thieves win!" : "Match ended"}
        </h2>
        <p className="mt-1 text-sm text-slate-300">{REASONS[results.reason]}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <span>
            Longest survival <span className="font-semibold text-slate-200">{formatClock(longestSurvival)}</span>
          </span>
          <span>
            Players <span className="font-semibold text-slate-200">{results.players.length}</span>
          </span>
        </div>
      </Card>

      <Card className="mb-4 overflow-hidden p-0">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.8fr_0.7fr] gap-2 border-b border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Player</span>
          <span>Role</span>
          <span className="text-right">Caps</span>
          <span className="text-right">Distance</span>
          <span className="text-right">Survived</span>
        </div>
        {[...results.players]
          .sort((a, b) => Number(b.won) - Number(a.won) || b.captures - a.captures)
          .map((p) => (
            <div
              key={p.id}
              className={`grid grid-cols-[1.4fr_0.8fr_0.7fr_0.8fr_0.7fr] items-center gap-2 border-b border-white/5 px-4 py-2.5 text-sm last:border-0 ${
                p.id === user?.id ? "bg-cyan-500/[0.06]" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-base">{p.avatar}</span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">
                    {p.username}
                    {p.id === user?.id && <span className="ml-1 text-[10px] text-cyan-300">YOU</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {p.status === "alive" ? "survived" : p.captured ? "captured" : "eliminated"}
                  </div>
                </div>
              </div>
              <Badge tone={p.role === "police" ? "blue" : "green"}>{p.role ?? "—"}</Badge>
              <span className="text-right text-slate-300">{p.captures}</span>
              <span className="text-right text-slate-300">{formatMeters(p.distanceM)}</span>
              <span className="text-right font-mono text-xs text-slate-300">{formatClock(p.survivalMs)}</span>
            </div>
          ))}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate("/create-room")}>Host another match</Button>
        <Button variant="secondary" onClick={() => navigate("/dashboard")}>
          Dashboard
        </Button>
        <Link to="/leaderboard">
          <Button variant="ghost">Leaderboard</Button>
        </Link>
      </div>
    </div>
  );
}
