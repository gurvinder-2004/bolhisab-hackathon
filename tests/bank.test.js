import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBankCSV, customersInNarration, suggestMatch, buildSampleStatement } from '../src/domain/bank.js';
import { forecast, forecastHeadline } from '../src/domain/forecast.js';

const CUST = [
  { id: 'a', name: 'Ramesh Gupta', shopName: 'Gupta Traders' },
  { id: 'b', name: 'Suresh Gupta', shopName: 'Gupta Hardware' },
  { id: 'c', name: 'Anil Patil', shopName: 'Patil Foods' },
];
const OPEN = new Map([
  ['a', [
    { id: 'i1', outstanding: 118000, dueDate: '2026-09-01', number: 'A1' },
    { id: 'i2', outstanding: 59000, dueDate: '2026-09-20', number: 'A2' },
  ]],
  ['c', [{ id: 'i3', outstanding: 236000, dueDate: '2026-08-01', number: 'C1' }]],
]);

test('csv: parses header, dates and comma amounts; skips debits and junk', () => {
  const csv = 'Date,Narration,Ref,Amount\n'
    + '25/10/2026,"NEFT-CR-RAmesh Gupta-INV1",N1,"1,180.00"\n'
    + '24-10-2026,IMPS FROM ANIL PATIL,I2,2360\n'
    + '23/10/2026,CHQ ISSUED RENT,C3,-25000\n'
    + 'not a row\n'
    + '22/10/2026,EMPTY AMOUNT,N4,abc\n';
  const { rows, skipped } = parseBankCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dateISO, '2026-10-25');
  assert.equal(rows[0].amountPaise, 118000);
  assert.equal(rows[1].amountPaise, 236000);
  assert.ok(skipped >= 3);
});

test('match: customer found from noisy narration despite spelling noise', () => {
  const hits = customersInNarration('NEFT-CR-HDFC0000123-RAAMESH GUPTTA-INV786', CUST);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].customer.id, 'a');
});

test('match: two Guptas with equal scores are ambiguous', () => {
  const r = suggestMatch({ narration: 'NEFT-CR-GUPTA', amountPaise: 100000 }, CUST, OPEN);
  assert.equal(r.type, 'ambiguous');
  assert.equal(r.candidates.length, 2);
});

test('match: exact single invoice', () => {
  const r = suggestMatch({ narration: 'UPI-CR FROM ANIL PATIL', amountPaise: 236000 }, CUST, OPEN);
  assert.equal(r.type, 'exact');
  assert.deepEqual(r.allocation, [{ invoiceId: 'i3', amountPaise: 236000 }]);
});

test('match: part payment on the oldest invoice', () => {
  const r = suggestMatch({ narration: 'IMPS ANIL PATIL part', amountPaise: 100000 }, CUST, OPEN);
  assert.equal(r.type, 'part');
  assert.deepEqual(r.allocation, [{ invoiceId: 'i3', amountPaise: 100000 }]);
});

test('match: combined clears both invoices FIFO', () => {
  const r = suggestMatch({ narration: 'NEFT Ramesh Gupta full', amountPaise: 177000 }, CUST, OPEN);
  assert.equal(r.type, 'combined');
  assert.deepEqual(r.allocation, [
    { invoiceId: 'i1', amountPaise: 118000 },
    { invoiceId: 'i2', amountPaise: 59000 },
  ]);
});

test('match: on-account when amount exceeds everything', () => {
  const r = suggestMatch({ narration: 'NEFT Anil Patil advance', amountPaise: 300000 }, CUST, OPEN);
  assert.equal(r.type, 'on_account');
  assert.equal(r.advancePaise, 64000);
});

test('match: ~10% short of a single invoice flags TDS, never auto-applies', () => {
  const r = suggestMatch({ narration: 'NEFT Anil Patil less TDS', amountPaise: 212400 }, CUST, OPEN);
  assert.equal(r.type, 'tds');
  assert.equal(r.tdsPaise, 23600);
});

