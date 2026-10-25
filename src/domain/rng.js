// Deterministic random numbers so the demo data is identical on every machine.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const int = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export function uuid(rng) {
  let s = '';
  for (let i = 0; i < 32; i++) s += int(rng, 0, 15).toString(16);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}
