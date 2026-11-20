export type Role = "police" | "thief";
export type RoomStatus = "lobby" | "active" | "ended";
export type GameMode = "classic" | "team" | "survival";

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

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  captures: number;
  distanceM: number;
  survivalMs: number;
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
  status: "alive" | "out";
  isHost: boolean;
  location?: { lat: number; lng: number; accuracy: number; at: number };
  distanceM: number;
  captures: number;
  cooldowns?: Record<string, number>;
  outsideSince?: number | null;
  outsideGraceEndsAt?: number;
  stale?: boolean;
  gpsCheck?: { accuracy: number; at: number } | null;
  invisibilityUntil?: number;
  radarShieldUntil?: number;
  decoyActive?: boolean;
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
    status: "alive" | "out";
    captured?: boolean;
    distanceM: number;
    captures: number;
    survivalMs: number;
    won: boolean;
  }[];
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

export interface LeaderboardRow {
  rank: number;
  id: string;
  username: string;
  avatar: string;
  gamesPlayed: number;
  wins: number;
  captures: number;
  distanceM: number;
  survivalMs: number;
}
