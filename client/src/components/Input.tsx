import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className = "", invalid, ...rest }: InputProps) {
  return (
    <input
      className={`w-full rounded-xl border bg-ink-900/80 px-3.5 py-2.5 font-sans text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-200 hover:border-white/20 focus:border-cyan-400/70 focus:bg-ink-900 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12),0_0_24px_-8px_rgba(34,211,238,0.6)] ${
        invalid ? "border-rose-500/60" : "border-white/10"
      } ${className}`}
      {...rest}
    />
  );
}
