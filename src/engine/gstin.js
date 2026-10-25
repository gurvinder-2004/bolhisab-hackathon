import { STATE_CODES } from './states.js';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Check character for the first 14 characters of a GSTIN (base-36, weights 1,2,1,2...).
export function gstinCheckChar(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const idx = CHARS.indexOf(first14[i]);
    if (idx < 0) throw new Error('Invalid GSTIN character');
    const v = idx * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export function makeGstin(first14) {
  return first14 + gstinCheckChar(first14);
}

export function validateGstin(input) {
  const g = String(input ?? '').trim().toUpperCase();
  if (g.length !== 15) return { valid: false, reason: 'GSTIN must be 15 characters' };
  if (!PATTERN.test(g)) return { valid: false, reason: 'GSTIN format is wrong' };
  const stateCode = g.slice(0, 2);
  if (!STATE_CODES[stateCode]) return { valid: false, reason: 'Unknown state code' };
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { valid: false, reason: 'Check digit does not match' };
  return { valid: true, gstin: g, stateCode, state: STATE_CODES[stateCode], pan: g.slice(2, 12) };
}
