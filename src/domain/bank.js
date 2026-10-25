// Bank statement import + payment matching. Pure logic, no I/O.
// Six cases: exact, part, combined (one transfer, many invoices), on-account,
// TDS-deducted (flagged, never auto-applied), ambiguous (ask the owner).

import { toPaise } from '../engine/money.js';
import { tokens } from './match.js';

// ---- CSV parsing ----
// Expects columns: Date, Narration, Ref, Amount (credit = money in).
// Also accepts Debit/Credit columns. Dates: dd/mm/yyyy, dd-mm-yyyy or yyyy-mm-dd.

const DATE_RE = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/;
function normDate(s) {
  const m = DATE_RE.exec(String(s ?? '').trim());
  if (!m) return null;
  let [, a, b, c] = m;
  if (a.length === 4) [a, b, c] = [c, b, a]; // yyyy-mm-dd
  const d = Number(a), mo = Number(b), y = Number(c);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function splitCSVLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// -> { rows: [{dateISO, narration, ref, amountPaise}], skipped: number }
export function parseBankCSV(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], skipped: 0 };
  const head = lines[0].toLowerCase();
  const hasHeader = head.includes('date') && (head.includes('narration') || head.includes('description') || head.includes('particular') || head.includes('amount') || head.includes('debit') || head.includes('credit'));
  const body = hasHeader ? lines.slice(1) : lines;

  const rows = [];
  let skipped = 0;
  for (const line of body) {
    const cells = splitCSVLine(line);
    if (cells.length < 3) { skipped++; continue; }
    // headerless fallback: date, narration, amount (, ref)
    let dateISO, narration, ref, amountPaise = null;
    if (hasHeader) {
      const h = splitCSVLine(lines[0]).map((x) => x.toLowerCase());
      const idx = (name) => h.findIndex((c) => c.includes(name));
      const di = idx('date'), ni = Math.max(idx('narration'), idx('description'), idx('particular'), idx('remark'));
      const ri = idx('ref') >= 0 ? idx('ref') : idx('utr');
      const ai = idx('amount'), debi = idx('debit'), cri = idx('credit');
      dateISO = normDate(cells[di]);
      narration = ni >= 0 ? (cells[ni] ?? '') : '';
      ref = ri >= 0 ? (cells[ri] ?? '') : '';
      try {
        if (debi >= 0 && cri >= 0 && (cells[debi] || cells[cri])) {
          const cr = cells[cri] ? toPaise(cells[cri]) : 0;
          const db = cells[debi] ? toPaise(cells[debi]) : 0;
          amountPaise = cr - db;
        } else if (ai >= 0 && cells[ai]) amountPaise = toPaise(cells[ai]);
      } catch { amountPaise = null; }
    } else {
      dateISO = normDate(cells[0]);
      narration = cells[1] ?? '';
      try { amountPaise = cells[3] !== undefined && /^[-\d.,]+$/.test(cells[3]) && cells[3] !== '' ? toPaise(cells[3]) : toPaise(cells[2]); } catch { amountPaise = null; }
      ref = /^[-\d.,]+$/.test(cells[3] ?? '') ? (cells[2] ?? '') : (cells[3] ?? '');
    }
    if (!dateISO || amountPaise == null || !Number.isFinite(amountPaise) || narration === '') { skipped++; continue; }
    if (amountPaise <= 0) { skipped++; continue; } // debits/zero not handled in the demo
    rows.push({ dateISO, narration, ref, amountPaise });
  }
  return { rows, skipped };
}

// ---- customer detection from narration ----
// Bank narrations are noisy ("NEFT-CR-HDFC0000123-RAAMESH GUPTA-INV786"); score by
// how many of the customer's name tokens appear in the narration.

function narrationTokens(n) {
  return new Set(tokens(n));
}

