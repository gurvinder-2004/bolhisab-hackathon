'use client';

// Login for the owner app (web + Android shell). Free auth via Supabase email+password.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase.js';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const signIn = async (e) => {
    e?.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.push('/dashboard');
    } catch (e2) {
      setErr(e2.message === 'Invalid login credentials' ? 'Galat email ya password.' : e2.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F0EA] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-[2rem] bg-white p-7 shadow-[0_30px_70px_-40px_rgba(26,24,28,0.5)] ring-1 ring-[#E5E3DC]">
          <div className="flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-192.png" alt="BolHisab" width={56} height={56} />
            <h1 className="mt-3 text-xl font-extrabold tracking-tight">Bol<span className="text-[#D99C00]">Hisab</span></h1>
            <p className="text-xs font-semibold text-[#9C9A92]">हिसाब अब बोलकर — apne dashboard mein aaiye</p>
          </div>

          <form onSubmit={signIn} className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email"
              className="w-full rounded-2xl bg-[#F8F7F2] px-4 py-3.5 text-sm font-semibold ring-1 ring-[#E5E3DC] outline-none placeholder:font-normal placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password"
              className="w-full rounded-2xl bg-[#F8F7F2] px-4 py-3.5 text-sm font-semibold ring-1 ring-[#E5E3DC] outline-none placeholder:font-normal placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
            {err && <p className="rounded-xl bg-[#FDE7E4] px-3 py-2 text-xs font-bold text-[#C4392C]">{err}</p>}
            <button type="submit" disabled={busy}
              className="w-full rounded-2xl bg-[#F5C818] py-3.5 text-sm font-extrabold text-[#1A181C] shadow-[0_14px_30px_-14px_rgba(245,200,24,0.9)] transition active:scale-[0.98] disabled:opacity-50">
              {busy ? 'Login ho raha…' : 'Login → Dashboard'}
            </button>
          </form>

          <div className="mt-5 rounded-2xl bg-[#F8F7F2] p-3 text-center ring-1 ring-[#E5E3DC]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9C9A92]">Judges / demo account</p>
            <button type="button" onClick={() => { setEmail('bolhisab.judges@gmail.com'); setPassword('bolhisab-demo'); }}
              className="mt-1 text-xs font-bold text-[#6D3FD8] active:underline">
              bolhisab.judges@gmail.com · bolhisab-demo <span className="text-[#9C9A92]">(tap to fill)</span>
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-[#9C9A92]">
          <Link href="/" className="active:underline">← BolHisab home</Link>
        </p>
      </div>
    </main>
  );
}
