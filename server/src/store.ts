import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { GameResults, HistoryEntry, RoomSettings, UserRecord } from "./types.js";

interface DbShape {
  users: UserRecord[];
  history: HistoryEntry[];
  /** Last known settings per room name is not stored; rooms live in memory only. */
  results: Record<string, GameResults>;
  version: number;
}

const emptyDb = (): DbShape => ({ users: [], history: [], results: {}, version: 1 });

/**
 * Tiny atomic JSON store. The active game state deliberately lives in memory;
 * this only persists accounts, statistics and finished-game history.
 *
 * Swap this file for a Postgres/PostGIS repository when running in production —
 * the rest of the server only uses the methods below.
 */
class Store {
  private db: DbShape;
  private file: string;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.file = path.join(config.dataDir, "db.json");
    this.db = this.load();
  }

  private load(): DbShape {
    try {
      const raw = fs.readFileSync(this.file, "utf8");
      const parsed = JSON.parse(raw) as Partial<DbShape>;
      return {
        ...emptyDb(),
        ...parsed,
        users: parsed.users ?? [],
        history: parsed.history ?? [],
        results: parsed.results ?? {},
      };
    } catch {
      return emptyDb();
    }
  }

  /** Debounced, atomic write (write temp file then rename). */
  private persist(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const tmp = `${this.file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
        fs.renameSync(tmp, this.file);
      } catch (err) {
        console.error("[store] failed to persist database", err);
      }
    }, 150);
  }

  get users(): UserRecord[] {
    return this.db.users;
  }

  findUserById(id: string): UserRecord | undefined {
    return this.db.users.find((u) => u.id === id);
  }

  findUserByUsername(username: string): UserRecord | undefined {
    const needle = username.trim().toLowerCase();
    return this.db.users.find((u) => u.username.toLowerCase() === needle);
  }

  createUser(user: UserRecord): UserRecord {
    this.db.users.push(user);
    this.persist();
    return user;
  }

  updateUser(id: string, patch: Partial<UserRecord>): UserRecord | undefined {
    const user = this.findUserById(id);
    if (!user) return undefined;
    Object.assign(user, patch);
    this.persist();
    return user;
  }

  addHistory(entries: HistoryEntry[]): void {
    this.db.history.push(...entries);
    // Keep the file bounded; leaderboard aggregates come from user stats.
    if (this.db.history.length > 5000) {
      this.db.history = this.db.history.slice(-5000);
    }
    this.persist();
  }

  historyFor(userId: string, limit = 20): HistoryEntry[] {
    return this.db.history
      .filter((h) => h.userId === userId)
      .slice(-limit)
      .reverse();
  }

  saveResult(code: string, results: GameResults): void {
    this.db.results[code] = results;
    this.persist();
  }

  getResult(code: string): GameResults | undefined {
    return this.db.results[code];
  }

  leaderboard(limit = 50) {
    return [...this.db.users]
      .sort((a, b) => {
        const scoreA = a.stats.wins * 3 + a.stats.captures - a.stats.gamesPlayed * 0.1;
        const scoreB = b.stats.wins * 3 + b.stats.captures - b.stats.gamesPlayed * 0.1;
        return scoreB - scoreA;
      })
      .slice(0, limit)
      .map((u, index) => ({
        rank: index + 1,
        id: u.id,
        username: u.username,
        avatar: u.avatar,
        ...u.stats,
      }));
  }
}

export const store = new Store();
export type { RoomSettings };
