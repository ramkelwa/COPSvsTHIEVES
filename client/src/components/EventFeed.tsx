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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Match feed</h3>
      {latest.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No events yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {latest.map((event) => (
            <li key={event.id} className="flex items-start gap-2 text-xs text-slate-300">
              <span className="mt-px">{ICONS[event.type]}</span>
              <span className="flex-1 leading-snug">{event.message}</span>
              <span className="whitespace-nowrap text-[10px] text-slate-500">{formatAgo(event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
