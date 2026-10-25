// Dates are ISO 'YYYY-MM-DD' strings in IST. Day maths is done on whole days, never hours.
const IST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function utc(iso) {
  if (!ISO.test(iso)) throw new Error(`Bad date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export const todayIST = (now = new Date()) => IST.format(now);
export const diffDays = (fromISO, toISO) => Math.round((utc(toISO) - utc(fromISO)) / 86400000);
export const addDays = (iso, n) => new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);
export const daysOverdue = (dueISO, todayISO) => Math.max(0, diffDays(dueISO, todayISO));
export const formatDateIN = (iso) => { utc(iso); const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
