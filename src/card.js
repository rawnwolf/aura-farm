import { CONFIG, TIERS } from './config.js';

const W = 1200, H = 675; // large-image size for X and Telegram (16:9)
const GOLD_HI = '#f3dc9b', GOLD = '#d9b56a', BONE = '#ece4d2', MIST = '#8d8899', TEAL = '#45d6c8';

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('800 120px "Cinzel"'),
      document.fonts.load('700 40px "Cinzel"'),
      document.fonts.load('400 24px "Cinzel"'),
      document.fonts.load('400 26px "Spectral"'),
      document.fonts.load('500 24px "Spectral"'),
    ]);
  } catch { /* fall back to system serif */ }
}

function corner(g, x, y, sx, sy) {
  g.save();
  g.translate(x, y); g.scale(sx, sy);
  g.strokeStyle = GOLD; g.lineWidth = 2;
  g.beginPath(); g.moveTo(2, 40); g.lineTo(2, 12); g.lineTo(12, 2); g.lineTo(40, 2); g.stroke();
  g.globalAlpha = 0.45; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(9, 32); g.lineTo(9, 16); g.lineTo(16, 9); g.lineTo(32, 9); g.stroke();
  g.globalAlpha = 1; g.fillStyle = GOLD_HI;
  g.beginPath(); g.moveTo(14, 10); g.lineTo(18, 14); g.lineTo(14, 18); g.lineTo(10, 14); g.closePath(); g.fill();
  g.restore();
}

/**
 * Draw an aura card.
 * data: { tierIndex, multiplier, days, aura?, wallet? }
 * A card with no aura value is a preview from the tier slider, so its wording says "farming toward".
 */
export async function makeCard(scene, data) {
  await fontsReady();
  const t = TIERS[data.tierIndex];
  const real = data.aura != null;
  const intensity = 0.25 + ((data.multiplier - 1) / 2) * 0.85;

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d');
  g.fillStyle = '#05070a';
  g.fillRect(0, 0, W, H);

  // The portal, rendered live at this tier, on the right
  const figX = 560, figW = W - figX;
  if (scene) {
    scene.snapshot(t.color, intensity, ({ canvas, cx, top, bottom }) => {
      const srcH = bottom - top;
      const srcW = srcH * (figW / H);
      g.drawImage(canvas, cx - srcW / 2, top, srcW, srcH, figX, 0, figW, H);
    });
  } else {
    const glow = g.createRadialGradient(figX + figW / 2, H * 0.42, 10, figX + figW / 2, H * 0.42, 340);
    glow.addColorStop(0, t.color); glow.addColorStop(1, 'rgba(5,7,10,0)');
    g.fillStyle = glow; g.fillRect(figX, 0, figW, H);
  }
  const fade = g.createLinearGradient(figX - 20, 0, figX + 200, 0);
  fade.addColorStop(0, 'rgba(5,7,10,1)'); fade.addColorStop(1, 'rgba(5,7,10,0)');
  g.fillStyle = fade; g.fillRect(figX - 20, 0, 220, H);
  g.fillStyle = '#05070a'; g.fillRect(0, 0, figX - 20, H);

  // Gold frame
  g.strokeStyle = 'rgba(217,181,106,0.45)'; g.lineWidth = 2;
  g.strokeRect(22, 22, W - 44, H - 44);
  corner(g, 16, 16, 1, 1); corner(g, W - 16, 16, -1, 1); corner(g, 16, H - 16, 1, -1); corner(g, W - 16, H - 16, -1, -1);

  const left = 76;
  g.textBaseline = 'alphabetic';

  // Brand
  g.fillStyle = BONE;
  g.font = '700 34px "Cinzel", serif';
  g.fillText('$AURA', left, 104);
  g.fillStyle = TEAL;
  g.font = '400 15px "Cinzel", serif';
  g.letterSpacing = '4px';
  g.fillText('PAIRED WITH $VEIL', left + 136, 101);

  // Line above the tier
  g.fillStyle = TEAL;
  g.font = '400 20px "Cinzel", serif';
  g.letterSpacing = '5px';
  const who = data.wallet ? `${data.wallet.slice(0, 4)}…${data.wallet.slice(-4)}` : null;
  let leadX = left;
  if (real && who) {
    // Wallet addresses are case-sensitive, so draw them as-is, not in capitals
    g.letterSpacing = '0px';
    g.font = '500 24px "Spectral", serif';
    g.fillText(who, left, 226);
    leadX = left + g.measureText(who).width + 14;
    g.font = '400 20px "Cinzel", serif';
    g.letterSpacing = '5px';
  }
  const lead = real ? (who ? 'has reached' : 'My aura has reached') : 'Farming toward';
  g.fillText(lead.toUpperCase(), leadX, 226);
  g.letterSpacing = '0px';

  // Tier name in its colour
  g.save();
  let size = 112;
  g.font = `800 ${size}px "Cinzel", serif`;
  const name = t.name.toUpperCase();
  while (g.measureText(name).width > figX - left - 10 && size > 60) { size -= 4; g.font = `800 ${size}px "Cinzel", serif`; }
  g.shadowColor = t.color; g.shadowBlur = 38;
  g.fillStyle = t.color;
  g.fillText(name, left - 3, 226 + size * 0.95);
  g.restore();

  // Stats
  const statsY = 226 + size * 0.95 + 86;
  const stats = [[`${data.multiplier.toFixed(2)}×`, 'Multiplier']];
  stats.push([`${Math.floor(data.days)}`, real ? 'Days held' : 'Days']);
  if (real) stats.push([Number(data.aura).toLocaleString(undefined, { maximumFractionDigits: 0 }), 'Aura']);
  let x = left;
  stats.forEach(([num, label]) => {
    g.fillStyle = GOLD_HI;
    g.font = '700 42px "Cinzel", serif';
    g.fillText(num, x, statsY);
    const nw = g.measureText(num).width;
    g.fillStyle = MIST;
    g.font = '400 15px "Cinzel", serif';
    g.letterSpacing = '3px';
    g.fillText(label.toUpperCase(), x, statsY + 30);
    const lw = g.measureText(label.toUpperCase()).width;
    g.letterSpacing = '0px';
    x += Math.max(nw, lw) + 54;
  });

  // Footer: motto in gold, site
  const grad = g.createLinearGradient(0, H - 110, 0, H - 72);
  grad.addColorStop(0, '#fff1c4'); grad.addColorStop(0.6, '#e6bd6b'); grad.addColorStop(1, '#a8772c');
  g.fillStyle = grad;
  g.font = '800 34px "Cinzel", serif';
  g.fillText('HOLD. FARM. ASCEND.', left, H - 84);
  g.fillStyle = MIST;
  g.font = '400 22px "Spectral", serif';
  g.fillText(CONFIG.siteHost, left, H - 52);

  return out;
}

export function shareText(data) {
  const t = TIERS[data.tierIndex];
  return data.aura != null
    ? `My aura has reached ${t.name} on $AURA, farming at ${data.multiplier.toFixed(2)}×. Hold. Farm. Ascend.`
    : `Farming toward ${t.name} on $AURA. Hold. Farm. Ascend.`;
}
