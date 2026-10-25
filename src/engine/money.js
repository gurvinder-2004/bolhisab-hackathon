// All money is whole paise (integers). Rupee decimals are converted exactly once, at input.

// Integer division rounded half up. d must be > 0.
export function roundDiv(n, d) {
  return Math.floor((2 * n + d) / (2 * d));
}

// "10,000.50" | 10000.5 | "₹333" -> paise. Third decimal onward rounds half up.
export function toPaise(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Invalid amount');
    input = String(input);
  }
  let s = String(input).trim().replace(/[₹,\s]/g, '');
  if (!/^-?\d*\.?\d*$/.test(s) || s === '' || s === '-' || s === '.') {
    throw new Error(`Invalid amount: ${input}`);
  }
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [whole = '0', frac = ''] = s.split('.');
  let paise = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2));
  if (frac.length > 2 && frac[2] >= '5') paise += 1;
  return neg ? -paise : paise;
}

// Quantity with up to 3 decimals -> integer thousandths.
export function toMilli(q) {
  const s = String(q).trim();
  if (!/^\d+(\.\d{1,3})?$/.test(s)) throw new Error(`Invalid quantity: ${q}`);
  const [w, f = ''] = s.split('.');
  return Number(w) * 1000 + Number((f + '000').slice(0, 3));
}

// Percent (up to 2 decimals) -> basis points. 18 -> 1800.
export const pctToBp = (pct) => toPaise(pct);

const INT = new Intl.NumberFormat('en-IN');

// 10000000 paise -> "₹1,00,000"; paise shown only when non-zero (or alwaysPaise).
export function formatINR(paise, { alwaysPaise = false } = {}) {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  let out = '₹' + INT.format(rupees);
  if (p !== 0 || alwaysPaise) out += '.' + String(p).padStart(2, '0');
  return neg ? '-' + out : out;
}
