// Rule-based Hinglish/Hindi/English command parser. Deterministic fallback for when
// Gemini is unreachable; also runs first on typed text (free, instant, offline).
// It NEVER calculates anything: amounts are taken exactly as spoken, one number per command.
// Output shape matches the Gemini path so the UI treats both identically.

import { transliterate } from '../domain/match.js';

// Same phonetic folding as match.js, applied per word: "hazaar"/"हज़ार"/"hazara" -> "hajar".
function normWord(w) {
  let t = transliterate(String(w)).toLowerCase().replace(/[^a-z0-9]/g, '');
  t = t.replace(/ph/g, 'f').replace(/sh/g, 's').replace(/w/g, 'v').replace(/z/g, 'j')
    .replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u').replace(/aa/g, 'a')
    .replace(/(.)\1+/g, '$1');
  return t;
}

// Spoken numbers 1-99 keyed by their normalized form.
// Careful: सात (7) -> "sat", साठ (60) -> "sath" — the schwa folding keeps them apart.
const NUM = {
  ek: 1, do: 2, dono: 2, tin: 3, char: 4, chara: 4, panch: 5, panc: 5, pach: 5,
  chah: 6, chha: 6, che: 6, sat: 7, ath: 8, nau: 9, das: 10,
  gyarah: 11, barah: 12, terah: 13, chaudah: 14, chauda: 14, pandrah: 15, pandra: 15,
  solah: 16, sola: 16, satrah: 17, atarah: 18, unis: 19,
  bis: 20, ekis: 21, bais: 22, teis: 23, chaubis: 24, pacis: 25,
  chabis: 26, satais: 27, atais: 28, unatis: 29,
  tis: 30, ikatis: 31, batis: 32, taintis: 33, chauntis: 34, cauntis: 34,
  paintis: 35, chatis: 36, saintis: 37, adatis: 38, unatalis: 39,
  chalis: 40, iktalis: 41, betalis: 42, taintalis: 43, chavalis: 44,
  paintalis: 45, chiyalis: 46, sattalis: 47, atalis: 48, unacas: 49,
  pacas: 50, pachas: 50, ikvan: 51, banvan: 52, tirpan: 53,
  chauvan: 54, pachpan: 55, chapan: 56, sattavan: 57, atavan: 58, unsat: 59,
  sath: 60, ikasath: 61, basath: 62, tiresath: 63, chausath: 64,
  painsath: 65, chiyasath: 66, sarsath: 67, adsath: 68, unhattar: 69,
  sattar: 70, ekhattar: 71, bahattar: 72, tihattar: 73, chauhattar: 74,
  pachattar: 75, chihattar: 76, sathattar: 77, athattar: 78, unasi: 79,
  asi: 80, ekasi: 81, biri: 82, irasi: 83, chaurasi: 84, pachasi: 85,
  chiyasi: 86, satasi: 87, athasi: 88, niasi: 89, nabe: 90,
  ikyanave: 91, banave: 92, tiranave: 93, chauranave: 94, pachanave: 95,
  chyanave: 96, sattanave: 97, anthanave: 98, ninyanave: 99,
};
const HUNDRED = { sau: 100 };
const UNIT = { hajar: 1e3, lakh: 1e5, karod: 1e7 }; // "crore" -> normWord -> "crore"; add alias
UNIT.crore = 1e7;

