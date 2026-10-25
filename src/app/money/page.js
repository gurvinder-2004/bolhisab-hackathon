'use client';

// Paisa page: bank statement import + matching (six cases, TDS flag, confirm-before-paid)
// and the 13-week cash forecast with what-if controls.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadBook } from '../../lib/data.js';
import { importBankPayment } from '../../lib/actions.js';
import { formatINR, formatDateIN } from '../../engine/index.js';
import { parseBankCSV, suggestMatch, buildSampleStatement } from '../../domain/bank.js';
import { forecast, forecastHeadline } from '../../domain/forecast.js';
import { Icon } from '../../components/ui.js';

const TYPE_META = {
  exact: { label: 'Exact match', cls: 'bg-[#E7F6EC] text-[#1B7A3D]' },
  combined: { label: 'Ek jama, kai bills', cls: 'bg-[#E0EBFB] text-[#2058C8]' },
  part: { label: 'Part payment', cls: 'bg-[#FDF3C7] text-[#8A6D00]' },
  on_account: { label: 'Advance / on-account', cls: 'bg-[#EDE7FE] text-[#6D28D9]' },
  tds: { label: 'TDS kata hai', cls: 'bg-[#FDE7E4] text-[#C4392C]' },
  ambiguous: { label: 'Do log same naam', cls: 'bg-[#FDE3C4] text-[#8A4B00]' },
  unknown_customer: { label: 'Kaun bheja?', cls: 'bg-[#F2F0EA] text-[#9C9A92]' },
};

