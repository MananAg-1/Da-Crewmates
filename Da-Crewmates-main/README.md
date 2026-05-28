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

## Current Integration Notes

- React login flow is the primary entry.
- After login, game module is loaded from `/game/index.html`.
- APOD uses single backend route: `GET /api/space/apod`.
- Local DB path: `server/data/devspace.sqlite`.
