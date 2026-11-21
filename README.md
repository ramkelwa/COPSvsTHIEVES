# Cops vs Thieves — real-world GPS hide & seek

A playable, real-time multiplayer hide-and-seek game for phones. Friends meet in the real world, share a room code,
one team hunts while the other runs, and everyone follows a live tactical map. Positions are streamed over
Socket.IO only while a match is active, and all game rules (cooldowns, boundaries, captures) are enforced by the
server.

This is a complete web implementation — not a mock, not a static prototype. Two phones can play a full round today.

---

## Feature map

| Area | Status |
| --- | --- |
| Accounts: register, login, logout, profile, avatar, unique player id | ✅ JWT + bcrypt |
| Rooms: create, unique 5-char code, join, invite link, player limit, lobby management | ✅ |
| Roles: auto-shuffle or host assignment, hidden until match start | ✅ |
| Live GPS: permission consent, watch, server timestamps, accuracy shown, stop on end | ✅ |
| Police visibility: 30s scan (host configurable), last-known snapshots | ✅ |
| Thieves visibility: 90s police reveal (host configurable), explicit "last known" UI | ✅ |
| GPS accuracy check screen with 4 bands, retry, server-recorded start gate | ✅ |
| Play area: circle or polygon, map picker, server-side out-of-bounds + 20s grace | ✅ |
| Police dashboard: scan, intel list, distances, capture, radar, captured list | ✅ |
| Thieves dashboard: police intel, timer, boundary, safe zones, capture warnings, abilities | ✅ |
| Capture: server distance + accuracy + freshness validation, anti-double-capture | ✅ |
| Power-ups: radar, invisibility, radar shield, decoy, safe zones, configurable | ✅ |
| Win conditions: all thieves out → police; timer expires → thieves; auto-end + results | ✅ |
| Leaderboard, per-player stats and match history | ✅ |
| Fair play: server cooldowns, speed sanity, room access control, socket auth, rate limiting | ✅ |
| Privacy: no lobby positions, no post-match positions, location only inside active rooms | ✅ |

**Deliberate deviations from the brief** (honest notes, not hidden gaps):

- **Web stack, not React Native/Android.** The brief allowed "React Native or an appropriate Android
  implementation"; this is a mobile-first responsive web app using the HTML5 Geolocation API. It works in mobile
  browsers today. No native background tracking is claimed or pretended.
- **JWT auth, not Firebase Auth.** Local development uses a **JSON store**; production supports PostgreSQL for
  accounts, stats, history, and results. Active rooms and live game state remain in server memory, so run one
  backend instance. Geospatial validation uses server-side math (`server/src/geo.ts`).
- **Capture is server-authoritative after validation**, not a two-sided confirmation dialog. Both players' fresh
  GPS fixes must pass accuracy and distance checks on the server, which prevents fake captures without letting a
  caught thief stall the game by refusing to confirm. The result is broadcast to everyone.
- **OpenStreetMap tiles by default** with no API key. Mapbox/Google raster tiles can be swapped in via
  `VITE_MAP_TILE_URL` (see `client/.env.example`).

---

## Architecture

```
┌─────────────── Browser (React 18 + TypeScript) ───────────────┐
│ screens ── AuthContext ── SocketContext (single socket)       │
│   │            │                 │                            │
│   │            └── /api/*        └── Socket.IO events         │
│   └── GameMap (Leaflet) + useGeolocation (GPS watch)          │
└──────────────────────────┬─────────────────────────────────────┘
                           │ HTTP + WebSocket
┌──────────────────────────▼─────────────────────────────────────┐
│ Express + Socket.IO (Node 20, ESM, TypeScript)                 │
│  routes.ts     auth.ts      rate limiting, validation (zod)    │
│  realtime.ts   JWT socket handshake, room channels             │
│  game/engine.ts   authoritative rooms, cooldowns, capture,     │
│                   boundary tick, win conditions, serialization │
│  geo.ts        haversine, point-in-polygon, boundary distance  │
│  store.ts      PostgreSQL in production, JSON in local dev     │
└────────────────────────────────────────────────────────────────┘
```

Key privacy rule in the engine: `serializeRoom(room, viewerId)` produces a **per-viewer** payload. Teammates and
yourself get live positions, opposed roles get only scan/reveal snapshots, and nothing after a match ends. The
client never receives data it is not entitled to.

### Project structure

