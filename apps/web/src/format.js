export const pct = (p) => `${Math.round((p ?? 0) * 100)}%`;

export const time = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Brauzerlarda uz-UZ lokali har doim ham to'liq emas — nomlarni o'zimiz beramiz
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const WEEKDAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

export const dateLong = (iso) => {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`;
};

export const dateShort = (d) => `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()}`;

export function countdown(iso, now = Date.now()) {
  let ms = Date.parse(iso) - now;
  if (ms <= 0) return 'hozir';
  const d = Math.floor(ms / 86400000);
  ms -= d * 86400000;
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const m = Math.floor(ms / 60000);
  return [d && `${d} kun`, h && `${h} soat`, `${m} daqiqa`].filter(Boolean).join(' ');
}

export const RESULT_LABEL = { W: 'G', D: 'D', L: 'M' }; // G'alaba / Durang / Mag'lubiyat
