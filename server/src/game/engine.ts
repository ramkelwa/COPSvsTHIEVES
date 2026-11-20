import crypto from "node:crypto";
import { haversineM, outsideByM, withinCircle } from "../geo.js";
import { store } from "../store.js";
import type {
  Boundary,
  GameEvent,
  GameResults,
  IntelPlayer,
  LatLng,
  PlayerStatus,
  PlayerView,
  RoomSettings,
  RoomView,
  Role,
  StoredLocation,
  UserRecord,
} from "../types.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_EVENT_LOG = 40;
const LOCATION_INTEL_MAX_AGE_MS = 30_000;
const LOCATION_STALE_MS = 45_000;
const CAPTURE_REQUIRES_FRESH_MS = 15_000;
const MAX_SPEED_MPS = 45; // faster than any human, drop as spoof/jump
const MAX_CLOCK_SKEW_MS = 120_000;
const ENDED_ROOM_TTL_MS = 15 * 60_000;
const LOBBY_DISCONNECT_TTL_MS = 2 * 60_000;

interface InternalPlayer {
  id: string;
  username: string;
  avatar: string;
  role: Role | null;
  ready: boolean;
  connected: boolean;
  socketIds: Set<string>;
  location: StoredLocation | null;
  distanceM: number;
  captures: number;
  status: PlayerStatus;
  eliminatedBy: "capture" | "boundary" | null;
  outAt: number | null;
  joinedAt: number;
  leftAt: number | null;
  gpsCheck: { accuracy: number; at: number } | null;
  lastAcceptedLocationAt: number;
  lastScanAt: number;
  lastRadarAt: number;
  lastCaptureAt: number;
  lastAbilityAt: Record<string, number>;
  invisibilityUntil: number;
  radarShieldUntil: number;
  decoy: { lat: number; lng: number; until: number } | null;
  outsideSince: number | null;
  scanSnapshot: { at: number; players: IntelPlayer[] } | null;
}

interface InternalRoom {
  code: string;
  name: string;
  isPrivate: boolean;
  hostId: string;
  status: "lobby" | "active" | "ended";
  settings: RoomSettings;
  players: Map<string, InternalPlayer>;
  createdAt: number;
  startedAt: number | null;
  endsAt: number | null;
  headStartUntil: number;
  winner: "police" | "thieves" | null;
  results: GameResults | null;
  events: GameEvent[];
  policeSnapshot: { at: number; nextAt: number; players: IntelPlayer[] };
  endedAt: number | null;
}

export type EngineResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RoomSummary {
  code: string;
  name: string;
  isPrivate: boolean;
  mode: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  createdAt: number;
}

export const DEFAULT_SETTINGS: Omit<RoomSettings, "boundary"> = {
  mode: "classic",
  maxPlayers: 12,
  durationSec: 15 * 60,
  policeCount: 1,
  scanCooldownSec: 30,
  policeRevealSec: 90,
  captureRadiusM: 20,
  maxAccuracyM: 50,
  accuracyToleranceM: 25,
  boundaryGraceSec: 20,
  locationIntervalMs: 3000,
  headStartSec: 0,
  radar: true,
  radarCooldownSec: 60,
  radarRadiusM: 150,
  safeZones: false,
  safeZoneList: [],
  abilities: true,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

function newPlayer(user: UserRecord): InternalPlayer {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    role: null,
    ready: false,
    connected: true,
    socketIds: new Set(),
    location: null,
    distanceM: 0,
    captures: 0,
    status: "alive",
    eliminatedBy: null,
    outAt: null,
    joinedAt: Date.now(),
    leftAt: null,
    gpsCheck: null,
    lastAcceptedLocationAt: 0,
    lastScanAt: 0,
    lastRadarAt: 0,
    lastCaptureAt: 0,
    lastAbilityAt: {},
    invisibilityUntil: 0,
    radarShieldUntil: 0,
    decoy: null,
    outsideSince: null,
    scanSnapshot: null,
  };
}

export function sanitizeSettings(input: Partial<RoomSettings>, fallbackBoundary?: Boundary): RoomSettings {
  const raw = { ...DEFAULT_SETTINGS, boundary: fallbackBoundary, ...input } as RoomSettings;
  const mode = ["classic", "team", "survival"].includes(raw.mode) ? raw.mode : "classic";
  const boundary = validateBoundary(raw.boundary);
  if (!boundary) throw new Error("A valid play area boundary is required");
  return {
    mode,
    maxPlayers: clamp(Math.round(raw.maxPlayers), 2, 40),
    durationSec: clamp(Math.round(raw.durationSec), 60, 3 * 60 * 60),
    policeCount: clamp(Math.round(raw.policeCount), 1, 20),
    scanCooldownSec: clamp(Math.round(raw.scanCooldownSec), 5, 600),
    policeRevealSec: clamp(Math.round(raw.policeRevealSec), 10, 1800),
    captureRadiusM: clamp(Math.round(raw.captureRadiusM), 5, 100),
    maxAccuracyM: clamp(Math.round(raw.maxAccuracyM), 10, 200),
    accuracyToleranceM: clamp(Math.round(raw.accuracyToleranceM), 0, 100),
    boundaryGraceSec: clamp(Math.round(raw.boundaryGraceSec), 5, 120),
    locationIntervalMs: clamp(Math.round(raw.locationIntervalMs), 1000, 60_000),
    headStartSec: clamp(Math.round(raw.headStartSec), 0, 600),
    radar: Boolean(raw.radar),
    radarCooldownSec: clamp(Math.round(raw.radarCooldownSec), 5, 600),
    radarRadiusM: clamp(Math.round(raw.radarRadiusM), 20, 1000),
    safeZones: Boolean(raw.safeZones),
    safeZoneList: Array.isArray(raw.safeZoneList)
      ? raw.safeZoneList.slice(0, 10).map((z, i) => ({
          id: z.id || `zone-${i}`,
          lat: Number(z.lat),
          lng: Number(z.lng),
          radiusM: clamp(Number(z.radiusM) || 50, 10, 500),
        }))
      : [],
    abilities: Boolean(raw.abilities),
    boundary,
  };
}

