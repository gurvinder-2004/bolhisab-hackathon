'use client';

// BolHisab design kit — cream canvas, near-black surfaces, yellow + violet triad.
// Presentational only; every screen's logic lives in its own page.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../lib/lang.js';

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
  arrowLeft: 'M19 12H5m7 7-7-7 7-7',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18v2.5M3 7.5V17a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5ZM16.5 13.5h.01',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z',
};

export function Icon({ name, className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------- brand wordmark: "Bol" white + "Hisab" yellow ----------
export function BrandText({ className = 'text-lg' }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-white">Bol</span><span className="text-[#F5C818]">Hisab</span>
    </span>
  );
}

// ---------- back button: a real, visible pill ----------
export function BackLink({ href = '/', label, className = '' }) {
  return (
    <Link href={href}
      className={`no-print inline-flex items-center gap-1.5 rounded-full bg-white py-2 pl-3 pr-4 text-xs font-bold text-[#6B6960] ring-1 ring-[#E5E3DC] shadow-[0_4px_14px_-8px_rgba(26,24,28,0.3)] transition hover:ring-[#8B5CF6] hover:text-[#1A181C] active:scale-95 ${className}`}>
      <Icon name="arrowLeft" className="h-4 w-4" />
      {label}
    </Link>
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

// ---------- language switcher ----------
export function LangSwitch({ dark = false }) {
  const { lang, setLang, t } = useLang();
  const opts = [['hg', 'Hinglish'], ['hi', 'हिंदी'], ['en', 'English']];
  return (
    <div className={`flex items-center gap-1 rounded-full p-1 ${dark ? 'bg-white/5' : 'bg-[#F2F0EA]'}`}>
      {opts.map(([code, label]) => (
        <button key={code} onClick={() => setLang(code)} aria-label={label}
          className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition
            ${lang === code ? 'bg-[#F5C818] text-[#1A181C]' : dark ? 'text-white/50 hover:text-white' : 'text-[#9C9A92] hover:text-[#1A181C]'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------- desktop sidebar ----------
export function Sidebar() {
  const path = usePathname();
  const { t } = useLang();
  const [biz, setBiz] = useState(null);
  const [email, setEmail] = useState(null);
  useEffect(() => {
    let live = true;
    supabase.from('businesses').select('name, owner_name').limit(1)
      .then(({ data }) => { if (live) setBiz(data?.[0] ?? null); });
    supabase.auth.getSession().then(({ data }) => { if (live) setEmail(data?.session?.user?.email ?? null); });
    return () => { live = false; };
  }, []);
  if (path.startsWith('/pay/') || path.startsWith('/letter/') || path === '/' || path.startsWith('/login')) return null;
  const NAV = [
    { href: '/dashboard', label: t('navHome'), icon: 'home' },
    { href: '/invoices', label: t('navKhata'), icon: 'book' },
    { href: '/customers', label: t('navCustomers'), icon: 'users' },
    { href: '/money', label: t('navPaisa'), icon: 'chart' },
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col bg-[#1C1A1F] p-5 md:flex print:hidden">
      <Link href="/dashboard" className="flex items-center gap-3 px-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-192.png" alt="BolHisab" width={44} height={44} className="rounded-2xl" />
        <span>
          <BrandText className="text-lg" />
          <span className="block text-[11px] font-medium text-white/50">Hisab ab Bolkar</span>
        </span>
      </Link>

      <Link href="/bolo" className={`mt-8 flex items-center gap-3 rounded-full px-4 py-3 text-sm font-bold transition
          ${path === '/bolo' ? 'bg-[#F5C818] text-[#1A181C]' : 'bg-white/5 text-white hover:bg-white/10'}`}>
        <Icon name="mic" className="h-5 w-5" />
        {t('navBolo')}
      </Link>

      <nav className="mt-3 flex flex-col gap-1">
        {NAV.map((tab) => {
          const active = path.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition
                ${active ? 'bg-[#F5C818] text-[#1A181C]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Icon name={tab.icon} className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
            <Icon name="globe" className="h-3.5 w-3.5" /> {t('langLabel')}
          </p>
          <LangSwitch dark />
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <Avatar name={biz?.owner_name || biz?.name || 'RS'} className="h-10 w-10 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{biz?.owner_name || 'Owner'}</span>
            <span className="block truncate text-[11px] text-white/50">{email || biz?.name || 'Business'}</span>
          </span>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
            title={t('logout')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-[#F05A4F] hover:text-white active:scale-95">
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------- small shared pieces ----------
export function Eyebrow({ children, className = '' }) {
  return <p className={`text-[11px] font-bold uppercase tracking-[0.14em] text-[#9C9A92] ${className}`}>{children}</p>;
}

export const HINDI_WEEKDAYS = ['RAVIVAAR', 'SOMVAAR', 'MANGALVAAR', 'BUDHVAAR', 'GURUVAAR', 'SHUKRAVAAR', 'SHANIVAAR'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function dateEyebrow(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${HINDI_WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
