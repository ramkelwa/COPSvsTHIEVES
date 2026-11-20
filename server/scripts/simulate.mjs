/**
 * End-to-end multiplayer smoke test.
 *
 * Requires the server to be running (npm run dev:server or npm start).
 * Run with: npm run simulate
 *
 * It registers two throwaway players, creates and joins a room over HTTP,
 * records GPS checks, starts the match, streams locations over Socket.IO,
 * scans, captures, and verifies the stored result — including a privacy check
 * that a thief's client never receives live police locations in the roster.
 */
import { io } from "socket.io-client";

const BASE = process.env.BASE_URL || "http://localhost:4000";
const suffix = Math.random().toString(36).slice(2, 7);
const PASSWORD = "simulate123";
const CENTER = { lat: 51.5074, lng: -0.1278 };

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data.error ?? ""}`);
  return data;
}

function connect(token) {
  const client = {
    socket: io(BASE, { auth: { token }, transports: ["websocket"], forceNew: true }),
    state: null,
  };
  client.socket.on("game:state", (view) => {
    client.state = view;
  });
  return client;
}

function waitFor(predicate, { timeout = 15000, interval = 100, label = "condition" } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      let value;
      try {
        value = predicate();
      } catch {
        value = undefined;
      }
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${label}`));
      }
    }, interval);
  });
}

const emitAck = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

async function main() {
  console.log(`Simulating against ${BASE}`);
  const health = await api("/health");
  check("server health endpoint responds", health.ok === true);

  const players = [];
  for (let i = 0; i < 2; i += 1) {
    const username = `sim_${suffix}_${i}`;
    players.push(await api("/auth/register", { method: "POST", body: { username, password: PASSWORD } }));
  }
  check("two accounts registered", players.length === 2 && players.every((p) => p.token && p.user.id));

  const host = players[0];
  const guest = players[1];

  const { room: created } = await api("/rooms", {
    method: "POST",
    token: host.token,
    body: {
      name: `Simulation ${suffix}`,
      isPrivate: true,
      settings: {
        mode: "classic",
        maxPlayers: 4,
        durationSec: 300,
        scanCooldownSec: 5,
        policeRevealSec: 30,
        captureRadiusM: 30,
        maxAccuracyM: 100,
        boundary: { type: "circle", center: CENTER, radiusM: 300 },
      },
    },
  });
  const code = created.code;
  check("room created with 5-char code", /^[A-Z0-9]{5}$/.test(code), code);

  await api(`/rooms/${code}/join`, { method: "POST", token: guest.token });
  const joined = await api(`/rooms/${code}`, { token: guest.token });
  check("guest joined the lobby", joined.room.players.length === 2);

  // Starting without GPS checks must be rejected.
  let startBlocked = false;
  try {
    await api(`/rooms/${code}/start`, { method: "POST", token: host.token });
  } catch {
    startBlocked = true;
  }
  check("start is blocked until GPS checks pass", startBlocked);

  await api(`/rooms/${code}/gps`, { method: "POST", token: host.token, body: { accuracy: 8 } });
  await api(`/rooms/${code}/gps`, { method: "POST", token: guest.token, body: { accuracy: 12 } });
  await api(`/rooms/${code}/ready`, { method: "POST", token: guest.token, body: { ready: true } });
  await api(`/rooms/${code}/start`, { method: "POST", token: host.token });

  const hostClient = connect(host.token);
  const guestClient = connect(guest.token);
  const clients = [hostClient, guestClient];

  await Promise.all(
    clients.map((client) =>
      new Promise((resolve) => {
        if (client.socket.connected) resolve();
        else client.socket.once("connect", resolve);
      }),
    ),
  );
  await Promise.all(clients.map((client) => emitAck(client.socket, "room:enter", { code })));

  await waitFor(() => clients.every((c) => c.state?.code === code), { label: "room state" });
  const started = clients.map((c) => c.state).find((s) => s.status === "active");
  check("match is active for both clients", Boolean(started) && clients.every((c) => c.state.status === "active"));

  const policeClient = clients.find((c) => c.state.me?.role === "police");
  const thiefClient = clients.find((c) => c.state.me?.role === "thief");
  check("roles were assigned (one police, one thief)", Boolean(policeClient && thiefClient));

  const sendLocation = (client) =>
    emitAck(client.socket, "game:location", {
      ...CENTER,
      accuracy: 5,
      timestamp: Date.now(),
    });
  const hostLoc = await sendLocation(hostClient);
  const guestLoc = await sendLocation(guestClient);
  check("both GPS updates accepted", hostLoc?.ok === true && guestLoc?.ok === true);

  await waitFor(() => policeClient.state.me?.location && thiefClient.state.me?.location, {
    label: "locations to appear in state",
  });

  // Privacy: a thief's roster must not contain live police coordinates.
  const policeId = policeClient.state.me.id;
  const thiefViewOfPolice = thiefClient.state.players.find((p) => p.id === policeId);
  check(
    "thief never receives live police roster coordinates",
    !thiefViewOfPolice?.location,
    JSON.stringify(thiefViewOfPolice?.location),
  );

  const scan = await emitAck(policeClient.socket, "game:scan");
  check("police scan returns thief intel", scan?.ok === true && Array.isArray(scan.data?.players) && scan.data.players.length === 1);

  await waitFor(() => policeClient.state.intel?.players?.length === 1, { label: "scan intel in state" });
  const thiefId = thiefClient.state.me.id;
  const capture = await emitAck(policeClient.socket, "game:capture", { targetId: thiefId });
  check("capture within radius succeeds", capture?.ok === true, capture?.error);

  const ended = await waitFor(() => clients.find((c) => c.state?.status === "ended"), {
    timeout: 8000,
    label: "game end state",
  });
  check("game ended automatically after all thieves caught", ended.state.status === "ended");
  check("police won", ended.state.winner === "police", String(ended.state.winner));

  const { results } = await api(`/results/${code}`, { token: host.token });
  check("stored results contain both players", results.players.length === 2);
  check("stored result marks police as winner", results.winner === "police");

  // After the game ended, further captures must be refused.
  const lateCapture = await emitAck(policeClient.socket, "game:capture", { targetId: thiefId });
  check("ended matches reject further captures", lateCapture?.ok === false);

  clients.forEach((c) => c.socket.disconnect());
  console.log(failures === 0 ? "\nAll simulation checks passed." : `\n${failures} simulation check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
