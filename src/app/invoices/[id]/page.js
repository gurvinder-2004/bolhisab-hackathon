'use client';

// The invoice: print-ready Tax Invoice / Bill of Supply, with UPI QR, record-payment,
// WhatsApp reminder with pay link, and the demand letter.

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { supabase } from '../../../lib/supabase.js';
import { loadBook, statusColor, statusLabel } from '../../../lib/data.js';
import { recordPayment, logEvent } from '../../../lib/actions.js';
import { formatINR, formatDateIN, amountInWords, todayIST } from '../../../engine/index.js';
import { whatsappTemplate } from '../../../domain/chase.js';
import { STATE_CODES } from '../../../engine/states.js';

export default function InvoiceDetail({ params }) {
  const { id } = use(params);
  const [book, setBook] = useState(null);
  const [qr, setQr] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reload = () => loadBook().then(setBook).catch(() => {});
  useEffect(() => { reload(); }, []);

  const inv = book?.invoices.find((i) => i.id === id);
  const cust = book?.customers.find((c) => c.id === inv?.customerId);
  const biz = book?.business;

  const upiLink = useMemo(() => {
    if (!biz?.upi_id || !inv) return null;
    const am = (inv.outstanding / 100).toFixed(2);
    return `upi://pay?pa=${encodeURIComponent(biz.upi_id)}&pn=${encodeURIComponent(biz.name)}&am=${am}&cu=INR&tn=${encodeURIComponent((inv.number ?? 'Invoice') + ' payment')}`;
  }, [biz, inv]);

  useEffect(() => {
    if (upiLink) QRCode.toDataURL(upiLink, { width: 180, margin: 1 }).then(setQr).catch(() => {});
  }, [upiLink]);

  if (!book) return <main className="mx-auto max-w-2xl p-6 text-[#9C9A92]">Loading…</main>;
  if (!inv || !cust || !biz) return <main className="mx-auto max-w-2xl p-6 text-[#C4392C]">Invoice nahi mila.</main>;

  const payLink = typeof window !== 'undefined' ? `${window.location.origin}/pay/${inv.id}` : `/pay/${inv.id}`;

  const doRecordPayment = async () => {
    const rupees = Number(payAmt);
    if (!rupees || rupees <= 0) return;
    setBusy(true);
    try {
      await recordPayment({ customerId: cust.id, amountRupees: rupees, method: 'upi' });
      setPayAmt(''); setMsg('Payment jama ho gaya ✓'); reload();
    } catch (e) { setMsg(`Fail: ${e.message}`); }
    finally { setBusy(false); }
  };

  const sendWhatsapp = () => {
    const text = whatsappTemplate({ name: cust.name, number: inv.number, amountPaise: inv.outstanding, dueDate: inv.dueDate, business: biz.name, payLink });
    window.open(`https://wa.me/91${(cust.phone || '').replace(/\D/g, '').replace(/^91/, '')}?text=${encodeURIComponent(text)}`, '_blank');
    logEvent({ kind: 'reminder_sent', customerId: cust.id, invoiceId: inv.id, payload: { via: 'whatsapp', channel: 'invoice_page' } });
  };

  const invLines = Array.isArray(inv.lines) ? inv.lines : [];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      {/* actions */}
      <div className="no-print mb-3 flex items-center justify-between">
        <Link href="/invoices" className="inline-flex items-center gap-1 text-xs font-bold text-[#9C9A92]">← Bills</Link>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusColor[inv.status]}`}>{statusLabel[inv.status]}</span>
      </div>

      {/* ===== printable invoice ===== */}
      <section id="invoice-paper" className="rounded-[1.5rem] bg-white p-5 shadow-[0_14px_40px_-24px_rgba(26,24,28,0.4)] ring-1 ring-[#E5E3DC]">
        <div className="border-b-2 border-[#1A1A1A] pb-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-extrabold">{biz.name}</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-600">{biz.address}</p>
              <p className="text-[11px] text-stone-600">GSTIN: {biz.gstin}</p>
            </div>
            <div className="text-right">
              <p className="rounded-lg bg-[#1A1A1A] px-2 py-1 text-[11px] font-extrabold uppercase text-white">
                {inv.docType === 'TAX_INVOICE' ? 'Tax Invoice' : inv.docType === 'BILL_OF_SUPPLY' ? 'Bill of Supply' : 'Invoice'}
              </p>
              <p className="mt-1 text-[11px] font-bold">{inv.number ?? '(DRAFT — number nahi)'}</p>
              <p className="text-[11px] text-stone-600">Date: {formatDateIN(inv.invoiceDate)}</p>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[11px]">
            <div>
              <p className="font-bold">Bill to:</p>
              <p className="text-stone-700">{cust.name}{cust.shop_name ? ` (${cust.shop_name})` : ''}</p>
              <p className="text-stone-600">{[cust.area, cust.city].filter(Boolean).join(', ')}</p>
              {cust.gstin && <p className="text-stone-600">GSTIN: {cust.gstin}</p>}
            </div>
            {inv.place_of_supply_code && (
              <div className="text-right">
                <p className="font-bold">Place of supply</p>
                <p className="text-stone-700">{STATE_CODES[inv.place_of_supply_code] ?? inv.place_of_supply_code}</p>
                <p className="text-stone-600">{inv.supply === 'INTRA' ? 'Intra-state (CGST+SGST)' : 'Inter-state (IGST)'}</p>
              </div>
            )}
          </div>
        </div>

        <table className="mt-3 w-full text-[11px]">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-1.5">#</th><th>Item</th><th>HSN</th><th className="text-right">Qty</th>
              <th className="text-right">Rate</th><th className="text-right">Taxable</th>
              {inv.cgstPaise || inv.sgstPaise ? <><th className="text-right">CGST</th><th className="text-right">SGST</th></> : inv.igstPaise ? <th className="text-right">IGST</th> : null}
              <th className="text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {invLines.map((l, idx) => (
              <tr key={idx} className="border-b border-stone-100">
                <td className="py-1.5">{idx + 1}</td>
                <td className="max-w-28">{l.description}</td>
                <td>{l.hsn}</td>
                <td className="text-right">{l.qty} {l.unit}</td>
                <td className="text-right">{formatINR(l.ratePaise)}</td>
                <td className="text-right">{formatINR(l.taxable)}</td>
                {inv.cgstPaise || inv.sgstPaise ? <><td className="text-right">{formatINR(l.cgst)}</td><td className="text-right">{formatINR(l.sgst)}</td></> : inv.igstPaise ? <td className="text-right">{formatINR(l.igst)}</td> : null}
                <td className="text-right font-semibold">{formatINR(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="text-[11px] text-stone-600">
            {qr && <img src={qr} alt="UPI QR" width={110} height={110} className="rounded-lg ring-1 ring-stone-200" />}
            <p className="mt-1 font-semibold">Scan karke UPI se pay karein</p>
            <p className="text-stone-500">{biz.upi_id}</p>
          </div>
          <div className="min-w-40 text-[11px]">
            <div className="flex justify-between py-0.5"><span>Taxable</span><span className="font-semibold">{formatINR(inv.taxablePaise)}</span></div>
            {inv.cgstPaise > 0 && <div className="flex justify-between py-0.5"><span>CGST</span><span className="font-semibold">{formatINR(inv.cgstPaise)}</span></div>}
            {inv.sgstPaise > 0 && <div className="flex justify-between py-0.5"><span>SGST</span><span className="font-semibold">{formatINR(inv.sgstPaise)}</span></div>}
            {inv.igstPaise > 0 && <div className="flex justify-between py-0.5"><span>IGST</span><span className="font-semibold">{formatINR(inv.igstPaise)}</span></div>}
            {inv.roundOffPaise !== 0 && <div className="flex justify-between py-0.5"><span>Round off</span><span className="font-semibold">{inv.roundOffPaise > 0 ? '+' : ''}{formatINR(inv.roundOffPaise)}</span></div>}
            <div className="mt-1 flex justify-between border-t-2 border-[#1A1A1A] pt-1 text-sm font-extrabold"><span>Total</span><span>{formatINR(inv.totalPaise)}</span></div>
            {inv.outstanding > 0 && <div className="flex justify-between py-0.5 text-rose-600"><span>Baaki</span><span className="font-bold">{formatINR(inv.outstanding)}</span></div>}
          </div>
        </div>
        <p className="mt-2 text-[10px] capitalize text-stone-500">{amountInWords(inv.totalPaise)}</p>
        {inv.statusOverride === 'draft' && <p className="mt-1 text-[10px] font-bold text-amber-600">DRAFT — bhejne par number milega</p>}
        <div className="mt-4 flex items-end justify-between">
          <p className="text-[10px] text-stone-400">Due date: {formatDateIN(inv.dueDate)}</p>
          <div className="text-center">
            <p className="mt-4 border-t border-stone-400 px-4 pt-1 text-[10px] text-stone-600">For {biz.name}</p>
            <p className="text-[9px] text-stone-400">Authorised signatory</p>
          </div>
        </div>
      </section>

      {/* actions */}
      <div className="no-print mt-4 grid grid-cols-2 gap-2.5 text-xs font-bold">
        <button onClick={() => window.print()} className="rounded-2xl bg-[#1A181C] py-3.5 text-white transition active:scale-[0.98]">🖨 Print / PDF</button>
        <button onClick={sendWhatsapp} className="rounded-2xl bg-[#1B7A3D] py-3.5 text-white transition active:scale-[0.98]">💬 WhatsApp + link</button>
        <Link href={`/letter/${inv.id}`} className="rounded-2xl bg-[#EDE7FE] py-3.5 text-center text-[#6D28D9] transition active:scale-[0.98]">📄 Demand letter</Link>
        <button onClick={() => navigator.clipboard?.writeText(payLink)} className="rounded-2xl bg-white py-3.5 text-[#6B6960] ring-1 ring-[#E5E3DC] transition active:scale-[0.98]">🔗 Pay link copy</button>
      </div>

      {/* record payment */}
      {inv.outstanding > 0 && (
        <section className="no-print mt-3 rounded-[1.5rem] bg-white p-4 ring-1 ring-[#E5E3DC]">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9C9A92]">Payment aaya? Jama karo</h3>
          <div className="mt-2.5 flex gap-2">
            <input value={payAmt} onChange={(e) => setPayAmt(e.target.value)} inputMode="decimal" placeholder="₹ amount"
              className="min-w-0 flex-1 rounded-xl bg-[#F8F7F2] px-3 py-2.5 text-sm ring-1 ring-[#E5E3DC] outline-none focus:ring-2 focus:ring-[#8B5CF6]" />
            <button onClick={doRecordPayment} disabled={busy} className="rounded-xl bg-[#F5C818] px-5 py-2.5 text-sm font-extrabold text-[#1A181C] transition active:scale-95 disabled:opacity-50">{busy ? '…' : 'Jama'}</button>
          </div>
          <button onClick={() => setPayAmt(String(inv.outstanding / 100))} className="mt-1.5 text-[11px] font-bold text-[#6D3FD8]">Poora ({formatINR(inv.outstanding)}) bhar do</button>
          {msg && <p className="mt-1.5 text-xs font-bold text-[#1B7A3D]">{msg}</p>}
        </section>
      )}
    </main>
  );
}
