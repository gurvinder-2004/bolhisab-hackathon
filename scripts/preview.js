import { buildDemoData } from '../src/data/index.js';
import { invoiceState, ageing } from '../src/domain/status.js';
import { reliability } from '../src/domain/reliability.js';
import { formatINR, diffDays } from '../src/engine/index.js';

const d = buildDemoData();
const paid = new Map();
for (const a of d.allocations) paid.set(a.invoiceId, (paid.get(a.invoiceId) ?? 0) + a.amountPaise);
const payDate = new Map(d.payments.map((p) => [p.id, p.paidOn]));
const lastPaid = new Map();
for (const a of d.allocations) lastPaid.set(a.invoiceId, payDate.get(a.paymentId));
const states = d.invoices.map((i) => ({ i, ...invoiceState(i, paid.get(i.id) ?? 0, d.today) }));
const count = {};
for (const s of states) count[s.status] = (count[s.status] ?? 0) + 1;
console.log('invoices:', d.invoices.length, count);
const a = ageing(states);
console.log('ageing:', Object.fromEntries(Object.entries(a).map(([k, v]) => [k, formatINR(v)])));
console.log('to collect:', formatINR(states.reduce((x, s) => x + s.outstanding, 0)));
for (const c of d.customers) {
  const rows = states.filter((s) => s.i.customerId === c.id && s.status !== 'draft' && s.status !== 'disputed')
    .map((s) => ({ dueDate: s.i.dueDate, paidOn: s.outstanding === 0 ? lastPaid.get(s.i.id) : null }));
  const r = reliability(rows, d.today);
  console.log(c.name.padEnd(16), r.grade ?? '-', r.reason);
}
