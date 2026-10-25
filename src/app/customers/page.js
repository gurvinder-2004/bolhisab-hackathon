'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadBook } from '../../lib/data.js';
import { formatINR } from '../../engine/index.js';
import { insertCustomer } from '../../lib/actions.js';
import { Avatar, Icon } from '../../components/ui.js';
import { useLang } from '../../lib/lang.js';
import AuthGate from '../../components/AuthGate.js';

const GRADE_COLOR = {
  A: 'bg-[#E7F6EC] text-[#1B7A3D]', B: 'bg-[#FDF3C7] text-[#8A6D00]',
  C: 'bg-[#FDE7E4] text-[#C4392C]', '-': 'bg-[#F2F0EA] text-[#9C9A92]',
};

function Customers() {
  const router = useRouter();
  const { t } = useLang();
  const [book, setBook] = useState(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', area: '', city: '' });

  const reload = () => loadBook().then(setBook).catch(() => {});
  useEffect(() => { reload(); }, []);

  const saveCustomer = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await insertCustomer(form);
      setForm({ name: '', phone: '', area: '', city: '' });
      setAdding(false);
      reload();
    } finally { setBusy(false); }
  };

  if (!book) return <main className="mx-auto max-w-3xl p-6 text-[#9C9A92]">Loading…</main>;

  const rows = book.customers
    .filter((c) => (c.name + ' ' + (c.area ?? '') + ' ' + (c.city ?? '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.balancePaise - a.balancePaise);
  const totalBaaki = book.customers.reduce((s, c) => s + Math.max(0, c.balancePaise), 0);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9C9A92]">{t('navCustomers')}</p>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t('custTitle')}</h1>
          <p className="mt-0.5 text-xs font-semibold text-[#9C9A92]">{rows.length} {t('custSub')} · kul baaki {formatINR(totalBaaki)}</p>
        </div>
        <button onClick={() => setAdding(!adding)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#F5C818] px-4 py-3 text-xs font-extrabold text-[#1A181C] shadow-[0_12px_28px_-14px_rgba(245,200,24,0.9)] transition active:scale-95">
          <Icon name="plus" className="h-4 w-4" /> {t('newCustomer')}
        </button>
      </header>

      {adding && (
        <form onSubmit={saveCustomer} className="mb-4 grid grid-cols-2 gap-2.5 rounded-[1.5rem] bg-white p-4 ring-1 ring-[#E5E3DC]">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Naam *" required
            className="col-span-2 rounded-xl bg-[#F8F7F2] px-3.5 py-2.5 text-sm font-semibold ring-1 ring-[#E5E3DC] outline-none placeholder:font-normal placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" inputMode="tel"
            className="rounded-xl bg-[#F8F7F2] px-3.5 py-2.5 text-sm ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
          <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Area"
            className="rounded-xl bg-[#F8F7F2] px-3.5 py-2.5 text-sm ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
          <div className="col-span-2 flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="flex-1 rounded-xl bg-[#F2F0EA] py-2.5 text-xs font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] active:scale-95">Cancel</button>
            <button type="submit" disabled={busy || !form.name.trim()}
              className="flex-[2] rounded-xl bg-[#1A181C] py-2.5 text-xs font-extrabold text-white active:scale-95 disabled:opacity-50">
              {busy ? 'Ban raha…' : 'Khaata banao'}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 ring-1 ring-[#E5E3DC]">
        <Icon name="search" className="h-4 w-4 text-[#B5B3AA]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#B5B3AA]" />
      </div>

      <ul className="mt-4 space-y-2.5">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="flex items-center gap-3 rounded-[1.5rem] bg-white px-4 py-3.5 ring-1 ring-[#E5E3DC] transition hover:ring-[#8B5CF6] active:scale-[0.99]">
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {c.name}
                  {c.area ? <span className="font-medium text-[#9C9A92]"> · {c.area}</span> : null}
                </p>
                <p className="text-[11px] text-[#9C9A92]">{c.openInvoices.length} khuli bill{c.onAccountPaise > 0 ? ' · advance jama' : ''}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${GRADE_COLOR[c.grade] ?? GRADE_COLOR['-']}`}>{c.grade}</span>
                <span className={`text-sm font-extrabold ${c.balancePaise > 0 ? 'text-[#C4392C]' : 'text-[#1B7A3D]'}`}>{formatINR(c.balancePaise)}</span>
              </div>
              <Icon name="chevron" className="h-4 w-4 shrink-0 text-[#B5B3AA]" />
            </Link>
          </li>
        ))}
        {!rows.length && <li className="rounded-[1.5rem] bg-white p-8 text-center text-sm text-[#9C9A92] ring-1 ring-[#E5E3DC]">Koi nahi mila.</li>}
      </ul>
    </main>
  );
}

export default function CustomersPage() {
  return <AuthGate><Customers /></AuthGate>;
}