export function validateBoundary(input: unknown): Boundary | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Boundary;
  const validLatLng = (p: LatLng) =>
    Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Math.abs(p.lat) <= 85 && Math.abs(p.lng) <= 180;
  if (b.type === "circle") {
    if (!validLatLng(b.center)) return null;
    if (!Number.isFinite(b.radiusM)) return null;
    return { type: "circle", center: { lat: b.center.lat, lng: b.center.lng }, radiusM: clamp(b.radiusM, 20, 20_000) };
  }
  if (b.type === "polygon") {
    if (!Array.isArray(b.points) || b.points.length < 3) return null;
    if (!b.points.every(validLatLng)) return null;
    if (b.points.length > 100) return null;
    return { type: "polygon", points: b.points.map((p) => ({ lat: p.lat, lng: p.lng })) };
  }
  return null;
}

class GameEngine {
  private rooms = new Map<string, InternalRoom>();
  private userRooms = new Map<string, string>();
  private onChange: ((code: string) => void) | null = null;
  private tickTimer: NodeJS.Timeout | null = null;

  setChangeHandler(handler: (code: string) => void): void {
    this.onChange = handler;
  }

  startTicking(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  stopTicking(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private changed(code: string): void {
    this.onChange?.(code);
  }

  private log(room: InternalRoom, event: Omit<GameEvent, "id" | "at">): void {
    room.events.push({ ...event, id: crypto.randomUUID(), at: Date.now() });
    if (room.events.length > MAX_EVENT_LOG) room.events.splice(0, room.events.length - MAX_EVENT_LOG);
  }

  private broadcastLog(room: InternalRoom, event: Omit<GameEvent, "id" | "at">): void {
    this.log(room, event);
    this.changed(room.code);
  }

  getRoom(code: string): InternalRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  roomOfUser(userId: string): InternalRoom | undefined {
    const code = this.userRooms.get(userId);
    return code ? this.rooms.get(code) : undefined;
  }

  createRoom(
    host: UserRecord,
    input: { name: string; isPrivate: boolean; settings: Partial<RoomSettings> },
  ): EngineResult<InternalRoom> {
    const existing = this.roomOfUser(host.id);
    if (existing && existing.status !== "ended") {
      return { ok: false, error: "You are already in a room. Leave it before creating another." };
    }
    if (existing) this.rooms.delete(existing.code);

    let settings: RoomSettings;
    try {
      settings = sanitizeSettings(input.settings);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }

    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();
    const player = newPlayer(host);
    player.ready = true;
    const room: InternalRoom = {
      code,
      name: (input.name || `${host.username}'s game`).slice(0, 40),
      isPrivate: Boolean(input.isPrivate),
      hostId: host.id,
      status: "lobby",
      settings,
      players: new Map([[host.id, player]]),
      createdAt: Date.now(),
      startedAt: null,
      endsAt: null,
      headStartUntil: 0,
      winner: null,
      results: null,
      events: [],
      policeSnapshot: { at: 0, nextAt: 0, players: [] },
      endedAt: null,
    };
    this.rooms.set(code, room);
    this.userRooms.set(host.id, code);
    this.log(room, { type: "join", message: `${host.username} created the room`, playerId: host.id });
    return { ok: true, data: room };
  }

  joinRoom(code: string, user: UserRecord): EngineResult<InternalRoom> {
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: "Room not found. Check the code." };
    if (room.status === "ended") return { ok: false, error: "This game has already ended." };
    if (room.status === "active") {
      const player = room.players.get(user.id);
      if (!player) return { ok: false, error: "This game is already in progress." };
      player.connected = true;
      this.userRooms.set(user.id, room.code);
      return { ok: true, data: room };
    }
    const current = this.roomOfUser(user.id);
    if (current && current.code !== room.code) {
      return { ok: false, error: `You are already in room ${current.code}. Leave it first.` };
    }
    if (room.players.has(user.id)) {
      const p = room.players.get(user.id)!;
      p.connected = true;
      return { ok: true, data: room };
    }
    if (room.players.size >= room.settings.maxPlayers) return { ok: false, error: "This room is full." };
    room.players.set(user.id, newPlayer(user));
    this.userRooms.set(user.id, room.code);
    this.broadcastLog(room, { type: "join", message: `${user.username} joined the lobby`, playerId: user.id });
    return { ok: true, data: room };
  }

  leaveRoom(userId: string): EngineResult<true> {
    const room = this.roomOfUser(userId);
    if (!room) return { ok: true, data: true };
    const player = room.players.get(userId);
    this.userRooms.delete(userId);

    if (!player) {
      this.rooms.delete(room.code);
      return { ok: true, data: true };
    }

    if (room.status === "lobby") {
      room.players.delete(userId);
      this.log(room, { type: "leave", message: `${player.username} left the lobby`, playerId: userId });
      if (room.players.size === 0) {
        this.rooms.delete(room.code);
        return { ok: true, data: true };
      }
      if (room.hostId === userId) this.transferHost(room);
      this.changed(room.code);
      return { ok: true, data: true };
    }

    if (room.status === "active" && player.status === "alive") {
      // Leaving an active game counts as elimination; locations stop immediately.
      player.status = "out";
      player.eliminatedBy = "boundary";
      player.outAt = Date.now();
      player.location = null;
      player.outsideSince = null;
      this.broadcastLog(room, {
        type: "leave",
        message: `${player.username} left the game and is out`,
        playerId: userId,
      });
      this.checkWin(room);
      return { ok: true, data: true };
    }

    if (room.status === "ended") {
      room.players.delete(userId);
    }
    this.changed(room.code);
    return { ok: true, data: true };
  }

  private transferHost(room: InternalRoom): void {
    const next = [...room.players.values()].find((p) => p.connected) ?? [...room.players.values()][0];
    if (!next) return;
    room.hostId = next.id;
    this.log(room, { type: "leave", message: `${next.username} is now the host`, playerId: next.id });
  }

  recordGpsCheck(userId: string, accuracy: number): EngineResult<{ thresholdM: number }> {
    const room = this.roomOfUser(userId);
    if (!room) return { ok: false, error: "Join a room before checking GPS." };
    if (room.status !== "lobby") return { ok: false, error: "GPS checks are only needed before the game starts." };
    const player = room.players.get(userId);
    if (!player) return { ok: false, error: "You are not in this room." };
    if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 500) {
      return { ok: false, error: "Invalid GPS accuracy." };
    }
    player.gpsCheck = { accuracy: Math.round(accuracy * 10) / 10, at: Date.now() };
    this.changed(room.code);
    return { ok: true, data: { thresholdM: room.settings.maxAccuracyM } };
  }

