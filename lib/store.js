// Small JSON files in the project's private Vercel Blob store.
//   shatters.json - transfer-outs found by comparing real balances (append only)
//   harvests.json - every harvest and dry run, plus amounts carried over
import { get, put } from '@vercel/blob';

export async function readJSON(path, fallback) {
  try {
    const r = await get(path, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return fallback;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (e?.name === 'BlobNotFoundError') return fallback;
    throw e;
  }
}

export async function writeJSON(path, data) {
  await put(path, JSON.stringify(data), {
    access: 'private', contentType: 'application/json',
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
  });
}

/** Add shatter events, merging with whatever is stored now (one per wallet per balance). */
export async function addShatters(events) {
  if (!events.length) return;
  const cur = await readJSON('shatters.json', []);
  const key = (e) => `${e.wallet}:${Math.round(e.amount)}`;
  // Two requests can find the same transfer-out a moment apart: only skip near-duplicates.
  const recent = Date.now() - 15 * 60e3;
  const have = new Set(cur.filter((e) => e.t > recent).map(key));
  const fresh = events.filter((e) => !have.has(key(e)));
  if (fresh.length) await writeJSON('shatters.json', [...cur, ...fresh]);
}
