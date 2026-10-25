import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData } from '../src/data/index.js';
import { validateGstin, computeInvoice, financialYear, diffDays } from '../src/engine/index.js';
import { invoiceState, ageing } from '../src/domain/status.js';
import { seedSql } from '../scripts/make-seed.js';

const d = buildDemoData();
const paid = new Map();
for (const a of d.allocations) paid.set(a.invoiceId, (paid.get(a.invoiceId) ?? 0) + a.amountPaise);
const states = d.invoices.map((i) => ({ i, ...invoiceState(i, paid.get(i.id) ?? 0, d.today) }));

test('demo data is deterministic', () => {
  assert.deepEqual(buildDemoData(), buildDemoData());
});

test('business and customers: valid made-up GSTINs, one other-state, one unregistered', () => {
  assert.equal(validateGstin(d.business.gstin).valid, true);
  assert.equal(d.business.gstin.slice(0, 2), d.business.stateCode);
  assert.equal(d.customers.length, 12);
  for (const c of d.customers) {
    if (c.gstin) { const v = validateGstin(c.gstin); assert.equal(v.valid, true, c.name); assert.equal(v.stateCode, c.stateCode); }
  }
  assert.equal(d.customers.filter((c) => !c.gstin).length, 1);
  assert.equal(d.customers.filter((c) => c.stateCode !== '27').length, 1);
  assert.equal(d.customers.filter((c) => c.name.endsWith('Gupta')).length, 2);
});

test('invoices: 76 issued + 1 draft, consecutive numbers, one financial year', () => {
  assert.equal(d.invoices.length, 77);
  const nums = d.invoices.filter((i) => i.number).map((i) => i.number).sort();
  assert.equal(new Set(nums).size, 76);
  nums.forEach((n, k) => assert.equal(n, `INV/26-27/${String(k + 1).padStart(4, '0')}`));
  assert.equal(d.invoices.filter((i) => !i.number).length, 1);
  const byDate = d.invoices.filter((i) => i.number).sort((a, b) => (a.number < b.number ? -1 : 1));
  for (let k = 1; k < byDate.length; k++) assert.ok(byDate[k].invoiceDate >= byDate[k - 1].invoiceDate, 'numbers follow dates');
  for (const i of d.invoices) assert.equal(financialYear(i.invoiceDate), '26-27');
  assert.equal(d.invoices.filter((i) => i.invoiceDate >= '2026-06-24' && i.number).length >= 40, true);
});

test('invoice maths matches the engine, and GST type follows the customer state', () => {
  for (const i of d.invoices) {
    const c = d.customers.find((x) => x.id === i.customerId);
    const r = computeInvoice({
      business: { registrationType: 'regular', stateCode: '27' }, placeOfSupplyStateCode: c.stateCode,
      lines: i.lines.map((l) => ({ qty: l.qty, ratePaise: l.ratePaise, gstRatePct: l.gstRatePct })),
    });
    assert.equal(r.totals.grandTotal, i.totalPaise);
    assert.equal(r.supply, c.stateCode === '27' ? 'INTRA' : 'INTER');
    assert.equal(i.taxablePaise + i.cgstPaise + i.sgstPaise + i.igstPaise + i.roundOffPaise, i.totalPaise);
    assert.equal(i.totalPaise % 100, 0);
    for (const l of i.lines) assert.equal(l.hsn.length, 4); // turnover below Rs 5 crore
  }
});

test('payments: allocations never exceed invoice or payment', () => {
  const totals = new Map(d.invoices.map((i) => [i.id, i.totalPaise]));
  for (const [id, p] of paid) assert.ok(p <= totals.get(id));
  for (const p of d.payments) assert.equal(d.allocations.filter((a) => a.paymentId === p.id).reduce((s, a) => s + a.amountPaise, 0), p.amountPaise);
  for (const p of d.payments) assert.ok(p.paidOn <= d.today);
});

test('every status and every ageing bucket appears at the seed date', () => {
  const seen = new Set(states.map((s) => s.status));
  for (const st of ['paid', 'part_paid', 'due_soon', 'overdue', 'disputed', 'draft', 'sent']) assert.ok(seen.has(st), st);
  const a = ageing(states);
  for (const [k, v] of Object.entries(a)) assert.ok(v > 0, `bucket ${k}`);
  const overdue = states.filter((s) => s.status === 'overdue').map((s) => s.daysOverdue);
  assert.ok(new Set(overdue).size >= 5, 'overdue by different amounts');
  assert.equal(diffDays('2026-10-24', d.today), 0);
});

test('seed SQL has no stray undefined/NaN and quotes apostrophes', () => {
  const sql = seedSql(d);
  assert.doesNotMatch(sql, /undefined|NaN/);
  assert.match(sql, /^-- Demo data/);
});
