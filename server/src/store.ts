import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { config } from "./config.js";
import type { GameResults, HistoryEntry, RoomSettings, UserRecord } from "./types.js";

interface DbShape {
  users: UserRecord[];
  history: HistoryEntry[];
  results: Record<string, GameResults>;
  version: number;
}

const emptyDb = (): DbShape => ({ users: [], history: [], results: {}, version: 1 });

class Store {
  private db: DbShape;
  private file: string;
  private pool: Pool | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.file = path.join(config.dataDir, "db.json");
    this.db = this.load();
  }

  async initialize(): Promise<void> {
    if (!config.databaseUrl) {
      if (config.isProd) throw new Error("DATABASE_URL is required in production.");
      return;
    }

    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ...(config.databaseSsl ? { ssl: true } : {}),
    });

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cvt_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        stats JSONB NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS cvt_users_username_lower_idx
        ON cvt_users (LOWER(username));
      CREATE TABLE IF NOT EXISTS cvt_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        ended_at BIGINT NOT NULL,
        payload JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cvt_history_user_ended_idx
        ON cvt_history (user_id, ended_at DESC);
      CREATE TABLE IF NOT EXISTS cvt_results (
        code TEXT PRIMARY KEY,
        payload JSONB NOT NULL
      );
    `);

    const [users, history, results] = await Promise.all([
      this.pool.query("SELECT id, username, password_hash, avatar, created_at, stats FROM cvt_users"),
      this.pool.query("SELECT payload FROM cvt_history ORDER BY ended_at"),
      this.pool.query("SELECT code, payload FROM cvt_results"),
    ]);

    this.db = {
      version: 1,
      users: users.rows.map((row) => ({
        id: row.id as string,
        username: row.username as string,
        passwordHash: row.password_hash as string,
        avatar: row.avatar as string,
        createdAt: Number(row.created_at),
        stats: row.stats as UserRecord["stats"],
      })),
      history: history.rows.map((row) => row.payload as HistoryEntry),
      results: Object.fromEntries(
        results.rows.map((row) => [row.code as string, row.payload as GameResults]),
      ),
    };
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

  private persist(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.pool) {
        void this.flush().catch((err: unknown) => {
          console.error("[store] failed to persist PostgreSQL data", err);
        });
        return;
      }

      try {
        const tmp = `${this.file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
        fs.renameSync(tmp, this.file);
      } catch (err) {
        console.error("[store] failed to persist JSON data", err);
      }
    }, 150);
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.pool) return;

    const snapshot = JSON.parse(JSON.stringify(this.db)) as DbShape;
    const pool = this.pool;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO cvt_users (id, username, password_hash, avatar, created_at, stats)
           SELECT id, username, password_hash, avatar, created_at, stats
           FROM jsonb_to_recordset($1::jsonb) AS x(
             id text, username text, password_hash text, avatar text, created_at bigint, stats jsonb
           )
           ON CONFLICT (id) DO UPDATE SET
               username = EXCLUDED.username,
               password_hash = EXCLUDED.password_hash,
               avatar = EXCLUDED.avatar,
               created_at = EXCLUDED.created_at,
               stats = EXCLUDED.stats`,
          [
            JSON.stringify(
              snapshot.users.map((user) => ({
                id: user.id,
                username: user.username,
                password_hash: user.passwordHash,
                avatar: user.avatar,
                created_at: user.createdAt,
                stats: user.stats,
              })),
            ),
          ],
        );

        await client.query("DELETE FROM cvt_history");
        await client.query(
          `INSERT INTO cvt_history (id, user_id, ended_at, payload)
           SELECT id, user_id, ended_at, payload
           FROM jsonb_to_recordset($1::jsonb) AS x(
             id text, user_id text, ended_at bigint, payload jsonb
           )`,
          [
            JSON.stringify(
              snapshot.history.map((entry) => ({
                id: entry.id,
                user_id: entry.userId,
                ended_at: entry.endedAt,
                payload: entry,
              })),
            ),
          ],
        );
        await client.query(
          `INSERT INTO cvt_results (code, payload)
           SELECT code, payload
           FROM jsonb_to_recordset($1::jsonb) AS x(code text, payload jsonb)
           ON CONFLICT (code) DO UPDATE SET payload = EXCLUDED.payload`,
          [JSON.stringify(Object.entries(snapshot.results).map(([code, payload]) => ({ code, payload })))],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    });
    await this.writeQueue;
  }

  async close(): Promise<void> {
    await this.flush();
    await this.pool?.end();
    this.pool = null;
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
