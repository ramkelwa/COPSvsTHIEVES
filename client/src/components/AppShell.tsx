import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Brand } from "./Brand";
import { Button } from "./Button";

const NAV = [
  { to: "/dashboard", label: "Play", icon: "🎯" },
  { to: "/leaderboard", label: "Ranks", icon: "🏆" },
  { to: "/profile", label: "Profile", icon: "👤" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inMatch = location.pathname.startsWith("/game/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-ink-950/80 backdrop-blur-xl">
        <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.8),rgba(163,255,94,0.5),rgba(255,61,180,0.4),transparent)]" />
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Brand to={user ? "/dashboard" : "/"} />

          {!inMatch && (
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `font-display relative rounded-lg border px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all duration-200 ${
                      isActive
                        ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 shadow-[0_0_24px_-10px_rgba(34,211,238,0.9)]"
                        : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <span className="flex items-center gap-1.5">
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-acid shadow-[0_0_8px_rgba(163,255,94,0.9)]" />}
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          )}

          {inMatch && (
            <span className="hidden items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-rose-200">Live match</span>
            </span>
          )}

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 md:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.35),rgba(163,255,94,0.25))] text-base ring-1 ring-inset ring-white/25">
                {user?.avatar || "🙂"}
              </span>
              <span className="max-w-[9rem] truncate text-xs font-semibold text-slate-200">{user?.username}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-6xl flex-1 px-4 py-6 ${inMatch ? "pb-8" : "pb-24 sm:pb-8"}`}>
        <Outlet />
      </main>

      {!inMatch && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 backdrop-blur-xl sm:hidden">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    isActive ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute inset-x-5 top-0 h-0.5 rounded-full bg-[linear-gradient(90deg,#22d3ee,#a3ff5e)] transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <span className={`text-lg leading-none ${isActive ? "drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" : ""}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
