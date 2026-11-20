import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { store } from "./store.js";
import type { PublicUser, UserRecord } from "./types.js";

export interface AuthedRequest extends Request {
  user?: UserRecord;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username, avatar: user.avatar, stats: user.stats };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: UserRecord): string {
  return jwt.sign({ sub: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

/** Express middleware: requires a valid bearer token. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const user = store.findUserById(payload.sub);
  if (!user) {
    res.status(401).json({ error: "Account no longer exists." });
    return;
  }
  req.user = user;
  next();
}

/** Minimal in-memory fixed-window rate limiter. */
export function rateLimit(options: { windowMs: number; max: number; key?: (req: Request) => string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.key ? options.key(req) : req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > options.max) {
      res.status(429).json({ error: "Too many requests. Slow down and try again shortly." });
      return;
    }
    next();
  };
}
