'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loadBook, statusColor, statusLabel } from '../../lib/data.js';
import { formatINR, formatDateIN } from '../../engine/index.js';
import { Avatar, Icon } from '../../components/ui.js';
import { useLang } from '../../lib/lang.js';
import AuthGate from '../../components/AuthGate.js';

function InvoiceList() {
  const { t } = useLang();
  const sp = useSearchParams();
  const filter = sp.get('status');
  const [book, setBook] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { loadBook().then(setBook).catch(() => {}); }, []);

  if (!book) return <main className="mx-auto max-w-3xl p-6 text-[#9C9A92]">Loading…</main>;

  const names = new Map(book.customers.map((c) => [c.id, c.name]));
  let rows = book.invoices;
  if (filter) rows = rows.filter((i) => i.status === filter);
  if (q) rows = rows.filter((i) => ((i.number ?? 'draft') + ' ' + (names.get(i.customerId) ?? '')).toLowerCase().includes(q.toLowerCase()));

  const openDue = rows.reduce((s, i) => s + (i.status !== 'paid' ? i.outstanding : 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9C9A92]">{t('navKhata')}</p>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t('invTitle')}</h1>
          <p className="mt-0.5 text-xs font-semibold text-[#9C9A92]">{rows.length} bills · baaki {formatINR(openDue)}</p>
        </div>
        <Link href="/invoices/new" className="flex items-center gap-1.5 rounded-full bg-[#F5C818] px-4 py-3 text-xs font-extrabold text-[#1A181C] shadow-[0_12px_28px_-14px_rgba(245,200,24,0.9)] transition active:scale-95">
          <Icon name="plus" className="h-4 w-4" /> {t('newBill')}
        </Link>
      </header>

      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 ring-1 ring-[#E5E3DC]">
        <Icon name="search" className="h-4 w-4 text-[#B5B3AA]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number ya customer search…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#B5B3AA]" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link href="/invoices" className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${!filter ? 'bg-[#1A181C] text-white' : 'bg-white text-[#6B6960] ring-1 ring-[#E5E3DC]'}`}>
          Sab
        </Link>
        {['overdue', 'due_soon', 'part_paid', 'paid', 'disputed', 'draft'].map((s) => (
          <Link key={s} href={`/invoices?status=${s}`} className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${filter === s ? 'bg-[#1A181C] text-white' : statusColor[s]}`}>{statusLabel[s]}</Link>
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {rows.slice(0, 40).map((i) => (
          <li key={i.id}>
            <Link href={`/invoices/${i.id}`} className="flex items-center gap-3 rounded-[1.5rem] bg-white px-4 py-3.5 ring-1 ring-[#E5E3DC] transition hover:ring-[#8B5CF6] active:scale-[0.99]">
              <Avatar name={names.get(i.customerId) ?? '?'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{names.get(i.customerId) ?? '—'}</p>
                <p className="text-[11px] text-[#9C9A92]">{i.number ?? '(draft)'} · {formatDateIN(i.invoiceDate)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-extrabold">{formatINR(i.totalPaise)}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor[i.status]}`}>
                  {statusLabel[i.status]}{i.outstanding > 0 && i.status !== 'paid' ? ` · ${formatINR(i.outstanding)}` : ''}
                </span>
              </div>
              <Icon name="chevron" className="h-4 w-4 shrink-0 text-[#B5B3AA]" />
            </Link>
          </li>
        ))}
        {!rows.length && (
          <li className="rounded-[1.5rem] bg-white p-8 text-center text-sm text-[#9C9A92] ring-1 ring-[#E5E3DC]">
            Kuch nahi mila.<br />
            <Link href="/invoices/new" className="mt-1 inline-block font-bold text-[#6D3FD8]">Nayi bill banaiye →</Link>
          </li>
        )}
      </ul>
    </main>
  );
}

export default function InvoicesPage() {
  return <Suspense><AuthGate><InvoiceList /></AuthGate></Suspense>;
}