  setReady(userId: string, ready: boolean): EngineResult<true> {
    const room = this.roomOfUser(userId);
    if (!room || room.status !== "lobby") return { ok: false, error: "Not in a lobby." };
    const player = room.players.get(userId);
    if (!player) return { ok: false, error: "Not in this room." };
    player.ready = room.hostId === userId ? true : Boolean(ready);
    this.changed(room.code);
    return { ok: true, data: true };
  }

  updateSettings(userId: string, patch: Partial<RoomSettings>): EngineResult<RoomSettings> {
    const room = this.roomOfUser(userId);
    if (!room) return { ok: false, error: "Not in a room." };
    if (room.hostId !== userId) return { ok: false, error: "Only the host can change settings." };
    if (room.status !== "lobby") return { ok: false, error: "Settings are locked once the game starts." };
    try {
      const merged = sanitizeSettings({ ...room.settings, ...patch, boundary: patch.boundary ?? room.settings.boundary });
      if (merged.maxPlayers < room.players.size) {
        return { ok: false, error: `Max players cannot be lower than the ${room.players.size} players in the room.` };
      }
      room.settings = merged;
      this.log(room, { type: "join", message: "Host updated game settings" });
      this.changed(room.code);
      return { ok: true, data: merged };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  assignRoles(hostId: string, assignments: Record<string, Role> | null): EngineResult<true> {
    const room = this.roomOfUser(hostId);
    if (!room || room.status !== "lobby") return { ok: false, error: "Roles can only be assigned in the lobby." };
    if (room.hostId !== hostId) return { ok: false, error: "Only the host can assign roles." };
    if (assignments === null) {
      for (const player of room.players.values()) player.role = null;
      this.log(room, { type: "join", message: "Host switched role assignment back to automatic" });
      this.changed(room.code);
      return { ok: true, data: true };
    }
    for (const player of room.players.values()) {
      player.role = assignments[player.id] === "police" ? "police" : "thief";
    }
    const police = this.countRole(room, "police");
    if (police < 1 || police >= room.players.size) {
      room.players.forEach((p) => (p.role = null));
      return { ok: false, error: "At least one police and one thief are required." };
    }
    this.log(room, { type: "join", message: "Host assigned roles manually" });
    this.changed(room.code);
    return { ok: true, data: true };
  }

  startGame(hostId: string): EngineResult<true> {
    const room = this.roomOfUser(hostId);
    if (!room) return { ok: false, error: "Not in a room." };
    if (room.hostId !== hostId) return { ok: false, error: "Only the host can start the game." };
    if (room.status !== "lobby") return { ok: false, error: "The game has already started." };
    const players = [...room.players.values()];
    if (players.length < 2) return { ok: false, error: "At least 2 players are required." };
    const notReady = players.filter((p) => !p.ready && p.id !== room.hostId);
    if (notReady.length > 0) {
      return { ok: false, error: `Waiting for ${notReady.map((p) => p.username).join(", ")} to ready up.` };
    }
    if (players.some((p) => !p.connected)) return { ok: false, error: "A player is disconnected. Wait for them to reconnect." };

    // Every player must pass a recent GPS accuracy check before the match starts.
    const GPS_CHECK_MAX_AGE_MS = 15 * 60_000;
    const gpsBlocked = players.filter(
      (p) =>
        !p.gpsCheck ||
        Date.now() - p.gpsCheck.at > GPS_CHECK_MAX_AGE_MS ||
        p.gpsCheck.accuracy > room.settings.maxAccuracyM,
    );
    if (gpsBlocked.length > 0) {
      return {
        ok: false,
        error: `GPS check needed for ${gpsBlocked.map((p) => p.username).join(", ")}. Each player must pass the ${room.settings.maxAccuracyM}m accuracy check before starting.`,
      };
    }

    let policeCount = room.settings.mode === "classic" ? 1 : room.settings.policeCount;
    if (room.settings.mode === "team") {
      policeCount = clamp(policeCount, 1, players.length - 1);
    } else {
      policeCount = 1;
    }

    if (players.some((p) => p.role !== null)) {
      const assigned = players.filter((p) => p.role === "police").length;
      if (assigned < 1 || assigned >= players.length) {
        return { ok: false, error: "Role assignment needs at least one police and one thief." };
      }
    } else {
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      shuffled.forEach((p, i) => (p.role = i < policeCount ? "police" : "thief"));
    }

    const now = Date.now();
    room.status = "active";
    room.startedAt = now;
    room.endsAt = now + room.settings.durationSec * 1000;
    room.headStartUntil = now + (room.settings.headStartSec || 0) * 1000;
    room.winner = null;
    room.results = null;
    room.endedAt = null;
    // First reveal happens as soon as police GPS is available, then every policeRevealSec.
    room.policeSnapshot = { at: 0, nextAt: now, players: [] };
    for (const p of room.players.values()) {
      p.status = "alive";
      p.location = null;
      p.distanceM = 0;
      p.captures = 0;
      p.eliminatedBy = null;
      p.outAt = null;
      p.lastScanAt = 0;
      p.lastRadarAt = 0;
      p.lastCaptureAt = 0;
      p.lastAbilityAt = {};
      p.invisibilityUntil = 0;
      p.radarShieldUntil = 0;
      p.decoy = null;
      p.outsideSince = null;
      p.scanSnapshot = null;
      p.gpsCheck = null;
      p.ready = true;
    }
    this.log(room, {
      type: "start",
      message:
        room.settings.headStartSec > 0
          ? `Game started! Thieves have a ${room.settings.headStartSec}s head start.`
          : "Game started! Good luck.",
    });
    this.changed(room.code);
    return { ok: true, data: true };
  }

  private countRole(room: InternalRoom, role: Role): number {
    return [...room.players.values()].filter((p) => p.role === role).length;
  }

  private countAliveThieves(room: InternalRoom): number {
    return [...room.players.values()].filter((p) => p.role === "thief" && p.status === "alive").length;
  }

  private inSafeZone(room: InternalRoom, loc: LatLng): boolean {
    if (!room.settings.safeZones) return false;
    return room.settings.safeZoneList.some((z) => withinCircle(loc, z, z.radiusM));
  }

  handleLocation(
    userId: string,
    payload: { lat: number; lng: number; accuracy: number; timestamp: number },
  ): EngineResult<{ accepted: boolean; outside?: boolean; graceEndsAt?: number }> {
    const room = this.roomOfUser(userId);
    if (!room) return { ok: false, error: "You are not in a game." };
    if (room.status !== "active") return { ok: false, error: "The game is not active." };
    const player = room.players.get(userId);
    if (!player) return { ok: false, error: "You are not in this game." };
    if (player.status !== "alive") return { ok: false, error: "You are out of the game." };

    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    const accuracy = Number(payload.accuracy);
    const timestamp = Number(payload.timestamp);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
      return { ok: false, error: "Invalid coordinates." };
    }
    if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 500) {
      return { ok: false, error: "Invalid GPS accuracy." };
    }
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) {
      return { ok: false, error: "Location timestamp is stale or invalid." };
    }

