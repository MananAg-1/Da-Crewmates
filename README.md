# Da Crewmates

Da Crewmates is a gamified social platform that turns posting, profiles, direct messages, activity stats, and privacy controls into a navigable space-station experience. Instead of another endless feed, the app gives each social workflow a room on the ship.

**Live demo:** Deployed on Vercel at da-crewmates.vercel.app

## Why It Exists

Most social apps compress every interaction into the same scrollable feed. Da Crewmates explores a different model: users move through a station, enter purpose-built rooms, and interact with posts, messages, analytics, missions, and safety tools in spatial context.

The project is built as a hybrid React landing/auth shell plus a vanilla JavaScript game module backed by a Node and SQLite API. The technical choices are intentionally lightweight so the core idea stays easy to inspect: a social app can feel like a place, not just a timeline.

## What To Look For

- **Interaction model:** social workflows are mapped to ship rooms instead of a single flat feed.
- **End-to-end implementation:** authentication, posts, comments, voting, saves, profiles, follows, messaging, analytics, privacy, reports, and notifications are backed by real API routes and persistence.
- **Spatial interface:** the player navigates a station map and opens terminals for context-specific tools.
- **Safety and control:** privacy settings, blocked users, report submission, content preferences, and DM permissions are part of the core product rather than afterthoughts.
- **Realtime behavior:** direct messages, notifications, and post activity use server-sent events.
- **Practical architecture:** React handles the entry/auth shell, vanilla JavaScript controls the game-like station, and Node/SQLite keeps the backend portable.

## Highlights

- **Station-based social UX:** users enter a playable ship and open room terminals for different workflows.
- **Astronomy-focused posting:** posts are organized around Astrophysics, Astrometry, Astrogeology, and Astrobiology.
- **Crew accounts:** email/password signup, login, password reset, and Google Identity support.
- **Profiles and social graph:** follow crewmates, view profiles, manage followers, and discover suggestions.
- **Direct messages:** one-to-one threads, unread/read state, post sharing into chats, and realtime updates.
- **Privacy controls:** profile visibility, DM permissions, online presence, content filtering, zone activity sharing, alerts, and blocked users.
- **Room analytics:** MedBay and Reactor surfaces show activity, focus, topic, network, and safety signals.
- **Safety reporting:** report flows persist to the backend and can notify developers through SMTP.
- **Image uploads:** Cloudinary-backed post image uploads with type and size validation.
- **NASA APOD integration:** server-side APOD route with fallback behavior when NASA is unavailable or rate-limited.

## Product Flow

1. A visitor lands on the React entry experience.
2. They create or enter a crew account.
3. The app loads the game module at `/game/index.html`.
4. The player moves through the station map.
5. Room terminals expose feeds, comments, messages, analytics, privacy settings, reports, missions, and crew discovery.
6. The backend persists identity, posts, votes, comments, follows, messages, notifications, reports, sessions, room visits, and privacy settings in SQLite.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend shell | React 18, Vite 5, JSX |
| Game module | Vanilla HTML, CSS, JavaScript, canvas-based map helpers |
| Styling | Plain CSS with custom assets |
| Backend | Node.js built-in HTTP server |
| Database | SQLite through Node's built-in `node:sqlite` |
| Realtime | Server-sent events |
| Auth | Local email/password plus Google Identity client flow |
| External APIs | NASA APOD, Cloudinary, SMTP |
| Testing | Node built-in test runner |
| Deployment | Vercel |

## Repository Map

```txt
.
|-- src/                  React landing, splash, auth, and API helpers
|-- game/                 Interactive station, room terminals, map assets, game logic
|-- server/               Node API, SQLite persistence, regression tests
|-- index.html            Vite root entry
|-- vite.config.js        React plugin and game-module copy step
|-- vercel.json           Vercel routing config
|-- package.json          Scripts, dependencies, and Node engine
`-- .env.example          Local configuration template
```

## Local Development

The deployed Vercel app is the fastest way to judge the project. These commands are included for reviewers who want to inspect or run the full stack locally.

Requirements:

- Node.js `>=22.13.0`
- npm

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start the API and frontend together:

```bash
npm run dev:all
```

Or run them separately:

```bash
npm run api:dev
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`
- SQLite database: `server/data/devspace.sqlite`

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `API_PORT` | Local API port, defaults to `4000` |
| `APP_DATABASE_PATH` | Optional custom SQLite database path |
| `APP_ENCRYPTION_KEY` | Key material for local encrypted fields |
| `NASA_API_KEY` | NASA APOD API key, falls back to `DEMO_KEY` |
| `VITE_API_BASE_URL` | Frontend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google Identity client ID |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud for post image uploads |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary signing secret |
| `REPORT_EMAIL_TO` | Comma-separated developer report recipients |
| `REPORT_EMAIL_FROM` | Sender address for report emails |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_STARTTLS` | Enables or disables STARTTLS, defaults to enabled |

## Useful Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite frontend on `0.0.0.0` |
| `npm run api:dev` | Start the Node API |
| `npm run dev:all` | Run frontend and API together |
| `npm run build` | Build the frontend and copy the game module into `dist/game` |
| `npm run preview` | Preview the production build locally |
| `npm run test:regression` | Run backend regression tests |

## Suggested Review Path

For judges, the clearest path through the project is:

1. Open the deployed app.
2. Create or enter a crew account.
3. Enter the station and move through the map.
4. Open room terminals to explore posts, profiles, messages, privacy controls, reports, and analytics.
5. Create an astronomy post, interact with it, and check how the station surfaces update around that activity.
6. Review the repository sections below if you want to inspect how the experience is implemented.

## API Surface

The backend exposes routes for:

- Health checks
- Auth and password reset
- Posts, votes, saves, seen state, comments, and shares
- Post image uploads
- User profiles, search, follows, crewmates, and blocked users
- Friend request compatibility routes
- Direct message threads and messages
- Notifications and realtime events
- Room visits and analytics
- Privacy settings
- Missions and daily objectives
- Security reports
- NASA APOD

More endpoint examples live in [`server/README.md`](server/README.md).

## Deployment Notes

The project is already deployed on Vercel. The Vite build outputs the React app, and `vite.config.js` copies the standalone `game/` module into `dist/game` during the production build.

For judging, put the production URL at the top and treat the local setup section as technical reference. That gives reviewers the fastest path into the app while keeping the implementation easy to verify.

## Project Status

Da Crewmates is a functional prototype with a deployed frontend, local/full-stack development support, persistent backend data, and regression coverage for core API behavior. The current architecture is intentionally lightweight: React where the app shell benefits from component state, vanilla JavaScript where the station/game module benefits from direct DOM and canvas control, and a dependency-light Node backend for simple deployment and review.
