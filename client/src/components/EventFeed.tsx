import type { GameEvent } from "../lib/types";
import { formatAgo } from "../utils/time";

const ICONS: Record<GameEvent["type"], string> = {
  join: "➕",
  leave: "🚪",
  start: "🚩",
  capture: "🚨",
  "boundary-warning": "⚠️",
  eliminated: "💀",
  scan: "📡",
  radar: "📶",
  ability: "✨",
  end: "🏁",
};

export function EventFeed({ events, limit = 6 }: { events: GameEvent[]; limit?: number }) {
  const latest = [...events].slice(-limit).reverse();
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Match feed</h3>
        <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          live
        </span>
      </div>
      {latest.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No events yet.</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {latest.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-300"
            >
              <span className="mt-px">{ICONS[event.type]}</span>
              <span className="flex-1 leading-snug">{event.message}</span>
              <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-wide text-slate-500">
                {formatAgo(event.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
