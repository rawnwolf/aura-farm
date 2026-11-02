// Where the farm reads from: the Veilbound launchpad API and Helius (Solana).
export const LAUNCHPAD = process.env.LAUNCHPAD_URL || 'https://launch.veilbound.gg';
const PUB = `${LAUNCHPAD}/api/public/v1`;

async function json(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { accept: 'application/json', ...(opts.headers || {}) } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = { error: text.slice(0, 200) }; }
  if (!r.ok) { const e = new Error(body.error || `HTTP ${r.status}`); e.status = r.status; e.body = body; throw e; }
  return body;
}

export const getPair = (mint) => json(`${PUB}/pairs/${mint}`);
export const getGame = (mint) => json(`${LAUNCHPAD}/api/games/${mint}`);

/** Every trade of the coin, oldest first. Pages back with `before`. */
export async function getAllTrades(mint, { maxPages = 200 } = {}) {
  const seen = new Set(), all = [];
  let before = null;
  for (let i = 0; i < maxPages; i++) {
    const q = new URLSearchParams({ limit: '200' });
    if (before) q.set('before', String(before));
    const page = await json(`${PUB}/pairs/${mint}/trades?${q}`);
    const trades = page.trades || [];
    let added = 0;
    for (const t of trades) if (!seen.has(t.signature + t.side + t.wallet)) { seen.add(t.signature + t.side + t.wallet); all.push(t); added++; }
    if (trades.length < 200 || !page.next || added === 0) break;
    before = page.next;
  }
  return all.sort((a, b) => a.time - b.time);
}

/** Real balances of every holder (owner -> coins), read from chain via Helius. */
export async function getHolderBalances(mint, decimals = 6) {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error('HELIUS_API_KEY is not set');
  const url = `https://mainnet.helius-rpc.com/?api-key=${key}`;
  const out = new Map();
  for (let page = 1; page <= 50; page++) {
    const body = await json(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'aura', method: 'getTokenAccounts', params: { mint, page, limit: 1000 } }),
    });
    if (body.error) throw new Error(`Helius: ${body.error.message || JSON.stringify(body.error)}`);
    const accts = body.result?.token_accounts || [];
    for (const a of accts) out.set(a.owner, (out.get(a.owner) || 0) + Number(a.amount) / 10 ** decimals);
    if (accts.length < 1000) break;
  }
  return out;
}

/** Pay one wallet from the bankroll. Each ref is paid at most once by the launchpad. */
export async function payout({ mint, wallet, amount, ref, memo }) {
  const key = process.env.GAME_KEY;
  if (!key) throw new Error('GAME_KEY is not set');
  return json(`${LAUNCHPAD}/api/games/payout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-game-key': key },
    body: JSON.stringify({ mint, wallet, amount, ref, ...(memo ? { memo } : {}) }),
  });
}