// -> [{customer, score}] best first; score = matched name tokens / total name tokens
export function customersInNarration(narration, customers) {
  const nt = narrationTokens(narration);
  const out = [];
  for (const c of customers) {
    const nameT = [...new Set(tokens(c.name))];
    const shopT = c.shopName ? [...new Set(tokens(c.shopName))] : [];
    if (!nameT.length) continue;
    const hit = [...new Set([...nameT, ...shopT])].filter((t) => nt.has(t)).length;
    const score = hit / nameT.length; // shop tokens can help, never dilute
    if (score >= 0.5 && hit >= 1) out.push({ customer: c, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

const TDS_RATES = [0.02, 0.05, 0.1, 0.2];

// -> { type: 'exact'|'part'|'combined'|'on_account'|'tds'|'ambiguous'|'unknown_customer',
//      customer?, candidates?, allocation: [{invoiceId, amountPaise}], invoices?, tdsPaise? }
export function suggestMatch(row, customers, openInvoicesByCustomer) {
  const found = customersInNarration(row.narration, customers);
  if (!found.length) return { type: 'unknown_customer', allocation: [] };
  if (found.length > 1 && found[0].score === found[1].score) {
    return { type: 'ambiguous', candidates: found.map((f) => f.customer), allocation: [] };
  }
  const customer = found[0].customer;
  const open = (openInvoicesByCustomer.get(customer.id) ?? []).slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  if (!open.length) return { type: 'on_account', customer, allocation: [] };

  const total = open.reduce((s, i) => s + i.outstanding, 0);
  const A = row.amountPaise;

  // single invoice comparisons first (oldest)
  const first = open[0];
  if (open.length === 1) {
    if (A === first.outstanding) return { type: 'exact', customer, allocation: [{ invoiceId: first.id, amountPaise: A }] };
    // TDS: short by ~2/5/10/20% of the invoice
    const short = first.outstanding - A;
    if (short > 0) {
      for (const r of TDS_RATES) {
        if (Math.abs(short - Math.round(first.outstanding * r)) <= 100) {
          return { type: 'tds', customer, tdsPaise: short, invoices: open, allocation: [{ invoiceId: first.id, amountPaise: A }] };
        }
      }
    }
    if (A < first.outstanding) return { type: 'part', customer, allocation: [{ invoiceId: first.id, amountPaise: A }] };
    return { type: 'on_account', customer, allocation: [], advancePaise: A - total };
  }

  // multiple open invoices
  if (A === total) {
    return { type: 'combined', customer, allocation: open.map((i) => ({ invoiceId: i.id, amountPaise: i.outstanding })) };
  }
  if (A > total) return { type: 'on_account', customer, allocation: open.map((i) => ({ invoiceId: i.id, amountPaise: i.outstanding })), advancePaise: A - total };
  // FIFO subset
  let left = A;
  const alloc = [];
  for (const i of open) {
    if (left <= 0) break;
    const use = Math.min(left, i.outstanding);
    alloc.push({ invoiceId: i.id, amountPaise: use });
    left -= use;
  }
  if (left === 0) {
    const partialSingle = alloc.length === 1 && alloc[0].amountPaise < open[0].outstanding;
    return partialSingle ? { type: 'part', customer, allocation: alloc } : { type: 'combined', customer, allocation: alloc };
  }
  if (A < first.outstanding) return { type: 'part', customer, allocation: alloc };
  return { type: 'combined', customer, allocation: alloc, unallocatedPaise: left };
}

// ---- demo sample statement built from the LIVE book, so matches are guaranteed ----
export function buildSampleStatement({ today, customers, invoices, cashTip = 'UPI-CR' }) {
  const openByCust = new Map();
  for (const i of invoices) {
    if (i.status === 'draft' || i.outstanding <= 0) continue;
    if (!openByCust.has(i.customerId)) openByCust.set(i.customerId, []);
    openByCust.get(i.customerId).push(i);
  }
  const rows = [];
  const d = (offset) => {
    const dt = new Date(Date.parse(today + 'T00:00:00Z') - offset * 86400000);
    return dt.toISOString().slice(0, 10).split('-').reverse().join('/');
  };
  const usable = customers.filter((c) => openByCust.get(c.id)?.length);

  const single = usable.filter((c) => openByCust.get(c.id).length === 1);
  const exact = single[0];
  if (exact) rows.push([d(1), `NEFT-CR-${cashTip}-${exact.name.toUpperCase().replace(/\s+/g, '-')}-SETTLEMENT`, 'N17401', (openByCust.get(exact.id)[0].outstanding / 100).toFixed(2)]);

  const multi = usable.find((c) => openByCust.get(c.id).length >= 2 && c !== exact);
  if (multi) {
    const invs = openByCust.get(multi.id);
    rows.push([d(2), `NEFT-CR-${cashTip}-${multi.name.toUpperCase().replace(/\s+/g, '-')}-FULL CLEARANCE`, 'N17402', (invs.reduce((s, i) => s + i.outstanding, 0) / 100).toFixed(2)]);
    rows.push([d(3), `IMPS-CR-RECD FROM ${multi.name.toUpperCase()}`, 'I17403', (Math.max(1, Math.floor(invs[0].outstanding * 0.4 / 100)) * 100 / 100).toFixed(2)]);
  }

  // TDS needs a single-invoice customer (detection compares against one invoice)
  const tdsCust = single.find((c) => c !== exact) ?? exact;
  if (tdsCust) rows.push([d(4), `NEFT-CR-${cashTip}-${tdsCust.name.toUpperCase().replace(/\s+/g, '-')}-LESS TDS`, 'N17404', (Math.max(1, Math.floor(openByCust.get(tdsCust.id)[0].outstanding * 0.9 / 100))).toFixed(2)]);

  const other = usable.find((c) => c !== exact && c !== multi) ?? customers.find((c) => c !== exact && c !== multi);
  if (other) {
    const tot = (openByCust.get(other.id) ?? []).reduce((s, i) => s + i.outstanding, 0);
    rows.push([d(5), `UPI-CR-PAYMENT FROM ${other.name.toUpperCase()}`, 'U17405', ((tot + 500000) / 100).toFixed(2)]);
  }
  rows.push([d(6), 'UPI-CR-MISC SUSPENSE UNKNOWN', 'U17406', '1250.00']);
  rows.push([d(7), 'CHQ-ISSUED-RENT PAID', 'C17407', '-25000.00']);

  return 'Date,Narration,Ref,Amount\n' + rows.map((r) => r.join(',')).join('\n');
}
