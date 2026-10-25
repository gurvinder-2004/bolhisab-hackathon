import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toPaise, formatINR, amountInWords, computeInvoice, validateGstin, makeGstin, gstinCheckChar,
  nextInvoiceNumber, financialYear, todayIST, daysOverdue, addDays, einvoiceRequired, hsnDigitsRequired,
} from '../src/engine/index.js';

const regular = { registrationType: 'regular', stateCode: '27' };
const item = (o) => ({ qty: 1, ratePaise: toPaise('10000'), gstRatePct: 18, ...o });
const inv = (business, pos, lines) => computeInvoice({ business, placeOfSupplyStateCode: pos, lines });

test('money: exact paise, no float drift', () => {
  assert.equal(toPaise('333'), 33300);
  assert.equal(toPaise(0.1) + toPaise(0.2), 30);
  assert.equal(toPaise('1,00,000.50'), 10000050);
  assert.equal(toPaise('₹19.999'), 2000);
  assert.equal(toPaise('-5.25'), -525);
  assert.throws(() => toPaise('abc'));
});

test('format: Indian grouping', () => {
  assert.equal(formatINR(10000000), '₹1,00,000');
  assert.equal(formatINR(123456789), '₹12,34,567.89');
  assert.equal(formatINR(-50000), '-₹500');
  assert.equal(formatINR(0), '₹0');
});

test('words: Indian system', () => {
  assert.equal(amountInWords(11800000), 'Rupees One Lakh Eighteen Thousand Only');
  assert.equal(amountInWords(1180000), 'Rupees Eleven Thousand Eight Hundred Only');
  assert.equal(amountInWords(0), 'Rupees Zero Only');
  assert.equal(amountInWords(1000000000), 'Rupees One Crore Only');
  assert.equal(amountInWords(105050), 'Rupees One Thousand Fifty and Fifty Paise Only');
  assert.equal(amountInWords(100000000000), 'Rupees One Hundred Crore Only');
});

test('GST: Rs10,000 @18% same state = CGST 900 + SGST 900 = 11,800', () => {
  const r = inv(regular, '27', [item()]);
  assert.equal(r.supply, 'INTRA');
  assert.deepEqual(
    [r.totals.cgst, r.totals.sgst, r.totals.igst, r.totals.grandTotal, r.totals.roundOff],
    [90000, 90000, 0, 1180000, 0],
  );
  assert.equal(r.docType, 'TAX_INVOICE');
});

test('GST: same invoice to Gujarat = IGST 1,800 = 11,800', () => {
  const r = inv(regular, '24', [item()]);
  assert.equal(r.supply, 'INTER');
  assert.deepEqual([r.totals.cgst, r.totals.sgst, r.totals.igst, r.totals.grandTotal], [0, 0, 180000, 1180000]);
});

test('GST: 3 x Rs333 @5% - CGST/SGST rounded separately, may differ from IGST by a paisa', () => {
  const lines = [item({ qty: 3, ratePaise: toPaise('333'), gstRatePct: 5 })];
  const a = inv(regular, '27', lines);
  assert.deepEqual([a.totals.taxable, a.totals.cgst, a.totals.sgst, a.totals.beforeRound, a.totals.roundOff, a.totals.grandTotal],
    [99900, 2498, 2498, 104896, 4, 104900]);
  const b = inv(regular, '24', lines);
  assert.deepEqual([b.totals.igst, b.totals.beforeRound, b.totals.roundOff, b.totals.grandTotal], [4995, 104895, 5, 104900]);
});

test('GST: 10% discount', () => {
  const r = inv(regular, '27', [item({ discountPct: 10 })]);
  assert.deepEqual([r.totals.taxable, r.totals.cgst, r.totals.sgst, r.totals.grandTotal], [900000, 81000, 81000, 1062000]);
});

test('GST: flat discount + 0% item', () => {
  const r = inv(regular, '27', [item({ gstRatePct: 0, discountPaise: toPaise('500') })]);
  assert.deepEqual([r.totals.taxable, r.totals.tax, r.totals.grandTotal], [950000, 0, 950000]);
});

test('GST: round-off line, down and half-up', () => {
  const down = inv(regular, '27', [item({ ratePaise: toPaise('100.10'), gstRatePct: 0 })]);
  assert.deepEqual([down.totals.roundOff, down.totals.grandTotal], [-10, 10000]);
  const half = inv(regular, '27', [item({ ratePaise: toPaise('100.50'), gstRatePct: 0 })]);
  assert.deepEqual([half.totals.roundOff, half.totals.grandTotal], [50, 10100]);
});

