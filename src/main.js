import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/800.css';
import '@fontsource/spectral/400.css';
import '@fontsource/spectral/400-italic.css';
import '@fontsource/spectral/500.css';
import './style.css';
import { CONFIG, TIERS, multiplierFor, tierIndexFor } from './config.js';
import { createScene } from './scene.js';
import { makeCard, makeAnimatedCard, videoSupport, shareText } from './card.js';

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
const caNote = $('[data-ca-note]');
if (CONFIG.mint) {
  caValue.textContent = `${CONFIG.mint.slice(0, 6)}…${CONFIG.mint.slice(-6)}`;
  caValue.title = CONFIG.mint;
  caCopy.hidden = false;
  caCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.mint);
      caCopy.textContent = 'Copied';
      setTimeout(() => (caCopy.textContent = 'Copy address'), 1600);
    } catch {
      caValue.textContent = CONFIG.mint;
      caCopy.textContent = 'Select and copy';
    }
  });
} else {
  caValue.textContent = 'At launch';
  caNote.textContent = 'posted here and on X';
}

// ---------- Growth simulator ----------
const range = $('[data-sim-range]');
const track = $('[data-tier-track]');
TIERS.forEach((t, i) => {
  const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-pressed="false" style="--g:${t.color}"><span class="tgem" style="background:${t.color};color:${t.color}" aria-hidden="true"></span>${t.name}<small>Day ${t.day}</small></button>`;
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
      </dl>
      <button class="btn btn-ghost card-btn" type="button" data-card-wallet>Make my aura card</button>`;
    $('[data-card-wallet]', out).addEventListener('click', () =>
      openCard({ tierIndex: ti, multiplier: Number(a.multiplier), days: Number(a.days), aura: a.aura, wallet }));
  } catch {
    out.innerHTML = '<p class="err">Couldn’t read this wallet right now. Try again in a minute.</p>';
  }
});

// ---------- Aura cards ----------
const dialog = $('[data-card-dialog]');
const img = $('[data-card-img]');
const video = $('[data-card-video]');
const progress = $('[data-card-progress]');
const progressBar = $('[data-card-progress-bar]');
const saveLink = $('[data-card-save]');
const shareBtn = $('[data-card-share]');
const hint = $('[data-card-hint]');
const modeBtns = $$('[data-card-mode]');
const videoOk = !!videoSupport();
if (!videoOk) {
  const anim = $('[data-card-mode="animated"]');
  anim.disabled = true;
  anim.title = 'This browser can’t record video';
}

let cardData = null;
let mode = 'still';
const made = { still: null, animated: null }; // { file, url } per mode for the current card
let recording = false;

function slug(data) { return `aura-${TIERS[data.tierIndex].name.toLowerCase()}`; }
function clearMade() {
  Object.values(made).forEach((m) => m && URL.revokeObjectURL(m.url));
  made.still = made.animated = null;
}

function setMode(m) {
  mode = m;
  modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cardMode === m)));
  render();
}

function render() {
  const m = made[mode];
  const isVideo = mode === 'animated';
  img.hidden = isVideo;
  video.hidden = !isVideo || !m;
  progress.hidden = !(isVideo && recording);
  saveLink.textContent = isVideo ? 'Save video' : 'Save image';
  const ready = !!m;
  saveLink.setAttribute('aria-disabled', ready ? 'false' : 'true');
  saveLink.style.pointerEvents = ready ? '' : 'none';
  if (!m) { shareBtn.hidden = true; return; }
  saveLink.href = m.url;
  saveLink.download = m.file.name;
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [m.file] }));
  shareBtn.hidden = !canShare;
  const what = isVideo ? 'video' : 'image';
  hint.textContent = canShare
    ? `Share sends the ${what} straight to X, Telegram or anywhere else on your phone.`
    : `X can’t attach files from a link, so save the ${what} first, then add it to your post.`;
  if (isVideo && video.src !== m.url) { video.src = m.url; video.play().catch(() => {}); }
}

shareBtn.addEventListener('click', async () => {
  const m = made[mode];
  if (!m) return;
  try { await navigator.share({ files: [m.file], text: `${shareText(cardData)} ${CONFIG.siteUrl}` }); } catch { /* cancelled */ }
});

async function makeStill() {
  const canvas = await makeCard(scene, cardData);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], `${slug(cardData)}.png`, { type: 'image/png' });
  made.still = { file, url: URL.createObjectURL(blob) };
  img.src = made.still.url;
  img.alt = `Aura card: ${TIERS[cardData.tierIndex].name} tier, ${cardData.multiplier.toFixed(2)}× multiplier`;
}

async function makeAnimated() {
  if (recording || made.animated) return;
  recording = true;
  progressBar.style.width = '0%';
  $('[data-card-progress-label]').textContent = 'Recording your aura';
  render();
  const forData = cardData;
  try {
    const { blob, ext, mime } = await makeAnimatedCard(scene, forData, {
      onProgress: (p) => { progressBar.style.width = `${Math.round(p * 100)}%`; },
    });
    if (forData !== cardData) return; // a different card was opened meanwhile
    const file = new File([blob], `${slug(forData)}.${ext}`, { type: mime });
    made.animated = { file, url: URL.createObjectURL(blob) };
  } catch {
    $('[data-card-progress-label]').textContent = 'Recording didn’t work in this browser. Try the still card.';
    recording = false;
    progress.hidden = false;
    return;
  } finally {
    recording = false;
  }
  render();
}

modeBtns.forEach((b) => b.addEventListener('click', () => {
  if (b.disabled) return;
  setMode(b.dataset.cardMode);
  if (b.dataset.cardMode === 'animated') makeAnimated();
}));

async function openCard(data) {
  const btns = $$('[data-card-sim], [data-card-wallet]');
  btns.forEach((b) => (b.disabled = true));
  try {
    clearMade();
    cardData = data;
    video.removeAttribute('src');
    await makeStill();
    $('[data-card-x]').href = `https://x.com/intent/post?text=${encodeURIComponent(shareText(data))}&url=${encodeURIComponent(CONFIG.siteUrl)}`;
    setMode('still');
    dialog.showModal();
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

$('[data-card-sim]').addEventListener('click', () => {
  const days = Number(range.value);
  openCard({ tierIndex: tierIndexFor(days), multiplier: multiplierFor(days), days });
});
$('[data-card-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => video.pause());

// Used to render the link-preview image
window.__aura = { makeCard: (d) => makeCard(scene, d), makeAnimatedCard: (d, o) => makeAnimatedCard(scene, d, o) };
