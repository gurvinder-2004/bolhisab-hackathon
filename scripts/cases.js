import { toPaise, computeInvoice } from '../src/engine/index.js';

const reg = { registrationType: 'regular', stateCode: '27' };
const run = (b, pos, lines) => computeInvoice({ business: b, placeOfSupplyStateCode: pos, lines }).totals;
const L = (o) => ({ qty: 1, ratePaise: toPaise('10000'), gstRatePct: 18, ...o });
const f = (p) => `${Math.floor(Math.abs(p) / 100)}.${String(Math.abs(p) % 100).padStart(2, '0')}`; // plain 2-decimal display, no symbols

const rows = [];
const check = (name, expected, actual) => rows.push([name, expected, actual, expected === actual ? 'PASS' : 'FAIL']);

let t = run(reg, '27', [L()]);
check('10,000 @18% same state', 'CGST 900.00 + SGST 900.00 = 11800.00', `CGST ${f(t.cgst)} + SGST ${f(t.sgst)} = ${f(t.grandTotal)}`);
t = run(reg, '24', [L()]);
check('10,000 @18% other state', 'IGST 1800.00 = 11800.00', `IGST ${f(t.igst)} = ${f(t.grandTotal)}`);
t = run(reg, '27', [L({ qty: 3, ratePaise: toPaise('333'), gstRatePct: 5 })]);
check('3 x 333 @5% same state', 'CGST 24.98 + SGST 24.98, round off 0.04, total 1049.00', `CGST ${f(t.cgst)} + SGST ${f(t.sgst)}, round off ${f(t.roundOff)}, total ${f(t.grandTotal)}`);
t = run(reg, '24', [L({ qty: 3, ratePaise: toPaise('333'), gstRatePct: 5 })]);
check('3 x 333 @5% other state', 'IGST 49.95, round off 0.05, total 1049.00', `IGST ${f(t.igst)}, round off ${f(t.roundOff)}, total ${f(t.grandTotal)}`);
t = run(reg, '27', [L({ discountPct: 10 })]);
check('10% discount @18%', 'taxable 9000.00, tax 1620.00, total 10620.00', `taxable ${f(t.taxable)}, tax ${f(t.tax)}, total ${f(t.grandTotal)}`);
t = run({ registrationType: 'composition', stateCode: '27' }, null, [L()]);
check('Composition business', 'tax 0.00, total 10000.00', `tax ${f(t.tax)}, total ${f(t.grandTotal)}`);
t = run(reg, '27', [L({ gstRatePct: 0 })]);
check('0% item', 'tax 0.00, total 10000.00', `tax ${f(t.tax)}, total ${f(t.grandTotal)}`);

for (const r of rows) console.log(r.join(' | '));
if (rows.some((r) => r[3] === 'FAIL')) process.exit(1);
