'use client';

// Nayi bill: pick customer, add lines, live totals from the M1 engine (never the UI's own maths),
// then save as sent (numbered) or draft.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase.js';
import { loadBook } from '../../../lib/data.js';
import { getBusiness } from '../../../lib/actions.js';
import { computeInvoice, toPaise, formatINR, amountInWords, todayIST, addDays, nextInvoiceNumber } from '../../../engine/index.js';
import { GST_RATES } from '../../../config.js';
import { BackLink, Icon } from '../../../components/ui.js';
import AuthGate from '../../../components/AuthGate.js';

const emptyLine = { description: '', hsn: '', unit: 'pcs', qty: '1', rate: '', gstRatePct: 5 };

function NewInvoice() {
  const router = useRouter();
  const [book, setBook] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { loadBook().then(setBook).catch(() => {}); }, []);

  const cust = book?.customers.find((c) => c.id === customerId);

  const calc = useMemo(() => {
    if (!book?.business || !cust) return null;
    try {
      const engineLines = lines
        .filter((l) => l.description.trim() && l.qty && l.rate)
        .map((l) => ({ ...l, qty: Number(l.qty), ratePaise: toPaise(l.rate) }));
      if (!engineLines.length) return null;
      return computeInvoice({
        business: { registrationType: book.business.registration_type, stateCode: book.business.state_code },
        placeOfSupplyStateCode: cust.stateCode,
        lines: engineLines,
      });
    } catch (e) { return { error: e.message }; }
  }, [book, cust, lines]);

  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const save = async (asDraft) => {
    if (!calc || calc.error || !cust) return;
    setBusy(true); setErr(null);
    try {
      const biz = await getBusiness();
      const date = todayIST();
      let number = null;
      if (!asDraft) {
        const { data: existing } = await supabase.from('invoices').select('number').not('number', 'is', null);
        number = nextInvoiceNumber((existing ?? []).map((r) => r.number), date);
      }
      const engineLines = lines.filter((l) => l.description.trim() && l.qty && l.rate)
        .map((l) => ({ ...l, qty: Number(l.qty), ratePaise: toPaise(l.rate) }));
      const { data, error } = await supabase.from('invoices').insert({
        business_id: biz.id,
        customer_id: cust.id,
        number,
        invoice_date: date,
        due_date: addDays(date, cust.creditDays ?? 30),
        doc_type: calc.docType, supply: calc.supply, place_of_supply_code: calc.placeOfSupply?.code ?? null,
        lines: engineLines.map((l, i) => ({ ...l, ...calc.lines[i] })),
        taxable_paise: calc.totals.taxable, cgst_paise: calc.totals.cgst, sgst_paise: calc.totals.sgst,
        igst_paise: calc.totals.igst, round_off_paise: calc.totals.roundOff, total_paise: calc.totals.grandTotal,
        status_override: asDraft ? 'draft' : null,
      }).select().single();
      if (error) throw new Error(error.message);
      router.push(`/invoices/${data.id}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!book) return <main className="mx-auto max-w-2xl p-6 text-[#9C9A92]">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      <header className="mb-4 flex items-center justify-between">
        <BackLink href="/invoices" label="Bills" />
        <h1 className="text-lg font-extrabold tracking-tight">Nayi bill</h1>
      </header>

      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
        className="w-full rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold ring-1 ring-[#E5E3DC] outline-none focus:ring-2 focus:ring-[#8B5CF6]">
        <option value="">Customer chunein…</option>
        {book.customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name} — {c.gstin ? `GST ${c.gstin.slice(0, 2)}` : 'no GST'}{c.area ? ` · ${c.area}` : ''}</option>
        ))}
      </select>
      {cust && (
        <p className="mt-1.5 px-1 text-[11px] font-semibold text-[#6D3FD8]">
          Supply: {book.business.state_code === cust.stateCode ? 'intra-state (CGST+SGST)' : 'inter-state (IGST)'} · credit {cust.creditDays} din
        </p>
      )}

      {/* lines */}
      <section className="mt-3 space-y-2.5">
        {lines.map((l, i) => (
          <div key={i} className="rounded-[1.5rem] bg-white p-4 ring-1 ring-[#E5E3DC]">
            <div className="flex gap-2">
              <input value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} placeholder="Item (jaise: 5-ply carton)"
                className="min-w-0 flex-1 rounded-xl bg-[#F8F7F2] px-3 py-2.5 text-sm ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
              {lines.length > 1 && (
                <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="rounded-xl bg-[#F2F0EA] px-3 text-sm font-bold text-[#9C9A92] active:scale-95">✕</button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <input value={l.hsn} onChange={(e) => setLine(i, 'hsn', e.target.value)} placeholder="HSN"
                className="rounded-xl bg-[#F8F7F2] px-2 py-2 text-xs ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
              <input value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} inputMode="decimal" placeholder="Qty"
                className="rounded-xl bg-[#F8F7F2] px-2 py-2 text-xs ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
              <input value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} inputMode="decimal" placeholder="Rate ₹"
                className="rounded-xl bg-[#F8F7F2] px-2 py-2 text-xs ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
              <select value={l.gstRatePct} onChange={(e) => setLine(i, 'gstRatePct', Number(e.target.value))}
                className="rounded-xl bg-[#F8F7F2] px-1 py-2 text-xs ring-1 ring-[#E5E3DC] outline-none">
                {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
        ))}
        <button onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}
          className="w-full rounded-2xl border-2 border-dashed border-[#D9D6CB] py-3 text-sm font-bold text-[#9C9A92] transition active:bg-white">+ Line add karo</button>
      </section>

      {/* live totals */}
      <section className="mt-3 rounded-[1.75rem] bg-[#141216] p-5 text-white">
        {calc?.error ? (
          <p className="text-sm text-[#FFB3AC]">⚠ {calc.error}</p>
        ) : calc ? (
          <>
            <div className="flex justify-between text-xs text-white/60"><span>Taxable</span><span>{formatINR(calc.totals.taxable)}</span></div>
            {calc.totals.cgst > 0 && <div className="flex justify-between text-xs text-white/60"><span>CGST + SGST</span><span>{formatINR(calc.totals.cgst + calc.totals.sgst)}</span></div>}
            {calc.totals.igst > 0 && <div className="flex justify-between text-xs text-white/60"><span>IGST</span><span>{formatINR(calc.totals.igst)}</span></div>}
            {calc.totals.roundOff !== 0 && <div className="flex justify-between text-xs text-white/60"><span>Round off</span><span>{calc.totals.roundOff > 0 ? '+' : ''}{formatINR(calc.totals.roundOff)}</span></div>}
            <div className="mt-1.5 flex justify-between border-t border-white/15 pt-2 text-2xl font-extrabold tracking-tight"><span>Total</span><span className="text-[#F5C818]">{formatINR(calc.totals.grandTotal)}</span></div>
            <p className="mt-1 text-[10px] capitalize text-white/50">{calc.grandTotalWords}</p>
          </>
        ) : (
          <p className="text-sm text-white/50">Customer + item bharein, total yahan dikhega.</p>
        )}
      </section>

      {err && <p className="mt-2 text-sm text-[#C4392C]">⚠ {err}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => save(true)} disabled={!calc || calc.error || busy}
          className="rounded-2xl bg-white py-3.5 text-sm font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] transition active:scale-[0.98] disabled:opacity-40">Draft me rakho</button>
        <button onClick={() => save(false)} disabled={!calc || calc.error || busy || !customerId}
          className="rounded-2xl bg-[#F5C818] py-3.5 text-sm font-extrabold text-[#1A181C] shadow-[0_12px_28px_-12px_rgba(245,200,24,0.8)] transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none">
          {busy ? 'Ban rahi…' : '✔ Bill banao'}
        </button>
      </div>
    </main>
  );
}

export default function NewInvoicePage(props) {
  return <AuthGate><NewInvoice {...props} /></AuthGate>;
}
