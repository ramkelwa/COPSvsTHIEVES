import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20 ${className}`}>
      {children}
    </div>
  );
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
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-white/[0.06] text-slate-300 border-white/10",
  green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  blue: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  red: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone]} ${className}`}
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
    <div className="rounded-xl border border-white/10 bg-ink-900/60 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold leading-tight ${tone}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div> : null}
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
    info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-100",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  };
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm ${tones[tone]} ${className}`}>{children}</div>;
}

export function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-cyan-400 ${className}`}
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
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-snug text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full appearance-none rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-white/10 ${className}`} />;
}
