# Cops vs Thieves - Server Setup

## Prerequisites

- Node.js v20+ (recommended)
- npm or yarn
- PostgreSQL (optional - JSON file store used by default)
- Map API keys (Google Maps or Mapbox - optional for demo)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd cops-vs-thieves
```

### 2. Install dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install
```

### 3. Environment configuration

Create a `.env` file in the `server/` directory:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your settings:

```
PORT=4000
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

**Important**: Set `JWT_SECRET` to a stable value for persistent sessions across restarts. If not set, a random secret is generated each restart.

### 4. Data directory

The server uses a local JSON file for persistence by default. No database setup required for basic operation.

```bash
# The data directory will be created automatically
# server/data/db.json stores users, history, and results
```

### 5. Run the server

```bash
# Development mode
npm run dev

# Or directly with tsx
npx tsx watch src/index.ts
```

Server will start on `http://localhost:4000`

### 6. Run the client

```bash
# From the client directory
npm run dev
```

Client will be available at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/me` - Get current user profile
- `PATCH /api/me` - Update profile
- `GET /api/leaderboard` - Get top 50 players
- `GET /api/history` - Get user game history

### Rooms
- `POST /api/rooms` - Create a new room (requires auth)
- `GET /api/rooms/public` - List public rooms in lobby
- `GET /api/rooms/mine` - Get user's current room
- `GET /api/rooms/:code/preview` - Preview a room
- `GET /api/rooms/:code` - Get full room details
- `POST /api/rooms/:code/join` - Join a room (requires auth)
- `POST /api/rooms/:code/leave` - Leave a room
- `POST /api/rooms/:code/ready` - Set ready status
- `PATCH /api/rooms/:code/settings` - Update settings (host only)
- `POST /api/rooms/:code/roles` - Assign roles (host only)
- `POST /api/rooms/:code/start` - Start game (host only)
- `POST /api/rooms/:code/end` - End game (host only)

### Game Actions (Socket.IO)
Location updates, scans, radar, captures, and abilities are handled via Socket.IO:
- `game:location` - Send GPS location update
- `game:scan` - Police scan thief positions
- `game:radar` - Police radar detection
- `game:capture` - Attempt thief capture
- `game:ability` - Use thief abilities (invisibility, decoy, radar-shield)
- `game:end` - End game
- `game:rejoin` - Rejoin active game

## Socket.IO Connection

Clients connect with authentication:

```javascript
const socket = io("http://localhost:4000", {
  auth: { token: localStorage.getItem("token") },
  transports: ["websocket"]
});
```

The server verifies the JWT token and associates the socket with the user's room.

## Features Implemented

1. **Authentication**: JWT-based with bcrypt password hashing
2. **Room Management**: Create, join, leave, with configurable settings
3. **Role Assignment**: Random or host-assigned police/thief roles
4. **GPS Location Tracking**: Real-time location sharing via HTML5 Geolocation
5. **Cooldown System**: Configurable scan, radar, capture, and ability cooldowns
6. **Boundary System**: Circular and polygon play areas with grace period
7. **Capture System**: Distance-based capture with GPS accuracy validation
8. **Power-ups**: Invisibility, decoy, radar shield
9. **Safe Zones**: Configurable temporary safe zones
10. **Game Timer**: Configurable duration with winning conditions
11. **Statistics**: Per-player wins, captures, distance, survival time
12. **Leaderboard**: Global ranking based on wins and captures
13. **History**: Per-user game history persistence

## Production Considerations

### Database Migration

For production, replace the JSON file store (`server/src/store.ts`) with PostgreSQL + PostGIS:

1. Install: `npm install pg postgis`
2. Set up database with PostGIS extension
3. Modify `store.ts` to use `pg` pool for user/result persistence
4. The in-memory game engine can remain as-is

### Map API Keys

If using Google Maps or Mapbox, add API keys to environment:

```
VITE_GOOGLE_MAPS_KEY=your-google-maps-key
VITE_MAPBOX_KEY=your-mapbox-key
```

Update the TileLayer URLs in the respective screen components.

### HTTPS and Production

- Set `NODE_ENV=production`
- Set `CLIENT_ORIGIN` to your production domain
- Use a proper SSL certificate
- Set `JWT_SECRET` in environment (never use the generated random secret in production)

### Rate Limiting

The server includes per-IP rate limiting:
- Auth: 20 requests per 60 seconds
- General API: 240 requests per 60 seconds

Adjust in `server/src/config.ts` if needed.

## Client Setup

### Vite Configuration

The client uses Vite with React and Tailwind CSS. No additional configuration needed for standard operation.

### Required Dependencies

Already included in `client/package.json`:
- `react`, `react-dom`
- `react-router-dom`
- `socket.io-client`
- `react-leaflet`
- `leaflet`
- `tailwindcss`
- `@tailwindcss/vite`

## License

This project is for educational and demo purposes.