// Aura for one wallet. Pre-launch until AURA_MINT is set.
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export default function handler(req, res) {
  const wallet = String(req.query.wallet || '');
  if (!SOL_ADDR.test(wallet)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address' });
  }
  if (!process.env.AURA_MINT) {
    return res.status(200).json({ phase: 'prelaunch', holding: false });
  }
  // Placeholder until the farming engine is connected.
  return res.status(200).json({ phase: 'live', holding: false });
}
