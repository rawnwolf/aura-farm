# $AURA — Aura Farming

Hold $AURA to farm aura. Site + farming server for the $AURA coin on Veilbound (paired with $VEIL).

## Run locally
```
npm install
npm run dev
```

## Launch-day settings
Edit `src/config.js`:
- `mint` — the coin's mint address (turns off pre-launch mode)
- `buyUrl` — the coin's page on the Veilbound launchpad

In Vercel, set `AURA_MINT` (and later `GAME_KEY`) as environment variables. `HELIUS_API_KEY` is already set.

## Structure
- `index.html`, `src/` — the site (Vite + Three.js)
- `api/` — serverless endpoints the site reads (`/api/state`, `/api/aura`)
