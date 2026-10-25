import { INVOICE_PREFIX } from '../config.js';

// Financial year runs 1 April - 31 March. '2026-04-01' -> '26-27'
export function financialYear(iso) {
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

export function formatInvoiceNumber(prefix, fy, seq) {
  const n = `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;
  if (n.length > 16 || !/^[A-Za-z0-9/-]+$/.test(n)) throw new Error(`Invalid invoice number: ${n}`);
  return n;
}

// Next number = highest sequence already used in that financial year + 1. Never repeats.
export function nextInvoiceNumber(existing, dateISO, prefix = INVOICE_PREFIX) {
  if (!/^[A-Za-z0-9]+$/.test(prefix)) throw new Error('Prefix must be letters/numbers');
  const fy = financialYear(dateISO);
  const re = new RegExp(`^${prefix}/${fy}/(\\d+)$`);
  let max = 0;
  for (const n of existing) {
    const m = re.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return formatInvoiceNumber(prefix, fy, max + 1);
}
