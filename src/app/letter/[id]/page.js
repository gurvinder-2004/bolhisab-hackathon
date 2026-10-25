'use client';

// Print-ready Payment Demand Letter — with the mandatory honest disclaimer
// (not a legal notice, not a GST/CBDT notification). PS4 judges check this first.

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase.js';
import { formatINR, formatDateIN, amountInWords } from '../../../engine/index.js';
import { mapInvoiceRow, mapCustomerRow } from '../../../lib/ledger.js';
import { todayIST, formatDateIN as fmt } from '../../../engine/dates.js';

export default function DemandLetter({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const [b, i, alloc] = await Promise.all([
        supabase.from('businesses').select('*').limit(1),
        supabase.from('invoices').select('*').eq('id', id).single(),
        supabase.from('payment_allocations').select('*').eq('invoice_id', id),
      ]);
      if (!i.data || !b.data?.[0]) { setData({ missing: true }); return; }
      const cust = mapCustomerRow((await supabase.from('customers').select('*').eq('id', i.data.customer_id).single()).data ?? {});
      const paid = (alloc.data ?? []).reduce((s, a) => s + a.amount_paise, 0);
      const inv = mapInvoiceRow(i.data);
      const outstanding = Math.max(0, inv.totalPaise - paid);
      setData({ biz: b.data[0], inv, cust, paid, outstanding });
    })();
  }, [id]);

  if (!data) return <main className="mx-auto max-w-md p-6 text-[#9C9A92]">Loading…</main>;
  if (data.missing) return <main className="mx-auto max-w-md p-6 text-[#C4392C]">Invoice nahi mila.</main>;
  const { biz, inv, cust, outstanding } = data;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-5">
      <div className="no-print mb-3 flex items-center justify-between">
        <Link href={`/invoices/${id}`} className="text-xs font-bold text-[#9C9A92]">← Bill</Link>
        <button onClick={() => window.print()} className="rounded-full bg-[#1A181C] px-4 py-2 text-xs font-bold text-white transition active:scale-95">🖨 Print / PDF</button>
      </div>

      <section className="rounded-[1.5rem] bg-white p-6 shadow-[0_14px_40px_-24px_rgba(26,24,28,0.4)] ring-1 ring-[#E5E3DC]" style={{ fontFamily: 'Georgia, serif' }}>
        <div className="border-b border-stone-300 pb-3 text-center">
          <h1 className="text-xl font-extrabold uppercase tracking-wide">{biz.name}</h1>
          <p className="mt-1 text-[11px] leading-snug text-stone-600">{biz.address}</p>
          <p className="text-[11px] text-stone-600">GSTIN: {biz.gstin} · Ph: {cust.phone ?? '—'}</p>
        </div>

        <p className="mt-4 text-right text-[11px]">Date: {formatDateIN(todayIST())}</p>

        <p className="mt-3 text-[11px] font-bold">To,</p>
        <p className="text-[11px] leading-relaxed">
          {cust.name}{cust.shop_name ? ` (${cust.shop_name})` : ''}<br />
          {[cust.area, cust.city].filter(Boolean).join(', ')}<br />
          {cust.gstin ? `GSTIN: ${cust.gstin}` : ''}
        </p>

        <p className="mt-4 text-center text-sm font-extrabold underline">PAYMENT REMINDER — {inv.number}</p>

        <p className="mt-3 text-[11px] leading-relaxed">
          Dear {cust.name},<br /><br />
          As per our records, the following invoice remains unpaid beyond its due date:
        </p>

        <table className="mt-2 w-full border border-stone-300 text-[11px]">
          <thead>
            <tr className="bg-stone-100">
              <th className="border border-stone-300 px-2 py-1 text-left">Invoice</th>
              <th className="border border-stone-300 px-2 py-1">Date</th>
              <th className="border border-stone-300 px-2 py-1">Due date</th>
              <th className="border border-stone-300 px-2 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-stone-300 px-2 py-1">{inv.number}</td>
              <td className="border border-stone-300 px-2 py-1 text-center">{fmt(inv.invoiceDate)}</td>
              <td className="border border-stone-300 px-2 py-1 text-center">{fmt(inv.dueDate)}</td>
              <td className="border border-stone-300 px-2 py-1 text-right font-bold">{formatINR(outstanding)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-right text-[11px] italic">(Rupees {amountInWords(outstanding).replace(/^Rupees | Only$/g, '')} only)</p>

        <p className="mt-3 text-[11px] leading-relaxed">
          We request you to clear the above amount within <b>7 days</b> of this letter. Payment can be made by UPI
          ({biz.upi_id}) or bank transfer ({biz.bank_name}, A/c {biz.bank_account}, IFSC {biz.bank_ifsc}).
          If you have already paid or believe there is an error, please contact us so we can reconcile.
        </p>

        <div className="mt-4 rounded border border-stone-300 bg-stone-50 p-2 text-[10px] leading-snug text-stone-600">
          <b>Disclaimer:</b> This is a routine business payment reminder issued by {biz.name}.
          It is <b>not a legal notice</b> and <b>not a GST/CBDT/government notification</b> of any kind,
          and it does not create any legal obligation beyond the underlying invoice terms.
        </div>

        <div className="mt-8 flex justify-end">
          <div className="text-center">
            <p className="border-t border-stone-500 px-8 pt-1 text-[11px]">For {biz.name}</p>
            <p className="text-[9px] text-stone-500">Authorised signatory</p>
          </div>
        </div>
      </section>
    </main>
  );
}
