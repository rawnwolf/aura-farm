// Telegram bot webhook. Commands: /aura <wallet>, /top, /harvest, /ca, /help, /chatid
import { loadFarm, MINT, HARVEST_SHARE } from '../lib/farm.js';
import { sendText, esc } from '../lib/telegram.js';

const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const num = (n) => Math.round(n).toLocaleString('en-US');

const HELP = [
  '<b>AuraVeil farm bot</b>',
  '/aura &lt;wallet&gt; — your tier, aura and multiplier',
  '/top — top farmers',
  '/harvest — bankroll and next harvest',
  '/ca — the real contract and links',
].join('\n');

async function reply(cmd, arg) {
  if (cmd === 'start' || cmd === 'help') return HELP;
  if (cmd === 'ca' || cmd === 'contract') {
    return [`<b>The only real $AURA</b>`, `<code>${MINT}</code>`, 'Buy: launch.veilbound.gg/ecosystem/aura', 'Site: auraveil.xyz', 'X: @AuraVeilPair'].join('\n');
  }
  const f = await loadFarm();
  if (f.phase !== 'live') return 'Farming starts at launch.';
  if (cmd === 'aura') {
    if (!SOL_ADDR.test(arg || '')) return 'Send it like this: /aura YourSolanaWalletAddress';
    const r = f.rows.find((x) => x.wallet === arg);
    if (!r) return `${short(arg)} isn't farming right now. Buy and hold $AURA and it starts at Spark.`;
    const total = f.rows.reduce((a, x) => a + x.periodAura, 0);
    const share = total > 0 ? r.periodAura / total : 0;
    return [`<b>${esc(r.tier)}</b> · ${short(r.wallet)}`, `Aura: ${num(r.aura)}`, `Multiplier: ${r.multiplier.toFixed(2)}x · ${r.days.toFixed(1)} days held`,
      `Share of the next harvest: ${(share * 100).toFixed(2)}% (about $${(f.bankrollUsd * HARVEST_SHARE * share).toFixed(2)} at today's bankroll)`].join('\n');
  }
  if (cmd === 'top') {
    if (!f.rows.length) return 'No farmers yet.';
    return ['<b>Top farmers</b>', ...f.rows.slice(0, 5).map((r, i) => `${i + 1}. ${short(r.wallet)} · ${esc(r.tier)} · ${num(r.aura)} aura`)].join('\n');
  }
  if (cmd === 'harvest') {
    const live = process.env.HARVEST_MODE === 'live';
    const last = f.ledger.harvests.filter((h) => h.mode === 'live' && h.status === 'done').at(-1);
    return [`Bankroll: ${num(f.bankrollVeil)} VEIL (about $${f.bankrollUsd.toFixed(2)})`, `Farmers: ${f.rows.length}`,
      live ? 'Harvest: every day at noon New York time.' : 'Harvests start soon.',
      last ? `Last harvest: ${num(last.paidTotal)} VEIL to ${last.paidWallets} farmers.` : ''].filter(Boolean).join('\n');
  }
  return null;
}

export default async function handler(req, res) {
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.status(401).end();
  const msg = req.body?.message;
  const text = msg?.text || '';
  const m = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)$/s);
  if (!m) return res.status(200).json({ ok: true });
  const [, cmd, arg] = m;
  try {
    let out = cmd === 'chatid' ? `Chat id: <code>${msg.chat.id}</code>` : await reply(cmd.toLowerCase(), arg.trim());
    if (out) await sendText(msg.chat.id, out, { reply_to_message_id: msg.message_id });
  } catch (e) {
    console.error(e);
    await sendText(msg.chat.id, 'Farm data is unavailable right now. Try again in a minute.', { reply_to_message_id: msg.message_id });
  }
  return res.status(200).json({ ok: true });
}
