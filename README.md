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

## Farming server

- `lib/engine.js` — aura rules and harvest planning (tested by `node test/engine.test.js`).
- `api/state.js`, `api/aura.js` — live numbers for the site.
- `api/harvest.js` — the daily harvest, run by Vercel Cron at 17:00 UTC (noon New York).

Vercel settings that control it:
- `HARVEST_MODE` — `dry` plans and logs a harvest but pays nothing. `live` sends real payouts.
- `GAME_KEY` — the launchpad game key. `HELIUS_API_KEY` — reads real wallet balances.
- `CRON_SECRET` — required to call `/api/harvest` (Vercel Cron sends it).
- Optional: `HARVEST_SHARE` (default 0.25), `HARVEST_HOUR_UTC` (default 17), `EXCLUDE_WALLETS` (comma list).
