'use client';

// Client-side gate for the owner app. Landing (/), /login, /pay/*, /letter/* stay public.
// (Demo build: the data layer is intentionally open — documented in the README —
// this gate is the product-level login both web and the Android shell use.)

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase.js';

export default function AuthGate({ children }) {
  const router = useRouter();
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      if (data?.session?.user) setOk(true);
      else router.replace('/login');
    });
    return () => { live = false; };
  }, [router]);
  if (!ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F2F0EA]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-192.png" alt="BolHisab" width={56} height={56} className="animate-pulse rounded-2xl" />
      </main>
    );
  }
  return children;
}
