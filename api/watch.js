// Daily copycat check (Vercel Cron). Also callable by hand with the cron secret.
import { MINT } from '../lib/farm.js';
import { getPair } from '../lib/sources.js';
import { runWatch } from '../lib/watch.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Not allowed' });
  if (!MINT) return res.status(200).json({ status: 'prelaunch' });
  const pair = await getPair(MINT);
  return res.status(200).json(await runWatch(MINT, pair.liveAt || pair.createdAt || 0));
}
