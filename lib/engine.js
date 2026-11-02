// Aura farming engine. Pure functions: no network, no storage.
//
// Rules (what the site promises):
// - Every hour a wallet holds $AURA it earns aura = coins held x multiplier.
// - The multiplier climbs with days held in the current streak:
//   1x at day 0, 2x at day 7, 3x at day 30 (capped).
// - Any sell, or any drop in the wallet's real balance below what it bought
//   (a transfer out), shatters the streak: aura and multiplier reset to zero.
//   Coins still held start a new streak from that moment. Buying never resets.
// - Only coins bought on the market farm. Coins received by transfer don't.
// - A harvest pays a share of the bankroll by each wallet's aura earned since
//   the previous harvest.

const HOUR = 3600e3;
const DAY = 24 * HOUR;

// Integral of the multiplier over days held: F(d) = ∫0..d mult(x) dx.
// mult(x) = 1 + x/7 (x ≤ 7), 2 + (x-7)/23 (7 < x ≤ 30), 3 (x > 30).
export function multIntegral(d) {
  if (d <= 0) return 0;
  if (d <= 7) return d + (d * d) / 14;
  if (d <= 30) { const e = d - 7; return 10.5 + 2 * e + (e * e) / 46; }
  return 68 + 3 * (d - 30);
}
export function multiplierAt(d) {
  if (d <= 0) return 1;
  if (d <= 7) return 1 + d / 7;
  return Math.min(3, 2 + (d - 7) / 23);
}

// Aura a balance earns from time a to time b, with its streak starting at s.
// Aura is measured in coin-hours at 1x.
function auraBetween(bal, s, a, b) {
  if (!(bal > 0) || b <= a) return 0;
  const da = (a - s) / DAY, db = (b - s) / DAY;
  return bal * 24 * (multIntegral(db) - multIntegral(da));
}

/**
 * Simulate every wallet from its events up to `now`.
 * events: [{ wallet, t (ms), kind: 'buy'|'sell'|'shatter', amount }]
 *   - buy/sell amounts are in coins; shatter.amount is the balance after it.
 * periodStart: time of the previous harvest (or launch).
 * Returns Map wallet -> { bal, streakStart, aura, periodAura, lastSellAt }.
 */
export function simulate(events, now, periodStart) {
  const byWallet = new Map();
  const sorted = [...events].sort((x, y) => x.t - y.t || order(x) - order(y));
  for (const e of sorted) {
    if (e.t > now) continue;
    let w = byWallet.get(e.wallet);
    if (!w) { w = { bal: 0, streakStart: null, aura: 0, periodAura: 0, last: e.t, lastSellAt: null }; byWallet.set(e.wallet, w); }
    accrue(w, e.t, periodStart);
    if (e.kind === 'buy') {
      if (!(w.bal > 0)) w.streakStart = e.t;
      w.bal += e.amount;
    } else if (e.kind === 'sell' || e.kind === 'shatter') {
      w.bal = e.kind === 'sell' ? Math.max(0, w.bal - e.amount) : Math.max(0, e.amount);
      w.aura = 0;
      w.periodAura = 0;
      w.streakStart = w.bal > 0 ? e.t : null;
      w.lastSellAt = e.t;
    }
  }
  for (const w of byWallet.values()) accrue(w, now, periodStart);
  return byWallet;
}
function order(e) { return e.kind === 'buy' ? 1 : 0; } // same second: sells/shatters first

function accrue(w, t, periodStart) {
  if (w.bal > 0 && w.streakStart != null && t > w.last) {
    w.aura += auraBetween(w.bal, w.streakStart, w.last, t);
    const from = Math.max(w.last, periodStart);
    if (t > from) w.periodAura += auraBetween(w.bal, w.streakStart, from, t);
  }
  w.last = Math.max(w.last, t);
}

/**
 * Compare simulated balances with real on-chain balances. A wallet holding
 * less than it bought moved coins out without selling: that shatters its aura.
 * Returns new shatter events to record (time = now).
 */
export function findShatters(sim, actual, now, { tolerance = 0.005, dust = 1 } = {}) {
  const out = [];
  for (const [wallet, w] of sim) {
    if (!(w.bal > dust)) continue;
    const real = actual.get(wallet) ?? 0;
    if (real < w.bal * (1 - tolerance) - dust) out.push({ wallet, t: now, kind: 'shatter', amount: real });
  }
  return out;
}

export const TIER_DAYS = [
  { name: 'Spark', day: 0 }, { name: 'Ember', day: 2 }, { name: 'Flame', day: 7 },
  { name: 'Radiant', day: 14 }, { name: 'Ascended', day: 30 },
];
export function tierFor(days) {
  let name = TIER_DAYS[0].name;
  for (const t of TIER_DAYS) if (days >= t.day) name = t.name;
  return name;
}

/** Public view of each farming wallet, sorted by aura. */
export function farmers(sim, now, exclude = new Set()) {
  const rows = [];
  for (const [wallet, w] of sim) {
    if (exclude.has(wallet) || !(w.bal > 0) || w.streakStart == null) continue;
    const days = (now - w.streakStart) / DAY;
    rows.push({ wallet, bal: w.bal, days, multiplier: multiplierAt(days), tier: tierFor(days), aura: w.aura, periodAura: w.periodAura });
  }
  return rows.sort((a, b) => b.aura - a.aura);
}

/**
 * Plan a harvest. Pure: decides who gets what, in which payouts.
 * - pot = share x bankroll, split by period aura; plus amounts carried over.
 * - each payout >= minPayout and <= maxPct of the bankroll left at that moment;
 *   a large share is split across several payouts.
 * - total paid <= dayCap x starting bankroll; at most maxPayouts payouts.
 * - anything that can't be paid now carries over to the next harvest.
 */
export function planHarvest({ rows, bankroll, share = 0.25, carry = {}, minPayout, maxPct = 0.099, dayCap = 0.45, maxPayouts = 450, exclude = new Set() }) {
  const eligible = rows.filter((r) => !exclude.has(r.wallet) && r.periodAura > 0);
  const totalAura = eligible.reduce((a, r) => a + r.periodAura, 0);
  const pot = bankroll * share;
  const owed = new Map();
  for (const r of eligible) owed.set(r.wallet, (owed.get(r.wallet) || 0) + (totalAura > 0 ? (pot * r.periodAura) / totalAura : 0));
  for (const [w, v] of Object.entries(carry)) if (!exclude.has(w) && v > 0) owed.set(w, (owed.get(w) || 0) + v);

  const order = [...owed.entries()].sort((a, b) => b[1] - a[1]);
  let left = bankroll, paidTotal = 0;
  const cap = bankroll * dayCap;
  const payouts = [], nextCarry = {};
  for (const [wallet, amount] of order) {
    let due = amount, n = 0;
    while (due >= minPayout && payouts.length < maxPayouts && paidTotal < cap) {
      const chunk = Math.min(due, left * maxPct, cap - paidTotal);
      if (chunk < minPayout) break;
      const amt = Math.floor(chunk * 100) / 100;
      payouts.push({ wallet, amount: amt, part: ++n });
      due -= amt; left -= amt; paidTotal += amt;
    }
    if (due > 0.0001) nextCarry[wallet] = due;
  }
  return { pot, totalAura, bankroll, minPayout, payouts, paidTotal, nextCarry, wallets: owed.size };
}
