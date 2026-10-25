'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadBook } from '../../lib/data.js';
import { formatINR } from '../../engine/index.js';
import { Avatar, Icon } from '../../components/ui.js';

const GRADE_COLOR = {
  A: 'bg-[#E7F6EC] text-[#1B7A3D]', B: 'bg-[#FDF3C7] text-[#8A6D00]',
  C: 'bg-[#FDE7E4] text-[#C4392C]', '-': 'bg-[#F2F0EA] text-[#9C9A92]',
};

export default function Customers() {
  const [book, setBook] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { loadBook().then(setBook).catch(() => {}); }, []);
  if (!book) return <main className="mx-auto max-w-3xl p-6 text-[#9C9A92]">Loading…</main>;

  const rows = book.customers
    .filter((c) => (c.name + ' ' + (c.area ?? '') + ' ' + (c.city ?? '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.balancePaise - a.balancePaise);
  const totalBaaki = book.customers.reduce((s, c) => s + Math.max(0, c.balancePaise), 0);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      <header className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9C9A92]">Log</p>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Customers</h1>
        <p className="mt-0.5 text-xs font-semibold text-[#9C9A92]">{rows.length} log · kul baaki {formatINR(totalBaaki)}</p>
      </header>

      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 ring-1 ring-[#E5E3DC]">
        <Icon name="search" className="h-4 w-4 text-[#B5B3AA]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam ya area khojein…"
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
                <span className={`text-sm font-extrabold ${c.balancePaise > 0 ? 'text-[#6D3FD8]' : 'text-[#1B7A3D]'}`}>{formatINR(c.balancePaise)}</span>
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
