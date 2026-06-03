# Da Crewmates

Da Crewmates is a gamified social platform designed to reduce doom-scrolling by turning social interaction into a navigable space-station experience.

## Tech Stack

- Frontend shell: React + Vite (`src/`)
- Game module: Vanilla HTML/CSS/JS (`game/`)
- Backend: Node HTTP server + SQLite (`server/`)

## Repository Layout

- `src/`: Landing, splash, login, React app shell
- `game/`: Core game world, map logic, tablet UIs, zone systems
- `server/`: Auth, social APIs, APOD endpoint, SQLite data
- `index.html`: Vite root entry for React
- `package.json`: Scripts for frontend and backend

## Local Development

From project root:

1. Install dependencies
```bash
npm install
```

2. Start backend
```bash
npm run api:dev
```

3. Start frontend
```bash
npm run dev
```

Then open the Vite URL (usually `http://localhost:5173`).

## Two-Device LAN Demo

Use one computer as the host for both the API and frontend.

1. Find the host computer's LAN IP address.
2. In one terminal, start the backend:
```bash
npm run api:dev
```
3. In another terminal, start Vite on the network:
```bash
npm run dev -- --host 0.0.0.0
```
4. Set `VITE_API_BASE_URL` to `http://<host-lan-ip>:4000` before starting Vite if the second device is not the host computer.
5. Open `http://<host-lan-ip>:5173` on both devices.

Demo flow: create two crew accounts, send and accept a friend request, create a post in Electrical, share it from a feed surface, and read it on the other device in Communications > Messages. MedBay updates when rooms are opened because room visits are persisted by the backend.

## Current Integration Notes

- React login flow is the primary entry.
- After login, game module is loaded from `/game/index.html`.
- APOD uses single backend route: `GET /api/space/apod`.
- Local DB path: `server/data/devspace.sqlite`.
