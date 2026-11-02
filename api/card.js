// Public PNG of a harvest recap: /api/card (latest) or /api/card?n=3
import { readJSON } from '../lib/store.js';
import { loadFarm } from '../lib/farm.js';
import { recapOf } from '../lib/recap.js';
import { harvestCard } from '../lib/card.js';

export default async function handler(req, res) {
  const ledger = await readJSON('harvests.json', { harvests: [], carry: {} });
  const done = ledger.harvests.filter((h) => h.mode === 'live' && h.status === 'done');
  const n = Number(req.query.n) || done.length;
  const report = done[n - 1];
  if (!report) return res.status(404).json({ error: 'No harvest yet.' });
  const f = await loadFarm({ reconcile: false });
  const png = await harvestCard(recapOf(report, f.rows || [], ledger));
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 's-maxage=3600');
  return res.status(200).send(Buffer.from(png));
}
