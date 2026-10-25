'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui.js';

// Mobile: floating dark pill with a raised yellow mic in the center.
// Desktop takes over via the sidebar (this nav hides at md+).
const LEFT = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/invoices', label: 'Khata', icon: 'book' },
];
const RIGHT = [
  { href: '/customers', label: 'Log', icon: 'users' },
  { href: '/money', label: 'Paisa', icon: 'chart' },
];

export default function BottomNav() {
  const path = usePathname();
  if (path.startsWith('/pay/') || path.startsWith('/letter/')) return null;
  const active = (t) => (t.href === '/' ? path === '/' : path.startsWith(t.href));

  const Item = ({ t }) => (
    <Link href={t.href} className={`flex w-14 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-bold
      ${active(t) ? 'bg-[#F5C818] text-[#1A181C]' : 'text-white/60'}`}>
      <Icon name={t.icon} className="h-5 w-5" />
      {t.label}
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 md:hidden print:hidden">
      <div className="flex items-center gap-1 rounded-full bg-[#1A181C] p-1.5 shadow-[0_18px_40px_-12px_rgba(26,24,28,0.55)]">
        {LEFT.map((t) => <Item key={t.href} t={t} />)}
        <Link href="/" aria-label="Bolo — voice entry"
          className={`mx-0.5 -my-3 flex h-14 w-14 items-center justify-center rounded-full transition
          ${path === '/' ? 'bg-white text-[#1A181C]' : 'bg-[#F5C818] text-[#1A181C]'}`}>
          <Icon name="mic" className="h-6 w-6" />
        </Link>
        {RIGHT.map((t) => <Item key={t.href} t={t} />)}
      </div>
    </nav>
  );
}
