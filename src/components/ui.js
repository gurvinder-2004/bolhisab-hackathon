'use client';

// BolHisab design kit — cream canvas, near-black surfaces, yellow + violet triad.
// Presentational only; every screen's logic lives in its own page.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// ---------- icons (stroke 1.8, round caps — matches the reference set) ----------
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 5.5V20.5M20 18v3H6.5',
  users: 'M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19M9.5 9.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM21 19v-1.5a4 4 0 0 0-3-3.87M16.5 3.13a4 4 0 0 1 0 7.75',
  chart: 'M4 20h16M7 16V9M12 16V5M17 16v-4',
  bell: 'M18 9a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9ZM10 19.5a2.2 2.2 0 0 0 4 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5 16 16',
  downLeft: 'M17 7 7 17M7 9v8h8',
  upRight: 'M7 17 17 7M9 7h8v8',
  chevron: 'm9 5 7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18v2.5M3 7.5V17a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5ZM16.5 13.5h.01',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z',
};

export function Icon({ name, className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------- avatar chips ----------
const AV_TONES = [
  'bg-[#F5C818] text-[#1A181C]',
  'bg-[#DDD0FA] text-[#4A2FA6]',
  'bg-[#1A181C] text-white',
  'bg-[#FDE3C4] text-[#8A4B00]',
];
const initials = (name = '?') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export function Avatar({ name = '?', className = 'w-11 h-11 text-sm' }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${AV_TONES[h % AV_TONES.length]} ${className}`}>
      {initials(name)}
    </span>
  );
}

// ---------- desktop sidebar ----------
const NAV = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/invoices', label: 'Khata', icon: 'book' },
  { href: '/customers', label: 'Log', icon: 'users' },
  { href: '/money', label: 'Paisa', icon: 'chart' },
];

export function Sidebar() {
  const path = usePathname();
  const [biz, setBiz] = useState(null);
  useEffect(() => {
    let live = true;
    supabase.from('businesses').select('name, owner_name').limit(1)
      .then(({ data }) => { if (live) setBiz(data?.[0] ?? null); });
    return () => { live = false; };
  }, []);
  if (path.startsWith('/pay/') || path.startsWith('/letter/')) return null;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col bg-[#1C1A1F] p-5 md:flex print:hidden">
      <Link href="/" className="flex items-center gap-3 px-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-192.png" alt="BolHisab" width={44} height={44} className="rounded-2xl" />
        <span>
          <span className="block text-lg font-extrabold tracking-tight text-white">BolHisab</span>
          <span className="block text-[11px] font-medium text-white/50">Hisab ab Bolkar</span>
        </span>
      </Link>

      <Link href="/" className={`mt-8 flex items-center gap-3 rounded-full px-4 py-3 text-sm font-bold transition
          ${path === '/' ? 'bg-[#F5C818] text-[#1A181C]' : 'bg-white/5 text-white hover:bg-white/10'}`}>
        <Icon name="mic" className="h-5 w-5" />
        Bolo — voice entry
      </Link>

      <nav className="mt-3 flex flex-col gap-1">
        {NAV.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition
                ${active ? 'bg-[#F5C818] text-[#1A181C]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Icon name={t.icon} className="h-5 w-5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/5 p-3">
        <Avatar name={biz?.owner_name || biz?.name || 'RS'} className="h-10 w-10 text-xs" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">{biz?.owner_name || 'Owner'}</span>
          <span className="block truncate text-[11px] text-white/50">{biz?.name || 'Business'}</span>
        </span>
      </div>
    </aside>
  );
}

// ---------- small shared pieces ----------
export function Eyebrow({ children, className = '' }) {
  return <p className={`text-[11px] font-bold uppercase tracking-[0.14em] text-[#9C9A92] ${className}`}>{children}</p>;
}

export function StatCard({ tone = 'white', icon, label, value, sub, iconBg }) {
  const tones = {
    yellow: 'bg-[#F5C818] text-[#1A181C]',
    violet: 'bg-[#8B5CF6] text-white',
    white: 'bg-white text-[#1A181C] ring-1 ring-[#E5E3DC]',
  };
  return (
    <div className={`rounded-3xl p-4 shadow-[0_10px_30px_-18px_rgba(26,24,28,0.35)] ${tones[tone]}`}>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${iconBg ?? (tone === 'white' ? 'bg-[#F2F0EA]' : 'bg-black/10')}`}>
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <p className={`mt-3 text-[11px] font-bold uppercase tracking-[0.1em] ${tone === 'white' ? 'text-[#9C9A92]' : 'opacity-70'}`}>{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className={`mt-0.5 text-[11px] font-medium ${tone === 'white' ? 'text-[#9C9A92]' : 'opacity-70'}`}>{sub}</p>}
    </div>
  );
}

export const HINDI_WEEKDAYS = ['RAVIVAAR', 'SOMVAAR', 'MANGALVAAR', 'BUDHVAAR', 'GURUVAAR', 'SHUKRAVAAR', 'SHANIVAAR'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function dateEyebrow(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${HINDI_WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