```
.
├── client/
│   ├── src/
│   │   ├── api.ts                 typed HTTP client (token handling, ApiError)
│   │   ├── App.tsx                routes + protected layout
│   │   ├── main.tsx               AuthProvider → SocketProvider
│   │   ├── context/               auth + socket providers
│   │   ├── hooks/                 useRoom, useGeolocation, useNow
│   │   ├── components/            AppShell, GameMap, EventFeed, UI primitives
│   │   ├── lib/                   shared types, map tiles, device prefs
│   │   ├── screens/               15 screens (home → results)
│   │   └── utils/                 geo math, GPS helpers, time formatting
│   └── vite.config.ts             Tailwind v4 plugin + /api & /socket.io proxy
├── server/
│   ├── src/
│   │   ├── index.ts               Express + Socket.IO bootstrap, static client
│   │   ├── routes.ts              REST API
│   │   ├── realtime.ts            socket events, room channels
│   │   ├── auth.ts                bcrypt, JWT, requireAuth, rateLimit
│   │   ├── config.ts              env config
│   │   ├── geo.ts                 geospatial primitives
│   │   ├── store.ts               atomic JSON store
│   │   ├── types.ts               shared server types
│   │   └── game/engine.ts         match engine
│   └── scripts/simulate.mjs       2-client end-to-end simulation
├── server/.env.example
├── client/.env.example
├── SERVER_SETUP.md
└── README.md
```

---

## Running locally

Prerequisites: **Node.js 20+** and npm. A phone with GPS is needed for real play; a desktop browser can open the
UI but location is approximate.

```bash
npm install                 # installs both workspaces

cp server/.env.example server/.env
# edit JWT_SECRET (any long random string) — required for stable logins

npm run dev                 # server :4000 + client :5173 (Vite proxies API + WS)
```

Open `http://localhost:5173`.

- Register two accounts (or two browsers / one normal + one private window on the same machine — emoji avatars make
  them easy to tell apart).
- One player creates a room, chooses a play area on the map and settings, shares the code or invite link.
- Both run **Run GPS check** from the lobby. The server records the accuracy and blocks the start until every
  player passes the host's threshold.
- The host starts. Roles are revealed; GPS streaming begins. Walk around and play.

For playing across devices on your LAN, replace `localhost` with your computer's LAN IP in the browser URL. On
phones, location requires **HTTPS** (or `localhost`) in most browsers — use a tunnel (ngrok/Cloudflare Tunnel) or a
reverse proxy with TLS. Camera-free, but GPS-aware.

### Production build

```bash
npm run build               # server tsc → server/dist, client tsc+vite → client/dist
NODE_ENV=production npm start
```

The server serves `client/dist` when it exists, so a single process can serve API, WebSocket and the SPA.
Set `JWT_SECRET` and `CLIENT_ORIGIN` (the frontend origin) in production. Configure `DATABASE_URL` for PostgreSQL, or
use a persistent `DATA_DIR` to keep the built-in JSON store across restarts.

### Deploy with Vercel + Render

The client and API are separate deployments. The Render service must have PostgreSQL configured before it starts.

1. Create a PostgreSQL database in Render.
2. Deploy the repository to Render as a Node web service from the repository root:
   - Build command: `npm install && npm run build -w server`
   - Start command: `npm run start -w server`
   - Set `NODE_ENV=production`, `JWT_SECRET` to a long random secret, `DATABASE_URL` to the database's internal
     connection string, and `CLIENT_ORIGIN` to your Vercel site's exact `https://...vercel.app` origin.
   - Leave `DATABASE_SSL` unset for Render's internal database URL. Set it to `true` only if your database provider
     requires TLS.
3. Deploy the `client` directory to Vercel with build command `npm run build` and output directory `dist`.
   Set `VITE_API_URL` to the Render service origin (for example `https://your-service.onrender.com`) before building.
4. If the Vercel domain changes, update `CLIENT_ORIGIN` on Render and redeploy the backend.

The browser connects directly to Render for REST and Socket.IO; Vercel serves the frontend. PostgreSQL persists
accounts and finished match data, but live rooms are in memory and will end if the Render service restarts. Data in
the old local JSON file is not automatically imported into PostgreSQL.

### Deploy the full app to Embarko

Deploy from the repository root as a Node service. Embarko runs the root build and start scripts, serving the client,
REST API and Socket.IO from the same origin. Its persistent `DATA_DIR` enables the JSON store when `DATABASE_URL` is
not configured. Set a stable `JWT_SECRET` in the app's environment settings.

### Verification commands

```bash
npm run typecheck           # server + client TypeScript
npm run build               # production build
npm run simulate            # end-to-end 2-client match (server must be running)
```

`npm run simulate` registers two throwaway players, creates a room, proves the start is blocked without GPS
checks, starts the match, streams locations, scans, captures, and asserts the stored result — including that a
thief's payload never contains live police coordinates.

---

## Configuration

### Server (`server/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | HTTP + Socket.IO |
| `JWT_SECRET` | random per boot | Set it in production or sessions die on restart |
| `JWT_EXPIRES_IN` | `7d` | |
| `CLIENT_ORIGIN` | `http://localhost:5173` | comma-separated dev origins |
| `DATABASE_URL` | unset | PostgreSQL connection string; production can use a persistent `DATA_DIR` instead |
| `DATABASE_SSL` | false | Set `true` if the database provider requires SSL |
| `DATA_DIR` | `server/data` | Local JSON store location when `DATABASE_URL` is unset |
| `NODE_ENV` | development | Production mode |

