import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import { Brand } from "../components/Brand";
import { Spinner } from "../components/ui";

const ROLES = [
  {
    id: "police",
    tag: "THE HUNTER",
    name: "POLICE",
    icon: "🚔",
    copy: "Pinpoint thieves with scan pulses, close the distance and cuff them before the clock dies.",
    traits: ["Scan every 30s", "Capture within 20 m", "Radar sweep support"],
    accent: "from-blue-500/25 via-blue-500/[0.06] to-transparent",
    ring: "border-blue-400/35 hover:border-blue-300/70",
    glow: "hover:shadow-[0_30px_80px_-40px_rgba(59,130,246,0.9)]",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
  {
    id: "thief",
    tag: "THE GHOST",
    name: "THIEF",
    icon: "🥷",
    copy: "Slip through the boundary, read the police reveals and outlast the timer with your abilities.",
    traits: ["Invisibility cloak", "Radar shield", "Decoy signals"],
    accent: "from-emerald-400/25 via-emerald-500/[0.06] to-transparent",
    ring: "border-emerald-400/35 hover:border-emerald-300/70",
    glow: "hover:shadow-[0_30px_80px_-40px_rgba(52,211,153,0.9)]",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
];

const FEATURES = [
  {
    icon: "🛰️",
    title: "Live tactical map",
    body: "Positions stream over Socket.IO while the match runs — and stop the instant it ends.",
  },
  {
    icon: "📡",
    title: "Two roles, one hunt",
    body: "Police refresh thief positions every 30s. Thieves see police last-known positions every 90s.",
  },
  {
    icon: "⭕",
    title: "Real-world arena",
    body: "Circle or polygon play areas with an out-of-bounds countdown, enforced server-side.",
  },
  {
    icon: "🛡️",
    title: "Fair play by design",
    body: "Server-validated captures, GPS accuracy checks and movement-speed sanity checks.",
  },
];

const TICKER = [
  "GPS LOCKED",
  "2 ROLES",
  "LIVE TRACKING",
  "CAPTURE RADIUS 20 M",
  "SAFE ZONES",
  "DECOY SIGNALS",
  "SERVER VALIDATED",
];

export function HomeScreen() {
  const { user, loading } = useAuth();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col overflow-hidden px-5 py-6">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-70" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-1/3 h-80 w-80 rounded-full bg-emerald-400/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-magenta/[0.06] blur-3xl" />

      <header className="relative z-10 flex items-center justify-between">
        <Brand />
        {user ? (
          <Link to="/dashboard">
            <Button size="sm">Open dashboard</Button>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        )}
      </header>

      <section className="relative z-10 grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:py-16">
        <div className="max-w-2xl animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/[0.08] px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </span>
            <span className="font-display text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-200">
              Real-world multiplayer · live now
            </span>
          </span>

          <h1 className="font-display mt-6 text-[2.7rem] font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-[4.4rem]">
            Hunt.
            <br />
            <span className="text-gradient animate-shimmer">Hide.</span>{" "}
            <span className="text-white/90">Dominate.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            GPS hide &amp; seek for phones. One team hunts, the other runs. Set a play area, share a room code, and
            watch every move on a live tactical map.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {loading ? (
              <Spinner className="h-7 w-7" />
            ) : (
              <>
                <Link to={user ? "/dashboard" : "/register"}>
                  <Button size="lg">{user ? "Back to the hunt" : "Create your squad"}</Button>
                </Link>
                {!user && (
                  <Link to="/login">
                    <Button size="lg" variant="secondary">
                      I have an account
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-5">
            {[
              ["2", "roles"],
              ["30s", "scan cycle"],
              ["60", "min rounds"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-display text-xl font-bold tracking-wide text-white sm:text-2xl">{value}</dt>
                <dd className="font-display mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[440px] animate-rise delay-200">
          <div className="absolute inset-6 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="panel hud-corners relative overflow-hidden p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Sector scan
                </div>
                <div className="font-display mt-1 text-sm font-bold uppercase tracking-[0.1em] text-white">
                  Arena <span className="text-cyan-300">07</span>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                <span className="font-display text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  tracking
                </span>
              </span>
            </div>

            <div className="relative mx-auto mt-4 aspect-square w-full max-w-[320px]">
              <div className="absolute inset-0 overflow-hidden rounded-full border border-cyan-400/20 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.14),rgba(3,6,15,0.9)_68%)]">
                <div className="absolute inset-[14%] rounded-full border border-cyan-400/15" />
                <div className="absolute inset-[30%] rounded-full border border-cyan-400/15" />
                <div className="absolute inset-[46%] rounded-full border border-cyan-400/15" />
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-400/10" />
                <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-cyan-400/10" />
                <div
                  className="animate-sweep absolute inset-0 rounded-full"
                  style={{
                    background: "conic-gradient(from 0deg, rgba(34,211,238,0.42), rgba(34,211,238,0.08) 24%, transparent 32%)",
                  }}
                />
                <span className="absolute left-[64%] top-[30%] h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.9)]">
                  <span className="animate-blip absolute inset-0 rounded-full bg-rose-400" />
                </span>
                <span className="absolute left-[30%] top-[62%] h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(163,255,94,0.9)]">
                  <span className="animate-blip absolute inset-0 rounded-full bg-emerald-300" />
                </span>
                <span className="absolute left-[52%] top-[52%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-200 bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,1)]" />
              </div>
              <div className="absolute -left-2 top-[18%] rounded-md border border-white/10 bg-ink-950/90 px-2 py-1 backdrop-blur">
                <span className="font-display text-[8px] font-bold uppercase tracking-[0.16em] text-rose-300">
                  🚔 148 m
                </span>
              </div>
              <div className="absolute -right-2 bottom-[16%] rounded-md border border-white/10 bg-ink-950/90 px-2 py-1 backdrop-blur">
                <span className="font-display text-[8px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                  🥷 62 m
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["Signal", "98%", "text-cyan-300"],
                ["Players", "8", "text-white"],
                ["State", "LIVE", "text-emerald-300"],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                  <div className="font-display text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {label}
                  </div>
                  <div className={`font-display mt-1 text-sm font-bold ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 grid gap-4 pb-12 md:grid-cols-2">
        {ROLES.map((role, index) => (
          <div
            key={role.id}
            className={`panel hud-corners panel-hover group relative overflow-hidden p-6 animate-rise delay-${index === 0 ? "100" : "200"} ${role.ring} ${role.glow}`}
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${role.accent}`} />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-ink-950/70 text-2xl shadow-inner">
                  {role.icon}
                </span>
                <div>
                  <div className={`font-display text-[9px] font-bold uppercase tracking-[0.24em] ${role.text}`}>
                    {role.tag}
                  </div>
                  <h2 className="font-display mt-1 text-2xl font-black uppercase tracking-[0.08em] text-white">
                    {role.name}
                  </h2>
                </div>
              </div>
              <span className={`mt-1 h-2 w-2 rounded-full ${role.dot} shadow-[0_0_10px_currentColor]`} />
            </div>
            <p className="relative mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{role.copy}</p>
            <ul className="relative mt-4 flex flex-wrap gap-1.5">
              {role.traits.map((trait) => (
                <li
                  key={trait}
                  className="font-display rounded-md border border-white/10 bg-ink-950/50 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-300"
                >
                  {trait}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="relative z-10 pb-12">
        <div className="mb-5 flex items-center gap-3">
          <span className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-400/80">
            // How it works
          </span>
          <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(34,211,238,0.4),transparent)]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="panel panel-hover group p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-500/[0.08] text-lg transition-shadow group-hover:shadow-[0_0_22px_-6px_rgba(34,211,238,0.8)]">
                {feature.icon}
              </div>
              <h2 className="font-display mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                {feature.title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="relative z-10 mb-6 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02] py-2">
        <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap px-4">
          {[...TICKER, ...TICKER].map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="font-display flex items-center gap-3 text-[8px] font-semibold uppercase tracking-[0.28em] text-slate-500"
            >
              <span className="h-1 w-1 rounded-full bg-cyan-400/70" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-slate-500">
        Location is only shared with players in your room, only while a match is active, and never stored after the
        match ends. GPS accuracy is an estimate — never a guarantee.
      </footer>
    </div>
  );
}
