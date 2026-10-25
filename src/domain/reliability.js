import { diffDays } from '../engine/dates.js';

// invoices: [{ dueDate, paidOn|null }] for non-draft, non-disputed invoices. Unpaid-but-overdue counts as late.
export function reliability(invoices, today) {
  const late = [];
  for (const i of invoices) {
    if (i.paidOn) late.push(Math.max(0, diffDays(i.dueDate, i.paidOn)));
    else if (today > i.dueDate) late.push(diffDays(i.dueDate, today));
  }
  const n = late.length;
  if (n < 2) return { grade: null, n, avgDaysLate: 0, onTimePct: null, reason: 'Not enough history yet' };
  const avg = Math.round(late.reduce((a, b) => a + b, 0) / n);
  const onTimePct = Math.round((late.filter((d) => d === 0).length / n) * 100);
  const grade = avg <= 3 && onTimePct >= 60 ? 'A' : avg <= 12 ? 'B' : 'C'; // A: pays on time, B: a little late, C: chronically late
  const how = onTimePct === 100 ? 'Always pays on time' : avg === 0 ? 'Usually pays on time' : `Pays about ${avg} day${avg === 1 ? '' : 's'} late on average`;
  return { grade, n, avgDaysLate: avg, onTimePct, reason: `${how}; ${onTimePct}% of ${n} invoices on time` };
}
