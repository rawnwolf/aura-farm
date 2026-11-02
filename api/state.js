// Live farming state for the site: bankroll, farmers, leaderboard, last harvest.
import { loadFarm } from '../lib/farm.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  try {
    const f = await loadFarm();
    if (f.phase !== 'live') return res.status(200).json(f);
    const last = f.ledger.harvests.filter((h) => h.mode === 'live').at(-1) || null;
    return res.status(200).json({
      phase: 'live',
      bankrollUsd: f.bankrollUsd,
      bankrollVeil: f.bankrollVeil,
      farmers: f.rows.length,
      // The countdown only shows once real payouts are switched on.
      nextHarvestAt: process.env.HARVEST_MODE === 'live' ? f.nextHarvestAt : null,
      top: f.rows.slice(0, 10).map((r) => ({ wallet: r.wallet, tier: r.tier, aura: Math.round(r.aura) })),
      lastHarvest: last && { at: last.at, status: last.status, paid: last.paidTotal, wallets: last.paidWallets, payouts: last.payouts?.length ?? 0 },
      harvests: f.ledger.harvests.filter((h) => h.mode === 'live').slice(-10).reverse().map((h) => ({
        at: h.at, status: h.status, paidVeil: h.paidTotal, wallets: h.paidWallets,
        txs: (h.payouts || []).filter((p) => p.sig).map((p) => ({ wallet: p.wallet, amount: p.amount, sig: p.sig })),
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Farm data is unavailable right now.' });
  }
}
