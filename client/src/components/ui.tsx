import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel hud-corners relative ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-[linear-gradient(180deg,#7ef9ff,#a3ff5e)] shadow-[0_0_14px_rgba(34,211,238,0.8)]" />
          <h1 className="font-display text-xl font-bold uppercase leading-tight tracking-[0.06em] text-white sm:text-2xl">
            {title}
          </h1>
        </div>
        {subtitle ? <p className="mt-1.5 pl-3.5 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-white/[0.05] text-slate-300 border-white/12",
  green: "bg-emerald-500/12 text-emerald-300 border-emerald-400/35",
  blue: "bg-blue-500/12 text-blue-300 border-blue-400/35",
  red: "bg-rose-500/12 text-rose-300 border-rose-400/35",
  amber: "bg-amber-500/12 text-amber-300 border-amber-400/35",
  violet: "bg-violet-500/12 text-violet-300 border-violet-400/35",
  cyan: "bg-cyan-500/12 text-cyan-300 border-cyan-400/35",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: keyof typeof BADGE_TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "text-white",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(160deg,rgba(18,32,56,0.9),rgba(5,9,20,0.85))] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.6),transparent)]" />
      <div className="font-display text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`font-display mt-1 text-lg font-bold leading-none tracking-wide ${tone}`}>{value}</div>
      {hint ? <div className="mt-1 text-[10px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "warn" | "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
    warn: "border-amber-400/35 bg-amber-500/10 text-amber-100",
    error: "border-rose-400/40 bg-rose-500/12 text-rose-100",
    success: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
  };
  const dots = {
    info: "bg-cyan-400",
    warn: "bg-amber-400",
    error: "bg-rose-400",
    success: "bg-emerald-400",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm backdrop-blur ${tones[tone]} ${className}`}>
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dots[tone]}`} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-white/10 border-t-cyan-400 border-r-acid shadow-[0_0_18px_-4px_rgba(34,211,238,0.8)] ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="font-display mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-snug text-slate-500">{hint}</span> : null}
    </label>
  );
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2367e8f9' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.9rem center" }}
      className={`w-full appearance-none rounded-xl border border-white/10 bg-ink-900/80 py-2.5 pl-3.5 pr-9 font-sans text-sm text-slate-100 outline-none transition-all duration-200 hover:border-white/20 focus:border-cyan-400/70 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12),0_0_24px_-8px_rgba(34,211,238,0.6)] ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-px w-full bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.25),transparent)] ${className}`}
    />
  );
}
