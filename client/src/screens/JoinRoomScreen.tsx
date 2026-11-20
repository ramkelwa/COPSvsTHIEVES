import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert, Card, Field, PageHeader, Spinner } from "../components/ui";

interface RoomPreview {
  code: string;
  name: string;
  mode: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
}

export function JoinRoomScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase().slice(0, 5));
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    setPreview(null);
    setError(null);
    if (trimmed.length !== 5) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .previewRoom(trimmed)
        .then((room) => {
          if (active) setPreview(room as RoomPreview);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Room not found.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      setLoading(false);
    };
  }, [code]);

  const join = async () => {
    setError(null);
    setJoining(true);
    try {
      const room = await api.joinRoom(code.trim().toUpperCase());
      navigate(`/lobby/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that room.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Join a room" subtitle="Enter the code your host shared with you." />

      <Card>
        <Field label="Room code" hint="5 characters, letters and numbers. Codes are not case-sensitive.">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
            placeholder="ABC12"
            autoFocus
            inputMode="text"
            autoCapitalize="characters"
            className="text-center text-2xl font-bold tracking-[0.35em]"
            maxLength={5}
          />
        </Field>

        <div className="mt-4 min-h-[68px]">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Spinner className="h-4 w-4" /> Looking up room…
            </div>
          ) : preview ? (
            <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{preview.name}</span>
                <span className="text-xs uppercase tracking-wide text-slate-400">{preview.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Host {preview.hostName} · {preview.playerCount}/{preview.maxPlayers} players · {preview.mode} mode
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Enter the full code to preview the room.</p>
          )}
        </div>

        {error && (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        )}

        <Button className="mt-4 w-full" onClick={join} disabled={code.length !== 5 || joining || preview?.status === "active"}>
          {joining ? "Joining…" : preview?.status === "active" ? "Match already started" : "Join room"}
        </Button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          Joining puts you in the lobby. You will run a GPS accuracy check before the host can start the match.
        </p>
      </Card>
    </div>
  );
}
