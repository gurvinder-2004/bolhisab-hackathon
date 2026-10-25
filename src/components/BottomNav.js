'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui.js';
import { useLang } from '../lib/lang.js';

// Mobile: floating dark pill. Active tab = yellow ring; center mic = black, solid yellow icon.
const LEFT = [
  { href: '/dashboard', label: 'navHome', icon: 'home' },
  { href: '/invoices', label: 'navKhata', icon: 'book' },
];
const RIGHT = [
  { href: '/customers', label: 'navCustomers', icon: 'users' },
  { href: '/money', label: 'navPaisa', icon: 'chart' },
];

export default function BottomNav() {
  const path = usePathname();
  const { t } = useLang();
  if (path.startsWith('/pay/') || path.startsWith('/letter/') || path === '/' || path.startsWith('/login')) return null;
  const active = (href) => (href === '/bolo' ? path === '/bolo' : path.startsWith(href));

  const Item = ({ tab }) => (
    <Link href={tab.href} className={`flex w-14 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-bold transition
      ${active(tab.href) ? 'text-white ring-2 ring-[#F5C818]' : 'text-white/60'}`}>
      <Icon name={tab.icon} className="h-5 w-5" />
      {t(tab.label)}
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 md:hidden print:hidden">
      <div className="flex items-center gap-1 rounded-full bg-[#1A181C] p-1.5 shadow-[0_18px_40px_-12px_rgba(26,24,28,0.55)]">
        {LEFT.map((tab) => <Item key={tab.href} tab={tab} />)}
        <Link href="/bolo" aria-label={t('navBolo')}
          className={`mx-0.5 flex h-14 w-14 items-center justify-center rounded-full transition
          ${path === '/bolo' ? 'bg-white/10 text-[#F5C818] ring-2 ring-[#F5C818]' : 'bg-black/30 text-[#F5C818]'}`}>
          <Icon name="mic" className="h-6 w-6" />
        </Link>
        {RIGHT.map((tab) => <Item key={tab.href} tab={tab} />)}
      </div>
    </nav>
  );
}
