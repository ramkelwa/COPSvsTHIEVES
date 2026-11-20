import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { hashPassword, rateLimit, requireAuth, signToken, toPublicUser, verifyPassword } from "./auth.js";
import type { AuthedRequest } from "./auth.js";
import { engine } from "./game/engine.js";
import { store } from "./store.js";
import type { Role, RoomSettings } from "./types.js";

const router = Router();

const avatarSchema = z.string().max(8).optional();
const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const latLng = z.object({ lat: z.number().min(-85).max(85), lng: z.number().min(-180).max(180) });
const boundarySchema = z.union([
  z.object({ type: z.literal("circle"), center: latLng, radiusM: z.number().min(20).max(20_000) }),
  z.object({ type: z.literal("polygon"), points: z.array(latLng).min(3).max(100) }),
]);

const settingsSchema = z
  .object({
    mode: z.enum(["classic", "team", "survival"]).optional(),
    maxPlayers: z.number().int().min(2).max(40).optional(),
    durationSec: z.number().int().min(60).max(10800).optional(),
    policeCount: z.number().int().min(1).max(20).optional(),
    scanCooldownSec: z.number().int().min(5).max(600).optional(),
    policeRevealSec: z.number().int().min(10).max(1800).optional(),
    captureRadiusM: z.number().int().min(5).max(100).optional(),
    maxAccuracyM: z.number().int().min(10).max(200).optional(),
    accuracyToleranceM: z.number().int().min(0).max(100).optional(),
    boundaryGraceSec: z.number().int().min(5).max(120).optional(),
    locationIntervalMs: z.number().int().min(1000).max(60000).optional(),
    headStartSec: z.number().int().min(0).max(600).optional(),
    radar: z.boolean().optional(),
    radarCooldownSec: z.number().int().min(5).max(600).optional(),
    radarRadiusM: z.number().int().min(20).max(1000).optional(),
    safeZones: z.boolean().optional(),
    safeZoneList: z
      .array(
        z.object({
          id: z.string().max(40).optional(),
          lat: z.number().min(-85).max(85),
          lng: z.number().min(-180).max(180),
          radiusM: z.number().min(10).max(500),
        }),
      )
      .max(10)
      .optional(),
    abilities: z.boolean().optional(),
    boundary: boundarySchema.optional(),
  })
  .strict();

const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });
const apiLimiter = rateLimit({ windowMs: 60_000, max: 240 });

// ---------- Auth ----------

router.post("/auth/register", authLimiter, async (req, res, next) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const avatar = avatarSchema.parse(req.body?.avatar) || "😎";
  if (store.findUserByUsername(parsed.data.username)) {
    res.status(409).json({ error: "That username is taken." });
    return;
  }
  const user = store.createUser({
    id: crypto.randomUUID(),
    username: parsed.data.username,
    passwordHash: await hashPassword(parsed.data.password),
    avatar,
    createdAt: Date.now(),
    stats: { gamesPlayed: 0, wins: 0, captures: 0, distanceM: 0, survivalMs: 0 },
  });
  try {
    await store.flush();
  } catch (err) {
    next(err);
    return;
  }
  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
});

router.post("/auth/login", authLimiter, async (req, res) => {
  const parsed = z
    .object({ username: z.string().trim().min(1), password: z.string().min(1) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }
  const user = store.findUserByUsername(parsed.data.username);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Wrong username or password." });
    return;
  }
  res.json({ token: signToken(user), user: toPublicUser(user) });
});

router.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: toPublicUser(req.user!) });
});

