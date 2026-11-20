import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "police" | "thief";
  size?: "sm" | "md" | "lg";
}

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-cyan-500 text-ink-950 hover:bg-cyan-400 active:bg-cyan-300 font-semibold shadow-lg shadow-cyan-500/20",
  secondary: "bg-white/[0.06] text-slate-100 hover:bg-white/10 border border-white/10",
  ghost: "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white",
  danger: "bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/30",
  police: "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/30",
  thief: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30",
};

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-5 py-3 text-base rounded-xl",
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
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
