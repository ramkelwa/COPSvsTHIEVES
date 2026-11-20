import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: optionalNumber("PORT", 4000),
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  dataDir: process.env.DATA_DIR || path.join(__dirname, "..", "data"),
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
  isProd: process.env.NODE_ENV === "production",
  /** Hard cap on room capacity. */
  maxRoomPlayers: 40,
};

if (!process.env.JWT_SECRET) {
  console.warn(
    "[config] JWT_SECRET is not set. A random secret was generated: all sessions end when the server restarts. Set JWT_SECRET in server/.env for stable logins.",
  );
}
