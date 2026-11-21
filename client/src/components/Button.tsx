import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "police" | "thief";
  size?: "sm" | "md" | "lg";
}

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "btn-shine bg-[linear-gradient(115deg,#7ef9ff_0%,#22d3ee_42%,#a3ff5e_100%)] text-ink-950 hover:brightness-110 active:brightness-95 shadow-[0_10px_34px_-12px_rgba(34,211,238,0.9)]",
  secondary:
    "bg-white/[0.05] text-slate-100 border border-white/15 hover:border-cyan-400/60 hover:bg-white/[0.08] hover:text-white",
  ghost: "bg-transparent text-slate-400 hover:bg-white/5 hover:text-white",
  danger:
    "btn-shine bg-[linear-gradient(115deg,#fb7185,#e11d48)] text-white hover:brightness-110 shadow-[0_10px_34px_-12px_rgba(244,63,94,0.9)]",
  police:
    "btn-shine bg-[linear-gradient(115deg,#7dd3fc,#2563eb)] text-white hover:brightness-110 shadow-[0_10px_34px_-12px_rgba(37,99,235,0.9)]",
  thief:
    "btn-shine bg-[linear-gradient(115deg,#d9ffb0,#34d399_55%,#22c55e)] text-ink-950 hover:brightness-110 shadow-[0_10px_34px_-12px_rgba(52,211,153,0.9)]",
};

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-[11px] rounded-lg",
  md: "px-4 py-2.5 text-xs rounded-lg",
  lg: "px-5 py-3.5 text-[13px] rounded-xl",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`font-display inline-flex items-center justify-center gap-2 font-bold uppercase tracking-[0.12em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