    const now = Date.now();
    if (player.lastAcceptedLocationAt && now - player.lastAcceptedLocationAt < room.settings.locationIntervalMs) {
      return { ok: true, data: { accepted: false } };
    }

    const previous = player.location;
    if (previous) {
      const dt = (now - previous.receivedAt) / 1000;
      const dist = haversineM(previous, { lat, lng });
      if (dt > 0.5) {
        const speed = dist / dt;
        if (speed > MAX_SPEED_MPS) {
          return { ok: false, error: "Movement speed is implausible. GPS jump ignored." };
        }
        if (dist < 500) player.distanceM += dist;
      }
    }

    player.location = { lat, lng, accuracy, timestamp, receivedAt: now };
    player.lastAcceptedLocationAt = now;

    // Boundary enforcement, with GPS-accuracy slack to prevent false eliminations.
    let outside = false;
    let graceEndsAt: number | undefined;
    const accuracyOk = accuracy <= room.settings.maxAccuracyM;
    const slack = room.settings.accuracyToleranceM + Math.min(accuracy / 2, 30);
    if (accuracyOk) {
      const beyond = outsideByM(player.location, room.settings.boundary);
      outside = beyond > slack;
    }
    if (outside) {
      if (player.outsideSince === null) {
        player.outsideSince = now;
        const deadline = now + room.settings.boundaryGraceSec * 1000;
        graceEndsAt = deadline;
        this.log(room, {
          type: "boundary-warning",
          message: `${player.username} is outside the play area! ${room.settings.boundaryGraceSec}s to return.`,
          playerId: player.id,
        });
      } else {
        graceEndsAt = player.outsideSince + room.settings.boundaryGraceSec * 1000;
      }
    } else if (player.outsideSince !== null) {
      player.outsideSince = null;
      this.log(room, { type: "join", message: `${player.username} returned to the play area`, playerId: player.id });
    }

