// Builds the live picture of the farm: who holds, their aura, the bankroll.
import { simulate, findShatters, farmers } from './engine.js';
import { getPair, getGame, getAllTrades, getHolderBalances } from './sources.js';
import { readJSON, addShatters } from './store.js';

export const MINT = process.env.AURA_MINT || '';
export const HARVEST_HOUR_UTC = Number(process.env.HARVEST_HOUR_UTC ?? 17); // 12pm New York (EST)
export const HARVEST_SHARE = Number(process.env.HARVEST_SHARE ?? 0.25);

export function nextHarvestAt(now = Date.now()) {
  const d = new Date(now);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HARVEST_HOUR_UTC);
  return t > now ? t : t + 24 * 3600e3;
}

function excludedWallets(pair, game) {
  const ex = new Set((process.env.EXCLUDE_WALLETS || '').split(',').map((s) => s.trim()).filter(Boolean));
  if (pair?.dev?.wallet) ex.add(pair.dev.wallet);       // the launcher's wallet can't be paid
  if (game?.bankroll) ex.add(game.bankroll);
  for (const a of [pair?.pool?.address, pair?.pool?.curvePool]) if (a) ex.add(a);
  return ex;
}

let cache = null; // per server instance, 45 s
/**
 * @param {{reconcile?: boolean, fresh?: boolean}} opts
 *   reconcile: compare with real balances and record transfer-outs (default true)
 */
export async function loadFarm({ reconcile = true, fresh = false } = {}) {
  if (!MINT) return { phase: 'prelaunch' };
  if (!fresh && cache && Date.now() - cache.at < 45e3) return cache.farm;

  const now = Date.now();
  const [pair, game, trades, shatters, ledger] = await Promise.all([
    getPair(MINT), getGame(MINT), getAllTrades(MINT),
    readJSON('shatters.json', []), readJSON('harvests.json', { harvests: [], carry: {} }),
  ]);
  const launchAt = pair.liveAt || pair.createdAt || (trades[0]?.time ?? now / 1000) * 1000;
  const lastLive = ledger.harvests.filter((h) => h.mode === 'live' && h.status === 'done').at(-1);
  const periodStart = lastLive ? lastLive.at : launchAt;

  const events = [
    ...trades.map((t) => ({ wallet: t.wallet, t: t.time * 1000, kind: t.side === 'sell' ? 'sell' : 'buy', amount: Number(t.amount) })),
    ...shatters,
  ];
  let sim = simulate(events, now, periodStart);

  let balancesOk = false, newShatters = [];
  if (reconcile) {
    try {
      const actual = await getHolderBalances(MINT, pair.token?.decimals ?? 6);
      balancesOk = true;
      newShatters = findShatters(sim, actual, now);
      if (newShatters.length) {
        await addShatters(newShatters);
        sim = simulate([...events, ...newShatters], now, periodStart);
      }
    } catch (e) {
      console.error('balance check failed:', e.message);
    }
  }

  const exclude = excludedWallets(pair, game);
  const rows = farmers(sim, now, exclude);
  const veil = game.balance?.veil ?? 0, usd = game.balance?.usd ?? 0;
  const farm = {
    phase: 'live', now, launchAt, periodStart, balancesOk,
    newShatters: newShatters.length,
    bankrollVeil: veil, bankrollUsd: usd, veilUsd: veil > 0 ? usd / veil : null,
    limits: { maxPct: (game.api?.maxPct ?? 10) / 100, dayPct: (game.api?.dayPct ?? 50) / 100 },
    rows, exclude, ledger, trades: trades.length,
    nextHarvestAt: nextHarvestAt(now),
  };
  cache = { at: Date.now(), farm };
  return farm;
}
