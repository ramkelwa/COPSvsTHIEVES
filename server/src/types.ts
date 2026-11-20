export type Role = "police" | "thief";
export type GameMode = "classic" | "team" | "survival";
export type RoomStatus = "lobby" | "active" | "ended";
export type PlayerStatus = "alive" | "out";

export interface LatLng {
  lat: number;
  lng: number;
}

export type Boundary =
  | { type: "circle"; center: LatLng; radiusM: number }
  | { type: "polygon"; points: LatLng[] };

export interface SafeZone extends LatLng {
  id: string;
  radiusM: number;
}

export interface RoomSettings {
  mode: GameMode;
  maxPlayers: number;
  durationSec: number;
  policeCount: number;
  scanCooldownSec: number;
  policeRevealSec: number;
  captureRadiusM: number;
  maxAccuracyM: number;
  accuracyToleranceM: number;
  boundaryGraceSec: number;
  locationIntervalMs: number;
  headStartSec: number;
  boundary: Boundary;
  radar: boolean;
  radarCooldownSec: number;
  radarRadiusM: number;
  safeZones: boolean;
  safeZoneList: SafeZone[];
  abilities: boolean;
}

export interface StoredLocation {
  lat: number;
  lng: number;
  accuracy: number;
  /** Client-reported timestamp (ms epoch). */
  timestamp: number;
  /** Server receive time (ms epoch). Never trusted from the client. */
  receivedAt: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  captures: number;
  distanceM: number;
  survivalMs: number;
}

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  avatar: string;
  createdAt: number;
  stats: PlayerStats;
}

export interface PublicUser {
  id: string;
  username: string;
  avatar: string;
  stats: PlayerStats;
}

export interface IntelPlayer {
  id: string;
  username: string;
  avatar: string;
  lat: number;
  lng: number;
  accuracy: number;
  /** Location timestamp (ms). */
  at: number;
  distanceM?: number;
  decoy?: boolean;
}

export interface PlayerView {
  id: string;
  username: string;
  avatar: string;
  role: Role | null;
  ready: boolean;
  connected: boolean;
  status: PlayerStatus;
  isHost: boolean;
  /** Live position of teammates / self, never of an opposed role. */
  location?: { lat: number; lng: number; accuracy: number; at: number };
  distanceM: number;
  captures: number;
  /** Only present for the viewer's own player object: ability name -> next ready time (ms). */
  cooldowns?: Record<string, number>;
  outsideSince?: number | null;
  stale?: boolean;
  /** Pre-game GPS self-check recorded by the server (lobby only). */
  gpsCheck?: { accuracy: number; at: number } | null;
  /** Self-only ability state. */
  invisibilityUntil?: number;
  radarShieldUntil?: number;
  decoyActive?: boolean;
  outsideGraceEndsAt?: number;
}

export interface RoomView {
  code: string;
  name: string;
  isPrivate: boolean;
  status: RoomStatus;
  hostId: string;
  mode: GameMode;
  settings: RoomSettings;
  players: PlayerView[];
  safeZones: SafeZone[];
  startedAt: number | null;
  endsAt: number | null;
  serverTime: number;
  remainingThieves: number;
  totalThieves: number;
  totalPolice: number;
  winner: "police" | "thieves" | null;
  /** Per-viewer intel: police get their scan results, thieves get the last police reveal. */
  intel: {
    kind: "thieves" | "police" | null;
    at: number | null;
    nextAt: number | null;
    players: IntelPlayer[];
  };
  me: PlayerView | null;
  results?: GameResults;
  events: GameEvent[];
}

export interface GameEvent {
  id: string;
  type:
    | "join"
    | "leave"
    | "start"
    | "capture"
    | "boundary-warning"
    | "eliminated"
    | "scan"
    | "radar"
    | "ability"
    | "end";
  message: string;
  at: number;
  playerId?: string;
}

export interface GameResults {
  winner: "police" | "thieves" | null;
  reason: "all-captured" | "time-up" | "host-ended" | "empty";
  endedAt: number;
  players: {
    id: string;
    username: string;
    avatar: string;
    role: Role | null;
    status: PlayerStatus;
    captured?: boolean;
    distanceM: number;
    captures: number;
    survivalMs: number;
    won: boolean;
  }[];
}

export interface HistoryEntry {
  id: string;
  userId: string;
  code: string;
  roomName: string;
  mode: GameMode;
  role: Role | null;
  won: boolean;
  captures: number;
  distanceM: number;
  survivalMs: number;
  endedAt: number;
}
