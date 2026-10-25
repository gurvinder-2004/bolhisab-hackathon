'use client';

// BolHisab landing — pure white, animated hero, two doors: Web Dashboard and APK.

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon, LangMenu, LangSwitch } from '../components/ui.js';
import { useLang } from '../lib/lang.js';

// feature copy comes from the language dictionary (f1t/f1b … f4t/f4b)
const FEATURE_ICONS = [
  { icon: 'mic', tint: 'bg-[#FDF3C7] text-[#8A6D00]', t: 'f1t', b: 'f1b' },
  { icon: 'book', tint: 'bg-[#DDD0FA] text-[#4A2FA6]', t: 'f2t', b: 'f2b' },
  { icon: 'bell', tint: 'bg-[#FDE7E4] text-[#C4392C]', t: 'f3t', b: 'f3b' },
  { icon: 'chart', tint: 'bg-[#E0EBFB] text-[#2058C8]', t: 'f4t', b: 'f4b' },
];

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <div className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
  );
}

export default function Landing() {
  const { t } = useLang();
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-white text-[#1A181C]">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-[#F0EEE8] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-192.png" alt="BolHisab" width={36} height={36} />
            <span className="text-lg font-extrabold tracking-tight">Bol<span className="text-[#D99C00]">Hisab</span></span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#6B6960] md:flex">
            <a href="#features" className="transition hover:text-[#1A181C]">Features</a>
            <a href="#how" className="transition hover:text-[#1A181C]">How it works</a>
            <a href="#download" className="transition hover:text-[#1A181C]">Download</a>
          </nav>
          <span className="sm:hidden"><LangMenu /></span>
          <span className="hidden sm:inline-flex"><LangSwitch /></span>
          <Link href="/login" className="rounded-full bg-[#1A181C] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-black active:scale-95 sm:px-5">
            {t('ctaWeb')}
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-24 h-96 w-96 rounded-full bg-[#F5C818]/20 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-[#8B5CF6]/15 blur-3xl animate-blob" style={{ animationDelay: '-7s' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F8F7F2] px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6B6960] ring-1 ring-[#E5E3DC]">
                🎙 Voice-first khata for Indian manufacturers
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                {t('heroH1a')}{' '}
                <span className="text-[#D99C00]">{t('heroH1b')}</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-[#6B6960]">
                {t('landingSub')}
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="rounded-full bg-[#F5C818] px-7 py-4 text-sm font-extrabold text-[#1A181C] shadow-[0_16px_36px_-14px_rgba(245,200,24,0.9)] transition hover:scale-[1.03] active:scale-95">
                  Web Dashboard →
                </Link>
                <a href="/bolhisab.apk" className="flex items-center gap-2 rounded-full bg-[#1A181C] px-7 py-4 text-sm font-extrabold text-white transition hover:scale-[1.03] active:scale-95">
                  <Icon name="download" className="h-4 w-4" /> {t('ctaApk')}
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-7 flex flex-wrap gap-2 text-[11px] font-bold text-[#9C9A92]">
                {['Hinglish', 'हिंदी', 'English', 'GST-ready', 'UPI QR'].map((c) => (
                  <span key={c} className="rounded-full bg-[#F8F7F2] px-3 py-1.5 ring-1 ring-[#E5E3DC]">{c}</span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* hero visual: mic + pulse rings + floating cards */}
          <Reveal delay={200} className="relative mx-auto hidden h-[420px] w-full max-w-md md:block">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="hero-ring absolute h-40 w-40 rounded-full bg-[#F5C818]/40" />
              <div className="hero-ring absolute h-40 w-40 rounded-full bg-[#F5C818]/40" style={{ animationDelay: '1.2s' }} />
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-[#F5C818] shadow-[0_30px_60px_-20px_rgba(245,200,24,0.8)]">
                <Icon name="mic" className="h-16 w-16 text-[#1A181C]" />
              </div>
            </div>
            {/* waveform */}
            <div className="absolute bottom-2 left-1/2 flex h-10 -translate-x-1/2 items-center gap-1.5">
              {[0.9, 0.4, 1.1, 0.7, 1.3, 0.5, 1, 0.8, 1.2, 0.6].map((d, i) => (
                <span key={i} className="wave-bar h-8 w-1.5 rounded-full bg-[#8B5CF6]/70" style={{ animationDuration: `${d}s` }} />
              ))}
            </div>
            {/* floating cards */}
            <div className="animate-floaty absolute left-0 top-6 w-52 rounded-2xl bg-white p-3.5 shadow-[0_20px_44px_-20px_rgba(26,24,28,0.35)] ring-1 ring-[#E5E3DC]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9C9A92]">Sun raha hoon…</p>
              <p className="mt-1 text-sm font-bold">“Sharma ji ne 110 ki sabji, 90 ka tel…”</p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-extrabold text-[#1B7A3D]">✓ Bill ₹200 saved</p>
            </div>
            <div className="animate-floaty-slow absolute bottom-24 left-2 w-44 rounded-2xl bg-[#141216] p-3.5 text-white shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Aapko milega</p>
              <p className="text-xl font-extrabold text-[#FF9D93]">₹11,24,580</p>
              <p className="text-[10px] text-white/40">Aaj ke follow-ups: 5</p>
            </div>
            <div className="animate-floaty absolute right-0 top-28 w-40 rounded-2xl bg-white p-3.5 shadow-[0_20px_44px_-20px_rgba(26,24,28,0.35)] ring-1 ring-[#E5E3DC]" style={{ animationDelay: '-2.5s' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9C9A92]">Payment aaya</p>
              <p className="mt-0.5 text-lg font-extrabold text-[#1B7A3D]">+₹5,000</p>
              <p className="text-[10px] text-[#9C9A92]">UPI · Patil ji</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* stats strip */}
      <section className="border-y border-[#F0EEE8] bg-[#FCFBF8]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 text-center md:grid-cols-4">
          {[['3 sec', 'mein entry'], ['6 cases', 'bank matching'], ['13 weeks', 'cash forecast'], ['70+', 'passing tests']].map(([a, b], i) => (
            <Reveal key={a} delay={i * 70}>
              <p className="text-2xl font-extrabold tracking-tight md:text-3xl">{a}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9C9A92]">{b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">{t('featuresTitle')}</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[#6B6960]">Copy-pen aur WhatsApp ke chakkar se azaadi — ek bolti hui khata, sab kuch diary se zyada smart.</p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {FEATURE_ICONS.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="group h-full rounded-[1.75rem] bg-white p-6 ring-1 ring-[#ECEAE2] transition hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(26,24,28,0.35)] hover:ring-[#F5C818]">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${f.tint}`}>
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight">{t(f.t)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6B6960]">{t(f.b)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-y border-[#F0EEE8] bg-[#FCFBF8]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Reveal><h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">{t('howTitle')}</h2></Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              ['1', t('s1t'), t('s1b')],
              ['2', t('s2t'), t('s2b')],
              ['3', t('s3t'), t('s3b')],
            ].map(([n, t, b], i) => (
              <Reveal key={n} delay={i * 100}>
                <div className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F5C818] text-lg font-extrabold text-[#1A181C]">{n}</span>
                  <h3 className="mt-4 text-lg font-extrabold">{t}</h3>
                  <p className="mx-auto mt-1.5 max-w-xs text-sm text-[#6B6960]">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* download CTA */}
      <section id="download" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-[#141216] px-6 py-14 text-center text-white md:py-20">
            <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[#F5C818]/25 blur-3xl animate-blob" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-[#8B5CF6]/25 blur-3xl animate-blob" style={{ animationDelay: '-6s' }} />
            <h2 className="relative text-3xl font-extrabold tracking-tight md:text-5xl">{t('dlTitle')}</h2>
            <p className="relative mx-auto mt-3 max-w-md text-white/60">{t('dlSub')}</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="rounded-full bg-[#F5C818] px-7 py-4 text-sm font-extrabold text-[#1A181C] transition hover:scale-[1.03] active:scale-95">
                {t('ctaWeb')}
              </Link>
              <a href="/bolhisab.apk" className="flex items-center gap-2 rounded-full bg-white/10 px-7 py-4 text-sm font-extrabold text-white ring-1 ring-white/25 transition hover:bg-white/20 active:scale-95">
                <Icon name="download" className="h-4 w-4" /> {t('ctaApk')}
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[#F0EEE8]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-[#9C9A92] md:flex-row">
          <span className="flex items-center gap-2 font-extrabold text-[#1A181C]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-192.png" alt="" width={24} height={24} className="rounded-lg" />
            BolHisab · हिसाब अब बोलकर
          </span>
          <span>Made for India's small manufacturers</span>
        </div>
      </footer>
    </main>
  );
}
