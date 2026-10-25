import { daysOverdue, diffDays } from '../engine/dates.js';
import { DUE_SOON_DAYS } from '../config.js';

// status: draft | disputed | paid | part_paid | overdue | due_soon | sent
export function invoiceState(inv, paidPaise, today) {
  const outstanding = Math.max(0, inv.totalPaise - paidPaise);
  const over = daysOverdue(inv.dueDate, today);
  let status;
  if (inv.statusOverride === 'draft') status = 'draft';
  else if (inv.statusOverride === 'disputed') status = 'disputed';
  else if (outstanding === 0) status = 'paid';
  else if (paidPaise > 0) status = 'part_paid';
  else if (over > 0) status = 'overdue';
  else if (diffDays(today, inv.dueDate) <= DUE_SOON_DAYS) status = 'due_soon';
  else status = 'sent';
  const counts = status !== 'draft' && outstanding > 0;
  return { status, outstanding: status === 'draft' ? 0 : outstanding, daysOverdue: counts ? over : 0, overdue: counts && over > 0 };
}

export function ageBucket(days) {
  if (days <= 0) return 'not_due';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export function ageing(states) {
  const out = { not_due: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const s of states) if (s.outstanding > 0 && s.status !== 'draft') out[ageBucket(s.daysOverdue)] += s.outstanding;
  return out;
}

// What a customer owes in total: open invoices + quick khata credits - money paid on account.
export function customerBalance({ invoiceOutstanding, creditsPaise, onAccountPaise = 0 }) {
  return invoiceOutstanding + creditsPaise - onAccountPaise;
}
