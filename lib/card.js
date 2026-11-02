// Harvest recap image (1200x675 PNG) for X and Telegram.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
let assets;
function load() {
  if (!assets) {
    assets = {
      bg: `data:image/jpeg;base64,${readFileSync(here('./card-bg.jpg')).toString('base64')}`,
      fonts: [
        { name: 'Cinzel', data: readFileSync(here('./fonts/cinzel-latin-800-normal.ttf')), weight: 800 },
        { name: 'Spectral', data: readFileSync(here('./fonts/spectral-latin-400-normal.ttf')), weight: 400 },
        { name: 'Spectral', data: readFileSync(here('./fonts/spectral-latin-600-normal.ttf')), weight: 600 },
      ],
    };
  }
  return assets;
}

const el = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const GOLD = '#E9C478', BONE = '#ECE6D8', MIST = '#9097AB';

/**
 * @param {{n:number, date:string, paidVeil:number, paidUsd:number, farmers:number, top?:{wallet:string,tier:string,days:number}}} h
 */
export async function harvestCard(h) {
  const { bg, fonts } = load();
  const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
  const tree = el('div', { width: 1200, height: 675, position: 'relative', background: '#07080C', fontFamily: 'Spectral' }, [
    { type: 'img', props: { src: bg, width: 1200, height: 675, style: { position: 'absolute', left: 0, top: 0 } } },
    el('div', { position: 'absolute', left: 72, top: 64, flexDirection: 'column', width: 700 }, [
      el('div', { fontFamily: 'Cinzel', fontSize: 30, color: GOLD, letterSpacing: 4 }, `$AURA · HARVEST #${h.n}`),
      el('div', { fontFamily: 'Cinzel', fontSize: 92, color: BONE, marginTop: 28, lineHeight: 1 }, `${fmt(h.paidVeil)} VEIL`),
      el('div', { fontSize: 36, color: GOLD, marginTop: 14 }, `about $${fmt(h.paidUsd, 2)}, paid by aura`),
      el('div', { fontSize: 40, color: BONE, marginTop: 40, fontWeight: 600 }, `${fmt(h.farmers)} farmer${h.farmers === 1 ? '' : 's'} paid, straight to their wallets`),
      h.top ? el('div', { fontSize: 30, color: MIST, marginTop: 16 }, `Top farmer ${short(h.top.wallet)} · ${h.top.tier} · ${fmt(h.top.days, 1)} days held`) : el('div', {}, ''),
      el('div', { fontSize: 28, color: MIST, marginTop: 56 }, `${h.date} · auraveil.xyz · hold to farm aura`),
    ]),
  ]);
  const svg = await satori(tree, { width: 1200, height: 675, fonts });
  return new Resvg(svg).render().asPng();
}
