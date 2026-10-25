'use client';

// BolHisab voice console. Mic -> /api/voice -> resolve customer -> "kaunse Gupta ji?" ->
// confirm card (big amount + words, read aloud) -> auto-reopened mic listens for
// "haan"/"nahi" (or "pehla"/"doosra") -> executes -> spoken confirmation + undo window.
// Tap or type always works as the manual fallback.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { mapCustomerRow } from '../../lib/ledger.js';
import { resolveCustomer, describeCandidates } from '../../domain/match.js';
import { formatINR, formatDateIN, toPaise, amountInWords, todayIST } from '../../engine/index.js';
import {
  insertCreditEntry, recordPayment, insertCustomer, undoWrite, logEvent, outstandingForCustomer,
  createVoiceBill,
} from '../../lib/actions.js';
import { Avatar, Icon, LangMenu } from '../../components/ui.js';
import AuthGate from '../../components/AuthGate.js';

const STATUS = {
  idle: 'Boliye — "Gupta ji 400 ka samaan liya"',
  rec: 'Sun raha hoon… (tap karke rokiye)',
  think: 'Samajh raha hoon…',
  listen: (what) => `Sun raha hoon… boliye: ${what}`,
};

function VoiceConsole() {
  const [customers, setCustomers] = useState([]);
  const [phase, setPhase] = useState('idle'); // idle | rec | think | listen
  const [heard, setHeard] = useState('');
  const [card, setCardState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastWrite, setLastWrite] = useState(null);
  const [recents, setRecents] = useState([]);
  const [typed, setTyped] = useState('');
  const recorder = useRef(null);
  const chunks = useRef([]);
  const streamRef = useRef(null);      // persistent mic stream (echo-cancelled)
  const audioCtxRef = useRef(null);    // shared AudioContext for VAD
  const stopRecordingRef = useRef(null); // active recording's stop fn (VAD cleanup)

  // voice-confirm loop state (refs: survive async answer handling)
  const cardRef = useRef(null);
  const listenCtx = useRef(null);      // 'confirm' | 'choose' | null
  const listenTrials = useRef(0);
  const handleParsedRef = useRef(() => {});
  const setCard = useCallback((c) => { cardRef.current = c; setCardState(c); }, []);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers((data ?? []).map(mapCustomerRow));
  }, []);

  const loadRecents = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('credit_entries').select('*, customers(name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('payments').select('*, customers(name)').order('created_at', { ascending: false }).limit(5),
    ]);
    const rows = [
      ...(c.data ?? []).map((r) => ({ id: r.id, kind: 'credit', name: r.customers?.name ?? '—', paise: r.amount_paise, when: r.created_at, note: r.note })),
      ...(p.data ?? []).map((r) => ({ id: r.id, kind: 'payment', name: r.customers?.name ?? '—', paise: r.amount_paise, when: r.created_at, mode: r.mode })),
    ].sort((a, b) => (a.when < b.when ? 1 : -1));
    setRecents(rows.slice(0, 6));
  }, []);

  useEffect(() => { loadCustomers(); loadRecents(); }, [loadCustomers, loadRecents]);

  // ---------- TTS ----------
  // Robust on all engines: fires onEnd on the real end event; if the engine never fires
  // events, a poll notices speaking===false; a 30s cap guarantees we never hang.
  // We NEVER cancel a speaking question mid-sentence.
  const speak = useCallback((text, onEnd) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return onEnd?.(false);
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const v = voices.find((x) => x.lang?.startsWith('hi')) || voices.find((x) => x.lang?.startsWith('en-IN')) || voices.find((x) => x.lang?.startsWith('en'));
    if (v) u.voice = v;
    u.lang = v?.lang || 'hi-IN';
    u.rate = 0.95;
    let done = false, poll = null;
    const finish = (spoke) => { if (!done) { done = true; if (poll) clearInterval(poll); onEnd?.(spoke); } };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    synth.speak(u);
    setTimeout(() => { // engines that never fire events: watch the speaking flag
      if (done) return;
      poll = setInterval(() => { if (!synth.speaking && !synth.pending) finish(true); }, 300);
    }, 1000);
    setTimeout(() => finish(true), 30000);
  }, []);

  // ---------- voice-confirm loop ----------
  const cancelListen = useCallback(() => {
    listenCtx.current = null;
    listenTrials.current = 0;
    stopRecordingRef.current?.();
  }, []);

  const base64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  // One persistent mic stream for the whole session (echo-cancelled). Repeated
  // getUserMedia open/close cycles on Android yield silent tracks — that was the
  // "mic opens but hears nothing" bug.
  const getStream = async () => {
    if (streamRef.current?.active) return streamRef.current;
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = s;
    return s;
  };
  const getAudioCtx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AC();
    return audioCtxRef.current;
  };
  // short cue so the shopkeeper knows the mic is live and it's their turn to speak
  const beep = useCallback(() => {
    try {
      const actx = getAudioCtx();
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + 0.12);
    } catch {}
  }, []);

  // mode 'command' (user tapped the mic) | 'answer' (auto-opened after a spoken question).
  // Recording ends 1.2s after speech goes quiet (VAD) — never mid-sentence — with hard caps.
  const startRec = useCallback(async (mode) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      if (mode === 'answer') return false; // manual fallback stays available
      setCard({ type: 'error', message: 'Is browser mein mic nahi chalta. Neeche type karke command bhejein.' });
      return false;
    }
    try {
      const stream = await getStream();
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      let didSpeak = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stopRecordingRef.current = null;
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        if (!didSpeak || blob.size < 1000) {
          setPhase('idle');
          if (mode === 'command') { setCard({ type: 'error', message: 'Awaaz nahi pahunchi. Mic ke paas boliye aur dobara try karein.' }); return; }
          // answer too short/quiet: count it as a failed try and re-open the mic silently
          if (listenCtx.current && ++listenTrials.current < (listenCtx.current === 'choose' ? 3 : 2)) { listenFor(listenCtx.current); return; }
          listenCtx.current = null;
          speak('Awaaz nahi pahunchi. Screen par tap kariye.');
          return;
        }
        if (mode === 'answer') { setPhase('think'); await sendAnswer(blob, rec.mimeType); setPhase('idle'); return; }
        setPhase('think');
        try {
          const res = await fetch('/api/voice', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ audioBase64: base64(await blob.arrayBuffer()), mimeType: rec.mimeType }),
          });
          const j = await res.json();
          if (!j.ok) throw new Error(j.error);
          handleParsedRef.current(j.parsed);
        } catch {
          setCard({ type: 'error', message: 'Network/model se connect nahi ho paya. Dobara try karein ya type karein.' });
        } finally { setPhase('idle'); }
      };
      recorder.current = rec;
      rec.start(250); // timeslice keeps audio flushing; avoids lost-tail bugs
      setPhase(mode === 'answer' ? 'listen' : 'rec');
      if (mode === 'answer') beep(); // "your turn" cue: the question has ended, speak now
      if (mode === 'command') {
        setCard(null); setHeard(''); setLastWrite(null);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel(); // user wants to talk NOW
      }

      // voice-activity stop: end 1.2s after speech goes quiet; hard cap otherwise
      const capMs = mode === 'answer' ? 10000 : 15000;
      let vadTimer = null, safety = null, srcNode = null;
      let heardSpeech = false, lastLoud = 0;
      const finish = () => {
        if (vadTimer) clearInterval(vadTimer);
        if (safety) clearTimeout(safety);
        try { srcNode?.disconnect(); } catch {}
        try { if (rec.state === 'recording') rec.stop(); } catch {}
      };
      stopRecordingRef.current = finish;
      try {
        const actx = getAudioCtx();
        if (actx.state === 'suspended') actx.resume().catch(() => {});
        srcNode = actx.createMediaStreamSource(stream);
        const an = actx.createAnalyser();
        an.fftSize = 512;
        srcNode.connect(an);
        const buf = new Float32Array(an.fftSize);
        const t0 = Date.now();
        vadTimer = setInterval(() => {
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const now = Date.now();
          if (rms > 0.015) { heardSpeech = true; didSpeak = true; lastLoud = now; }
          // never stop before 800ms: one-word answers ("pehla") need their pre-roll kept
          if (now - t0 > capMs || (now - t0 > 800 && heardSpeech && now - lastLoud > 1200)) finish();
        }, 100);
      } catch { /* VAD unavailable: plain cap below still ends the recording */ }
      safety = setTimeout(finish, capMs + 1000);
      return true;
    } catch (e) {
      if (mode === 'command') setCard({ type: 'error', message: e?.name === 'NotAllowedError' ? 'Mic ki permission chahiye. Browser settings mein allow karein.' : 'Mic khul nahi paya. Type karke bhejein.' });
      return false;
    }
  }, [setCard, beep]);

  // Schedule the answer mic WITHOUT resetting the retry count (retries call this).
  // The mic only opens once the spoken question has actually finished — the old code
  // could open it while TTS was still talking and record the app's own voice.
  const listenFor = useCallback((ctx) => {
    listenCtx.current = ctx;
    setPhase('listen');
    const open = () => setTimeout(() => { if (listenCtx.current === ctx) startRec('answer'); }, 500);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) {
        const t0 = Date.now();
        const wait = setInterval(() => {
          if (listenCtx.current !== ctx) { clearInterval(wait); return; }
          if ((!synth.speaking && !synth.pending) || Date.now() - t0 > 25000) { clearInterval(wait); open(); }
        }, 250);
        return;
      }
    }
    open();
  }, [startRec]);

  // Begin a fresh question cycle: resets retries, then listens.
  const beginListen = useCallback((ctx) => {
    listenTrials.current = 0;
    listenFor(ctx);
  }, [listenFor]);

  const sendAnswer = async (blob, mimeType) => {
    const ctx = listenCtx.current;
    const c = cardRef.current;
    if (!ctx || !c) return;
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64(await blob.arrayBuffer()), mimeType, context: ctx }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      // through the ref: the recording closure is stale (first render, customers=[])
      // and would drop correct answers — this bit us for days as "samajh nahi aaya"
      handleAnswerRef.current(j.parsed, c, ctx);
    } catch {
      // network hiccup: one more try, then leave it to manual
      if (++listenTrials.current < 2) listenFor(ctx); else listenCtx.current = null;
    }
  };

  const handleAnswer = (ans, c, ctx) => {
    if (ctx === 'confirm') {
      if (ans.answer === 'yes') {
        listenCtx.current = null;
        // single fuzzy match: "Sahi hai?" -> yes means "that's the one, continue"
        if (c.type === 'disambiguate') {
          const cust = customers.find((x) => x.id === c.candidates[0].id);
          if (cust) {
            if (c.parsed?.intent === 'outstanding') answerOutstandingRef.current(cust, c.parsed);
            else confirmForRef.current(cust, c.parsed);
          }
          return;
        }
        submitCardRef.current();
        return;
      }
      if (ans.answer === 'no') {
        listenCtx.current = null;
        setCard(null);
        speak('Theek hai, cancel kar diya.');
        return;
      }
      if (++listenTrials.current < 2) {
        speak('Samajh nahi aaya. Haan ya nahi boliye — ya screen par button dabaiye.', () => listenFor('confirm'));
      } else { listenCtx.current = null; speak('Screen par button dabaiye.'); }
      return;
    }
    if (ctx === 'choose') {
      const candCustomers = c.candidates
        .map((x) => customers.find((cu) => cu.id === x.id))
        .filter(Boolean);
      const again = () => {
        const heardBit = ans.heard ? ` Maine suna: ${ans.heard}.` : '';
        const short = candCustomers.length === 2 ? 'Pehla ya doosra boliye.' : 'Number boliye.';
        if (++listenTrials.current < 3) speak(`Samajh nahi aaya.${heardBit} ${short}`, () => listenFor('choose'));
        else { listenCtx.current = null; speak('Screen par naam tap kariye.'); }
      };
      if (ans.wantsNew) {
        listenCtx.current = null;
        openNewCustomerCardRef.current(c.parsed, 'confirm');
        return;
      }
      let chosen = null;
      if (Number.isInteger(ans.choiceIndex) && ans.choiceIndex >= 1 && ans.choiceIndex <= candCustomers.length) chosen = candCustomers[ans.choiceIndex - 1];
      else if (ans.customerName) {
        const r = resolveCustomer(ans.customerName, candCustomers);
        if (r.status === 'unique') chosen = r.candidates[0].customer;
        else if (r.status === 'ambiguous' && r.candidates.length === candCustomers.length) {
          // said a name that matches ALL options (e.g. "gupta wala" for two Guptas): ask for position
          again();
          return;
        }
      }
      if (chosen) {
        listenCtx.current = null;
        if (c.parsed?.intent === 'outstanding') answerOutstandingRef.current(chosen, c.parsed);
        else confirmForRef.current(chosen, c.parsed);
        return;
      }
      again();
    }
  };

  // keep latest callbacks reachable from the async answer path
  const submitCardRef = useRef(() => {});
  const answerOutstandingRef = useRef(() => {});
  const confirmForRef = useRef(() => {});
  const openNewCustomerCardRef = useRef(() => {});
  const handleAnswerRef = useRef(() => {});

  const stopRec = useCallback(() => {
    // mid-recording tap: stop cleanly, the audio gathered so far is still processed
    if (stopRecordingRef.current) { stopRecordingRef.current(); return; }
    cancelListen(); // tapped while waiting to listen: skip voice answering
  }, [cancelListen]);

  // release the persistent mic when the page goes away
  useEffect(() => () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
  }, []);

  // ---------- pipeline after parse ----------
  const answerOutstanding = useCallback(async (customer, parsed) => {
    if (customer) {
      const b = await outstandingForCustomer(customer.id);
      const rupees = formatINR(Math.max(0, b.balancePaise));
      const spoken = `${customer.name} ka ${rupees} baaki hai`;
      setCard({
        type: 'answer',
        title: `${customer.name}${customer.area ? ' · ' + customer.area : ''}`,
        big: rupees,
        words: amountInWords(Math.max(0, b.balancePaise)),
        lines: [
          `Bills par: ${formatINR(Math.max(0, b.invoiceOutstandingPaise))} (${b.openInvoices.length} khuli)`,
          `Khata (udhaar): ${formatINR(b.creditsPaise)}`,
          b.onAccountPaise > 0 ? `Advance jama: -${formatINR(b.onAccountPaise)}` : null,
        ].filter(Boolean),
      });
      speak(spoken);
    } else {
      const [inv, alloc, pay, cred] = await Promise.all([
        supabase.from('invoices').select('id,total_paise,due_date,status_override'),
        supabase.from('payment_allocations').select('invoice_id,amount_paise'),
        supabase.from('payments').select('amount_paise'),
        supabase.from('credit_entries').select('amount_paise'),
      ]);
      const paid = new Map();
      for (const a of alloc.data ?? []) paid.set(a.invoice_id, (paid.get(a.invoice_id) ?? 0) + a.amount_paise);
      const { invoiceState } = await import('../../domain/status.js');
      let out = 0;
      for (const i of inv.data ?? []) {
        const st = invoiceState({ statusOverride: i.status_override, totalPaise: i.total_paise, dueDate: i.due_date }, paid.get(i.id) ?? 0, todayIST());
        out += st.outstanding;
      }
      const credits = (cred.data ?? []).reduce((s, c) => s + c.amount_paise, 0);
      const onAcct = Math.max(0, (pay.data ?? []).reduce((s, p) => s + p.amount_paise, 0) - (alloc.data ?? []).reduce((s, a) => s + a.amount_paise, 0));
      const total = out + credits - onAcct;
      setCard({
        type: 'answer', title: 'Poora baaki (sab customers)',
        big: formatINR(total), words: amountInWords(total),
        lines: [`Bills: ${formatINR(out)}`, `Khata: ${formatINR(credits)}`, onAcct > 0 ? `Advance: -${formatINR(onAcct)}` : null].filter(Boolean),
      });
      speak(`Kul milakar ${formatINR(total).replace('₹', '')} rupaye baaki hai`);
    }
  }, [speak, setCard]);

  const confirmFor = useCallback((customer, parsed) => {
    const paise = parsed.amountRupees != null ? toPaise(String(parsed.amountRupees)) : null;
    if (parsed.intent === 'delete_customer') {
      setCard({ type: 'confirm-delete', customer, parsed });
      speak(`${customer.name} ka poora khaata delete karun? Haan ya nahi?`, () => beginListen('confirm'));
      // enrich the card with what will be lost (async, arrives onto the open card)
      outstandingForCustomer(customer.id).then((b) => {
        if (cardRef.current?.type === 'confirm-delete' && cardRef.current.customer.id === customer.id) {
          setCard({ ...cardRef.current, balancePaise: b.balancePaise, openCount: b.openInvoices.length });
        }
      }).catch(() => {});
      return;
    }
    if (parsed.intent === 'add_credit' && Array.isArray(parsed.items) && parsed.items.length) {
      // itemized bill: the customer later verifies each line on the pay link
      setCard({ type: 'confirm-bill', customer, parsed, items: parsed.items, paise, dateLabel: formatDateIN(todayIST()) });
      const list = parsed.items.map((it) => `${it.label} ${Math.round(it.amountRupees)}`).join(', ');
      speak(`${list}. Kul ${formatINR(paise)} ka bill banega. Bill khaate mein entry karun? Haan ya nahi?`, () => beginListen('confirm'));
    } else if (parsed.intent === 'add_credit') {
      setCard({ type: 'confirm-credit', customer, parsed, paise, dateLabel: formatDateIN(todayIST()) });
      speak(`${customer.name} ke khaate mein ${formatINR(paise)} add karun? Haan ya nahi?`, () => beginListen('confirm'));
    } else if (parsed.intent === 'record_payment') {
      setCard({ type: 'confirm-payment', customer, parsed, paise, dateLabel: formatDateIN(todayIST()) });
      speak(`${customer.name} ne ${formatINR(paise)} bheje. Jama karun? Haan ya nahi?`, () => beginListen('confirm'));
    } else if (parsed.intent === 'reminder') {
      const msg = `Namaste ${customer.name} ji, aapka payment (${formatINR(paise || 0)}) baaki hai. Kripya jaldi karein. — Sharma Packaging`;
      window.open(`https://wa.me/91${(customer.phone || '').replace(/\D/g, '').replace(/^91/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      logEvent({ kind: 'reminder_sent', customerId: customer.id, payload: { via: 'whatsapp', from: 'voice' } });
      setCard({
        type: 'answer', title: 'WhatsApp khul gaya', big: customer.name, words: null,
        lines: ['Message bhar chuka hai — aapko bas Send dabana hai.', 'Reminder note ledger mein log ho gaya.'],
      });
      speak(`${customer.name} ka reminder WhatsApp par khul gaya, aap send dabaiye`);
    }
  }, [speak, beginListen, setCard]);

  // Read the options SHORT: long reads invite the user to answer mid-question,
  // before the mic is open — which was the "never listens" loop.
  const speakOptions = useCallback((c, then) => {
    const n = c.candidates.length;
    const list = c.candidates.slice(0, 3).map((x, i) => `${i + 1}. ${x.label.replace(' · ', ', ')}`).join('. ');
    const more = n > 3 ? ` Aur ${n - 3} aur hain.` : '';
    const tail = n === 2 ? 'Boliye pehla ya doosra.'
      : n === 3 ? 'Boliye pehla, doosra ya teesra.'
      : 'Number boliye.';
    speak(`Kaunse? ${list}.${more} ${tail}`, then);
  }, [speak]);

  // New-customer card, asked by voice: "X naam se koi khaata nahi. Naya banau?"
  const openNewCustomerCard = useCallback((parsed, then) => {
    const name = parsed?.customerNameRoman || parsed?.customerName || '';
    setCard({ type: 'new-customer', parsed, name, phone: '', then: then ?? null });
    if (name) speak(`${name} naam se koi khaata nahi mila. Naya khaata banau? Haan ya nahi?`, () => beginListen('confirm'));
    // no name heard: stay manual (a spoken bare name isn't a yes/no answer)
  }, [speak, beginListen, setCard]);

  const resolveAndGo = useCallback((parsed) => {
    const name = parsed.customerName || parsed.customerNameRoman || '';
    if (parsed.intent === 'add_customer' || (!name && parsed.intent !== 'outstanding')) {
      if (parsed.intent === 'add_customer') {
        openNewCustomerCard(parsed, null);
        return;
      }
      setCard({ type: 'error', message: 'Kis customer ke liye? Naam boliye — jaise "Gupta ji 400 ka samaan liya".' });
      return;
    }
    if (!name && parsed.intent === 'outstanding') { answerOutstanding(null, parsed); return; }
    const r = resolveCustomer(name, customers);
    if (r.status === 'unique') {
      if (parsed.intent === 'outstanding') answerOutstanding(r.candidates[0].customer, parsed);
      else confirmFor(r.candidates[0].customer, parsed);
    } else if (r.status === 'ambiguous' && r.candidates.length === 1) {
      // fuzzy single hit: confirm the match instead of "pehla ya doosra"
      const cust = r.candidates[0].customer;
      setCard({
        type: 'disambiguate', parsed, heardName: name, single: true,
        candidates: describeCandidates([cust]),
      });
      speak(`Sirf ek naam mila: ${cust.name}${cust.area ? ', ' + cust.area : ''}. Yahi sahi hai? Haan ya nahi?`, () => beginListen('confirm'));
    } else if (r.status === 'ambiguous') {
      setCard({
        type: 'disambiguate', parsed, heardName: name,
        candidates: describeCandidates(r.candidates.map((x) => x.customer)),
      });
      const c = cardRef.current;
      speakOptions(c, () => beginListen('choose'));
    } else {
      if (parsed.intent === 'outstanding') {
        setCard({ type: 'error', message: `"${name}" naam se koi customer nahi mila. Spelling try karein ya naam pura boliye.` });
      } else {
        openNewCustomerCard(parsed, 'confirm');
      }
    }
  }, [customers, answerOutstanding, confirmFor, speakOptions, beginListen, openNewCustomerCard, setCard]);

  const handleParsed = useCallback((parsed) => {
    setHeard(parsed?.heard || '');
    if (!parsed || parsed.intent === 'unknown') {
      setCard({ type: 'error', message: 'Samajh nahi aaya. Thoda saaf boliye — ya neeche type karein.' });
      return;
    }
    if ((parsed.intent === 'add_credit' || parsed.intent === 'record_payment') && parsed.amountRupees == null) {
      setCard({ type: 'error', message: 'Kitne ka? Amount boliye — jaise "chaar sau ka samaan".' });
      return;
    }
    resolveAndGo(parsed);
  }, [resolveAndGo, setCard]);

  const sendTyped = useCallback(async (e) => {
    e?.preventDefault();
    const text = typed.trim();
    if (!text) return;
    // if a confirm/choose card is open, typed text answers IT ("haan", "doosra")
    const openCard = cardRef.current;
    const ctx = openCard && (openCard.type?.startsWith('confirm') || openCard.type === 'new-customer' || openCard.type === 'disambiguate' && openCard.single) ? 'confirm'
      : openCard?.type === 'disambiguate' ? 'choose' : null;
    cancelListen();
    setTyped(''); setPhase('think'); setLastWrite(null);
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ctx ? { text, context: ctx } : { text }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      if (ctx) { setPhase('idle'); handleAnswer(j.parsed, openCard, ctx); return; }
      handleParsed(j.parsed);
    } catch {
      setCard({ type: 'error', message: 'Request fail ho gayi. Dobara try karein.' });
    } finally { setPhase('idle'); }
  }, [typed, handleParsed, cancelListen, setCard]);

  // ---------- confirm / write ----------
  const afterWrite = useCallback((kind, row, label, spoken) => {
    setCard(null);
    setLastWrite({ kind, id: row.id, label, until: Date.now() + 10000 });
    speak(spoken);
    loadCustomers(); loadRecents();
  }, [speak, loadCustomers, loadRecents, setCard]);

  const submitCard = useCallback(async () => {
    const card = cardRef.current;
    if (!card || busy) return;
    cancelListen();
    setBusy(true);
    try {
      if (card.type === 'confirm-credit') {
        const row = await insertCreditEntry({ customerId: card.customer.id, amountRupees: card.parsed.amountRupees, note: card.parsed.note });
        afterWrite('credit', row, `${card.customer.name} · khaata ${formatINR(card.paise)}`,
          `${card.customer.name} ke khaate mein ${formatINR(card.paise)} add ho gaya`);
      } else if (card.type === 'confirm-bill') {
        const row = await createVoiceBill({ customerId: card.customer.id, items: card.items });
        afterWrite('invoice', row, `${card.customer.name} · bill ${row.number} · ${formatINR(card.paise)}`,
          `${formatINR(card.paise)} ka bill ban gaya, ${card.customer.name} ke khaate mein`);
      } else if (card.type === 'confirm-delete') {
        const { error } = await supabase.from('customers').delete().eq('id', card.customer.id);
        if (error) throw new Error(error.message);
        await loadCustomers();
        setCard(null);
        setLastWrite(null); // cascades bills+allocations: no undo for deletes
        speak(`${card.customer.name} ka khaata delete ho gaya`);
      } else if (card.type === 'confirm-payment') {
        const { payment, allocatedTo } = await recordPayment({ customerId: card.customer.id, amountRupees: card.parsed.amountRupees, method: card.parsed.paymentMethod });
        const allocLine = allocatedTo.length ? `${allocatedTo.length} bill${allocatedTo.length > 1 ? 's' : ''} adjust hue` : 'on account jama hua';
        afterWrite('payment', payment, `${card.customer.name} · payment ${formatINR(card.paise)} (${allocLine})`,
          `${formatINR(card.paise)} jama ho gaya, ${allocLine}`);
      } else if (card.type === 'new-customer') {
        const row = await insertCustomer({ name: card.name, phone: card.phone, area: card.area, city: card.city });
        await loadCustomers();
        speak(`${card.name} ka naya khaata ban gaya`);
        if (card.then === 'confirm' && card.parsed?.intent) {
          confirmFor(mapCustomerRow(row), card.parsed);
        } else {
          afterWrite('none', row, `${card.name} · naya customer`, `${card.name} ka naya khaata ban gaya`);
        }
      }
    } catch (e) {
      setCard({ type: 'error', message: `Save nahi hua: ${e.message}` });
    } finally { setBusy(false); }
  }, [busy, afterWrite, loadCustomers, speak, confirmFor, cancelListen, setCard]);

  // wire refs AFTER all definitions (async answer handlers reach through these)
  useEffect(() => {
    handleParsedRef.current = handleParsed;
    answerOutstandingRef.current = answerOutstanding;
    confirmForRef.current = confirmFor;
    submitCardRef.current = submitCard;
    openNewCustomerCardRef.current = openNewCustomerCard;
    handleAnswerRef.current = handleAnswer;
  });

  const doUndo = useCallback(async () => {
    if (!lastWrite || lastWrite.kind === 'none') { setLastWrite(null); return; }
    try { await undoWrite({ kind: lastWrite.kind, id: lastWrite.id }); } catch {}
    setLastWrite(null);
    loadRecents();
    speak('Ho gaya, hata diya');
  }, [lastWrite, loadRecents, speak]);

  useEffect(() => {
    if (!lastWrite) return;
    const t = setTimeout(() => setLastWrite(null), 10000);
    return () => clearTimeout(t);
  }, [lastWrite]);

  const pick = (c) => {
    cancelListen();
    const cust = customers.find((x) => x.id === c.id);
    if (cardRef.current?.parsed?.intent === 'outstanding') answerOutstanding(cust, cardRef.current.parsed);
    else confirmFor(cust, cardRef.current.parsed);
  };

  const closeCard = () => { cancelListen(); setCard(null); };

  // ---------- render ----------
  const listening = phase === 'listen';
  const isChoose = cardRef.current?.type === 'disambiguate' && !cardRef.current.single;
  const chooseHint = cardRef.current && isChoose
    ? (cardRef.current.candidates.length === 2 ? '"pehla" ya "doosra"' : 'number boliye')
    : '"haan" ya "nahi"';
  const singleMatch = cardRef.current?.type === 'disambiguate' && cardRef.current.single;
  const statusText = listening ? STATUS.listen(singleMatch ? '"haan" ya "nahi"' : chooseHint) : STATUS[phase];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-36 pt-5 md:max-w-2xl md:pb-12 md:pt-8">
      {/* header */}
      <header className="mb-4 flex items-center gap-3 md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-192.png" alt="BolHisab" width={46} height={46} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-[#1A181C]">Bol<span className="text-[#D99C00]">Hisab</span></h1>
            <span className="text-sm font-semibold text-[#6D3FD8]">हिसाब अब बोलकर</span>
          </div>
        </div>
        <span className="md:hidden"><LangMenu /></span>
      </header>

      {/* mic hero — purple voice card */}
      <section className="voice-hero relative overflow-hidden rounded-[2rem] p-6 pb-8 text-center text-white md:p-9">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
          <Icon name="sparkle" className="h-3.5 w-3.5" /> AI Voice Entry
        </span>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight md:text-2xl">Bas bolo, hisab ho jayega.</h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] font-medium text-white/70">{statusText}</p>

        <button
          onClick={phase === 'rec' || listening ? stopRec : phase === 'idle' ? () => startRec('command') : undefined}
          disabled={phase === 'think'}
          className={`mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full transition md:h-36 md:w-36
            ${(phase === 'rec' || listening)
              ? 'mic-recording bg-white text-[#1A181C] active:scale-95'
              : 'bg-[#F5C818] text-[#1A181C] shadow-[0_20px_44px_-12px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95'}
            ${phase === 'think' ? 'opacity-50' : ''}`}
          aria-label={phase === 'rec' || listening ? 'Recording stop karein' : 'Bolna shuru karein'}
        >
          {phase === 'think' ? <span className="text-3xl">⋯</span>
            : (phase === 'rec' || listening) ? <Icon name="mic" className="h-12 w-12" />
            : <Icon name="mic" className="h-12 w-12" />}
        </button>

        {heard && <p className="mx-auto mt-4 inline-block rounded-full bg-white/12 px-4 py-1.5 text-sm italic text-white/85">“{heard}”</p>}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {['Hinglish', 'हिंदी', 'English'].map((l) => (
            <span key={l} className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white/85">{l}</span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {['Gupta ji 400 ka samaan liya', 'Patil ne 5,000 bheje', 'kitna baaki hai Gupta ji ka'].map((s) => (
            <button key={s} onClick={() => setTyped(s)}
              className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/75 active:bg-white/20">{s}</button>
          ))}
        </div>
      </section>

      {/* typed fallback */}
      <form onSubmit={sendTyped} className="mt-3 flex gap-2">
        <input
          value={typed} onChange={(e) => setTyped(e.target.value)}
          placeholder={cardRef.current && (cardRef.current.type?.startsWith('confirm') || cardRef.current.type === 'disambiguate' || cardRef.current.type === 'new-customer') ? 'Ya type karein: "haan" / "doosra"' : 'Type karein: "Mehta ji ka kitna baaki?"'}
          className="flex-1 rounded-2xl bg-white px-4 py-3.5 text-sm shadow-[0_6px_20px_-12px_rgba(26,24,28,0.3)] ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]"
        />
        <button type="submit" disabled={phase === 'think'}
          className="rounded-2xl bg-[#1A181C] px-5 py-3.5 text-sm font-bold text-white ring-1 ring-[#1A181C] transition active:scale-95 disabled:opacity-50">
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </form>

      {/* recents */}
      <section className="mt-5 rounded-[1.75rem] bg-white p-5 ring-1 ring-[#E5E3DC]">
        <h2 className="mb-1 text-base font-extrabold tracking-tight">Recent entries</h2>
        <ul>
          {recents.map((r) => (
            <li key={r.kind + r.id} className="flex items-center gap-3 border-b border-[#F2F0EA] py-3 last:border-0">
              <Avatar name={r.name} className="h-10 w-10 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{r.name}</span>
                <span className="block text-[11px] text-[#9C9A92]">{r.kind === 'payment' ? `Payment aaya${r.mode ? ' · ' + r.mode : ''}` : 'Udhaar diya'}</span>
              </span>
              <span className={`shrink-0 text-sm font-extrabold ${r.kind === 'payment' ? 'text-[#1B7A3D]' : 'text-[#C4392C]'}`}>
                {r.kind === 'payment' ? '+' : ''}{formatINR(r.paise)}
              </span>
            </li>
          ))}
          {!recents.length && <li className="py-5 text-center text-sm text-[#9C9A92]">Abhi kuch nahi. Mic dabaiye.</li>}
        </ul>
      </section>

      {/* undo toast */}
      {lastWrite && (
        <div className="fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-full bg-[#1A181C] py-2.5 pl-5 pr-2 text-sm text-white shadow-[0_18px_40px_-10px_rgba(26,24,28,0.6)] md:bottom-6">
          <span className="min-w-0 flex-1 truncate">✔ {lastWrite.label}</span>
          {lastWrite.kind !== 'none' && <button onClick={doUndo} className="rounded-full bg-[#F5C818] px-4 py-2 text-xs font-extrabold text-[#1A181C] active:scale-95">↩ Undo</button>}
        </div>
      )}

      {/* card overlay */}
      {card && (
        <div className="fixed inset-0 z-40 flex items-end bg-[#1A181C]/55 p-4 backdrop-blur-[2px] md:items-center" onClick={card.type === 'answer' || card.type === 'error' ? closeCard : null}>
          <div className="w-full rounded-[2rem] bg-white p-6 shadow-2xl md:mx-auto md:max-w-md" onClick={(e) => e.stopPropagation()}>

            {/* inline typed-answer row (voice alternative inside the card) */}
            {card.type !== 'answer' && card.type !== 'error' && (
              <form onSubmit={sendTyped} className="mb-4 flex gap-2">
                <input
                  value={typed} onChange={(e) => setTyped(e.target.value)}
                  placeholder={card.type === 'disambiguate' && !card.single ? 'Type karein: "pehla" / "doosra"' : 'Type karein: "haan" / "nahi"'}
                  className="min-w-0 flex-1 rounded-full bg-[#F2F0EA] px-4 py-2.5 text-sm outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]"
                />
                <button type="submit" className="rounded-full bg-[#1A181C] px-4 py-2.5 text-xs font-bold text-white active:scale-95">Bhejo</button>
              </form>
            )}

            {card.type === 'confirm-delete' && (
              <>
                <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-[#C4392C]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FDE7E4] text-[#C4392C]">
                    <Icon name="trash" className="h-4 w-4" />
                  </span>
                  Khaata delete karun?
                </h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#9C9A92]">
                  <Avatar name={card.customer.name} className="h-7 w-7 text-[10px]" />
                  {card.customer.name}{card.customer.area ? ` · ${card.customer.area}` : ''}{card.customer.phone ? ` · ${card.customer.phone}` : ''}
                </p>
                <div className="mt-3 rounded-2xl bg-[#FDE7E4]/60 p-3 text-xs font-semibold text-[#C4392C] ring-1 ring-[#F8CFC9]">
                  Poora khaata — {card.openCount ?? '…'} bills samet — hamesha ke liye delete hoga.
                  {card.balancePaise > 0 && ` Baaki: ${formatINR(card.balancePaise)}.`}
                  <br />Ye wapas nahi aayega.
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[#6D3FD8]">
                  <Icon name="mic" className="h-3.5 w-3.5" />
                  {listening ? 'Sun raha hoon… boliye “haan” ya “nahi”' : 'Ya boliye: “haan” / “nahi”'}
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={closeCard} className="flex-1 rounded-2xl bg-[#F2F0EA] py-3.5 text-sm font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] active:scale-[0.98]">Nahi, rehne do</button>
                  <button onClick={submitCard} disabled={busy} className="flex-1 rounded-2xl bg-[#F05A4F] py-3.5 text-sm font-extrabold text-white active:scale-[0.98] disabled:opacity-50">
                    {busy ? 'Delete ho raha…' : 'Haan, delete karo'}
                  </button>
                </div>
              </>
            )}

            {card.type === 'confirm-bill' && (
              <>
                <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#DDD0FA] text-[#4A2FA6]">
                    <Icon name="book" className="h-4 w-4" />
                  </span>
                  Bill banau — khaate mein?
                </h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#9C9A92]">
                  <Avatar name={card.customer.name} className="h-7 w-7 text-[10px]" />
                  {card.customer.name}{card.customer.area ? ` · ${card.customer.area}` : ''} · {card.dateLabel}
                </p>
                <ul className="mt-3 rounded-2xl bg-[#F8F7F2] p-2 ring-1 ring-[#E5E3DC]">
                  {card.items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between border-b border-[#ECEAE2] px-2.5 py-2 text-sm last:border-0">
                      <span className="font-semibold">{it.label}</span>
                      <span className="font-bold">{formatINR(toPaise(String(it.amountRupees)))}</span>
                    </li>
                  ))}
                </ul>
                <p className="my-4 text-center text-5xl font-extrabold tracking-tight">{formatINR(card.paise)}</p>
                <p className="text-center text-xs capitalize text-[#9C9A92]">{amountInWords(card.paise)} — kul</p>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[#6D3FD8]">
                  <Icon name="mic" className="h-3.5 w-3.5" />
                  {listening ? 'Sun raha hoon… boliye “haan” ya “nahi”' : 'Ya boliye: “haan” / “nahi”'}
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={closeCard} className="flex-1 rounded-2xl bg-[#F2F0EA] py-3.5 text-sm font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] active:scale-[0.98]">Nahi</button>
                  <button onClick={submitCard} disabled={busy} className="flex-[2] rounded-2xl bg-[#F5C818] py-3.5 text-sm font-extrabold text-[#1A181C] active:scale-[0.98] disabled:opacity-50">
                    {busy ? 'Ban raha…' : 'Haan, bill banao'}
                  </button>
                </div>
              </>
            )}

            {(card.type === 'confirm-credit' || card.type === 'confirm-payment') && (
              <>
                <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${card.type === 'confirm-payment' ? 'bg-[#F5C818]/25 text-[#8A6D00]' : 'bg-[#DDD0FA] text-[#4A2FA6]'}`}>
                    <Icon name={card.type === 'confirm-payment' ? 'downLeft' : 'upRight'} className="h-4 w-4" />
                  </span>
                  {card.type === 'confirm-payment' ? 'Payment aaya — jama karun?' : 'Khaate mein add karun?'}
                </h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#9C9A92]">
                  <Avatar name={card.customer.name} className="h-7 w-7 text-[10px]" />
                  {card.customer.name}{card.customer.area ? ` · ${card.customer.area}` : ''} · {card.dateLabel}
                  {card.parsed.paymentMethod ? ` · ${card.parsed.paymentMethod.toUpperCase()}` : ''}
                </p>
                <p className="my-5 text-center text-5xl font-extrabold tracking-tight">{formatINR(card.paise)}</p>
                <p className="text-center text-xs capitalize text-[#9C9A92]">{amountInWords(card.paise)}</p>
                {card.parsed.note && <p className="mt-2 text-center text-xs text-[#9C9A92]">Note: {card.parsed.note}</p>}
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[#6D3FD8]">
                  <Icon name="mic" className="h-3.5 w-3.5" />
                  {listening ? 'Sun raha hoon… boliye “haan” ya “nahi”' : 'Ya boliye: “haan” / “nahi”'}
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={closeCard} className="flex-1 rounded-2xl bg-[#F2F0EA] py-3.5 text-sm font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] active:scale-[0.98]">Nahi</button>
                  <button onClick={submitCard} disabled={busy} className="flex-[2] rounded-2xl bg-[#F5C818] py-3.5 text-sm font-extrabold text-[#1A181C] active:scale-[0.98] disabled:opacity-50">
                    {busy ? 'Save ho raha…' : 'Haan, save karo'}
                  </button>
                </div>
              </>
            )}

            {card.type === 'disambiguate' && (
              <>
                <h3 className="text-base font-extrabold tracking-tight">
                  {card.single
                    ? <>Yahi sahi hai? <span className="font-semibold text-[#9C9A92]">(ek hi naam mila)</span></>
                    : <>Kaunse {card.heardName}? <span className="font-semibold text-[#9C9A92]">({card.candidates.length})</span></>}
                </h3>
                <div className="mt-4 space-y-2">
                  {card.candidates.map((c, i) => (
                    <button key={c.id} onClick={() => pick(c)} className="flex w-full items-center gap-3 rounded-2xl bg-[#F8F7F2] px-4 py-3 text-left text-sm font-bold ring-1 ring-[#E5E3DC] transition active:scale-[0.99] active:ring-[#8B5CF6]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5C818] text-xs font-extrabold text-[#1A181C]">{i + 1}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-bold text-[#6D3FD8]">
                  <Icon name="mic" className="h-3.5 w-3.5" />
                  {card.single
                    ? (listening ? 'Sun raha hoon… “haan” ya “nahi”' : 'Ya boliye: “haan” / “nahi”')
                    : card.candidates.length === 2
                      ? (listening ? 'Sun raha hoon… “pehla” ya “doosra”' : 'Ya boliye: “pehla” / “doosra”')
                      : (listening ? `Sun raha hoon… number boliye (1–${card.candidates.length})` : `Ya number boliye — 1 se ${card.candidates.length}`)}
                </p>
                {!card.single && (
                  <button onClick={() => { cancelListen(); openNewCustomerCard(card.parsed, 'confirm'); }}
                    className="mt-2 w-full rounded-2xl py-2 text-xs font-bold text-[#9C9A92] active:underline">Ye naya naam hai — naya khaata banao</button>
                )}
              </>
            )}

            {card.type === 'new-customer' && (
              <>
                <h3 className="text-base font-extrabold tracking-tight">Naya customer banau?</h3>
                <div className="mt-4 space-y-2">
                  <input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Naam"
                    className="w-full rounded-2xl bg-[#F8F7F2] px-4 py-3 text-sm font-semibold ring-1 ring-[#E5E3DC] outline-none placeholder:font-normal placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
                  <input value={card.phone || ''} onChange={(e) => setCard({ ...card, phone: e.target.value })} placeholder="Phone (optional)"
                    inputMode="tel" className="w-full rounded-2xl bg-[#F8F7F2] px-4 py-3 text-sm ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
                  <input value={card.area || ''} onChange={(e) => setCard({ ...card, area: e.target.value })} placeholder="Area / sheher (optional)"
                    className="w-full rounded-2xl bg-[#F8F7F2] px-4 py-3 text-sm ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[#6D3FD8]">
                  <Icon name="mic" className="h-3.5 w-3.5" />
                  {listening ? 'Sun raha hoon… boliye “haan” ya “nahi”' : 'Ya boliye: “haan” / “nahi”'}
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={closeCard} className="flex-1 rounded-2xl bg-[#F2F0EA] py-3.5 text-sm font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] active:scale-[0.98]">Nahi</button>
                  <button onClick={submitCard} disabled={busy || !card.name?.trim()} className="flex-[2] rounded-2xl bg-[#F5C818] py-3.5 text-sm font-extrabold text-[#1A181C] active:scale-[0.98] disabled:opacity-50">
                    {busy ? 'Bana raha hoon…' : 'Khaata banao'}
                  </button>
                </div>
              </>
            )}

            {card.type === 'answer' && (
              <>
                <h3 className="text-base font-extrabold tracking-tight">{card.title}</h3>
                <p className="my-5 text-center text-4xl font-extrabold tracking-tight">{card.big}</p>
                {card.words && <p className="text-center text-xs capitalize text-[#9C9A92]">{card.words}</p>}
                <ul className="mt-4 space-y-1.5 text-sm text-[#6B6960]">
                  {card.lines.map((l, i) => <li key={i} className="rounded-xl bg-[#F8F7F2] px-3 py-2">{l}</li>)}
                </ul>
                <button onClick={closeCard} className="mt-5 w-full rounded-2xl bg-[#1A181C] py-3.5 text-sm font-bold text-white active:scale-[0.98]">Theek hai</button>
              </>
            )}

            {card.type === 'error' && (
              <>
                <h3 className="text-base font-extrabold tracking-tight text-[#F05A4F]">😕 {card.message}</h3>
                <button onClick={closeCard} className="mt-5 w-full rounded-2xl bg-[#1A181C] py-3.5 text-sm font-bold text-white active:scale-[0.98]">Theek hai</button>
              </>
            )}

          </div>
        </div>
      )}
    </main>
  );
}

export default function BoloPage() {
  return <AuthGate><VoiceConsole /></AuthGate>;
}
