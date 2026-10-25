'use client';

// Customer profile: balance breakdown, reliability grade, open invoices, timeline,
// and the chase actions (WhatsApp with pay link, demand letter).

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { loadBook, statusColor, statusLabel } from '../../../lib/data.js';
import { logEvent } from '../../../lib/actions.js';
import { formatINR, formatDateIN } from '../../../engine/index.js';
import { whatsappTemplate, CHANNEL_LABEL } from '../../../domain/chase.js';
import { Avatar, BackLink, Icon } from '../../../components/ui.js';
import AuthGate from '../../../components/AuthGate.js';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase.js';

const GRADE_TEXT = {
  A: 'भरोसेमंद — waqt par bharta hai', B: 'Theek hai — thoda late', C: 'Dhyan rakho — late bharta hai', '-': 'Abhi data nahi',
};

function CustomerDetail({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw new Error(error.message);
      router.push('/customers');
    } finally { setBusy(false); }
  };
  const [book, setBook] = useState(null);
  useEffect(() => { loadBook().then(setBook).catch(() => {}); }, []);
  if (!book) return <main className="mx-auto max-w-2xl p-6 text-[#9C9A92]">Loading…</main>;

  const c = book.customers.find((x) => x.id === id);
  if (!c) return <main className="mx-auto max-w-2xl p-6 text-[#C4392C]">Customer nahi mila.</main>;

  const myFups = book.followUps.filter((f) => f.customerId === c.id);
  const fup = myFups[0];
  const events = book.events.filter((e) => e.customer_id === c.id).slice(0, 6);

  const payLinkFor = (invId) => (typeof window !== 'undefined' ? `${window.location.origin}/pay/${invId}` : `/pay/${invId}`);
  const nudge = (inv) => {
    const text = whatsappTemplate({ name: c.name, number: inv.number, amountPaise: inv.outstanding, dueDate: inv.dueDate, business: book.business.name, payLink: payLinkFor(inv.id) });
    window.open(`https://wa.me/91${(c.phone || '').replace(/\D/g, '').replace(/^91/, '')}?text=${encodeURIComponent(text)}`, '_blank');
    logEvent({ kind: 'reminder_sent', customerId: c.id, invoiceId: inv.id, payload: { via: 'whatsapp', channel: 'customer_page' } });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      <BackLink href="/customers" label="Customers" className="mb-3" />

      {/* black hero */}
      <header className="flex items-center gap-4 rounded-[2rem] bg-[#141216] p-5 text-white">
        <Avatar name={c.name} className="h-16 w-16 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{c.name}</h1>
          <p className="truncate text-xs text-white/60">{[c.shopName, c.area, c.city].filter(Boolean).join(' · ')}</p>
          <p className="truncate text-[11px] text-white/40">{c.phone} {c.gstin ? `· GSTIN ${c.gstin}` : '· unregistered'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-extrabold tracking-tight text-[#FF9D93]">{formatINR(c.balancePaise)}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">kul baaki</p>
        </div>
      </header>

      <div className="mt-3 flex justify-end no-print">
        <button onClick={() => setConfirmDel(true)}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-[#C4392C] ring-1 ring-[#F8CFC9] transition hover:bg-[#FDE7E4] active:scale-95">
          <Icon name="trash" className="h-4 w-4" /> Delete khaata
        </button>
      </div>
      {confirmDel && (
        <div className="fixed inset-0 z-40 flex items-end bg-[#1A181C]/55 p-4 backdrop-blur-[2px] md:items-center" onClick={() => setConfirmDel(false)}>
          <div className="w-full rounded-[2rem] bg-white p-6 shadow-2xl md:mx-auto md:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-[#C4392C]">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FDE7E4] text-[#C4392C]"><Icon name="trash" className="h-4 w-4" /></span>
              {c.name} ka khaata delete karein?
            </h3>
            <p className="mt-3 rounded-2xl bg-[#FDE7E4]/60 p-3 text-xs font-semibold text-[#C4392C] ring-1 ring-[#F8CFC9]">
              {c.openInvoices.length} bills, khata entries aur poora record hamesha ke liye chala jayega.
              {c.balancePaise > 0 ? ` Baaki: ${formatINR(c.balancePaise)}.` : ''} Ye wapas nahi aayega.
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-2xl bg-[#F2F0EA] py-3.5 text-sm font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] active:scale-[0.98]">Nahi, rehne do</button>
              <button onClick={doDelete} disabled={busy} className="flex-1 rounded-2xl bg-[#F05A4F] py-3.5 text-sm font-extrabold text-white active:scale-[0.98] disabled:opacity-50">
                {busy ? 'Delete ho raha…' : 'Haan, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* grade + breakdown */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] bg-white p-4 ring-1 ring-[#E5E3DC]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9C9A92]">Bharne ka record</p>
          <p className="mt-1.5 text-sm font-extrabold">{c.grade}-grade</p>
          <p className="text-[11px] font-semibold text-[#6D3FD8]">{GRADE_TEXT[c.grade] ?? ''}</p>
          <p className="mt-0.5 text-[11px] text-[#9C9A92]">{c.gradeReason}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-4 text-xs ring-1 ring-[#E5E3DC]">
          <div className="flex justify-between py-1"><span className="text-[#9C9A92]">Bills par</span><span className="font-bold">{formatINR(c.invoiceOutstandingPaise)}</span></div>
          <div className="flex justify-between py-1"><span className="text-[#9C9A92]">Khata</span><span className="font-bold">{formatINR(c.creditsPaise)}</span></div>
          {c.onAccountPaise > 0 && <div className="flex justify-between py-1"><span className="text-[#9C9A92]">Advance</span><span className="font-bold text-[#1B7A3D]">-{formatINR(c.onAccountPaise)}</span></div>}
        </div>
      </section>

      {fup && (
        <div className="mt-3 flex items-center justify-between rounded-[1.5rem] bg-[#F5C818] p-4 text-[#1A181C]">
          <span>
            <span className="block text-sm font-extrabold">Aaj ka kaam: {CHANNEL_LABEL[fup.action]}</span>
            <span className="block text-[11px] font-semibold opacity-70">{fup.number} · {fup.daysOverdue} din late</span>
          </span>
          <span className="text-lg font-extrabold">{formatINR(fup.outstandingPaise)}</span>
        </div>
      )}

      {/* open invoices */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-extrabold tracking-tight">Khuli bills</h2>
        <ul className="space-y-2.5">
          {c.openInvoices.map((inv) => (
            <li key={inv.id} className="rounded-[1.5rem] bg-white p-4 ring-1 ring-[#E5E3DC]">
              <div className="flex items-center justify-between">
                <Link href={`/invoices/${inv.id}`} className="min-w-0">
                  <p className="truncate text-sm font-bold">{inv.number}</p>
                  <p className="text-[11px] text-[#9C9A92]">{formatDateIN(inv.invoiceDate)} → due {formatDateIN(inv.dueDate)}</p>
                </Link>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold">{formatINR(inv.outstanding)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor[inv.status]}`}>{statusLabel[inv.status]}{inv.daysOverdue > 0 ? ` · ${inv.daysOverdue}d` : ''}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => nudge(inv)} className="rounded-full bg-[#1B7A3D] px-4 py-2 text-[11px] font-bold text-white transition active:scale-95">💬 WhatsApp + pay link</button>
                <Link href={`/letter/${inv.id}`} className="rounded-full bg-[#EDE7FE] px-4 py-2 text-[11px] font-bold text-[#6D28D9] transition active:scale-95">📄 Letter</Link>
                {inv.status === 'disputed' && <span className="rounded-full bg-[#EDE7FE] px-4 py-2 text-[11px] font-bold text-[#6D28D9]">vivadadit — paused</span>}
              </div>
            </li>
          ))}
          {!c.openInvoices.length && <li className="rounded-[1.5rem] bg-white p-5 text-center text-sm text-[#9C9A92] ring-1 ring-[#E5E3DC]">Sab clear! 🎉</li>}
        </ul>
      </section>

      {/* timeline */}
      {events.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-extrabold tracking-tight">Timeline</h2>
          <ul className="rounded-[1.5rem] bg-white px-4 ring-1 ring-[#E5E3DC]">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-[#F2F0EA] py-2.5 text-xs last:border-0">
                <span className="font-semibold text-[#6B6960]">
                  {e.kind === 'reminder_sent' ? '💬 Reminder bheja' : e.kind === 'dispute_raised' ? '⚠️ Vivad raise hua' : e.kind === 'promise' ? '🤝 Wada hua' : e.kind}
                </span>
                <span className="text-[#9C9A92]">{formatDateIN(e.created_at.slice(0, 10))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default function CustomerPage(props) {
  return <AuthGate><CustomerDetail {...props} /></AuthGate>;
}
