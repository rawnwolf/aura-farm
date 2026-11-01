// Everything Tori may need to change lives here.
export const CONFIG = {
  // Set the coin's mint address after launch. Empty = pre-launch mode.
  mint: '',
  // Coin page on the Veilbound launchpad (set after launch).
  buyUrl: '',
  launchpadUrl: 'https://veilbound-launchpad.fly.dev',
  siteHost: 'auraveil.xyz',
  siteUrl: 'https://auraveil.xyz',
  xUrl: 'https://x.com/AuraVeil',
  telegramUrl: 'https://t.me/AuraVeilCommunity',
  harvestShare: 0.25, // share of the bankroll paid each daily harvest
};

// Multiplier: 1x at day 0, 2x at day 7, 3x at day 30 (capped).
export function multiplierFor(days) {
  if (days <= 0) return 1;
  if (days <= 7) return 1 + days / 7;
  return Math.min(3, 2 + (days - 7) / 23);
}

// Tiers are set by days held (and so by multiplier).
export const TIERS = [
  { name: 'Spark',    day: 0,  color: '#E9A24A', blurb: 'Your aura flickers on the moment you buy.' },
  { name: 'Ember',    day: 2,  color: '#FF6A2B', blurb: 'Two days in. The glow takes hold.' },
  { name: 'Flame',    day: 7,  color: '#FF3D7F', blurb: 'One week. Your farming rate has doubled.' },
  { name: 'Radiant',  day: 14, color: '#9B5CFF', blurb: 'Two weeks. The Veil starts to notice you.' },
  { name: 'Ascended', day: 30, color: '#FFE09A', blurb: 'Thirty days. Full 3× farming, for as long as you hold.' },
];

export function tierIndexFor(days) {
  let i = 0;
  TIERS.forEach((t, k) => { if (days >= t.day) i = k; });
  return i;
}
