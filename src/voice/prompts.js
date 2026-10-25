// Shared Gemini prompt + JSON schema for audio/text -> intent. The model only extracts
// what was SAID; it never computes or looks up anything. Same output shape as src/voice/rules.js.

export const INTENTS = ['add_credit', 'record_payment', 'add_customer', 'outstanding', 'reminder', 'unknown'];

export const SYSTEM_PROMPT = `You are the intent parser for "Baaki", a voice ledger for Indian shopkeepers.
The user speaks Hindi, Hinglish, English, Marathi or a mix. Extract the command into JSON.

Rules:
- Extract ONLY what was said. NEVER calculate, convert, or invent amounts. If the user says "do hazaar" the amount is 2000 because that is the number spoken; but if they say "paune do" (1:45/quarter-to-two style), write amount_rupees exactly as best heard and put the phrase in amount_phrase. If no amount was said, use null.
- customer_name: the name exactly as spoken (keep the original script).
- customer_name_roman: the same name in Latin script (transliterate). Null if no name.
- One command per utterance. If the user said two things, take the first and put the rest in note.
- amount_rupees: a number in rupees (not paise). Null if none spoken.
- note: what the goods/payment were for, in the user's own words, or null.
- payment_method: upi | cash | bank | cheque | null.
- new_customer: true only if the user is asking to CREATE a customer ("naya khaata", "add customer").
- intent choices:
  - add_credit: add goods/udhaar to the ledger ("400 ka samaan liya", "khaate me daalo").
  - record_payment: money received ("bheje", "payment aaya", "paisa diya").
  - add_customer: create a new customer/khaata.
  - outstanding: asking how much is due/baaki/hisaab ("kitna baaki hai", "kya total hai").
  - reminder: send a payment reminder ("yaad dila do", "reminder bhejo").
  - unknown: anything else (questions about weather, chit-chat, unclear audio).
- heard: your best transcript of the full utterance in its original script.
Return JSON only.`;

// Gemini responseSchema (structured output).
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: INTENTS },
    customer_name: { type: 'string', nullable: true },
    customer_name_roman: { type: 'string', nullable: true },
    amount_rupees: { type: 'number', nullable: true },
    amount_phrase: { type: 'string', nullable: true },
    note: { type: 'string', nullable: true },
    payment_method: { type: 'string', enum: ['upi', 'cash', 'bank', 'cheque'], nullable: true },
    new_customer: { type: 'boolean' },
    heard: { type: 'string' },
  },
  required: ['intent', 'heard'],
};

// Gemini output -> the shape the UI expects (same fields as parseCommand()).
export function normalizeGemini(g) {
  const g2 = g ?? {};
  let intent = INTENTS.includes(g2.intent) ? g2.intent : 'unknown';
  if (g2.new_customer === true) intent = 'add_customer';
  let amount = null;
  if (typeof g2.amount_rupees === 'number' && Number.isFinite(g2.amount_rupees) && g2.amount_rupees > 0) {
    amount = Math.round(g2.amount_rupees * 100) / 100;
  }
  return {
    intent,
    customerName: g2.customer_name?.trim() || null,
    customerNameRoman: g2.customer_name_roman?.trim() || null,
    amountRupees: amount,
    amountPhrase: g2.amount_phrase?.trim() || null,
    note: g2.note?.trim() || null,
    paymentMethod: g2.payment_method || null,
    heard: g2.heard?.trim() || '',
  };
}

// ---- Short-answer contexts (the confirm/disambiguate voice loop) ----

export const CONFIRM_PROMPT = `The app just read out a proposed action to an Indian shopkeeper and asked for confirmation. The shopkeeper replies in Hindi, Hinglish, Marathi, Gujarati or English.
Decide ONLY: did they agree, refuse, or say something else?
- yes: haan, ha, ji haan, haan ji, kar do, kar do na, kardo, kar dijiye, thik hai, theek hai, ok, okay, sahi hai, bilkul, chalo, avjo, hou, yes, yeah, correct, confirm
- no: nahi, nahin, na, nahi karna, nahi chahiye, mat karo, rehne do, ruk jao, band karo, cancel, galat, wrong, no, nope, stop
- other: anything else, including a changed amount or a different instruction.
Return JSON only: {"answer":"yes"|"no"|"other","heard":"..."}`;

export const CONFIRM_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', enum: ['yes', 'no', 'other'] },
    heard: { type: 'string' },
  },
  required: ['answer', 'heard'],
};

export function normalizeConfirm(g) {
  const a = g?.answer;
  return { answer: a === 'yes' || a === 'no' ? a : 'other', heard: g?.heard?.trim() || '' };
}

export const CHOOSE_PROMPT = `The app just listed numbered customer options (e.g. "1. Ramesh Gupta, Pimpri. 2. Suresh Gupta, Hadapsar") and asked which one the shopkeeper means. The reply may be in Hindi, Hinglish, Marathi, Gujarati or English.
Extract ONLY:
- choice_index: the 1-based number they picked ("pehla"/"first"/"ek" = 1, "doosra"/"second"/"do" = 2, "teesra" = 3, "chautha" = 4, digits too). PREFER this whenever the reply indicates order or position.
- customer_name: a DISTINCTIVE name they said (original script), or null. Only set this when the name alone tells the two options apart.
- wants_new: true only if they said this is a new customer / naya khaata / not in the list.
Return JSON only: {"choice_index":number|null,"customer_name":string|null,"wants_new":boolean,"heard":"..."}`;

export const CHOOSE_SCHEMA = {
  type: 'object',
  properties: {
    choice_index: { type: 'number', nullable: true },
    customer_name: { type: 'string', nullable: true },
    wants_new: { type: 'boolean' },
    heard: { type: 'string' },
  },
  required: ['heard'],
};

export function normalizeChoose(g) {
  let idx = g?.choice_index;
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 1) idx = null;
  return {
    choiceIndex: idx,
    customerName: g?.customer_name?.trim() || null,
    wantsNew: g?.wants_new === true,
    heard: g?.heard?.trim() || '',
  };
}
