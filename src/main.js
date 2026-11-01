import './style.css';
import { CONFIG, TIERS, multiplierFor, tierIndexFor } from './config.js';
import { createScene } from './scene.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const prelaunch = !CONFIG.mint;

// ---------- 3D scene (falls back to a CSS glow if WebGL is unavailable) ----------
let scene = null;
try {
  scene = createScene($('#aura'));
} catch (e) {
  document.body.classList.add('no-webgl');
}

function applyTier(i, intensityOverride) {
  const t = TIERS[i];
  document.documentElement.style.setProperty('--tier', t.color);
  const intensity = intensityOverride ?? 0.3 + (i / (TIERS.length - 1)) * 0.7;
  scene?.setTier(t.color, intensity);
}

// ---------- Links ----------
$$('[data-x]').forEach((a) => (a.href = CONFIG.xUrl));
$$('[data-tg]').forEach((a) => (a.href = CONFIG.telegramUrl));
$$('[data-buy]').forEach((a) => {
  if (CONFIG.buyUrl) {
    a.href = CONFIG.buyUrl;
    a.target = '_blank';
    a.rel = 'noopener';
  } else {
    a.textContent = CONFIG.launchLabel;
    a.setAttribute('aria-disabled', 'true');
    a.removeAttribute('href');
  }
});

// ---------- Contract address ----------
const caValue = $('[data-ca-value]');
const caCopy = $('[data-ca-copy]');
if (CONFIG.mint) {
  caValue.textContent = CONFIG.mint;
  caCopy.hidden = false;
  caCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.mint);
      caCopy.textContent = 'Copied';
      setTimeout(() => (caCopy.textContent = 'Copy'), 1600);
    } catch {
      caCopy.textContent = 'Select and copy';
    }
  });
} else {
  caValue.textContent = 'Posted here and on X at launch';
  caValue.style.color = 'var(--mist)';
}

// ---------- Growth simulator ----------
const range = $('[data-sim-range]');
const track = $('[data-tier-track]');
TIERS.forEach((t, i) => {
  const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-pressed="false">${t.name}<small>${t.day === 0 ? 'Day 0' : `Day ${t.day}`}</small></button>`;
  li.querySelector('button').addEventListener('click', () => { range.value = t.day; updateSim(true); });
  track.appendChild(li);
});
let simTouched = false;
function updateSim(fromUser) {
  if (fromUser) simTouched = true;
  const days = Number(range.value);
  const m = multiplierFor(days);
  const ti = tierIndexFor(days);
  $('[data-sim-tier]').textContent = TIERS[ti].name;
  $('[data-sim-blurb]').textContent = TIERS[ti].blurb;
  $('[data-sim-days]').textContent = days % 1 === 0 ? days : days.toFixed(1);
  $('[data-sim-mult]').textContent = `${m.toFixed(2)}×`;
  $$('button', track).forEach((b, i) => b.setAttribute('aria-pressed', String(i === ti)));
  range.setAttribute('aria-valuetext', `${days} days, ${TIERS[ti].name}, ${m.toFixed(2)} times`);
  // Intensity follows the multiplier smoothly, not just the tier step
  applyTier(ti, 0.25 + ((m - 1) / 2) * 0.85);
}
range.addEventListener('input', () => updateSim(true));
updateSim(false);

// ---------- Scroll: drift the figure, and let the page tell the tier story ----------
const grow = $('#grow');
function onScroll() {
  const vh = window.innerHeight;
  scene?.setScroll(Math.min(window.scrollY / vh, 1));
  // Before someone touches the slider, scrolling through the tiers section previews the climb
  if (!simTouched) {
    const r = grow.getBoundingClientRect();
    const p = Math.min(Math.max((vh * 0.75 - r.top) / (r.height + vh * 0.25), 0), 1);
    if (p > 0 && p < 1) { range.value = Math.round(p * 30 * 4) / 4; updateSim(false); }
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Data ----------
const fmtUsd = (n) => (n == null ? '—' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })}`);
const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }));
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

