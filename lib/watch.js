// Copycat watch: new coins calling themselves AURA / AuraVeil that aren't ours.
import { LAUNCHPAD } from './sources.js';
import { readJSON, writeJSON } from './store.js';
import { sendText, esc } from './telegram.js';

const OLD_AURA = new Set(['DtR4D9FtVoTX2569gaL837ZgrB6wNjj6tkmnX9Rdk9B2']); // the 2024 "aura" memecoin, not a copy
const looksLikeUs = (sym = '', name = '') => /^\$?aura/i.test(sym) || /aura\s*veil/i.test(name) || /^aura$/i.test(name.trim());

export async function findCopycats(mint, launchAt) {
  const found = [];
  try {
    const r = await fetch(`${LAUNCHPAD}/api/public/v1/pairs?limit=200&sort=newest`);
    const { pairs = [] } = await r.json();
    for (const p of pairs) if (p.mint !== mint && looksLikeUs(p.symbol, p.name)) found.push({ mint: p.mint, symbol: p.symbol, name: p.name, where: 'Veilbound launchpad', link: p.page });
  } catch (e) { console.error('watch launchpad:', e.message); }
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/search?q=AURA');
    const { pairs = [] } = await r.json();
    for (const p of pairs) {
      if (p.chainId !== 'solana') continue;
      const b = p.baseToken || {};
      if (b.address === mint || OLD_AURA.has(b.address) || !looksLikeUs(b.symbol, b.name)) continue;
      if (p.pairCreatedAt && p.pairCreatedAt < launchAt) continue; // older coins aren't copies of us
      found.push({ mint: b.address, symbol: b.symbol, name: b.name, where: p.dexId, link: p.url });
    }
  } catch (e) { console.error('watch dexscreener:', e.message); }
  const uniq = new Map(found.map((c) => [c.mint, c]));
  return [...uniq.values()];
}

export async function runWatch(mint, launchAt) {
  const all = await findCopycats(mint, launchAt);
  const state = await readJSON('watch.json', { seen: [] });
  const fresh = all.filter((c) => !state.seen.includes(c.mint));
  const chat = process.env.TELEGRAM_ALERT_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (fresh.length && chat) {
    const lines = fresh.map((c) => `• ${esc(c.name)} ($${esc(c.symbol)}) on ${esc(c.where)}: <code>${esc(c.mint)}</code>`);
    await sendText(chat, [`<b>Copycat warning.</b> ${fresh.length === 1 ? 'This coin is' : 'These coins are'} not $AURA:`, ...lines, '', `The only real contract: <code>${mint}</code>`].join('\n'));
  }
  if (fresh.length) await writeJSON('watch.json', { seen: [...state.seen, ...fresh.map((c) => c.mint)] });
  return { copycats: all, newlyFound: fresh.length };
}
