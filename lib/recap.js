// What gets announced after a live harvest.
import { harvestCard } from './card.js';
import { sendPhoto } from './telegram.js';

export function recapOf(report, rows, ledger) {
  const done = ledger.harvests.filter((h) => h.mode === 'live' && h.status === 'done');
  const n = done.indexOf(report) + 1 || done.length;
  const byWallet = {};
  for (const p of report.payouts || []) if (p.status === 'done') byWallet[p.wallet] = (byWallet[p.wallet] || 0) + p.amount;
  const topWallet = Object.entries(byWallet).sort((a, b) => b[1] - a[1])[0]?.[0];
  const r = rows.find((x) => x.wallet === topWallet);
  return {
    n, date: new Date(report.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }),
    paidVeil: report.paidTotal || 0, paidUsd: (report.paidTotal || 0) * (report.veilUsd || 0),
    farmers: report.paidWallets || 0,
    top: r ? { wallet: r.wallet, tier: r.tier, days: r.days } : null,
  };
}

export async function announceHarvest(recap) {
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!chat) return;
  const png = await harvestCard(recap);
  const caption = [
    `<b>Harvest #${recap.n} is in.</b>`,
    `${Math.round(recap.paidVeil).toLocaleString('en-US')} VEIL (about $${recap.paidUsd.toFixed(2)}) paid to ${recap.farmers} farmer${recap.farmers === 1 ? '' : 's'}, straight to their wallets.`,
    `Proof: launch.veilbound.gg/ecosystem/aura`,
    `Next harvest tomorrow at noon New York time. Keep farming.`,
  ].join('\n');
  await sendPhoto(chat, png, caption);
}