let nextHarvestAt = null;
function tickCountdown() {
  const el = $('[data-countdown]');
  if (!nextHarvestAt) return;
  const s = Math.max(0, Math.floor((nextHarvestAt - Date.now()) / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  el.textContent = `${h}:${m}:${sec}`;
}
setInterval(tickCountdown, 1000);

function renderBoard(rows) {
  const board = $('[data-board]');
  if (!rows?.length) {
    board.innerHTML = `<p class="empty">${prelaunch ? 'The leaderboard fills in after launch. The first farmers start glowing on day one.' : 'No farmers yet. Buy and hold to take the top spot.'}</p>`;
    return;
  }
  board.innerHTML = `<table>
    <thead><tr><th scope="col">Rank</th><th scope="col">Wallet</th><th scope="col">Tier</th><th scope="col">Aura</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(short(r.wallet))}</td><td>${escapeHtml(r.tier)}</td><td>${fmtNum(r.aura)}</td></tr>`).join('')}</tbody>
  </table>`;
}

async function loadState() {
  if (prelaunch) {
    $('[data-countdown-label]').textContent = 'First harvest';
    $('[data-countdown]').textContent = 'After launch';
    renderBoard([]);
    return;
  }
  try {
    const s = await getJSON('/api/state');
    $('[data-bankroll]').textContent = fmtUsd(s.bankrollUsd);
    $('[data-farmers]').textContent = fmtNum(s.farmers);
    if (s.nextHarvestAt) { nextHarvestAt = new Date(s.nextHarvestAt).getTime(); tickCountdown(); }
    else $('[data-countdown]').textContent = 'Starting soon';
    renderBoard(s.top);
  } catch {
    $('[data-board]').innerHTML = '<p class="empty">Live farming data is unavailable right now. Refresh in a minute.</p>';
  }
}
loadState();
if (!prelaunch) setInterval(loadState, 60_000);

// ---------- Wallet lookup ----------
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
$('[data-lookup]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('[data-lookup-result]');
  const wallet = new FormData(e.target).get('wallet').trim();
  if (!SOL_ADDR.test(wallet)) {
    out.innerHTML = '<p class="err">That doesn’t look like a Solana wallet address. Check for missing or extra characters.</p>';
    return;
  }
  if (prelaunch) {
    out.innerHTML = `<p>Farming starts at launch.</p><p class="muted">Once you buy, this wallet starts at Spark and climbs from there. Check back after launch to see it glow.</p>`;
    return;
  }
  out.innerHTML = '<p class="muted">Reading your aura…</p>';
  try {
    const a = await getJSON(`/api/aura?wallet=${encodeURIComponent(wallet)}`);
    if (!a.holding) {
      out.innerHTML = `<p>This wallet isn’t farming yet.</p><p class="muted">Buy and hold $AURA and it starts at Spark.</p>`;
      applyTier(0);
      return;
    }
    const ti = Math.max(0, TIERS.findIndex((t) => t.name === a.tier));
    applyTier(ti);
    simTouched = true;
    out.innerHTML = `
      <p class="sim-tier" style="font-size:2.6rem">${escapeHtml(TIERS[ti].name)}</p>
      <dl class="sim-stats" style="margin-top:14px;flex-wrap:wrap">
        <div><dt>Aura</dt><dd>${fmtNum(a.aura)}</dd></div>
        <div><dt>Multiplier</dt><dd>${Number(a.multiplier).toFixed(2)}×</dd></div>
        <div><dt>Days held</dt><dd>${Number(a.days).toFixed(1)}</dd></div>
        <div><dt>Est. next harvest</dt><dd>${fmtUsd(a.estHarvestUsd)}</dd></div>
      </dl>`;
  } catch {
    out.innerHTML = '<p class="err">Couldn’t read this wallet right now. Try again in a minute.</p>';
  }
});
