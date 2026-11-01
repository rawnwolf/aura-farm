// Live farming state for the site. Until the coin launches (AURA_MINT unset),
// this reports pre-launch. The farming engine fills this in after launch.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  if (!process.env.AURA_MINT) {
    return res.status(200).json({ phase: 'prelaunch' });
  }
  // Placeholder until the farming engine is connected.
  return res.status(200).json({ phase: 'live', bankrollUsd: null, farmers: null, nextHarvestAt: null, top: [] });
}
