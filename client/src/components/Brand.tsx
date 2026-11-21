import { Link } from "react-router-dom";

export function Brand({ to = "/", withTagline = true }: { to?: string; withTagline?: boolean }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#7ef9ff,#22d3ee_45%,#a3ff5e)] shadow-[0_0_22px_-6px_rgba(34,211,238,0.9)]">
        <span className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/40" />
        <span className="font-display text-[10px] font-black tracking-tight text-ink-950">CVT</span>
        <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse-soft rounded-full bg-magenta shadow-[0_0_10px_rgba(255,61,180,0.9)]" />
      </span>
      <span className="leading-none">
        <span className="font-display block text-[13px] font-bold uppercase tracking-[0.14em] text-white transition-colors group-hover:text-cyan-200">
          Cops <span className="text-cyan-400">vs</span> Thieves
        </span>
        {withTagline && (
          <span className="font-display mt-1 block text-[8px] font-semibold uppercase tracking-[0.32em] text-slate-500">
            Live GPS arena
          </span>
        )}
      </span>
    </Link>
  );
}