// Digits first: "₹20,000", "400", "20k", "1.5 lakh". Returns {rupees, matched} with the raw matched text.
function numericAmount(text) {
  const re = /(?:₹|rs\.?|rupees?|rupaye)?\s*(\d+(?:,\d{2,3})*|\d+)(?:\.(\d{1,2}))?\s*(k|hazaar?|hazar|hajar|lakh|lac|crore|karod)?\b/i;
  const m = re.exec(text);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  if (m[2]) n += Number('0.' + m[2]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suf = m[3] ? normWord(m[3]) : '';
  if (suf === 'k' || suf === 'hajar') n *= 1e3;
  else if (suf === 'lakh' || suf === 'lac') n *= 1e5;
  else if (suf === 'karod' || suf === 'crore') n *= 1e7;
  return { rupees: n, matched: m[0] };
}

// Number-words: "do hajar paanch sau" -> 2500. Returns {rupees, start, end} as word indices (end exclusive).
function wordAmount(words) {
  const norm = words.map(normWord);
  let total = 0, segment = 0, start = -1, end = -1, any = false;
  for (let i = 0; i < norm.length; i++) {
    const t = norm[i];
    if (t in NUM) { segment += NUM[t]; if (start < 0) start = i; end = i; any = true; }
    else if (t in HUNDRED) { segment = (segment || 1) * 100; if (start < 0) start = i; end = i; any = true; }
    else if (t in UNIT) { total += (segment || 1) * UNIT[t]; segment = 0; if (start < 0) start = i; end = i; any = true; }
    else if (any) break; // the number phrase ended
  }
  total += segment;
  if (!any || total <= 0) return null;
  return { rupees: total, start, end: end + 1 };
}

// Command vocabulary: dropped from the extracted customer name. Stored in every form we match on.
const KW_LIST = (
  'ji jee sahab sahet seth bhai bhaiya shri shree mr mrs sir madam ka ke ki ko se me mein par liye aur and of the to a an ' +
  'add karo kardo krdo daal dalo daldo dala daala diya diye dale entry kijiye ' +
  'samaan saman maal cheez liya liye le liye legaye gaye ' +
  'udhaar udhar khaata khaat khate khatein khata baaki baki ' +
  'bhej bheje bheja bhejiye dena payment paisa paise rupees rupaye ' +
  'aaya aaye aayein mila mile transfer kiya kiye ' +
  'upi neft rtgs imps cash cheque check online phonepe gpay googlepay paytm bank ' +
  'chukaya chuka jama jamma ' +
  'naya nayi navi customer grahak client banaye banao banao kholog kholo open create ' +
  'kitna kitne kitni kinta kitana kitane kya hai hein hain ho total balance due ' +
  'hisaab hisab batavo batao bata dikhao dikha do mujhe please ' +
  'reminder yaad yad dila dilado dilwa send bhejo msg message whatsapp ' +
  'abhi aaj kal is iske iska isko us uska jo invoice bill banao bana banaye gst ' +
  'सामान उधार खाते खाता बाकी भेजे भेज दिया दिए ने का की को से में नया नई ग्राहक कितना कितने हिसाब बताओ याद दिलाओ जी जी'
).split(/\s+/);
const KW = new Set(KW_LIST.flatMap((w) => {
  const t = transliterate(w).toLowerCase();
  return [w.toLowerCase(), t, normWord(w)];
}));

const norm = (list) => [...new Set(list.map(normWord))];
// Payment verbs: "bheje", "aaya", "jama"... ("liya" is deliberately NOT here — it means credit)
const PAY_VERBS = norm(['bheje', 'bheja', 'bhej', 'diye', 'diya', 'chukaya', 'chuka', 'payment', 'transfer', 'jama', 'mila', 'aaya', 'aaye', 'भेजे', 'दिया', 'दिए', 'आया', 'आए', 'जमा']);
const CREDIT_WORDS = norm(['samaan', 'saman', 'maal', 'udhaar', 'udhar', 'khaate', 'khaat', 'khate', 'khata', 'liya', 'liye', 'सामान', 'उधार', 'खाते', 'खाता', 'लिया', 'लिए']);
const ASK_WORDS = norm(['kitna', 'kitne', 'kitni', 'kinta', 'kitana', 'hisab', 'hisaab', 'balance', 'total', 'कितना', 'कितने', 'हिसाब']);
const DUE_WORDS = norm(['baaki', 'baki', 'due', 'hisaab', 'hisab', 'balance', 'बाकी', 'हिसाब']);
const REMINDER_WORDS = norm(['reminder', 'yaad', 'yad', 'whatsapp', 'msg', 'message', 'याद']);
const NEW_WORDS = norm(['naya', 'nayi', 'navi', 'नया', 'नई']);
const CUSTOMER_WORDS = norm(['customer', 'grahak', 'client', 'khaata', 'khaat', 'khata', 'ग्राहक', 'खाता']);

const hasAny = (norms, list) => norms.some((t) => list.includes(t));

// ---- itemized bills: "110 ki sabji, 90 ka tel, 150 ka raashan le liya" ----
// Each item is taken EXACTLY as spoken; the total is always summed here, never by the LLM.
const ITEM_LINK = new Set(['ka', 'ki', 'ke']); // "110 ki sabji", "90 ka tel"
const ITEM_STOP = new Set(norm(['liya', 'liye', 'lie', 'le', 'leliya', 'leliye', 'lelie', 'legaye', 'gaye', 'diya', 'diye', 'लिया', 'लिए', 'ले', 'गए']));
const GENERIC_LABELS = new Set(norm(['samaan', 'saman', 'maal', 'kirana', 'kiryana', 'samangri', 'सामान', 'माल', 'किराना']));
const DEFAULT_ITEM_LABEL = 'Kiryana samaan';
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Read an amount starting at word i (digits or number-words). -> {rupees, end} | null
function amountAt(words, i) {
  const m = /^(?:₹|rs\.?|rupees?|rupaye)?(\d+(?:,\d{2,3})*)(?:\.(\d{1,2}))?$/i.exec(words[i] ?? '');
  if (m) {
    let n = Number(m[1].replace(/,/g, ''));
    if (m[2]) n += Number('0.' + m[2]);
    let end = i + 1;
    const suf = normWord(words[end] ?? '');
    if (suf === 'k' || suf === 'hajar') { n *= 1e3; end++; }
    else if (suf === 'lakh' || suf === 'lac') { n *= 1e5; end++; }
    else if (suf === 'karod' || suf === 'crore') { n *= 1e7; end++; }
    return n > 0 ? { rupees: n, end } : null;
  }
  const wa = wordAmount(words.slice(i));
  if (wa && wa.start === 0 && wa.end > 0) return { rupees: wa.rupees, end: i + wa.end };
  return null;
}

// One clause: "<amount> (ki|ka|ke) <label words>". -> item | null
function itemAt(words, i) {
  const a = amountAt(words, i);
  if (!a) return null;
  let j = a.end;
  if (!ITEM_LINK.has(normWord(words[j] ?? ''))) return null;
  j++;
  const labelWords = [];
  while (j < words.length && labelWords.length < 4) {
    if (ITEM_STOP.has(normWord(words[j]))) break;
    const next = amountAt(words, j);
    if (next && ITEM_LINK.has(normWord(words[next.end] ?? ''))) break; // the next item starts here
    labelWords.push(words[j]);
    j++;
  }
  const label = labelWords.join(' ').replace(/[,.]$/g, '').trim();
  if (!label) return null;
  return { label, amountRupees: a.rupees, end: j };
}

// All items in the utterance + the word index where the first one starts.
function extractItems(words) {
  const items = [];
  let firstAt = -1;
  for (let i = 0; i < words.length; i++) {
    const it = itemAt(words, i);
    if (!it) continue;
    if (firstAt < 0) firstAt = i;
    items.push(it);
    i = it.end - 1; // jump past the label (handles comma-free lists too)
  }
  if (!items.length) return { items: null, firstAt: -1 };
  let list = items.map((it) => ({ label: cap(it.label), amountRupees: it.amountRupees }));
  // a lone generic "1000 ka samaan" becomes the default bill line
  if (list.length === 1 && GENERIC_LABELS.has(normWord(list[0].label))) list = [{ label: DEFAULT_ITEM_LABEL, amountRupees: list[0].amountRupees }];
  return { items: list, firstAt };
}

// ---- Short answers for the voice-confirm loop (typed text path; audio goes via Gemini) ----

const YES_WORDS = norm(['haan', 'han', 'ha', 'ji', 'haanji', 'karo', 'kardo', 'kardoji', 'kardijiye', 'kardena', 'thik', 'thika', 'theek', 'ok', 'okay', 'sahi', 'bilkul', 'chalo', 'avjo', 'hu', 'yes', 'ya', 'yep', 'correct', 'confirm', 'done', 'haanji', 'हाँ', 'हां', 'ठीक', 'सही', 'करो', 'जी', 'चलो', 'हौ', 'હોં', 'હા']);
const NO_WORDS = norm(['nahi', 'nahin', 'na', 'nahikarna', 'nahichahiye', 'matkaro', 'rehne', 'ruko', 'rukjao', 'band', 'bandkaro', 'cancel', 'galat', 'wrong', 'no', 'nope', 'stop', 'nahi', 'नहीं', 'ना', 'मत', 'रहने', 'बंद', 'गलत', 'ના', 'નહિ']);

export function parseShortAnswer(raw) {
  const words = String(raw ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'other';
  const norms = words.map(normWord);
  // any explicit no beats yes ("haan nahi" = no); a lone "ji" is not a yes
  if (norms.some((t) => NO_WORDS.includes(t) && t !== 'ji')) return 'no';
  const yes = norms.filter((t) => YES_WORDS.includes(t) && t !== 'ji');
  if (yes.length && (yes.length > 0 || norms.includes('ji'))) {
    // "ji haan" / "haan ji" both fine; bare "ji" alone is too ambiguous -> require another yes word
    if (yes.some((t) => t !== 'ji') || norms.includes('haan')) return 'yes';
  }
  return 'other';
}

// ---- Choice answers for the "kaunse Gupta ji?" loop ----
// -> { index: 0-based|null, wantsNew: bool }  (name matching against candidates happens in the caller)

// Ordinals keyed by normWord form; Devanagari दूसरा -> "dusara" (schwa), Latin "doosra" -> "dosra".
const ORD = { pehla: 0, pehle: 0, pahila: 0, pahile: 0, pahala: 0, pahale: 0, phela: 0, pherla: 0, first: 0, ek: 0,
  dosra: 1, dusra: 1, dusara: 1, dusre: 1, dosre: 1, second: 1, do: 1,
  tisra: 2, tisara: 2, tisare: 2, tisre: 2, third: 2, tin: 2, teen: 2,
  chautha: 3, chatha: 3, cautha: 3, chauta: 3, fourth: 3, char: 3,
  panchva: 4, pachva: 4, pansva: 4, fifth: 4, panch: 4 };

export function parseChoiceAnswer(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { index: null, wantsNew: false };
  const words = text.split(/\s+/);
  const norms = words.map(normWord);
  if (hasAny(norms, norm(['naya', 'navi', 'nayi', 'alag', 'नया', 'नई']))) return { index: null, wantsNew: true };
  for (const n of norms) if (n in ORD) return { index: ORD[n], wantsNew: false };
  for (const w of words) if (/^[1-5]$/.test(w)) return { index: Number(w) - 1, wantsNew: false };
  return { index: null, wantsNew: false };
}


export function parseCommand(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const words = text.split(/\s+/);
  const norms = words.map(normWord);

  // --- intent, priority: question > reminder > new customer > payment > credit
  let intent = null;
  if (hasAny(norms, ASK_WORDS) && (hasAny(norms, DUE_WORDS) || text.includes('?'))) intent = 'outstanding';
  else if (hasAny(norms, REMINDER_WORDS)) intent = 'reminder';
  else if (hasAny(norms, NEW_WORDS) && hasAny(norms, CUSTOMER_WORDS)) intent = 'add_customer';
  else if (hasAny(norms, PAY_VERBS)) intent = 'record_payment';
  else if (hasAny(norms, CREDIT_WORDS)) intent = 'add_credit';
  else if (numericAmount(text) || wordAmount(words)) intent = 'add_credit'; // bare "gupta ji 400" -> khata entry
  else return null;

  // --- items: "110 ki sabji, 90 ka tel" — runs for sale-ish intents; a real item list
  // always means goods taken on credit, even if a payment verb slipped in
  let items = null, firstItemAt = -1;
  if (intent === 'add_credit' || intent === 'record_payment' || numericAmount(text)) {
    const ex = extractItems(words);
    if (ex.items) {
      items = ex.items;
      firstItemAt = ex.firstAt;
      intent = 'add_credit';
    }
  }

  // --- amount
  let amount = null, wordSpan = null, matchedNum = null;
  if (intent !== 'add_customer') {
    if (items) {
      amount = Math.round(items.reduce((s, it) => s + Math.round(Number(it.amountRupees) * 100), 0)) / 100;
    } else {
      const n = numericAmount(text);
      if (n) { amount = n.rupees; matchedNum = n.matched; }
      else {
        const w = wordAmount(words);
        if (w) { amount = w.rupees; wordSpan = [w.start, w.end]; }
      }
    }
  }

  // --- customer name: words before the first item (or outside the amount span) that are not command words
  const matchedNumWords = new Set((matchedNum || '').toLowerCase().split(/\s+/));
  const nameLimit = items ? firstItemAt : words.length;
  const nameWords = [];
  for (let i = 0; i < nameLimit; i++) {
    if (wordSpan && i >= wordSpan[0] && i < wordSpan[1]) continue;
    if (matchedNumWords.has(words[i].toLowerCase())) continue;
    if (KW.has(words[i].toLowerCase()) || KW.has(norms[i])) continue;
    nameWords.push(words[i]);
  }
  const customerName = nameWords.join(' ').replace(/\s+/g, ' ').trim() || null;

  let paymentMethod = null;
  if (intent === 'record_payment') {
    const has = (l) => hasAny(norms, norm(l));
    if (has(['upi', 'phonepe', 'gpay', 'googlepay', 'paytm', 'imps'])) paymentMethod = 'upi';
    else if (has(['cash'])) paymentMethod = 'cash';
    else if (has(['cheque', 'check'])) paymentMethod = 'cheque';
    else if (has(['neft', 'rtgs', 'bank'])) paymentMethod = 'bank';
  }

  return {
    intent,
    customerName,
    customerNameRoman: customerName && transliterate(customerName) !== customerName ? transliterate(customerName) : null,
    amountRupees: amount,
    items,
    note: null,
    paymentMethod,
    heard: text,
  };
}
