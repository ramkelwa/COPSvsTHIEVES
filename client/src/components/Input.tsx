import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className = "", invalid, ...rest }: InputProps) {
  return (
    <input
      className={`w-full rounded-xl border bg-ink-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20 ${
        invalid ? "border-rose-500/60" : "border-white/10"
      } ${className}`}
      {...rest}
    />
  );
}
