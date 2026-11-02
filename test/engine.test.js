import assert from 'node:assert/strict';
import { simulate, findShatters, farmers, planHarvest, multIntegral, multiplierAt } from '../lib/engine.js';
const H = 3600e3, D = 24 * H, T0 = Date.UTC(2026, 10, 2, 19);

// multiplier curve
assert.equal(multiplierAt(0), 1); assert.equal(multiplierAt(7), 2); assert.equal(multiplierAt(30), 3); assert.equal(multiplierAt(99), 3);
assert.ok(Math.abs(multIntegral(30) - 68) < 1e-9);

// A holds 1000 for 1 day at ~1x-1.14x; B buys same but sells half at 12h (shatters)
const ev = [
  { wallet: 'A', t: T0, kind: 'buy', amount: 1000 },
  { wallet: 'B', t: T0, kind: 'buy', amount: 1000 },
  { wallet: 'B', t: T0 + 12 * H, kind: 'sell', amount: 500 },
  { wallet: 'C', t: T0 + 6 * H, kind: 'buy', amount: 100 },
  { wallet: 'C', t: T0 + 7 * H, kind: 'buy', amount: 100 },
];
let sim = simulate(ev, T0 + D, T0);
const a = sim.get('A'), b = sim.get('B'), c = sim.get('C');
assert.ok(Math.abs(a.aura - 1000 * 24 * (1 + 1 / 14)) < 1e-6, 'A aura = coins x hours x avg multiplier');
assert.equal(b.bal, 500); assert.equal(b.streakStart, T0 + 12 * H, 'sell restarts streak');
assert.ok(b.aura < a.aura / 2 + 1, 'B lost its first 12h of aura');
assert.equal(c.streakStart, T0 + 6 * H, 'buying more never resets');
assert.equal(c.bal, 200);

// transfer out: real balance lower than bought -> shatter
const actual = new Map([['A', 1000], ['B', 500], ['C', 50]]);
const sh = findShatters(sim, actual, T0 + D);
assert.deepEqual(sh.map((s) => s.wallet), ['C']);
sim = simulate([...ev, ...sh], T0 + D + H, T0);
assert.equal(sim.get('C').bal, 50); assert.equal(sim.get('C').streakStart, T0 + D);
assert.equal(findShatters(sim, actual, T0 + D + H).length, 0, 'no repeat once recorded');

// harvest plan: min payout, 10% cap with splitting, carry
const rows = farmers(sim, T0 + D + H, new Set());
const plan = planHarvest({ rows, bankroll: 20000, share: 0.25, carry: { Z: 3 }, minPayout: 1480, maxPct: 0.099, dayCap: 0.45 });
console.log(plan.payouts, plan.nextCarry, Math.round(plan.paidTotal));
for (const p of plan.payouts) assert.ok(p.amount >= 1480 - 0.01);
let left = 20000; for (const p of plan.payouts) { assert.ok(p.amount <= left * 0.099 + 0.01); left -= p.amount; }
assert.ok(plan.paidTotal <= 20000 * 0.45);
const owedSum = plan.paidTotal + Object.values(plan.nextCarry).reduce((x, y) => x + y, 0);
assert.ok(Math.abs(owedSum - (5000 + 3)) < 1, 'paid + carried = pot + old carry');
assert.ok(plan.nextCarry.Z > 0, 'tiny carry waits');

// whale needs several payouts in one harvest
const big = planHarvest({ rows: [{ wallet: 'W', periodAura: 1 }], bankroll: 100000, share: 0.25, minPayout: 100, maxPct: 0.099, dayCap: 0.45 });
assert.ok(big.payouts.length >= 3 && Math.abs(big.paidTotal - 25000) < 1, 'whale paid in full across parts');
console.log('all engine tests passed');
