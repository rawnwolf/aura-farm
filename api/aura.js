// Aura for one wallet: tier, aura, multiplier, days held, estimated next harvest.
import { loadFarm, HARVEST_SHARE } from '../lib/farm.js';

const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export default async function handler(req, res) {
  const wallet = String(req.query.wallet || '');
  if (!SOL_ADDR.test(wallet)) return res.status(400).json({ error: 'Invalid Solana wallet address' });
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  try {
    const f = await loadFarm();
    if (f.phase !== 'live') return res.status(200).json({ phase: f.phase, holding: false });
    const r = f.rows.find((x) => x.wallet === wallet);
    if (!r) return res.status(200).json({ phase: 'live', holding: false, excluded: f.exclude.has(wallet) });
    const totalPeriod = f.rows.reduce((a, x) => a + x.periodAura, 0);
    const share = totalPeriod > 0 ? r.periodAura / totalPeriod : 0;
    return res.status(200).json({
      phase: 'live', holding: true, tier: r.tier,
      aura: Math.round(r.aura), multiplier: r.multiplier, days: r.days,
      sharePct: share * 100,
      estHarvestUsd: f.bankrollUsd * HARVEST_SHARE * share,
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Farm data is unavailable right now.' });
  }
}
