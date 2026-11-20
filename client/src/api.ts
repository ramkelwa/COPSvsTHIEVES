import type {
  Boundary,
  GameResults,
  HistoryEntry,
  LeaderboardRow,
  PublicUser,
  Role,
  RoomSettings,
  RoomView,
} from "./lib/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TOKEN_KEY = "cvt.token";
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage can be disabled */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the game server. Is it running?", 0);
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  const record = (payload ?? {}) as Record<string, unknown>;

  if (!res.ok) {
    throw new ApiError(
      typeof record.error === "string" ? record.error : `Request failed (${res.status})`,
      res.status,
    );
  }
  return payload as T;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface CreateRoomInput {
  name?: string;
  isPrivate?: boolean;
  settings: Partial<RoomSettings> & { boundary: Boundary };
}

export const api = {
  // ---------- Auth & profile ----------
  register(username: string, password: string, avatar?: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: { username, password, ...(avatar ? { avatar } : {}) },
    });
  },
  login(username: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/login", { method: "POST", auth: false, body: { username, password } });
  },
  async me(): Promise<PublicUser> {
    const { user } = await request<{ user: PublicUser }>("/me");
    return user;
  },
  async updateMe(patch: { username?: string; avatar?: string }): Promise<PublicUser> {
    const { user } = await request<{ user: PublicUser }>("/me", { method: "PATCH", body: patch });
    return user;
  },
  async leaderboard(): Promise<LeaderboardRow[]> {
    const { leaderboard } = await request<{ leaderboard: LeaderboardRow[] }>("/leaderboard");
    return leaderboard;
  },
  async history(): Promise<HistoryEntry[]> {
    const { history } = await request<{ history: HistoryEntry[] }>("/history");
    return history;
  },
  async results(code: string): Promise<GameResults> {
    const { results } = await request<{ results: GameResults }>(`/results/${encodeURIComponent(code)}`);
    return results;
  },

  // ---------- Rooms ----------
  async createRoom(input: CreateRoomInput): Promise<RoomView> {
    const { room } = await request<{ room: RoomView }>("/rooms", { method: "POST", body: input });
    return room;
  },
  async myRoom(): Promise<RoomView | null> {
    const { room } = await request<{ room: RoomView | null }>("/rooms/mine");
    return room;
  },
  async publicRooms(): Promise<unknown[]> {
    const { rooms } = await request<{ rooms: unknown[] }>("/rooms/public");
    return rooms;
  },
  async room(code: string): Promise<RoomView> {
    const { room } = await request<{ room: RoomView }>(`/rooms/${encodeURIComponent(code)}`);
    return room;
  },
  async previewRoom(code: string): Promise<unknown> {
    const { room } = await request<{ room: unknown }>(`/rooms/${encodeURIComponent(code)}/preview`);
    return room;
  },
  async joinRoom(code: string): Promise<RoomView> {
    const { room } = await request<{ room: RoomView }>(`/rooms/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: {},
    });
    return room;
  },
  leaveRoom(code: string): Promise<{ ok: boolean }> {
    return request(`/rooms/${encodeURIComponent(code)}/leave`, { method: "POST", body: {} });
  },
  setReady(code: string, ready: boolean): Promise<{ ok: boolean }> {
    return request(`/rooms/${encodeURIComponent(code)}/ready`, { method: "POST", body: { ready } });
  },
  updateSettings(code: string, patch: Partial<RoomSettings>): Promise<RoomSettings> {
    return request<{ settings: RoomSettings }>(`/rooms/${encodeURIComponent(code)}/settings`, {
      method: "PATCH",
      body: patch,
    }).then((r) => r.settings);
  },
  assignRoles(code: string, assignments: Record<string, Role>): Promise<{ ok: boolean }> {
    return request(`/rooms/${encodeURIComponent(code)}/roles`, { method: "POST", body: { assignments } });
  },
  resetRoles(code: string): Promise<{ ok: boolean }> {
    return request(`/rooms/${encodeURIComponent(code)}/roles`, { method: "POST", body: { auto: true } });
  },
  startGame(code: string): Promise<{ ok: boolean }> {
    return request(`/rooms/${encodeURIComponent(code)}/start`, { method: "POST", body: {} });
  },
  endGame(code: string): Promise<{ ok: boolean }> {
    return request(`/rooms/${encodeURIComponent(code)}/end`, { method: "POST", body: {} });
  },
  recordGpsCheck(code: string, accuracy: number): Promise<{ thresholdM: number }> {
    return request<{ thresholdM: number }>(`/rooms/${encodeURIComponent(code)}/gps`, {
      method: "POST",
      body: { accuracy },
    });
  },
};
