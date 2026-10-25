'use client';

// Home — greeting header, purple voice hero, black balance card, snapshot stats,
// latest hisab, follow-ups, ageing. Realtime kept intact.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase.js';
import { loadBook } from '../../lib/data.js';
import { formatINR } from '../../engine/index.js';
import { CHANNEL_LABEL } from '../../domain/chase.js';
import { Avatar, Eyebrow, Icon, LangMenu, dateEyebrow } from '../../components/ui.js';
import { useLang } from '../../lib/lang.js';
import AuthGate from '../../components/AuthGate.js';

const AGE_LABELS = { not_due: 'Due nahi', '1-30': '1–30 din', '31-60': '31–60 din', '61-90': '61–90 din', '90+': '90+' };
const AGE_BAR = { not_due: '#DDD0FA', '1-30': '#F5C818', '31-60': '#E0A81F', '61-90': '#E88A5A', '90+': '#F05A4F' };

const dayOf = (isoLike) => String(isoLike || '').slice(0, 10);

function Dashboard() {
  const { t } = useLang();
  const [book, setBook] = useState(null);
  const [err, setErr] = useState(null);

  const refresh = useCallback(async () => {
    try { setBook(await loadBook()); setErr(null); } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase.channel('live-book')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  const derived = useMemo(() => {
    if (!book) return null;
    const today = book.today;
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 1);
    const kal = dayOf(d.toISOString());
    const custName = (id) => book.customers.find((c) => c.id === id)?.name ?? '—';
    const aajMila = book.payments.filter((p) => dayOf(p.paid_on) === today).reduce((s, p) => s + p.amount_paise, 0);
    const kalMila = book.payments.filter((p) => dayOf(p.paid_on) === kal).reduce((s, p) => s + p.amount_paise, 0);
    const aajDiya = book.creditEntries.filter((c) => dayOf(c.created_at) === today).reduce((s, c) => s + c.amount_paise, 0);
    const rows = [
      ...book.payments.map((p) => ({ id: `p${p.id}`, kind: 'payment', name: custName(p.customer_id), paise: p.amount_paise, when: p.paid_on })),
      ...book.creditEntries.map((c) => ({ id: `c${c.id}`, kind: 'credit', name: custName(c.customer_id), paise: c.amount_paise, when: c.created_at, note: c.note })),
    ].sort((a, b) => (a.when < b.when ? 1 : -1)).slice(0, 5);
    return { aajMila, kalMila, aajDiya, rows, kal };
  }, [book]);

  if (err) return <main className="mx-auto max-w-3xl p-6 text-[#C4392C]">Load nahi hua: {err}</main>;
  if (!book || !derived) return <main className="mx-auto max-w-3xl p-6 text-[#9C9A92]">Loading…</main>;

  const firstName = (book.business?.owner_name || book.business?.name || 'Boss').trim().split(/\s+/)[0];
  const age = book.ageing;
  const ageMax = Math.max(1, ...Object.values(age));

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      {/* ---------- header ---------- */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Eyebrow>{dateEyebrow(book.today)}</Eyebrow>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Namaste, {firstName}! <span className="align-middle text-2xl">👋</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/customers" className="hidden items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-[#9C9A92] ring-1 ring-[#E5E3DC] md:flex">
            <Icon name="search" className="h-4 w-4" /> {t('search')}
          </Link>
          <Link href="#followups" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-[#E5E3DC]">
            <Icon name="bell" className="h-5 w-5" />
            {!!book.followUps.length && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#F05A4F] ring-2 ring-white" />}
          </Link>
          <span className="md:hidden"><LangMenu /></span>
          <span className="md:hidden"><Avatar name={book.business?.owner_name || book.business?.name || 'B'} className="h-11 w-11 text-xs" /></span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        {/* ---------- voice hero ---------- */}
        <section className="voice-hero relative flex flex-col justify-between overflow-hidden rounded-[2rem] p-6 text-white md:p-7">
          <div className="max-w-[70%]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
              <Icon name="sparkle" className="h-3.5 w-3.5" /> AI Voice Entry
            </span>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight md:text-[2rem]">{t('hero')}</h2>
            <p className="mt-2 text-sm font-medium text-white/70">{t('heroSub')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Hinglish', 'हिंदी', 'English'].map((l) => (
                <span key={l} className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white/85">{l}</span>
              ))}
            </div>
          </div>
          <Link href="/bolo" aria-label="Bolo"
            className="absolute bottom-6 right-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#F5C818] text-[#1A181C] shadow-[0_16px_36px_-10px_rgba(0,0,0,0.45)] transition hover:scale-105 active:scale-95 md:h-24 md:w-24">
            <Icon name="mic" className="h-9 w-9 md:h-10 md:w-10" />
          </Link>
        </section>

        {/* ---------- balance card (dues = red) ---------- */}
        <section className="flex flex-col justify-between rounded-[2rem] bg-[#141216] p-6 text-white">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">{t('collect')}</p>
            <span className="text-white/40">···</span>
          </div>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-[#FF9D93] md:text-[2.75rem] md:leading-none">{formatINR(book.toCollectPaise)}</p>
          <div className="mt-6 space-y-3 border-t border-white/10 pt-4 text-sm">
            <Link href="/invoices?status=overdue" className="flex items-center justify-between rounded-2xl px-2 py-1.5 transition hover:bg-white/5">
              <span className="flex items-center gap-3 text-white/75">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F05A4F]/20 text-[#FF9D93]"><Icon name="bell" className="h-4 w-4" /></span>
                {t('overdue')}
              </span>
              <span className="font-extrabold text-[#FF9D93]">{formatINR(book.overduePaise)}</span>
            </Link>
            <Link href="/invoices?status=due_soon" className="flex items-center justify-between rounded-2xl px-2 py-1.5 transition hover:bg-white/5">
              <span className="flex items-center gap-3 text-white/75">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6]/25 text-[#B79BFA]"><Icon name="upRight" className="h-4 w-4" /></span>
                {t('weekDue')}
              </span>
              <span className="font-extrabold text-[#FF9D93]">{formatINR(book.dueThisWeekPaise)}</span>
            </Link>
          </div>
        </section>
      </div>

      {/* ---------- snapshot (received = green, credit given = red) ---------- */}
      <section className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-white p-4 ring-1 ring-[#E5E3DC]">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#E7F6EC] text-[#1B7A3D]"><Icon name="downLeft" className="h-4 w-4" /></span>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9C9A92]">{t('aajMila')}</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#1B7A3D]">{formatINR(derived.aajMila)}</p>
          <p className="mt-0.5 text-[11px] font-medium text-[#9C9A92]">
            {derived.aajMila >= derived.kalMila ? `Kal se +${formatINR(derived.aajMila - derived.kalMila)}` : `Kal se −${formatINR(derived.kalMila - derived.aajMila)}`}
          </p>
        </div>
        <div className="rounded-3xl bg-white p-4 ring-1 ring-[#E5E3DC]">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FDE7E4] text-[#C4392C]"><Icon name="upRight" className="h-4 w-4" /></span>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9C9A92]">{t('aajUdhaar')}</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#C4392C]">{formatINR(derived.aajDiya)}</p>
          <p className="mt-0.5 text-[11px] font-medium text-[#9C9A92]">{derived.aajDiya ? 'Naya maal gaya' : 'Aaj kuch nahi'}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 ring-1 ring-[#E5E3DC]">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F2F0EA] text-[#1A181C]"><Icon name="users" className="h-4 w-4" /></span>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9C9A92]">{t('totalCust')}</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight">{String(book.customers.length)}</p>
          <p className="mt-0.5 text-[11px] font-medium text-[#9C9A92]">Khata chal rahi hai</p>
        </div>
        <div className="rounded-3xl bg-[#F5C818] p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-black/10 text-[#1A181C]"><Icon name="bell" className="h-4 w-4" /></span>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] opacity-70">{t('chaseAaj')}</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight">{String(book.followUps.length)}</p>
          <p className="mt-0.5 text-[11px] font-medium opacity-70">Reminder bhejein</p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* ---------- latest hisab ---------- */}
        <section className="rounded-[1.75rem] bg-white p-5 ring-1 ring-[#E5E3DC]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-extrabold tracking-tight">{t('latest')}</h2>
            <Link href="/customers" className="text-xs font-bold text-[#6D3FD8]">{t('viewAll')} →</Link>
          </div>
          {derived.rows.length ? derived.rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-[#F2F0EA] py-2.5 last:border-0">
              <Avatar name={r.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.name}</p>
                <p className="text-[11px] text-[#9C9A92]">
                  {r.kind === 'payment' ? 'Payment aaya' : 'Udhaar diya'}{r.note ? ` · ${r.note}` : ''} · {dayOf(r.when) === book.today ? 'Aaj' : dayOf(r.when) === derived.kal ? 'Kal' : dayOf(r.when)}
                </p>
              </div>
              <p className={`shrink-0 text-sm font-extrabold ${r.kind === 'payment' ? 'text-[#1B7A3D]' : 'text-[#C4392C]'}`}>
                {r.kind === 'payment' ? '+' : ''}{formatINR(r.paise)}
              </p>
            </div>
          )) : <p className="py-6 text-center text-sm text-[#9C9A92]">Abhi koi entry nahi. Bolkar shuru karein!</p>}
        </section>

        {/* ---------- follow-ups ---------- */}
        <section id="followups" className="rounded-[1.75rem] bg-white p-5 ring-1 ring-[#E5E3DC]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-extrabold tracking-tight">{t('followups')}</h2>
            <span className="text-xs font-semibold text-[#9C9A92]">{book.followUps.length} pending</span>
          </div>
          {book.followUps.slice(0, 5).map((f) => (
            <div key={f.invoiceId} className="flex items-center gap-3 border-b border-[#F2F0EA] py-2.5 last:border-0">
              <Avatar name={f.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{f.name} <span className="font-medium text-[#9C9A92]">· {f.area || f.city || ''}</span></p>
                <p className="flex items-center gap-1.5 text-[11px] text-[#9C9A92]">
                  <span className="font-bold text-[#C4392C]">{f.daysOverdue} din late</span> · {f.number}
                  <span className={`rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide
                    ${f.action === 'whatsapp' ? 'bg-[#E7F6EC] text-[#1B7A3D]' : f.action === 'call' ? 'bg-[#FDF3C7] text-[#8A6D00]' : 'bg-[#EDE7FE] text-[#6D28D9]'}`}>
                    {CHANNEL_LABEL[f.action]}
                  </span>
                </p>
              </div>
              <p className="shrink-0 text-sm font-extrabold text-[#C4392C]">{formatINR(f.outstandingPaise)}</p>
              <Link href={`/customers/${f.customerId}`} className="shrink-0 text-[#9C9A92]"><Icon name="chevron" className="h-4 w-4" /></Link>
            </div>
          ))}
          {!book.followUps.length && <p className="py-6 text-center text-sm text-[#9C9A92]">Aaj koi follow-up nahi. 🎉</p>}
        </section>
      </div>

      {/* ---------- ageing ---------- */}
      <section className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-[#E5E3DC]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-extrabold tracking-tight">{t('ageing')}</h2>
          <Link href="/invoices" className="text-xs font-bold text-[#6D3FD8]">Invoices →</Link>
        </div>
        {Object.entries(age).map(([k, v]) => (
          <div key={k} className="mb-2.5 flex items-center gap-3 text-xs last:mb-0">
            <span className="w-16 shrink-0 font-semibold text-[#9C9A92]">{AGE_LABELS[k]}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F2F0EA]">
              <div className="h-full rounded-full" style={{ width: `${Math.round((v / ageMax) * 100)}%`, background: AGE_BAR[k] }} />
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-bold text-[#C4392C]">{formatINR(v)}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return <AuthGate><Dashboard /></AuthGate>;
}
