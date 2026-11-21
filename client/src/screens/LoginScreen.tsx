import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import { Brand } from "../components/Brand";
import { Input } from "../components/Input";
import { Alert, Card, Field } from "../components/ui";

export function LoginScreen() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <Brand />
        </div>
        <Card className="animate-rise">
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-400/80">
            // Player access
          </p>
          <h1 className="font-display mt-2 text-xl font-bold uppercase tracking-[0.04em] text-white">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-400">Sign in to create or join a room.</p>

          {error && (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                autoComplete="username"
                autoFocus
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            New here?{" "}
            <Link to="/register" className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