test('GST: totals equal the sum of the lines', () => {
  const r = inv(regular, '27', [
    item({ qty: '2.5', ratePaise: toPaise('99.99'), gstRatePct: 5 }),
    item({ qty: 7, ratePaise: toPaise('13.37'), gstRatePct: 18 }),
    item({ qty: 1, ratePaise: toPaise('1250'), gstRatePct: 3 }),
  ]);
  const s = (k) => r.lines.reduce((a, l) => a + l[k], 0);
  assert.equal(r.totals.taxable, s('taxable'));
  assert.equal(r.totals.cgst, s('cgst'));
  assert.equal(r.totals.beforeRound, s('taxable') + s('tax'));
  assert.equal(r.totals.grandTotal % 100, 0);
});

test('Composition: Bill of Supply, no GST', () => {
  const r = inv({ registrationType: 'composition', stateCode: '27' }, null, [item()]);
  assert.equal(r.docType, 'BILL_OF_SUPPLY');
  assert.match(r.note, /not eligible to collect tax on supplies/);
  assert.deepEqual([r.totals.tax, r.totals.grandTotal], [0, 1000000]);
});

test('Unregistered: plain invoice, no GST', () => {
  const r = inv({ registrationType: 'unregistered', stateCode: '27' }, null, [item()]);
  assert.equal(r.docType, 'INVOICE');
  assert.equal(r.totals.tax, 0);
});

test('GST: guards', () => {
  assert.throws(() => inv(regular, '27', [item({ gstRatePct: 12 })]), /not in config/);
  assert.throws(() => inv(regular, null, [item()]), /Place of supply/);
  assert.throws(() => inv(regular, '27', []), /at least one/);
  assert.throws(() => inv(regular, '27', [item({ discountPaise: 99999999 })]), /Discount/);
});

test('GSTIN: made-up samples pass, any single-character change fails', () => {
  const samples = ['27AABCS1234C1Z', '24AAACG5678D1Z', '29AAFCB9012E1Z'].map(makeGstin);
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const g of samples) {
    assert.equal(validateGstin(g).valid, true, g);
    for (let i = 0; i < 15; i++) {
      for (const c of CHARS) {
        if (c === g[i]) continue;
        assert.equal(validateGstin(g.slice(0, i) + c + g.slice(i + 1)).valid, false, `${g} pos ${i} -> ${c}`);
      }
    }
  }
  assert.equal(validateGstin(samples[0]).stateCode, '27');
  assert.equal(validateGstin('27AABCS1234C1Z').valid, false); // 14 chars
  assert.equal(validateGstin(samples[0].toLowerCase()).valid, true); // case-insensitive
});

test('GSTIN: algorithm matches a widely published example', () => {
  assert.equal(gstinCheckChar('27AAPFU0939F1Z'), 'V');
});

test('Invoice numbers: consecutive per financial year, never repeat, max 16 chars', () => {
  assert.equal(financialYear('2026-03-31'), '25-26');
  assert.equal(financialYear('2026-04-01'), '26-27');
  assert.equal(nextInvoiceNumber([], '2026-10-24'), 'INV/26-27/0001');
  const used = ['INV/26-27/0001', 'INV/26-27/0002', 'INV/25-26/0150'];
  assert.equal(nextInvoiceNumber(used, '2026-10-24'), 'INV/26-27/0003');
  assert.equal(nextInvoiceNumber(used, '2027-04-01'), 'INV/27-28/0001');
  assert.equal(nextInvoiceNumber(used, '2027-03-31'), 'INV/26-27/0003');
  assert.ok(nextInvoiceNumber(['INV/26-27/9999'], '2026-10-24').length <= 16);
});

test('Dates: IST day, whole-day overdue', () => {
  assert.equal(todayIST(new Date('2026-10-23T20:00:00Z')), '2026-10-24'); // 01:30 IST next day
  assert.equal(todayIST(new Date('2026-10-24T18:29:00Z')), '2026-10-24');
  assert.equal(todayIST(new Date('2026-10-24T18:31:00Z')), '2026-10-25');
  assert.equal(daysOverdue('2026-10-01', '2026-10-24'), 23);
  assert.equal(daysOverdue('2026-11-01', '2026-10-24'), 0);
  assert.equal(addDays('2026-02-27', 3), '2026-03-02');
});

test('Thresholds: e-invoicing and HSN digits only ABOVE Rs 5 crore', () => {
  assert.equal(einvoiceRequired(5_000_000_000), false);
  assert.equal(einvoiceRequired(5_000_000_001), true);
  assert.equal(hsnDigitsRequired(5_000_000_000), 4);
  assert.equal(hsnDigitsRequired(5_000_000_001), 6);
});
