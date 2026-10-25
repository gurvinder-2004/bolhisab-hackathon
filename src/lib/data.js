// Shared client-side "book": one load, everything derived — invoices with live status,
// customers with balances and grades, today's follow-ups. Mirrors scripts/preview.js.

import { supabase } from './supabase.js';
import { todayIST, diffDays } from '../engine/dates.js';
import { invoiceState, ageBucket, ageing } from '../domain/status.js';
import { reliability } from '../domain/reliability.js';
import { mapCustomerRow, mapInvoiceRow } from './ledger.js';
import { todaysFollowUps } from '../domain/chase.js';

export async function loadBook() {
  const [bizRes, custRes, invRes, payRes, allocRes, credRes, evRes, expRes] = await Promise.all([
    supabase.from('businesses').select('*').limit(1),
    supabase.from('customers').select('*').order('name'),
    supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
    supabase.from('payments').select('*'),
    supabase.from('payment_allocations').select('*'),
    supabase.from('credit_entries').select('*'),
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*'),
  ]);
  const business = bizRes.data?.[0] ?? null;
  const today = todayIST();
  const customers = (custRes.data ?? []).map(mapCustomerRow);
  const invoices = (invRes.data ?? []).map(mapInvoiceRow);

  const paidByInvoice = new Map();
  for (const a of allocRes.data ?? []) paidByInvoice.set(a.invoice_id, (paidByInvoice.get(a.invoice_id) ?? 0) + a.amount_paise);
  const payDateByPayment = new Map((payRes.data ?? []).map((p) => [p.id, p.paid_on]));

  const states = invoices.map((inv) => {
    const st = invoiceState(inv, paidByInvoice.get(inv.id) ?? 0, today);
    return { ...inv, ...st };
  });

  // customer-level rollups
  const creditsByCustomer = new Map();
  for (const c of credRes.data ?? []) creditsByCustomer.set(c.customer_id, (creditsByCustomer.get(c.customer_id) ?? 0) + c.amount_paise);
  const paidByCustomer = new Map();
  for (const p of payRes.data ?? []) paidByCustomer.set(p.customer_id, (paidByCustomer.get(p.customer_id) ?? 0) + p.amount_paise);

  const rows = customers.map((c) => {
    const invs = states.filter((s) => s.customerId === c.id);
    const invoiceOutstanding = invs.reduce((s, i) => s + i.outstanding, 0);
    const myInvoiceIds = new Set(invs.map((i) => i.id));
    const allocOnMyInvoices = (allocRes.data ?? []).filter((a) => myInvoiceIds.has(a.invoice_id));
    const allocatedSum = allocOnMyInvoices.reduce((s, a) => s + a.amount_paise, 0);
    const myPayments = (payRes.data ?? []).filter((p) => p.customer_id === c.id);
    const onAccount = Math.max(0, myPayments.reduce((s, p) => s + p.amount_paise, 0) - allocatedSum);
    const credits = creditsByCustomer.get(c.id) ?? 0;
    const hist = invs
      .filter((s) => s.status !== 'draft' && s.status !== 'disputed')
      .map((s) => {
        const lastPaid = s.outstanding === 0
          ? (allocOnMyInvoices.filter((a) => a.invoice_id === s.id).map((a) => payDateByPayment.get(a.payment_id)).filter(Boolean).sort().pop() ?? null)
          : null;
        return { dueDate: s.dueDate, paidOn: lastPaid };
      });
    const rel = reliability(hist, today);
    return {
      ...c,
      invoiceOutstandingPaise: invoiceOutstanding,
      creditsPaise: credits,
      onAccountPaise: onAccount,
      balancePaise: invoiceOutstanding + credits - onAccount,
      grade: rel.grade ?? '-',
      gradeReason: rel.reason ?? '',
      openInvoices: invs.filter((s) => s.outstanding > 0),
      invoices: invs,
    };
  });

  // last reminder per customer (days ago) from events
  const lastReminder = {};
  for (const ev of evRes.data ?? []) {
    if (ev.kind !== 'reminder_sent' || !ev.customer_id) continue;
    const d = diffDays(ev.created_at.slice(0, 10), today);
    if (!(ev.customer_id in lastReminder) || d < lastReminder[ev.customer_id]) lastReminder[ev.customer_id] = d;
  }

  const followUps = todaysFollowUps({
    invoices: states.filter((s) => s.status !== 'draft'),
    customers: rows.map((r) => ({ id: r.id, name: r.name, area: r.area, city: r.city, phone: r.phone, grade: r.grade })),
    lastReminderByCustomer: lastReminder,
    today,
  });

  return {
    today,
    business,
    customers: rows,
    invoices: states,
    ageing: ageing(states),
    toCollectPaise: states.reduce((s, i) => s + i.outstanding, 0),
    overduePaise: states.filter((i) => i.overdue).reduce((s, i) => s + i.outstanding, 0),
    dueThisWeekPaise: states.filter((i) => !i.overdue && i.status !== 'paid' && diffDays(today, i.dueDate) <= 7 && diffDays(today, i.dueDate) >= 0).reduce((s, i) => s + i.outstanding, 0),
    followUps,
    events: evRes.data ?? [],
    payments: payRes.data ?? [],
    creditEntries: credRes.data ?? [],
    expenses: (expRes.data ?? []).map((e) => ({
      id: e.id, label: e.label, category: e.category, amountPaise: e.amount_paise,
      recurrence: e.recurrence, dayOfMonth: e.day_of_month, dueDate: e.due_date,
    })),
  };
}

export const statusLabel = {
  paid: 'Paid', part_paid: 'Part paid', due_soon: 'Due soon', overdue: 'Overdue',
  sent: 'Sent', disputed: 'Disputed', draft: 'Draft',
};
export const statusColor = {
  paid: 'bg-[#E7F6EC] text-[#1B7A3D]', part_paid: 'bg-[#FDF3C7] text-[#8A6D00]',
  due_soon: 'bg-[#E0EBFB] text-[#2058C8]', overdue: 'bg-[#FDE7E4] text-[#C4392C]',
  sent: 'bg-[#F2F0EA] text-[#6B6960]', disputed: 'bg-[#EDE7FE] text-[#6D28D9]', draft: 'bg-[#F2F0EA] text-[#9C9A92]',
};
