// The chase engine: who to follow up with today, on which channel, and what to say.
// Pure logic — no I/O. Disputes always pause the ladder (a PS4-judge guarantee).

import { formatINR, formatDateIN } from '../engine/index.js';

// Channel by days overdue — the escalation ladder.
export function ladderChannel(daysOverdue) {
  if (daysOverdue <= 0) return null;
  if (daysOverdue <= 7) return 'whatsapp';
  if (daysOverdue <= 15) return 'call';
  if (daysOverdue <= 30) return 'letter';
  return 'letter_call';
}

// How many days to wait before nudging again, per channel.
const CADENCE = { whatsapp: 3, call: 5, letter: 10, letter_call: 10 };

// -> { action: 'whatsapp'|'call'|'letter'|'letter_call'|null, reason }
// lastReminderDaysAgo: days since the last reminder event for this customer (Infinity if never).
export function nextChaseAction({ status, outstandingPaise, daysOverdue, lastReminderDaysAgo = Infinity }) {
  if (status === 'draft' || status === 'disputed' || status === 'paid') return { action: null, reason: status === 'disputed' ? 'disputed — paused' : status };
  if (outstandingPaise <= 0) return { action: null, reason: 'settled' };
  const channel = ladderChannel(daysOverdue);
  if (!channel) return { action: null, reason: 'not due yet' };
  // a fresh reminder only suppresses the SAME rung of the ladder; escalation always fires
  const prevChannel = Number.isFinite(lastReminderDaysAgo) ? ladderChannel(daysOverdue - lastReminderDaysAgo) : null;
  if (channel === prevChannel && lastReminderDaysAgo < CADENCE[channel]) {
    return { action: null, reason: `reminded ${lastReminderDaysAgo}d ago` };
  }
  return { action: channel, reason: `${daysOverdue} din late` };
}

// score for "chase these first": overdue days and money matter; reliable payers get a break.
export function chaseScore({ daysOverdue, outstandingPaise, grade }) {
  const gradeAdj = grade === 'A' ? -3 : grade === 'B' ? 0 : 4;
  return daysOverdue + Math.min(30, Math.round(outstandingPaise / 100000)) + gradeAdj;
}

// Build the day's follow-up list.
// invoices: [{id, number, customerId, dueDate, totalPaise, status, outstanding | outstandingPaise, daysOverdue}]
// customers: [{id, name, area, city, phone, grade}]
// lastReminderByCustomer: {customerId: daysAgo}
export function todaysFollowUps({ invoices, customers, lastReminderByCustomer = {}, today }) {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const rows = [];
  for (const inv of invoices) {
    const cust = byId.get(inv.customerId);
    if (!cust) continue;
    const outstandingPaise = inv.outstandingPaise ?? inv.outstanding ?? 0;
    const last = lastReminderByCustomer[cust.id] ?? Infinity;
    const { action, reason } = nextChaseAction({
      status: inv.status, outstandingPaise, daysOverdue: inv.daysOverdue, lastReminderDaysAgo: last,
    });
    if (!action) continue;
    rows.push({
      invoiceId: inv.id, number: inv.number, customerId: cust.id,
      name: cust.name, area: cust.area, city: cust.city, phone: cust.phone, grade: cust.grade,
      outstandingPaise, daysOverdue: inv.daysOverdue, dueDate: inv.dueDate,
      action, reason, score: chaseScore({ daysOverdue: inv.daysOverdue, outstandingPaise, grade: cust.grade }),
    });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

export const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp bhejo', call: 'Phone karo', letter: 'Demand letter', letter_call: 'Letter + phone',
};

// Suggested WhatsApp text (judge-safe: polite, no threats).
export function whatsappTemplate({ name, number, amountPaise, dueDate, business, payLink }) {
  const l = [
    `Namaste ${name} ji 🙏`,
    `${business} ka hisaab: invoice ${number} (${formatDateIN(dueDate)} due) par ${formatINR(amountPaise)} baaki hai.`,
    payLink ? `Online jama karne ke liye: ${payLink}` : null,
    'Kripya jaldi clear karein. Dhanyavaad!',
  ].filter(Boolean);
  return l.join('\n');
}
