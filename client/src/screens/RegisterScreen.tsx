import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert, Card, Field } from "../components/ui";

const AVATARS = ["😎", "🕵️", "🥷", "🚔", "👻", "🦊", "🐺", "🔥"];

export function RegisterScreen() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(username, password, avatar);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 text-xs font-black text-ink-950">
            CVT
          </span>
          <span className="text-sm font-bold tracking-wide text-white">Cops vs Thieves</span>
        </Link>
        <Card>
          <h1 className="text-xl font-bold text-white">Create your player</h1>
          <p className="mt-1 text-sm text-slate-400">Your username and avatar appear on the map.</p>

          {error && (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Username" hint="3–20 letters, numbers or underscores.">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="night_runner"
                autoComplete="username"
                autoFocus
                required
              />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Avatar">
              <div className="grid grid-cols-8 gap-1.5">
                {AVATARS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAvatar(option)}
                    className={`grid aspect-square place-items-center rounded-lg border text-lg transition-colors ${
                      avatar === option
                        ? "border-cyan-400/70 bg-cyan-500/15"
                        : "border-white/10 bg-ink-900/70 hover:border-white/25"
                    }`}
                    aria-label={`Avatar ${option}`}
                    aria-pressed={avatar === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <Input
                value={avatar}
                onChange={(e) => setAvatar(e.target.value.slice(0, 8))}
                className="mt-2 text-center"
                maxLength={8}
                aria-label="Custom avatar"
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Already playing?{" "}
            <Link to="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