router.patch("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  const parsed = z
    .object({
      username: z
        .string()
        .trim()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only")
        .optional(),
      avatar: z.string().max(8).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  if (parsed.data.username) {
    const existing = store.findUserByUsername(parsed.data.username);
    if (existing && existing.id !== req.user!.id) {
      res.status(409).json({ error: "That username is taken." });
      return;
    }
  }
  const updated = store.updateUser(req.user!.id, {
    ...(parsed.data.username ? { username: parsed.data.username } : {}),
    ...(parsed.data.avatar ? { avatar: parsed.data.avatar } : {}),
  });
  try {
    await store.flush();
  } catch (err) {
    next(err);
    return;
  }
  res.json({ user: toPublicUser(updated!) });
});

router.get("/leaderboard", requireAuth, (_req, res) => {
  res.json({ leaderboard: store.leaderboard(50) });
});

router.get("/history", requireAuth, (req: AuthedRequest, res) => {
  res.json({ history: store.historyFor(req.user!.id, 30) });
});

router.get("/results/:code", requireAuth, (req: AuthedRequest, res) => {
  const results = store.getResult(req.params.code.toUpperCase());
  if (!results) {
    res.status(404).json({ error: "No results stored for that room." });
    return;
  }
  if (!results.players.some((p) => p.id === req.user!.id)) {
    res.status(403).json({ error: "You did not play in that match." });
    return;
  }
  res.json({ results });
});

// ---------- Rooms ----------

router.use(apiLimiter);

router.post("/rooms", requireAuth, (req: AuthedRequest, res) => {
  const parsed = z
    .object({
      name: z.string().trim().max(40).optional(),
      isPrivate: z.boolean().optional(),
      settings: settingsSchema,
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid room configuration" });
    return;
  }
  const result = engine.createRoom(req.user!, {
    name: parsed.data.name || `${req.user!.username}'s game`,
    isPrivate: parsed.data.isPrivate ?? true,
    settings: parsed.data.settings as Partial<RoomSettings>,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ room: engine.serializeRoom(result.data, req.user!.id) });
});

router.get("/rooms/public", requireAuth, (_req, res) => {
  res.json({ rooms: engine.publicRooms() });
});

router.get("/rooms/mine", requireAuth, (req: AuthedRequest, res) => {
  const room = engine.roomOfUser(req.user!.id);
  if (!room) {
    res.json({ room: null });
    return;
  }
  res.json({ room: engine.serializeRoom(room, req.user!.id) });
});

router.get("/rooms/:code/preview", requireAuth, (req, res) => {
  const room = engine.getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  res.json({ room: engine.summary(room) });
});

router.get("/rooms/:code", requireAuth, (req: AuthedRequest, res) => {
  const room = engine.getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  if (!room.players.has(req.user!.id)) {
    res.status(403).json({ error: "Join the room to view it." });
    return;
  }
  res.json({ room: engine.serializeRoom(room, req.user!.id) });
});

router.post("/rooms/:code/join", requireAuth, (req: AuthedRequest, res) => {
  const result = engine.joinRoom(req.params.code, req.user!);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  // The real socket attaches through `room:enter`; no fake socket ids here, so a
  // closed tab correctly marks the player offline.
  res.json({ room: engine.serializeRoom(result.data, req.user!.id) });
});

router.post("/rooms/:code/leave", requireAuth, (req: AuthedRequest, res) => {
  const result = engine.leaveRoom(req.user!.id);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post("/rooms/:code/ready", requireAuth, (req: AuthedRequest, res) => {
  const parsed = z.object({ ready: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ready must be a boolean" });
    return;
  }
  const result = engine.setReady(req.user!.id, parsed.data.ready);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post("/rooms/:code/gps", requireAuth, (req: AuthedRequest, res) => {
  const parsed = z.object({ accuracy: z.number().min(0.1).max(500) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid GPS accuracy in metres is required." });
    return;
  }
  const room = engine.getRoom(req.params.code);
  if (!room || !room.players.has(req.user!.id)) {
    res.status(403).json({ error: "You are not in that room." });
    return;
  }
  const result = engine.recordGpsCheck(req.user!.id, parsed.data.accuracy);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, ...result.data });
});

router.patch("/rooms/:code/settings", requireAuth, (req: AuthedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" });
    return;
  }
  const result = engine.updateSettings(req.user!.id, parsed.data as Partial<RoomSettings>);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ settings: result.data });
});

router.post("/rooms/:code/roles", requireAuth, (req: AuthedRequest, res) => {
  const parsed = z
    .object({ assignments: z.record(z.enum(["police", "thief"])).optional(), auto: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "assignments must map player ids to police/thief" });
    return;
  }
  if (!parsed.data.auto && !parsed.data.assignments) {
    res.status(400).json({ error: "Provide assignments or auto: true." });
    return;
  }
  const result = engine.assignRoles(
    req.user!.id,
    parsed.data.auto ? null : (parsed.data.assignments as Record<string, Role>),
  );
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post("/rooms/:code/start", requireAuth, (req: AuthedRequest, res) => {
  const result = engine.startGame(req.user!.id);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post("/rooms/:code/end", requireAuth, (req: AuthedRequest, res) => {
  const result = engine.endGameByHost(req.user!.id);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

export default router;
