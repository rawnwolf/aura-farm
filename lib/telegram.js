// Minimal Telegram Bot API client. Set TELEGRAM_BOT_TOKEN in Vercel.
const api = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
export const tgReady = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

export async function tg(method, body) {
  if (!tgReady()) return null;
  const r = await fetch(api(method), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.error('telegram', method, j.description || r.status);
  return j;
}

export const sendText = (chat_id, text, extra = {}) =>
  tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

export async function sendPhoto(chat_id, png, caption) {
  if (!tgReady()) return null;
  const form = new FormData();
  form.append('chat_id', String(chat_id));
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  form.append('photo', new Blob([png], { type: 'image/png' }), 'harvest.png');
  const r = await fetch(api('sendPhoto'), { method: 'POST', body: form });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.error('telegram sendPhoto', j.description || r.status);
  return j;
}

export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
