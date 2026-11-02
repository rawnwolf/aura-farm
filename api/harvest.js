// The daily harvest. Run by Vercel Cron once a day; can also be run by hand.
//
//   GET /api/harvest            (cron)   - runs in the mode set by HARVEST_MODE
//   GET /api/harvest?dry=1               - always a dry run: plans, pays nothing
//   GET /api/harvest?report=1            - shows the last dry run and last harvest
// All need the header  Authorization: Bearer <CRON_SECRET>.
//
// HARVEST_MODE=live is the only setting that sends real payouts. Anything else
// (or unset) is a dry run. Tori switches it to live in Vercel when she's ready.
import { loadFarm, MINT, HARVEST_SHARE } from '../lib/farm.js';
import { planHarvest } from '../lib/engine.js';
import { payout } from '../lib/sources.js';
import { readJSON, writeJSON } from '../lib/store.js';

const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Not allowed' });
  if (!MINT) return res.status(200).json({ status: 'prelaunch' });

  if (req.query.report) {
    const l = await readJSON('harvests.json', { harvests: [], carry: {} });
    return res.status(200).json({ lastDryRun: l.lastDryRun || null, lastHarvest: l.harvests.at(-1) || null, carry: l.carry });
  }

  const live = process.env.HARVEST_MODE === 'live' && !req.query.dry;
  const now = Date.now();
  const id = new Date(now).toISOString().slice(0, 10);
  const ledger = await readJSON('harvests.json', { harvests: [], carry: {} });

  if (live && ledger.harvests.some((h) => h.id === id && h.mode === 'live' && h.status !== 'skipped')) {
    return res.status(200).json({ status: 'already-harvested', id });
  }

  const f = await loadFarm({ fresh: true });
  const report = {
    id, at: now, mode: live ? 'live' : 'dry',
    bankrollVeil: f.bankrollVeil, bankrollUsd: f.bankrollUsd, veilUsd: f.veilUsd,
    periodStart: f.periodStart, farmers: f.rows.length, balancesChecked: f.balancesOk,
  };

  const skip = (reason) => {
    report.status = 'skipped'; report.reason = reason;
    return finish(ledger, report, live, res);
  };
  if (!f.veilUsd) return skip('The bankroll is empty.');
  if (live && !f.balancesOk) return skip('Could not check real wallet balances, so no payouts were sent.');
  const minPayout = (1.02 / f.veilUsd); // launchpad minimum is $1 a payout
  if (f.bankrollVeil * f.limits.maxPct < minPayout) {
    return skip(`The bankroll is under about $${Math.ceil(1 / f.limits.maxPct)}: one payout must be at least $1 and at most ${Math.round(f.limits.maxPct * 100)}% of the bankroll.`);
  }

  const plan = planHarvest({
    rows: f.rows, bankroll: f.bankrollVeil, share: HARVEST_SHARE, carry: ledger.carry || {},
    minPayout, maxPct: f.limits.maxPct - 0.001, dayCap: Math.min(0.45, f.limits.dayPct - 0.05), exclude: f.exclude,
  });
  Object.assign(report, {
    potVeil: plan.pot, minPayoutVeil: minPayout, totalPeriodAura: plan.totalAura,
    planned: plan.payouts.length, plannedVeil: plan.paidTotal,
  });
  let carry = { ...plan.nextCarry };

  if (!live) {
    report.status = 'dry-run';
    report.payouts = plan.payouts.map((p) => ({ ...p, usd: p.amount * f.veilUsd }));
    report.carryAfter = carry;
    return finish(ledger, report, false, res);
  }

  const results = [];
  for (const p of plan.payouts) {
    const ref = `aura-${id}-${p.wallet.slice(0, 8)}-${p.part}`;
    try {
      const r = await payout({ mint: MINT, wallet: p.wallet, amount: p.amount, ref, memo: `$AURA harvest ${id}` });
      results.push({ ...p, ref, status: r.status, sig: r.sig || null });
      if (r.status !== 'done') carry[p.wallet] = (carry[p.wallet] || 0) + p.amount;
    } catch (e) {
      results.push({ ...p, ref, status: 'failed', error: e.message });
      carry[p.wallet] = (carry[p.wallet] || 0) + p.amount; // nobody loses what they farmed
    }
  }
  const paid = results.filter((r) => r.status === 'done');
  report.payouts = results;
  report.paidTotal = paid.reduce((a, r) => a + r.amount, 0);
  report.paidWallets = new Set(paid.map((r) => r.wallet)).size;
  report.status = paid.length ? (paid.length === results.length ? 'done' : 'partial') : (results.length ? 'failed' : 'skipped');
  if (!results.length) report.reason = 'No wallet was owed at least $1 yet; shares carry over.';
  // A harvest that paid anyone closes the farming period.
  if (report.status === 'partial') report.status = 'done';
  ledger.carry = carry;
  return finish(ledger, report, true, res);
}

async function finish(ledger, report, live, res) {
  if (live) {
    ledger.harvests = [...ledger.harvests, report].slice(-120);
  } else {
    ledger.lastDryRun = report;
  }
  await writeJSON('harvests.json', ledger);
  const summary = {
    status: report.status, reason: report.reason, mode: report.mode, id: report.id,
    bankroll: `${Math.round(report.bankrollVeil || 0)} VEIL ($${(report.bankrollUsd || 0).toFixed(2)})`,
    farmers: report.farmers,
    payouts: (report.payouts || []).map((p) => `${short(p.wallet)} ${p.amount} VEIL${p.status ? ' ' + p.status : ''}`),
  };
  return res.status(200).json({ summary, report });
}
