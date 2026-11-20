import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm font-bold tracking-wide text-white"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-500 text-[11px] font-black text-ink-950">
              CVT
            </span>
            <span className="hidden sm:block">Cops vs Thieves</span>
          </button>

          {!inMatch && (
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {inMatch && <span className="hidden text-xs text-slate-500 sm:block">Live match</span>}
            <span
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/10 text-base"
              title={user?.username}
            >
              {user?.avatar || "🙂"}
            </span>
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

      <main className={`mx-auto w-full max-w-5xl flex-1 px-4 py-5 ${inMatch ? "pb-8" : "pb-24 sm:pb-8"}`}>
        <Outlet />
      </main>

      {!inMatch && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 backdrop-blur sm:hidden">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                    isActive ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
                  }`
                }
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
