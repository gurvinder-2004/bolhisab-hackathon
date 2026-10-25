// Customer name resolution for voice: "gupta ji" -> one customer, or "which one?" with what differs.

const C = { 'क':'k','ख':'kh','ग':'g','घ':'gh','च':'ch','छ':'chh','ज':'j','झ':'jh','ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'f','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h','ळ':'l' };
const V = { 'अ':'a','आ':'a','इ':'i','ई':'i','उ':'u','ऊ':'u','ए':'e','ऐ':'ai','ओ':'o','औ':'au','ऋ':'ri' };
const M = { 'ा':'a','ि':'i','ी':'i','ु':'u','ू':'u','े':'e','ै':'ai','ो':'o','ौ':'au','ृ':'ri' };
const HALANT = '\u094D', NUKTA = '\u093C';

function translitWord(w) {
  const ch = [...w];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (C[c]) {
      out += C[c];
      let j = i + 1;
      if (ch[j] === NUKTA) j++;
      const n = ch[j];
      if (n && M[n]) { out += M[n]; i = j; }
      else if (n === HALANT) { i = j; }
      else { if (j < ch.length) out += 'a'; i = j - 1; } // schwa kept except at word end
    } else if (V[c]) out += V[c];
    else if (c === 'ं' || c === 'ँ') out += 'n';
    else if (c === 'ः') out += 'h';
    else if (c !== HALANT && c !== NUKTA) out += c;
  }
  return out;
}

// Devanagari (Hindi/Marathi) -> rough Latin. Other scripts pass through unchanged.
export function transliterate(s) {
  if (!/[\u0900-\u097F]/.test(s)) return s;
  return s.split(/(\s+)/).map((p) => (/^\s+$/.test(p) ? p : translitWord(p))).join('');
}

const STOP = new Set(['ji','sahab','saheb','sahib','bhai','bhaiya','seth','shri','shree','sri','mr','mrs','ms','madam','sir',
  'ka','ke','ki','ko','se','wale','wala','wali','pvt','ltd','co','and','the','m','s']);

function phonetic(t) {
  return t.replace(/ph/g, 'f').replace(/sh/g, 's').replace(/w/g, 'v').replace(/z/g, 'j')
    .replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u').replace(/aa/g, 'a').replace(/(.)\1+/g, '$1');
}
const skeleton = (t) => t[0] + t.slice(1).replace(/[aeiouy]/g, '');

export function tokens(s) {
  return transliterate(String(s ?? '')).toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter((t) => t && !STOP.has(t)).map(phonetic);
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function tokenScore(a, b) {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;
  if (skeleton(a) === skeleton(b) && skeleton(a).length >= 3) return 0.85;
  const r = 1 - lev(a, b) / Math.max(a.length, b.length);
  return r >= 0.8 ? r : 0;
}

const fields = (c) => [...new Set([c.name, c.shopName, c.area, c.city].flatMap(tokens))];

// -> { status: 'unique' | 'ambiguous' | 'none', candidates: [{customer, score}] }
export function resolveCustomer(spoken, customers) {
  const st = tokens(spoken);
  if (!st.length) return { status: 'none', candidates: [] };
  const cands = [];
  for (const c of customers) {
    const ct = fields(c);
    let total = 0, ok = true;
    for (const s of st) {
      let best = 0;
      for (const t of ct) best = Math.max(best, tokenScore(s, t));
      if (best < 0.8) { ok = false; break; }
      total += best;
    }
    if (ok) cands.push({ customer: c, score: total / st.length });
  }
  cands.sort((a, b) => b.score - a.score);
  if (!cands.length) return { status: 'none', candidates: [] };
  const top = cands[0].score;
  const rivals = cands.slice(1).filter((x) => x.score >= top - 0.1);
  if (top >= 0.9 && rivals.length === 0) return { status: 'unique', candidates: [cands[0]] };
  return { status: 'ambiguous', candidates: cands.slice(0, 5) };
}

// "kaunse Gupta ji?" labels: name plus whatever differs (area, shop, city, phone) until each is unique.
export function describeCandidates(customers) {
  const extras = [['area', (c) => c.area], ['shop', (c) => c.shopName], ['city', (c) => c.city], ['phone', (c) => c.phone && 'ending ' + c.phone.slice(-4)]];
  const used = [];
  const label = (c) => [c.name, ...used.map((f) => f(c)).filter(Boolean)].join(' · ');
  const unique = () => new Set(customers.map(label)).size === customers.length;
  for (const [, f] of extras) {
    if (used.length && unique()) break;
    if (new Set(customers.map((c) => f(c))).size > 1) used.push(f);
  }
  return customers.map((c) => ({ id: c.id, label: label(c) }));
}

const ORD = { pehla: 0, pehle: 0, pahila: 0, first: 0, one: 0, ek: 0, '1': 0, doosra: 1, doosre: 1, dusra: 1, dusre: 1, second: 1, two: 1, do: 1, '2': 1, teesra: 2, teesre: 2, tisra: 2, third: 2, three: 2, teen: 2, '3': 2 };
// "pehle wale" / "second one" -> index, or null
export function pickByOrdinal(text, count) {
  for (const w of transliterate(String(text)).toLowerCase().split(/[^a-z0-9]+/)) {
    if (w in ORD && ORD[w] < count) return ORD[w];
  }
  return null;
}
