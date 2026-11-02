// One-time bot setup: points Telegram at /api/telegram and sets the command menu.
// Call with the cron secret after TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are set.
import { tg, tgReady } from '../lib/telegram.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Not allowed' });
  if (!tgReady() || !process.env.TELEGRAM_WEBHOOK_SECRET) return res.status(400).json({ error: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first.' });
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const hook = await tg('setWebhook', { url: `https://${host}/api/telegram`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'] });
  const cmds = await tg('setMyCommands', { commands: [
    { command: 'aura', description: 'Your tier, aura and multiplier' },
    { command: 'top', description: 'Top farmers' },
    { command: 'harvest', description: 'Bankroll and next harvest' },
    { command: 'ca', description: 'The real contract and links' },
  ] });
  const me = await tg('getMe', {});
  return res.status(200).json({ webhook: hook, commands: cmds, bot: me?.result?.username });
}
