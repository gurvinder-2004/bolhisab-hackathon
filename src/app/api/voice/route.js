// POST /api/voice
//   { audioBase64, mimeType }                 -> full command parse (Gemini)
//   { text }                                   -> rules first, then Gemini if rules fail
//   { audioBase64|text, context: 'confirm' }   -> { answer: yes|no|other, heard }
//   { audioBase64|text, context: 'choose' }    -> { choiceIndex, customerName, wantsNew, heard }
// The key never leaves the server.

import { NextResponse } from 'next/server';
import { parseCommand, parseShortAnswer, parseChoiceAnswer } from '../../../voice/rules.js';
import {
  SYSTEM_PROMPT, RESPONSE_SCHEMA, normalizeGemini,
  CONFIRM_PROMPT, CONFIRM_SCHEMA, normalizeConfirm,
  CHOOSE_PROMPT, CHOOSE_SCHEMA, normalizeChoose,
} from '../../../voice/prompts.js';

export const runtime = 'nodejs';

// gemini-2.5-flash is retired for new keys (Oct 2026); 3.8-flash is slow with default
// thinking. 3.5-flash is fast and handles audio + structured output. The free tier caps
// generateContent at ~20/day per model, so on quota errors we retry once on flash-lite
// (separate, larger quota). Override either via env.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';

async function generateWith(model, key, parts, { systemPrompt, schema }) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt ?? SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: schema ?? RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { status: res.status };
  const data = await res.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? null;
  return text ? { json: JSON.parse(text) } : {};
}

async function callGemini(parts, opts = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.log('[gemini] no key'); return null; }
  const first = await generateWith(MODEL, key, parts, opts);
  if (first.json) { console.log('[gemini]', MODEL); return first.json; }
  console.log('[gemini]', MODEL, 'failed:', first.status ?? 'no-content');
  if (first.status === 429 && FALLBACK_MODEL) {
    const second = await generateWith(FALLBACK_MODEL, key, parts, opts);
    if (second.json) { console.log('[gemini] fallback', FALLBACK_MODEL); return second.json; }
    console.log('[gemini] fallback failed:', second.status ?? 'no-content');
  }
  return null;
}

// The total of an itemized bill is always summed here from the per-item amounts —
// the model only extracts what was spoken, it never computes.
function sumItems(parsed) {
  if (Array.isArray(parsed.items) && parsed.items.length) {
    parsed.amountRupees = Math.round(parsed.items.reduce((s, it) => s + Math.round(Number(it.amountRupees || 0) * 100), 0)) / 100;
  }
  return parsed;
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const { audioBase64, mimeType, text, context } = body ?? {};
  const audioParts = audioBase64
    ? [{ text: 'Reply with JSON only.' }, { inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } }]
    : null;

  try {
    // ---- short-answer contexts ----
    if (context === 'confirm' || context === 'choose') {
      let raw = null;
      if (audioParts) {
        raw = await callGemini(audioParts, {
          systemPrompt: context === 'confirm' ? CONFIRM_PROMPT : CHOOSE_PROMPT,
          schema: context === 'confirm' ? CONFIRM_SCHEMA : CHOOSE_SCHEMA,
        });
      } else if (typeof text === 'string' && text.trim()) {
        if (context === 'confirm') raw = { answer: parseShortAnswer(text), heard: text.trim() };
        else {
          const { index, wantsNew } = parseChoiceAnswer(text); // rules are 0-based; API is 1-based like Gemini
          raw = { heard: text.trim(), choice_index: index == null ? null : index + 1, wants_new: wantsNew, customer_name: null };
        }
      } else {
        return NextResponse.json({ ok: false, error: 'no_input' }, { status: 400 });
      }
      if (!raw) return NextResponse.json({ ok: false, error: 'audio_not_understood' }, { status: 502 });
      const parsed = context === 'confirm' ? normalizeConfirm(raw) : normalizeChoose(raw);
      // safety net: Gemini sometimes transcribes the ordinal ("pehla") but returns
      // choice_index null — parse the transcript locally instead of failing.
      if (context === 'choose' && !parsed.choiceIndex && parsed.heard) {
        const local = parseChoiceAnswer(parsed.heard);
        if (local.index != null) parsed.choiceIndex = local.index + 1;
        if (local.wantsNew) parsed.wantsNew = true;
      }
      console.log('[voice]', context, JSON.stringify(parsed).slice(0, 220));
      return NextResponse.json({ ok: true, parsed, source: audioParts ? 'gemini' : 'rules' });
    }

    // ---- full command parse ----
    if (audioBase64) {
      const g = await callGemini([{ text: 'Parse this voice command.' }, audioParts[1]]);
      if (g) return NextResponse.json({ ok: true, parsed: sumItems(normalizeGemini(g)), source: 'gemini' });
      return NextResponse.json({ ok: false, error: 'audio_not_understood' }, { status: 502 });
    }

    if (typeof text === 'string' && text.trim()) {
      const viaRules = parseCommand(text);
      if (viaRules) return NextResponse.json({ ok: true, parsed: sumItems(viaRules), source: 'rules' });
      const g = await callGemini([{ text }]);
      if (g) return NextResponse.json({ ok: true, parsed: normalizeGemini(g), source: 'gemini' });
      return NextResponse.json({ ok: true, parsed: { intent: 'unknown', heard: text.trim() }, source: 'rules' });
    }

    return NextResponse.json({ ok: false, error: 'no_input' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
