import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import { Spinner } from "../components/ui";

const FEATURES = [
  { icon: "🛰️", title: "Live GPS map", body: "Positions stream over Socket.IO while the match is running — and stop the second it ends." },
  { icon: "🚔", title: "Two roles, one hunt", body: "Police scan thieves every 30s. Thieves see police last-known positions on a longer 90s reveal." },
  { icon: "📏", title: "Fair play by design", body: "Server-validated capture radius, GPS accuracy checks and movement-speed sanity checks." },
  { icon: "⭕", title: "Real-world arena", body: "Circle or polygon play areas with a 20s out-of-bounds grace warning, enforced server-side." },
];

export function HomeScreen() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 text-xs font-black text-ink-950">
            CVT
          </span>
          <span className="text-sm font-bold tracking-wide text-white">Cops vs Thieves</span>
        </div>
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

      <section className="flex flex-1 flex-col justify-center py-12">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Real-world multiplayer
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
            The park is the arena.
            <br />
            <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              Your friends are the game.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400">
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
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="text-2xl">{feature.icon}</div>
              <h2 className="mt-3 text-sm font-semibold text-white">{feature.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-slate-500">
        Location is only shared with players in your room, only while a match is active, and never stored after the
        match ends. GPS accuracy is an estimate — never a guarantee.
      </footer>
    </div>
  );
}