    this.changed(room.code);
    return { ok: true, data: { accepted: true, outside, graceEndsAt } };
  }

  private canPoliceAct(room: InternalRoom): boolean {
    return Date.now() >= room.headStartUntil;
  }

  scan(userId: string): EngineResult<{ players: IntelPlayer[]; at: number; nextAt: number }> {
    const room = this.roomOfUser(userId);
    if (!room || room.status !== "active") return { ok: false, error: "No active game." };
    const player = room.players.get(userId);
    if (!player || player.role !== "police") return { ok: false, error: "Only police can scan." };
    if (player.status !== "alive") return { ok: false, error: "You are out." };
    const now = Date.now();
    if (!this.canPoliceAct(room)) {
      return { ok: false, error: `Scans unlock after the ${room.settings.headStartSec}s head start.` };
    }
    const readyAt = player.lastScanAt + room.settings.scanCooldownSec * 1000;
    if (player.lastScanAt && now < readyAt) {
      return { ok: false, error: `Scan recharging: ${Math.ceil((readyAt - now) / 1000)}s left.` };
    }
    if (!player.location) return { ok: false, error: "Waiting for your GPS location." };

    const players = this.thiefIntel(room, player, "scan");
    player.lastScanAt = now;
    const nextAt = now + room.settings.scanCooldownSec * 1000;
    player.scanSnapshot = { at: now, players };
    this.log(room, {
      type: "scan",
      message: `Police scan: ${players.length} thief position${players.length === 1 ? "" : "s"} revealed`,
      playerId: userId,
    });
    this.changed(room.code);
    return { ok: true, data: { players, at: now, nextAt } };
  }

  radar(userId: string): EngineResult<{ players: IntelPlayer[]; at: number; nextAt: number }> {
    const room = this.roomOfUser(userId);
    if (!room || room.status !== "active") return { ok: false, error: "No active game." };
    if (!room.settings.radar) return { ok: false, error: "Radar is disabled in this room." };
    const player = room.players.get(userId);
    if (!player || player.role !== "police") return { ok: false, error: "Only police have radar." };
    if (player.status !== "alive") return { ok: false, error: "You are out." };
    if (!player.location) return { ok: false, error: "Waiting for your GPS location." };
    const now = Date.now();
    if (!this.canPoliceAct(room)) {
      return { ok: false, error: `Radar unlocks after the ${room.settings.headStartSec}s head start.` };
    }
    const readyAt = player.lastRadarAt + room.settings.radarCooldownSec * 1000;
    if (player.lastRadarAt && now < readyAt) {
      return { ok: false, error: `Radar recharging: ${Math.ceil((readyAt - now) / 1000)}s left.` };
    }

    // Radar only detects nearby thieves, and cannot pierce safe zones or stealth.
    const nearby = this.thiefIntel(room, player, "radar")
      .filter((t) => (t.distanceM ?? Infinity) <= room.settings.radarRadiusM)
      .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));

    player.lastRadarAt = now;
    const nextAt = now + room.settings.radarCooldownSec * 1000;
    const merged = new Map<string, IntelPlayer>();
    for (const t of player.scanSnapshot?.players ?? []) merged.set(t.id, t);
    for (const t of nearby) merged.set(t.id, t);
    player.scanSnapshot = {
      at: now,
      players: [...merged.values()].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)),
    };
    this.log(room, {
      type: "radar",
      message: `Radar sweep: ${nearby.length} nearby thief${nearby.length === 1 ? "" : "s"} detected`,
      playerId: userId,
    });
    this.changed(room.code);
    return { ok: true, data: { players: nearby, at: now, nextAt } };
  }

  private thiefIntel(room: InternalRoom, viewer: InternalPlayer, mode: "scan" | "radar"): IntelPlayer[] {
    const now = Date.now();
    const intel: IntelPlayer[] = [];
    for (const thief of room.players.values()) {
      if (thief.role !== "thief" || thief.status !== "alive" || !thief.location) continue;
      if (now - thief.location.receivedAt > LOCATION_INTEL_MAX_AGE_MS) continue;
      // Stealth: invisibility hides from everything; radar shield hides from radar.
      if (thief.invisibilityUntil > now) continue;
      if (mode === "radar" && thief.radarShieldUntil > now) continue;
      if (this.inSafeZone(room, thief.location)) continue;

      const decoyActive = thief.decoy && thief.decoy.until > now;
      const point = decoyActive ? { lat: thief.decoy!.lat, lng: thief.decoy!.lng } : thief.location;
      intel.push({
        id: thief.id,
        username: thief.username,
        avatar: thief.avatar,
        lat: point.lat,
        lng: point.lng,
        accuracy: thief.location.accuracy,
        at: thief.location.receivedAt,
        distanceM: viewer.location ? Math.round(haversineM(viewer.location, point)) : undefined,
        decoy: Boolean(decoyActive),
      });
    }
    return intel;
  }

  capture(userId: string, targetId: string): EngineResult<{ captured: true }> {
    const room = this.roomOfUser(userId);
    if (!room || room.status !== "active") return { ok: false, error: "No active game." };
    const cop = room.players.get(userId);
    const thief = room.players.get(targetId);
    if (!cop || cop.role !== "police" || cop.status !== "alive") return { ok: false, error: "Only active police can capture." };
    if (!thief || thief.role !== "thief") return { ok: false, error: "That player is not a thief." };
    if (thief.status !== "alive") return { ok: false, error: "That thief is already out." };
    if (!this.canPoliceAct(room)) return { ok: false, error: "Captures are disabled during the head start." };

    const now = Date.now();
    if (cop.lastCaptureAt && now - cop.lastCaptureAt < 5000) {
      return { ok: false, error: "Wait a moment before another capture attempt." };
    }
    if (!cop.location || now - cop.location.receivedAt > CAPTURE_REQUIRES_FRESH_MS) {
      return { ok: false, error: "Your GPS location is stale. Wait for a fresh fix." };
    }
    if (!thief.location || now - thief.location.receivedAt > CAPTURE_REQUIRES_FRESH_MS) {
      return { ok: false, error: "That thief's location is stale — get closer and try again." };
    }
    if (cop.location.accuracy > room.settings.maxAccuracyM || thief.location.accuracy > room.settings.maxAccuracyM) {
      return { ok: false, error: "GPS accuracy too low to capture fairly. Move to open sky and retry." };
    }
    const distance = haversineM(cop.location, thief.location);
    // Allow for GPS error, but cap the extra reach so it cannot be abused.
    const allowed = room.settings.captureRadiusM + Math.min(cop.location.accuracy, thief.location.accuracy) / 2;
    if (distance > allowed) {
      return { ok: false, error: `Target is ${Math.round(distance)}m away — get within ${room.settings.captureRadiusM}m.` };
    }
    if (this.inSafeZone(room, thief.location)) {
      return { ok: false, error: "That thief is inside a safe zone and cannot be captured." };
    }

    cop.lastCaptureAt = now;
    cop.captures += 1;
    thief.status = "out";
    thief.eliminatedBy = "capture";
    thief.outAt = now;
    thief.location = null;
    thief.outsideSince = null;
    thief.decoy = null;
    this.broadcastLog(room, {
      type: "capture",
      message: `${cop.username} captured ${thief.username}!`,
      playerId: thief.id,
    });
    this.checkWin(room);
    this.changed(room.code);
    return { ok: true, data: { captured: true } };
  }

  useAbility(
    userId: string,
    type: "invisibility" | "decoy" | "radar-shield",
    payload?: { lat?: number; lng?: number },
  ): EngineResult<{ until: number }> {
    const room = this.roomOfUser(userId);
    if (!room || room.status !== "active") return { ok: false, error: "No active game." };
    if (!room.settings.abilities) return { ok: false, error: "Thief abilities are disabled in this room." };
    const player = room.players.get(userId);
    if (!player || player.role !== "thief") return { ok: false, error: "Only thieves have abilities." };
    if (player.status !== "alive") return { ok: false, error: "You are out." };
    if (!player.location) return { ok: false, error: "Waiting for your GPS location." };
    const now = Date.now();
    const config = {
      invisibility: { durationMs: 20_000, cooldownMs: 120_000, label: "Invisibility" },
      "radar-shield": { durationMs: 60_000, cooldownMs: 90_000, label: "Radar shield" },
      decoy: { durationMs: 45_000, cooldownMs: 120_000, label: "Decoy" },
    }[type];
    if (!config) return { ok: false, error: "Unknown ability." };
    const last = player.lastAbilityAt[type] ?? 0;
    if (now < last + config.cooldownMs) {
      return { ok: false, error: `${config.label} recharging: ${Math.ceil((last + config.cooldownMs - now) / 1000)}s left.` };
    }

    if (type === "invisibility") {
      player.invisibilityUntil = now + config.durationMs;
    } else if (type === "radar-shield") {
      player.radarShieldUntil = now + config.durationMs;
    } else {
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng);
      const point = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : player.location;
      if (outsideByM(point, room.settings.boundary) > 0) {
        return { ok: false, error: "The decoy must be inside the play area." };
      }
      if (haversineM(player.location, point) > 300) {
        return { ok: false, error: "The decoy must be within 300m of you." };
      }
      player.decoy = { lat: point.lat, lng: point.lng, until: now + config.durationMs };
    }
    player.lastAbilityAt[type] = now;
    this.broadcastLog(room, {
      type: "ability",
      message: `${player.username} used ${config.label}`,
      playerId: player.id,
    });
    this.changed(room.code);
    return { ok: true, data: { until: now + config.durationMs } };
  }

  endGameByHost(userId: string): EngineResult<true> {
    const room = this.roomOfUser(userId);
    if (!room || room.status !== "active") return { ok: false, error: "No active game." };
    if (room.hostId !== userId) return { ok: false, error: "Only the host can end the game." };
    this.endGame(room, "host-ended");
    return { ok: true, data: true };
  }

  private checkWin(room: InternalRoom): void {
    if (room.status !== "active") return;
    if (this.countAliveThieves(room) === 0) {
      this.endGame(room, "all-captured");
    }
  }

  private endGame(room: InternalRoom, reason: GameResults["reason"]): void {
    if (room.status === "ended") return;
    const now = Date.now();
    const winner: "police" | "thieves" | null =
      reason === "empty" ? null : this.countAliveThieves(room) > 0 ? "thieves" : "police";
    room.status = "ended";
    room.endedAt = now;
    room.winner = winner;
    room.headStartUntil = 0;

    const results: GameResults = {
      winner,
      reason,
      endedAt: now,
      players: [...room.players.values()].map((p) => {
        const survivalMs =
          p.role === "thief"
            ? Math.max(0, (p.outAt ?? now) - (room.startedAt ?? now))
            : Math.max(0, now - (room.startedAt ?? now));
        const won = winner !== null && p.role === winner;
        return {
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          role: p.role,
          status: p.status,
          captured: p.eliminatedBy === "capture",
          distanceM: Math.round(p.distanceM),
          captures: p.captures,
          survivalMs,
          won,
        };
      }),
    };
    room.results = results;
    room.policeSnapshot = { at: 0, nextAt: 0, players: [] };

    // Persist stats and history, then drop location data immediately (privacy).
    const historyEntries = [];
    for (const p of room.players.values()) {
      const row = results.players.find((r) => r.id === p.id)!;
      const user = store.findUserById(p.id);
      if (user) {
        const stats = {
          gamesPlayed: user.stats.gamesPlayed + 1,
          wins: user.stats.wins + (row.won ? 1 : 0),
          captures: user.stats.captures + row.captures,
          distanceM: user.stats.distanceM + row.distanceM,
          survivalMs: user.stats.survivalMs + Math.round(row.survivalMs),
        };
        store.updateUser(user.id, { stats });
      }
      historyEntries.push({
        id: crypto.randomUUID(),
        userId: p.id,
        code: room.code,
        roomName: room.name,
        mode: room.settings.mode,
        role: p.role,
        won: row.won,
        captures: row.captures,
        distanceM: row.distanceM,
        survivalMs: Math.round(row.survivalMs),
        endedAt: now,
      });
      p.location = null;
      p.scanSnapshot = null;
      p.decoy = null;
      p.outsideSince = null;
      p.socketIds.clear();
    }
    store.addHistory(historyEntries);
    store.saveResult(room.code, results);

    this.log(room, {
      type: "end",
      message:
        winner === "police"
          ? "All thieves caught — Police win!"
          : winner === "thieves"
            ? "Time's up — Thieves win!"
            : "Game ended.",
    });
    this.changed(room.code);
  }

  private tick(): void {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (room.status === "ended") {
        if (room.endedAt && now - room.endedAt > ENDED_ROOM_TTL_MS) {
          for (const p of room.players.values()) {
            if (this.userRooms.get(p.id) === room.code) this.userRooms.delete(p.id);
          }
          this.rooms.delete(room.code);
        }
        continue;
      }
      if (room.status === "lobby") {
        let changed = false;
        for (const p of [...room.players.values()]) {
          if (!p.connected && p.leftAt && now - p.leftAt > LOBBY_DISCONNECT_TTL_MS) {
            room.players.delete(p.id);
            if (this.userRooms.get(p.id) === room.code) this.userRooms.delete(p.id);
            if (room.hostId === p.id) this.transferHost(room);
            changed = true;
          }
        }
        if (room.players.size === 0) {
          this.rooms.delete(room.code);
          continue;
        }
        if (changed) this.changed(room.code);
        continue;
      }
      if (room.status !== "active") continue;

      if (room.endsAt && now >= room.endsAt) {
        this.endGame(room, "time-up");
        continue;
      }

      // Periodic police-position reveal to thieves.
      if (now >= room.policeSnapshot.nextAt) {
        const reveal: IntelPlayer[] = [];
        for (const p of room.players.values()) {
          if (p.role !== "police" || p.status !== "alive" || !p.location) continue;
          reveal.push({
            id: p.id,
            username: p.username,
            avatar: p.avatar,
            lat: p.location.lat,
            lng: p.location.lng,
            accuracy: p.location.accuracy,
            at: p.location.receivedAt,
          });
        }
        if (reveal.length > 0) {
          room.policeSnapshot = {
            at: now,
            nextAt: now + room.settings.policeRevealSec * 1000,
            players: reveal,
          };
          this.changed(room.code);
        } else if (room.policeSnapshot.at === 0) {
          // Police GPS has not arrived yet; retry the first reveal shortly.
          room.policeSnapshot.nextAt = now + 3000;
        }
      }

      // Boundary grace expiry.
      for (const p of room.players.values()) {
        if (p.status !== "alive" || p.outsideSince === null) continue;
        if (now - p.outsideSince >= room.settings.boundaryGraceSec * 1000) {
          p.status = "out";
          p.eliminatedBy = "boundary";
          p.outAt = now;
          p.location = null;
          p.outsideSince = null;
          p.decoy = null;
          this.log(room, {
            type: "eliminated",
            message: `${p.username} failed to return to the play area and is OUT`,
            playerId: p.id,
          });
          this.changed(room.code);
          this.checkWin(room);
          if (room.status !== "active") break;
        }
      }
    }
  }

  serializeRoom(room: InternalRoom, viewerId: string): RoomView {
    const viewer = room.players.get(viewerId);
    const now = Date.now();
    const viewerIsPolice = viewer?.role === "police";
    const started = room.status !== "lobby";

    const players: PlayerView[] = [...room.players.values()].map((p) => {
      const canSeeLive =
        p.id === viewerId ||
        (viewer && viewer.role && p.role === viewer.role) || // teammates see each other
        !started;
      const showLocation =
        canSeeLive && p.location
          ? {
              lat: p.location.lat,
              lng: p.location.lng,
              accuracy: Math.round(p.location.accuracy),
              at: p.location.receivedAt,
            }
          : undefined;
      return {
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        // Roles stay hidden in the lobby except from the host, who assigns them.
        role: started || viewerId === room.hostId ? p.role : null,
        ready: p.ready,
        connected: p.connected,
        status: p.status,
        isHost: p.id === room.hostId,
        location: showLocation,
        distanceM: Math.round(p.distanceM),
        captures: p.captures,
        stale: Boolean(p.location && now - p.location.receivedAt > LOCATION_STALE_MS),
        outsideSince: p.id === viewerId ? p.outsideSince : undefined,
        gpsCheck: started ? undefined : (p.gpsCheck ?? null),
      };
    });

    let intel: RoomView["intel"] = { kind: null, at: null, nextAt: null, players: [] };
    if (room.status === "active" && viewer) {
      if (viewerIsPolice) {
        intel = {
          kind: "thieves",
          at: viewer.scanSnapshot?.at ?? null,
          nextAt: (viewer.lastScanAt || now) + room.settings.scanCooldownSec * 1000,
          // Hide thieves who have gone invisible or been eliminated since the scan.
          players: (viewer.scanSnapshot?.players ?? []).filter((entry) => {
            const current = room.players.get(entry.id);
            return current?.status === "alive" && current.invisibilityUntil <= now;
          }),
        };
      } else if (viewer.role === "thief") {
        const visible = room.policeSnapshot.players.filter((p) => {
          const player = room.players.get(p.id);
          return player?.status === "alive";
        });
        intel = {
          kind: "police",
          at: room.policeSnapshot.at || null,
          nextAt: room.policeSnapshot.nextAt || null,
          players: visible.map((p) => ({
            ...p,
            distanceM: viewer.location ? Math.round(haversineM(viewer.location, p)) : undefined,
          })),
        };
      }
    }

    const me = viewer
      ? {
          ...players.find((p) => p.id === viewerId)!,
          cooldowns: {
            scan: viewer.lastScanAt ? viewer.lastScanAt + room.settings.scanCooldownSec * 1000 : 0,
            radar: viewer.lastRadarAt ? viewer.lastRadarAt + room.settings.radarCooldownSec * 1000 : 0,
            capture: viewer.lastCaptureAt ? viewer.lastCaptureAt + 5000 : 0,
            invisibility: viewer.lastAbilityAt.invisibility
              ? viewer.lastAbilityAt.invisibility + 120_000
              : 0,
            "radar-shield": viewer.lastAbilityAt["radar-shield"] ? viewer.lastAbilityAt["radar-shield"] + 90_000 : 0,
            decoy: viewer.lastAbilityAt.decoy ? viewer.lastAbilityAt.decoy + 120_000 : 0,
          },
          invisibilityUntil: viewer.invisibilityUntil > now ? viewer.invisibilityUntil : 0,
          radarShieldUntil: viewer.radarShieldUntil > now ? viewer.radarShieldUntil : 0,
          decoyActive: Boolean(viewer.decoy && viewer.decoy.until > now),
          outsideGraceEndsAt:
            viewer.outsideSince !== null ? viewer.outsideSince + room.settings.boundaryGraceSec * 1000 : 0,
        }
      : null;

    return {
      code: room.code,
      name: room.name,
      isPrivate: room.isPrivate,
      status: room.status,
      hostId: room.hostId,
      mode: room.settings.mode,
      settings: room.settings,
      players,
      safeZones: room.settings.safeZones ? room.settings.safeZoneList : [],
      startedAt: room.startedAt,
      endsAt: room.endsAt,
      serverTime: now,
      remainingThieves: this.countAliveThieves(room),
      totalThieves: this.countRole(room, "thief"),
      totalPolice: this.countRole(room, "police"),
      winner: room.winner,
      intel,
      me,
      results: room.results ?? undefined,
      events: room.events.slice(-20),
    };
  }

  summary(room: InternalRoom): RoomSummary {
    const host = room.players.get(room.hostId);
    return {
      code: room.code,
      name: room.name,
      isPrivate: room.isPrivate,
      mode: room.settings.mode,
      status: room.status,
      playerCount: room.players.size,
      maxPlayers: room.settings.maxPlayers,
      hostName: host?.username ?? "unknown",
      createdAt: room.createdAt,
    };
  }

  publicRooms(): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((r) => !r.isPrivate && r.status === "lobby")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((r) => this.summary(r));
  }

  attachSocket(userId: string, socketId: string): void {
    const room = this.roomOfUser(userId);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;
    player.socketIds.add(socketId);
    player.connected = true;
    player.leftAt = null;
    this.changed(room.code);
  }

  detachSocket(userId: string, socketId: string): void {
    const room = this.roomOfUser(userId);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;
    player.socketIds.delete(socketId);
    if (player.socketIds.size === 0) {
      player.connected = false;
      player.leftAt = Date.now();
    }
    this.changed(room.code);
  }

  socketIdsFor(userId: string): string[] {
    const room = this.roomOfUser(userId);
    return [...(room?.players.get(userId)?.socketIds ?? [])];
  }

  playerIds(room: InternalRoom): string[] {
    return [...room.players.keys()];
  }

  /** Test helper: mark a player's position instantly (used by the simulator only). */
  debugSetLocation(userId: string, loc: LatLng & { accuracy?: number }): EngineResult<true> {
    const room = this.roomOfUser(userId);
    const player = room?.players.get(userId);
    if (!room || !player || room.status !== "active") return { ok: false, error: "No active game." };
    player.location = {
      lat: loc.lat,
      lng: loc.lng,
      accuracy: loc.accuracy ?? 8,
      timestamp: Date.now(),
      receivedAt: Date.now(),
    };
    player.lastAcceptedLocationAt = 0;
    player.outsideSince = null;
    this.changed(room.code);
    return { ok: true, data: true };
  }
}

export const engine = new GameEngine();
export type { InternalRoom };