export default function MoneyPage() {
  const [tab, setTab] = useState('import');
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      <header className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9C9A92]">Paisa</p>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Aana / Jaana</h1>
        <p className="mt-0.5 text-xs font-semibold text-[#9C9A92]">Bank import + 13-hafte cash nashpati</p>
      </header>
      <div className="mb-4 flex gap-2 rounded-full bg-white p-1.5 ring-1 ring-[#E5E3DC] md:max-w-md">
        {[['import', 'Bank import'], ['forecast', '13-hafte nashpati']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-full py-2.5 text-xs font-bold transition ${tab === k ? 'bg-[#1A181C] text-white' : 'text-[#9C9A92]'}`}>{l}</button>
        ))}
      </div>
      {tab === 'import' ? <ImportTab /> : <ForecastTab />}
    </main>
  );
}

function ImportTab() {
  const [book, setBook] = useState(null);
  const [csv, setCsv] = useState('');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null); // index of expanded row
  const [busy, setBusy] = useState(false);
  const [doneIdx, setDoneIdx] = useState(() => new Set());

  const reload = useCallback(() => { loadBook().then(setBook).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [reload]);

  const refreshMatches = useCallback((csvText) => {
    const b = book;
    if (!b) return;
    const openByCust = new Map();
    for (const inv of b.invoices) {
      if (inv.status === 'draft' || inv.outstanding <= 0) continue;
      if (!openByCust.has(inv.customerId)) openByCust.set(inv.customerId, []);
      openByCust.get(inv.customerId).push(inv);
    }
    const parsed = parseBankCSV(csvText);
    setRows(parsed.rows.map((r) => ({ ...r, match: suggestMatch(r, b.customers, openByCust) })));
    setDoneIdx(new Set());
  }, [book]);

  useEffect(() => { if (csv && book) refreshMatches(csv); }, [csv, book, refreshMatches]);

  const pickAmbiguous = (i, c) => {
    setRows((rs) => rs.map((row, idx) => {
      if (idx !== i) return row;
      const open = book.invoices.filter((v) => v.customerId === c.id && v.outstanding > 0 && v.status !== 'draft');
      const match = suggestMatch({ ...row, narration: row.narration + ' ' + c.name }, [c], new Map([[c.id, open]]));
      return { ...row, match };
    }));
  };

  const makeSample = () => {
    const sample = buildSampleStatement({ today: book.today, customers: book.customers, invoices: book.invoices });
    setCsv(sample);
  };

  const readFile = async (e) => {
    const f = e.target.files?.[0];
    if (f) setCsv(await f.text());
    e.target.value = '';
  };

  const confirmRow = async (i) => {
    const row = rows[i];
    const m = row.match;
    if (!m || m.type === 'unknown_customer' || m.type === 'ambiguous') return;
    setBusy(true);
    try {
      await importBankPayment({
        customerId: m.customer.id, amountPaise: row.amountPaise, paidOn: row.dateISO,
        ref: row.ref, allocations: m.allocation, tdsPaise: m.tdsPaise ?? 0, note: row.narration.slice(0, 60),
      });
      setDoneIdx((s) => new Set(s).add(i));
      setOpen(null);
      reload();
    } finally { setBusy(false); }
  };

  if (!book) return <p className="text-sm text-[#9C9A92]">Loading…</p>;

  const matchCount = rows ? rows.filter((r, i) => !doneIdx.has(i) && !['unknown_customer', 'ambiguous'].includes(r.match?.type)).length : 0;

  return (
    <>
      <div className="rounded-[1.75rem] bg-white p-5 ring-1 ring-[#E5E3DC]">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9C9A92]">Bank statement CSV</p>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4}
          placeholder={'Date,Narration,Ref,Amount\n25/10/2026,NEFT-CR-RAMESH-GUPTA,N1,1180.00'}
          className="mt-2.5 w-full rounded-2xl bg-[#F8F7F2] px-3.5 py-2.5 font-mono text-[11px] ring-1 ring-[#E5E3DC] outline-none placeholder:text-[#B5B3AA] focus:ring-2 focus:ring-[#8B5CF6]" />
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-bold">
          <label className="cursor-pointer rounded-full bg-[#1A181C] px-4 py-2.5 text-white transition active:scale-95">
            📁 CSV file chuniye
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={readFile} />
          </label>
          <button onClick={makeSample} className="rounded-full bg-[#F5C818] px-4 py-2.5 text-[#1A181C] transition active:scale-95">✨ Sample statement banao</button>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-[#9C9A92]">Sample asli data se banta hai — saare 6 case aayenge: exact, combined, part, advance, TDS, unknown.</p>
      </div>

      {rows && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-extrabold tracking-tight">
            {rows.length} transactions · {matchCount} match ho gaye
          </h2>
          <ul className="space-y-2.5">
            {rows.map((r, i) => {
              const m = r.match ?? {};
              const meta = TYPE_META[m.type] ?? TYPE_META.unknown_customer;
              const isDone = doneIdx.has(i);
              return (
                <li key={i} className={`rounded-[1.5rem] bg-white p-4 ring-1 ${isDone ? 'ring-[#BBE3C8] opacity-60' : 'ring-[#E5E3DC]'}`}>
                  <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(open === i ? null : i)}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{r.narration}</p>
                      <p className="text-[11px] text-[#9C9A92]">{formatDateIN(r.dateISO)} {r.ref ? `· ${r.ref}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-extrabold">+{formatINR(r.amountPaise)}</p>
                      <Icon name="chevron" className={`h-4 w-4 text-[#B5B3AA] transition ${open === i ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.cls}`}>{isDone ? 'jama ✓' : meta.label}</span>
                  </div>
                  {open === i && (
                    <div className="mt-2.5 border-t border-[#F2F0EA] pt-2.5 text-xs">
                      {m.type === 'ambiguous' && (
                        <div className="space-y-1.5">
                          <p className="text-[#9C9A92]">Kaun inme se?</p>
                          {m.candidates.map((c) => (
                            <button key={c.id} onClick={() => pickAmbiguous(i, c)}
                              className="w-full rounded-xl bg-[#F8F7F2] px-3.5 py-2.5 text-left font-bold ring-1 ring-[#E5E3DC] active:ring-[#8B5CF6]">{c.name}</button>
                          ))}
                        </div>
                      )}
                      {m.type === 'unknown_customer' && <p className="text-[#9C9A92]">Naam se koi customer nahi mila — manually add karein ya skip karein.</p>}
                      {m.customer && (
                        <>
                          <p className="font-extrabold">{m.customer.name} <span className="font-medium text-[#9C9A92]">· {m.customer.area}</span></p>
                          {m.allocation?.length > 0 && (
                            <ul className="mt-1 space-y-1 rounded-xl bg-[#F8F7F2] p-2.5">
                              {m.allocation.map((a) => {
                                const inv = book.invoices.find((v) => v.id === a.invoiceId);
                                return <li key={a.invoiceId} className="flex justify-between text-[#6B6960]"><span>{inv?.number ?? 'bill'}</span><span className="font-bold">{formatINR(a.amountPaise)}</span></li>;
                              })}
                            </ul>
                          )}
                          {m.tdsPaise > 0 && <p className="mt-1.5 font-bold text-[#C4392C]">⚠ TDS {formatINR(m.tdsPaise)} kata — alag se record hoga</p>}
                          {m.advancePaise > 0 && <p className="mt-1.5 font-bold text-[#6D28D9]">Advance: {formatINR(m.advancePaise)} on-account jayega</p>}
                          {!isDone && (
                            <button onClick={() => confirmRow(i)} disabled={busy}
                              className="mt-2.5 w-full rounded-xl bg-[#1A181C] py-3 text-sm font-extrabold text-white transition active:scale-[0.98] disabled:opacity-50">
                              {busy ? 'Jama ho raha…' : '✔ Haan, jama karo'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function ForecastTab() {
  const [book, setBook] = useState(null);
  const [extra, setExtra] = useState(0);        // rupees collected now
  const [cDelay, setCDelay] = useState(0);      // extra weeks for C-grade
  const [pause, setPause] = useState(false);

  useEffect(() => { loadBook().then(setBook).catch(() => {}); }, []);

  const weeks = useMemo(() => {
    if (!book?.business) return null;
    return forecast({
      today: book.today,
      cashPaise: book.business.cash_balance_paise, safetyPaise: book.business.safety_buffer_paise,
      invoices: book.invoices, customers: book.customers, expenses: book.expenses ?? [],
      overrides: { extraInPaise: extra * 100, cGradeExtraWeeks: cDelay, pauseOutflows: pause },
    });
  }, [book, extra, cDelay, pause]);

  if (!weeks) return <p className="text-sm text-[#9C9A92]">Loading…</p>;
  const head = forecastHeadline(weeks);
  const maxAbs = Math.max(1, ...weeks.map((w) => Math.max(Math.abs(w.inPaise), Math.abs(w.outPaise))));
  const dirty = extra > 0 || cDelay > 0 || pause;

  return (
    <>
      <div className="rounded-[2rem] bg-[#141216] p-5 text-white">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Cash aaj</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{formatINR(book.business.cash_balance_paise)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">13 hafte baad{dirty ? ' (what-if)' : ''}</p>
            <p className={`mt-1 text-2xl font-extrabold tracking-tight ${weeks[12].closingPaise < book.business.safety_buffer_paise ? 'text-[#FF9D93]' : 'text-[#F5C818]'}`}>{head.endsAt}</p>
          </div>
        </div>
        {weeks.some((w) => w.closingPaise < 0) && (
          <p className="mt-3 rounded-xl bg-[#F05A4F]/15 px-3 py-2 text-[11px] font-bold text-[#FF9D93]">
            ⚠ {head.worstWeekLabel} mein cash {formatINR(Math.abs(head.worstWeek.closingPaise))} tak negative ja sakta hai
          </p>
        )}
      </div>

      {/* weekly bars */}
      <section className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-[#E5E3DC]">
        <h2 className="mb-3 text-sm font-extrabold tracking-tight">Har hafte (in vs out)</h2>
        {weeks.map((w, i) => (
          <div key={i} className="mb-2 flex items-center gap-2 text-[11px]">
            <span className="w-14 shrink-0 font-semibold text-[#9C9A92]">{w.weekStart.slice(5).replace('-', '/')}</span>
            <div className="flex h-4 flex-1 items-center gap-0.5">
              <div className="flex flex-1 justify-end">
                {w.inPaise > 0 && <div className="h-3 rounded-l bg-[#8B5CF6]" style={{ width: `${Math.max(4, (w.inPaise / maxAbs) * 100)}%` }} />}
              </div>
              <div className="flex flex-1">
                {w.outPaise > 0 && <div className="h-3 rounded-r bg-[#F5C818]" style={{ width: `${Math.max(4, (w.outPaise / maxAbs) * 100)}%` }} />}
              </div>
            </div>
            <span className={`w-24 shrink-0 text-right font-bold ${w.belowBuffer ? 'text-[#C4392C]' : ''}`}>{formatINR(w.closingPaise)}</span>
          </div>
        ))}
        <div className="mt-1.5 flex gap-4 text-[10px] font-semibold text-[#9C9A92]">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#8B5CF6]" />aayega</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#F5C818]" />jaayega</span>
        </div>
      </section>

      {/* what-if */}
      <section className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-[#E5E3DC]">
        <h2 className="mb-3 text-sm font-extrabold tracking-tight">Kya hoga agar… (what-if)</h2>
        <label className="block text-xs font-bold text-[#6B6960]">Aaj hi extra vasooli: ₹{extra.toLocaleString('en-IN')}
          <input type="range" min={0} max={500000} step={25000} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className="mt-1.5 w-full accent-[#8B5CF6]" />
        </label>
        <label className="mt-3 block text-xs font-bold text-[#6B6960]">C-grade log aur {cDelay} hafte late bharein
          <input type="range" min={0} max={4} step={1} value={cDelay} onChange={(e) => setCDelay(Number(e.target.value))} className="mt-1.5 w-full accent-[#8B5CF6]" />
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#6B6960]">
          <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} className="h-4 w-4 accent-[#8B5CF6]" />
          Kharche rok do (demo mode)
        </label>
        {dirty && (
          <p className="mt-3 rounded-xl bg-[#F8F7F2] px-3.5 py-2.5 text-xs font-semibold text-[#6B6960]">
            What-if ke saath 13-hafte end: <b>{formatINR(weeks[12].closingPaise)}</b>
          </p>
        )}
      </section>
    </>
  );
}