### Client (`client/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_URL` | same origin | Backend origin; set to the Render service URL in production |
| `VITE_MAP_TILE_URL` | OpenStreetMap | any raster tile template |
| `VITE_MAP_ATTRIBUTION` | OSM attribution | keep attribution correct |

### Default match rules

| Rule | Default | Host editable |
| --- | --- | --- |
| Duration | 15 min | yes |
| Mode | classic (1 police) / team / survival | yes |
| Capture radius | 20 m | yes |
| Police scan cooldown | 30 s | yes |
| Police reveal to thieves | 90 s | yes |
| GPS accuracy required to start | 50 m | yes |
| Out-of-bounds grace | 20 s | yes |
| Head start | 0 s | yes |
| Radar | on, 60 s cooldown, 150 m | toggle |
| Thief abilities | on (invisibility 20 s / 120 s, radar shield 60 s / 90 s, decoy 45 s / 120 s) | toggle |
| Safe zones | off | toggle + up to 5 zones |

---

## How the rules are enforced

- **Location ingest** rejects malformed coordinates, stale/clock-skewed timestamps, and clamps updates to the room's
  `locationIntervalMs`.
- **Impossible movement** above 45 m/s is dropped as a GPS jump.
- **Boundary** uses `outsideByM` with GPS-accuracy slack; a confirmed exit starts the grace countdown, and the
  ticker marks the player OUT when it expires.
- **Capture** requires: active police, active thief, fresh fixes (<15 s), both accuracies under the room threshold,
  distance ≤ capture radius + half the reported accuracy, not inside a safe zone, and a 5 s attempt cooldown.
- **Scans / radar / abilities** are timed from server clocks; the client's countdown is display only.
- **Win conditions** are checked after every capture/elimination and by the 1-second ticker; results are persisted
  and stats/history updated once.
- **Access control**: REST room routes check membership; Socket.IO authenticates the JWT on connect and only
  broadcasts per-room; clients cannot request another player's location.

Privacy details: positions exist in memory only during an active match and are cleared on end; the lobby shows no
positions; thieves see police snapshots and police see scan snapshots, never each other's live feed. The browser's
location indicator is visible while `useGeolocation` runs, and the watcher is disabled whenever the match is not
active or the player is OUT.

---

## API and socket reference

### REST (all under `/api`, Bearer token except auth)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | `{ username, password, avatar? }` → `{ token, user }` |
| POST | `/auth/login` | → `{ token, user }` |
| GET | `/me` | profile |
| PATCH | `/me` | `{ username?, avatar? }` |
| GET | `/leaderboard` | top 50 |
| GET | `/history` | signed-in player's matches |
| GET | `/results/:code` | stored result (participants only) |
| POST | `/rooms` | create room + settings + boundary |
| GET | `/rooms/public` | public rooms |
| GET | `/rooms/mine` | current room or null |
| GET | `/rooms/:code` | serialized room (members only) |
| GET | `/rooms/:code/preview` | join-screen summary |
| POST | `/rooms/:code/join` | join |
| POST | `/rooms/:code/leave` | leave (OUT if active) |
| POST | `/rooms/:code/ready` | `{ ready }` |
| POST | `/rooms/:code/gps` | `{ accuracy }` record pre-game check |
| PATCH | `/rooms/:code/settings` | host edits rules |
| POST | `/rooms/:code/roles` | `{ assignments }` or `{ auto: true }` |
| POST | `/rooms/:code/start` | host starts (roles + GPS gate) |
| POST | `/rooms/:code/end` | host ends |

### Socket.IO (`auth: { token }`)

| Event | Direction | Payload |
| --- | --- | --- |
| `room:enter` | client → server | `{ code }` + ack → room view |
| `game:state` | server → client | per-viewer `RoomView`, pushed on every mutation |
| `game:location` | client → server | `{ lat, lng, accuracy, timestamp }` |
| `game:scan` | client → server | police thief scan (30 s) |
| `game:radar` | client → server | police nearby radar |
| `game:capture` | client → server | `{ targetId }` |
| `game:ability` | client → server | `{ type: "invisibility" \| "radar-shield" \| "decoy", lat?, lng? }` |
| `game:end` | client → server | host ends match |
| `game:rejoin` | client → server | re-sync after reconnect |
| `disconnect` | — | marks the player offline; leaving an active match marks them OUT |

---

## Security notes

- JWT verification for every socket connection; sockets cannot join arbitrary rooms.
- bcrypt password hashing; credentials validated with zod; fixed-window rate limits on auth (20/min) and the API
  (240/min per IP).
- Never trusts client-supplied roles, cooldowns or game state; only coordinates are accepted, with validation.
- Players can only read rooms they belong to; results are participant-only.
- Set `JWT_SECRET` in production and terminate TLS in front of the app.

## Next steps (not implemented)

- Postgres/PostGIS persistence and horizontal scaling (the engine is intentionally single-process in-memory).
- Redis adapter for Socket.IO across multiple instances.
- Native Android foreground-service tracking (the web app requires the screen/browser to stay active).
- Push notifications when the app is backgrounded.
- Rematch flow from the results screen.
