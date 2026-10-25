import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceState, ageBucket, ageing, customerBalance } from '../src/domain/status.js';
import { reliability } from '../src/domain/reliability.js';

const inv = (o) => ({ totalPaise: 1000000, dueDate: '2026-11-01', statusOverride: null, ...o });

test('status follows the demo date', () => {
  assert.equal(invoiceState(inv({}), 0, '2026-10-24').status, 'sent');
  assert.equal(invoiceState(inv({}), 0, '2026-10-25').status, 'due_soon'); // 7 days before due
  assert.equal(invoiceState(inv({}), 0, '2026-11-01').status, 'due_soon'); // due today is not overdue
  const o = invoiceState(inv({}), 0, '2026-11-02');
  assert.deepEqual([o.status, o.daysOverdue, o.overdue], ['overdue', 1, true]);
  assert.equal(invoiceState(inv({}), 1000000, '2026-12-01').status, 'paid');
  const p = invoiceState(inv({}), 400000, '2026-11-10');
  assert.deepEqual([p.status, p.outstanding, p.overdue], ['part_paid', 600000, true]);
});

test('draft and disputed override', () => {
  assert.equal(invoiceState(inv({ statusOverride: 'draft' }), 0, '2027-01-01').outstanding, 0);
  const d = invoiceState(inv({ statusOverride: 'disputed' }), 0, '2026-12-01');
  assert.equal(d.status, 'disputed');
  assert.equal(d.outstanding, 1000000);
});

test('ageing buckets', () => {
  assert.equal(ageBucket(0), 'not_due'); assert.equal(ageBucket(1), '1-30'); assert.equal(ageBucket(30), '1-30');
  assert.equal(ageBucket(31), '31-60'); assert.equal(ageBucket(61), '61-90'); assert.equal(ageBucket(91), '90+');
  const a = ageing([{ outstanding: 100, daysOverdue: 0, status: 'sent' }, { outstanding: 50, daysOverdue: 95, status: 'overdue' }, { outstanding: 999, daysOverdue: 0, status: 'draft' }]);
  assert.deepEqual([a.not_due, a['90+']], [100, 50]);
});

test('customer balance', () => {
  assert.equal(customerBalance({ invoiceOutstanding: 500000, creditsPaise: 40000, onAccountPaise: 10000 }), 530000);
});

test('reliability grades with reasons', () => {
  const day = (n) => `2026-0${1 + Math.floor(n / 28)}-${String((n % 28) + 1).padStart(2, '0')}`;
  const mk = (lateDays, n = 6) => Array.from({ length: n }, (_, i) => ({ dueDate: day(i), paidOn: lateDays === null ? null : addD(day(i), lateDays) }));
  const addD = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  assert.equal(reliability(mk(0), '2026-12-01').grade, 'A');
  assert.equal(reliability(mk(8), '2026-12-01').grade, 'B');
  assert.equal(reliability(mk(30), '2026-12-01').grade, 'C');
  assert.equal(reliability(mk(null), '2026-12-01').grade, 'C'); // overdue and unpaid counts as late
  assert.equal(reliability(mk(0, 1), '2026-12-01').grade, null);
  assert.match(reliability(mk(8), '2026-12-01').reason, /8 days late/);
});
