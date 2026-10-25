'use client';

// Customer-facing pay link (share on WhatsApp): amount, UPI QR, words,
// and "I have a dispute" — which pauses all chasing until resolved.

import { useEffect, useMemo, useState, use } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../../lib/supabase.js';
import { formatINR, formatDateIN, amountInWords } from '../../../engine/index.js';
import { mapInvoiceRow } from '../../../lib/ledger.js';
import { todayIST } from '../../../engine/dates.js';
import { invoiceState } from '../../../domain/status.js';

export default function PayLink({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [qr, setQr] = useState(null);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState('');
  const [askDispute, setAskDispute] = useState(false);
  const [disputed, setDisputed] = useState(false);

  useEffect(() => {
    (async () => {
      const [b, i, alloc] = await Promise.all([
        supabase.from('businesses').select('*').limit(1),
        supabase.from('invoices').select('*').eq('id', id).single(),
        supabase.from('payment_allocations').select('*').eq('invoice_id', id),
      ]);
      if (!i.data || !b.data?.[0]) { setData({ missing: true }); return; }
      const cust = (await supabase.from('customers').select('*').eq('id', i.data.customer_id).single()).data;
      const paid = (alloc.data ?? []).reduce((s, a) => s + a.amount_paise, 0);
      const inv = mapInvoiceRow(i.data);
      const st = invoiceState(inv, paid, todayIST());
      setData({ biz: b.data[0], inv: { ...inv, ...st }, cust });
      setDisputed(st.status === 'disputed');
    })();
  }, [id]);

  const upiLink = useMemo(() => {
    const d = data;
    if (!d?.biz?.upi_id || !d?.inv) return null;
    const am = (d.inv.outstanding / 100).toFixed(2);
    return `upi://pay?pa=${encodeURIComponent(d.biz.upi_id)}&pn=${encodeURIComponent(d.biz.name)}&am=${am}&cu=INR&tn=${encodeURIComponent((d.inv.number ?? 'Invoice') + ' payment')}`;
  }, [data]);

  useEffect(() => {
    if (upiLink) QRCode.toDataURL(upiLink, { width: 220, margin: 1 }).then(setQr).catch(() => {});
  }, [upiLink]);

  if (!data) return <main className="mx-auto max-w-md p-6 text-stone-400">Loading…</main>;
  if (data.missing) return <main className="mx-auto max-w-md p-6 text-rose-600">Invoice nahi mila.</main>;
  const { biz, inv, cust } = data;

  const raiseDispute = async () => {
    await supabase.from('invoices').update({ status_override: 'disputed' }).eq('id', id);
    await supabase.from('events').insert({
      business_id: biz.id, customer_id: cust.id, invoice_id: id,
      kind: 'dispute_raised', payload: { reason: reason || null, from: 'pay_link', on: todayIST() },
    });
    setDisputed(true); setAskDispute(false); setDone(false);
  };

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      <div className="overflow-hidden rounded-[2rem] bg-white text-center shadow-[0_20px_50px_-30px_rgba(26,24,28,0.5)] ring-1 ring-[#E5E3DC]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-192.png" alt="" width={52} height={52} className="mx-auto mt-6" />
        <p className="mt-2 px-6 text-sm font-bold">{biz.name}</p>
        <p className="px-6 text-xs text-[#9C9A92]">{inv.number} · due {formatDateIN(inv.dueDate)}</p>

        {inv.outstanding > 0 ? (
          <>
            <div className="mt-5 bg-[#141216] px-6 py-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Dena hai</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-[#F5C818]">{formatINR(inv.outstanding)}</p>
              <p className="mt-1 text-[11px] capitalize text-white/50">{amountInWords(inv.outstanding)}</p>
            </div>
            <div className="px-6 py-5">
              {Array.isArray(inv.lines) && inv.lines.length > 0 && (
                <div className="mb-4 rounded-2xl bg-[#F8F7F2] p-3 text-left ring-1 ring-[#E5E3DC]">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9C9A92]">Bill mein kya-kya</p>
                  <ul className="mt-1.5">
                    {inv.lines.map((l, idx) => (
                      <li key={idx} className="flex items-center justify-between border-b border-[#ECEAE2] px-1 py-2 text-xs last:border-0">
                        <span className="pr-2 text-[#6B6960]">{l.description}{l.qty > 1 ? ` × ${l.qty}` : ''}</span>
                        <span className="shrink-0 font-bold">{formatINR(l.lineTotal ?? l.taxable)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 flex justify-between px-1 pt-1.5 text-xs font-extrabold">
                    <span>Kul</span><span>{formatINR(inv.totalPaise)}</span>
                  </p>
                </div>
              )}
              {qr && (
                <>
                  <img src={qr} alt="UPI QR" width={220} height={220} className="mx-auto rounded-2xl ring-1 ring-[#E5E3DC]" />
                  <p className="mt-2 text-xs text-[#9C9A92]">Kisi bhi UPI app se scan karein</p>
                  <a href={upiLink} className="mt-3 inline-block rounded-full bg-[#F5C818] px-6 py-3 text-sm font-extrabold text-[#1A181C] shadow-[0_12px_28px_-12px_rgba(245,200,24,0.8)] active:scale-95">UPI app mein kholo</a>
                </>
              )}
              <div className="mt-4 border-t border-[#F2F0EA] pt-3 text-left text-xs text-[#9C9A92]">
                <p>Bank: {biz.bank_name} · A/c {biz.bank_account} · {biz.bank_ifsc}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-6 pb-6 text-2xl font-extrabold text-[#1B7A3D]">✓ Paid — shukriya!</p>
        )}
      </div>

      {disputed ? (
        <div className="mt-3 rounded-[1.5rem] bg-[#EDE7FE] p-4 text-center text-sm font-bold text-[#6D28D9] ring-1 ring-[#DDD0FA]">
          ⚠ Aapne is bill par vivad bataya hai. {biz.name} se baat hogi — tab tak koi reminder nahi aayega.
        </div>
      ) : inv.outstanding > 0 && !done ? (
        <div className="mt-3">
          {askDispute ? (
            <div className="rounded-[1.5rem] bg-white p-4 ring-1 ring-[#E5E3DC]">
              <p className="text-sm font-extrabold">Kya galat lag raha hai?</p>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jaise: maal kam mila, rate galat…"
                className="mt-2 w-full rounded-xl bg-[#F8F7F2] px-3.5 py-2.5 text-sm ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
              <div className="mt-2.5 flex gap-2">
                <button onClick={() => setAskDispute(false)} className="flex-1 rounded-xl bg-[#F2F0EA] py-2.5 text-sm font-bold text-[#6B6960] active:scale-95">Wapas</button>
                <button onClick={raiseDispute} className="flex-1 rounded-xl bg-[#F05A4F] py-2.5 text-sm font-bold text-white active:scale-95">Vivad darj karo</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAskDispute(true)} className="w-full rounded-2xl py-3 text-xs font-bold text-[#9C9A92] active:underline">
              Is bill mein koi baat hai? Vivad darj karein →
            </button>
          )}
        </div>
      ) : null}

      {done && <p className="mt-3 text-center text-sm font-bold text-[#1B7A3D]">Shukriya! Payment record ho gaya.</p>}
      <p className="mt-6 text-center text-[10px] font-semibold text-[#B5B3AA]">Powered by BolHisab</p>
    </main>
  );
}
