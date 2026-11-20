import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { config } from "./config.js";
import { engine } from "./game/engine.js";
import { initRealtime } from "./realtime.js";
import routes from "./routes.js";
import { store } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "200kb" }));
app.set("trust proxy", 1);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), now: Date.now() });
});
app.use("/api", routes);

// Serve the built client in production.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.clientOrigins,
    credentials: true,
  },
  pingInterval: 20_000,
  pingTimeout: 20_000,
});

async function start() {
  await store.initialize();
  initRealtime(io);
  engine.startTicking();
  server.listen(config.port, () => {
    console.log(`[server] Cops vs Thieves API listening on port ${config.port}`);
    console.log(`[server] allowed client origins: ${config.clientOrigins.join(", ")}`);
  });
}

void start().catch((err: unknown) => {
  console.error("[server] failed to initialize", err);
  process.exitCode = 1;
});

function shutdown(signal: string) {
  console.log(`\n[server] ${signal} received, shutting down`);
  engine.stopTicking();
  io.close();
  server.close(() => {
    void store.close().then(
      () => process.exit(0),
      (err: unknown) => {
        console.error("[store] failed to flush on shutdown", err);
        process.exit(1);
      },
    );
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app, io, server };
