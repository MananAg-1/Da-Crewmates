# Project Structure

## Root

- `index.html`: React/Vite app entry
- `package.json`: npm scripts and dependencies
- `vite.config.js`: Vite config
- `.env.example`: environment variable template

## Frontend App (`src/`)

- Landing screen
- Splash screen
- Login/signup flow
- App shell that loads game module after auth

## Game Module (`game/`)

- `index.html`: in-game scene and overlays
- `Main.js`: gameplay loop, zone routing, tablet logic
- `Styles.css`: in-game styling
- `terminalTemplates.html`: per-zone tablet content
- `Assets/`: maps, sprites, UI images

## Backend (`server/`)

- `index.js`: single backend server (auth + social + APOD)
- `data/devspace.sqlite`: local SQLite database