test('sample statement: builds from a live book and contains the six cases', () => {
  const csv = buildSampleStatement({
    today: '2026-10-25',
    customers: CUST,
    invoices: [
      { customerId: 'a', number: 'A1', outstanding: 118000, dueDate: '2026-09-01', status: 'sent' },
      { customerId: 'a', number: 'A2', outstanding: 59000, dueDate: '2026-09-20', status: 'sent' },
      { customerId: 'c', number: 'C1', outstanding: 236000, dueDate: '2026-08-01', status: 'sent' },
    ],
  });
  const { rows } = parseBankCSV(csv);
  assert.ok(rows.length >= 5);
  const types = new Set();
  for (const r of rows) {
    const m = suggestMatch(r, CUST, OPEN);
    types.add(m.type);
  }
  for (const t of ['exact', 'combined', 'part', 'tds', 'on_account', 'unknown_customer']) assert.ok(types.has(t), `missing case ${t}: got ${[...types]}`);
});

// ---- forecast ----

test('forecast: closing chains into next opening; A/B/C delays shift inflows', () => {
  const weeks = forecast({
    today: '2026-10-26', // a Monday
    cashPaise: 45000000, safetyPaise: 15000000,
    invoices: [
      { customerId: 'a', number: 'A1', outstanding: 100000, dueDate: '2026-10-28', status: 'sent' }, // A -> week 0
      { customerId: 'b', number: 'B1', outstanding: 200000, dueDate: '2026-10-28', status: 'sent' }, // B -> week 1
      { customerId: 'c', number: 'C1', outstanding: 400000, dueDate: '2026-10-28', status: 'sent' }, // C -> week 4
    ],
    customers: [
      { id: 'a', grade: 'A' }, { id: 'b', grade: 'B' }, { id: 'c', grade: 'C' },
    ],
    expenses: [{ label: 'rent', category: 'rent', amountPaise: 6500000, recurrence: 'monthly', dayOfMonth: 1 }],
  });
  assert.equal(weeks.length, 13);
  for (let i = 0; i < 12; i++) assert.equal(weeks[i].closingPaise, weeks[i + 1].openingPaise);
  assert.equal(weeks[0].inPaise, 100000);      // A on time
  assert.equal(weeks[1].inPaise, 200000);      // B one week late
  assert.equal(weeks[4].inPaise, 400000);      // C a month late
  assert.ok(weeks.some((w) => w.outPaise > 0)); // rent landed somewhere
});

test('forecast: shortfall week is visible and headline finds it', () => {
  const weeks = forecast({
    today: '2026-10-26',
    cashPaise: 1000000, safetyPaise: 1500000,
    invoices: [],
    customers: [],
    expenses: [{ label: 'salaries', category: 'salary', amountPaise: 24000000, recurrence: 'monthly', dayOfMonth: 1 }],
  });
  const short = weeks.filter((w) => w.closingPaise < 0);
  assert.ok(short.length >= 1);
  const h = forecastHeadline(weeks);
  assert.ok(h.worstWeek.closingPaise < 0);
  assert.ok(h.shortfall > 0);
});

test('forecast: what-if override collects extra now and can pause outflows', () => {
  const base = {
    today: '2026-10-26', cashPaise: 1000000, safetyPaise: 0,
    invoices: [], customers: [],
    expenses: [{ label: 'salaries', category: 'salary', amountPaise: 24000000, recurrence: 'monthly', dayOfMonth: 1 }],
  };
  const w1 = forecast(base);
  const w2 = forecast({ ...base, overrides: { extraInPaise: 50000000 } });
  const w3 = forecast({ ...base, overrides: { pauseOutflows: true } });
  assert.equal(w2[0].inPaise, 50000000);
  assert.equal(w3[0].closingPaise, base.cashPaise);
  assert.ok(w2[12].closingPaise > w1[12].closingPaise);
});
