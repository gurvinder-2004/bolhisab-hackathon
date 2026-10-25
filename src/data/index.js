import { mulberry32, int, uuid } from '../domain/rng.js';
import { computeInvoice, toPaise, addDays, nextInvoiceNumber } from '../engine/index.js';
import { BUSINESS } from './business.js';
import { CUSTOMERS } from './customers.js';

export const SEED_TODAY = '2026-10-24';

// Sample rates are placeholders for the demo: check cbic-gst.gov.in before presenting.
const CATALOG = [
  { description: '5-ply corrugated carton 18x12x10 in', hsn: '4819', unit: 'pcs', rate: '28.50', gst: 5, qty: [500, 4000] },
  { description: '3-ply corrugated carton 12x9x6 in', hsn: '4819', unit: 'pcs', rate: '14', gst: 5, qty: [1000, 6000] },
  { description: 'Printed carton, 1 colour offset', hsn: '4819', unit: 'pcs', rate: '42', gst: 5, qty: [500, 3000] },
  { description: 'Packing tape 48mm x 100m', hsn: '3919', unit: 'rolls', rate: '55', gst: 18, qty: [20, 200] },
  { description: 'Bubble wrap roll 1m x 50m', hsn: '3921', unit: 'rolls', rate: '620', gst: 18, qty: [5, 40] },
];

const CREDITS = [ // quick khata entries (no GST invoice): [customer index, rupees, note, days ago, source]
  [0, '400', 'tape rolls, 2 pcs', 5, 'voice'], [7, '1250', 'sample cartons', 9, 'manual'], [9, '780', 'bubble wrap, 1 roll', 3, 'voice'],
  [2, '2200', 'loose cartons', 12, 'manual'], [6, '350', 'tape rolls', 2, 'voice'], [10, '960', 'sample print run', 20, 'manual'],
  [1, '1500', 'cartons for trial', 15, 'manual'], [3, '640', 'tape and wrap', 7, 'voice'],
];

const EXPENSES = [ // monthly ones recur on dayOfMonth; one-off supplier bills have a dueDate
  { label: 'Salaries (8 employees)', category: 'salary', amount: '240000', recurrence: 'monthly', dayOfMonth: 1 },
  { label: 'Factory rent', category: 'rent', amount: '65000', recurrence: 'monthly', dayOfMonth: 5 },
  { label: 'Electricity', category: 'utility', amount: '38000', recurrence: 'monthly', dayOfMonth: 12 },
  { label: 'GST payment', category: 'tax', amount: '120000', recurrence: 'monthly', dayOfMonth: 20 },
  { label: 'Shree Paper Mills - kraft paper', category: 'supplier', amount: '420000', dueDate: '2026-11-02' },
  { label: 'Shree Paper Mills - kraft paper', category: 'supplier', amount: '310000', dueDate: '2026-11-18' },
  { label: 'Ink and adhesives - Colourchem', category: 'supplier', amount: '95000', dueDate: '2026-11-09' },
  { label: 'Shree Paper Mills - kraft paper', category: 'supplier', amount: '480000', dueDate: '2026-12-05' },
];

export function buildDemoData(today = SEED_TODAY) {
  const rng = mulberry32(20261024);
  const business = { id: uuid(rng), ...BUSINESS };
  const engineBiz = { registrationType: business.registrationType, stateCode: business.stateCode };
  const customers = CUSTOMERS.map(({ profile, ...c }) => ({ id: uuid(rng), ...c }));
  const profiles = CUSTOMERS.map((c) => c.profile);

  const makeLines = () => {
    const n = int(rng, 1, 3), picked = new Set();
    while (picked.size < n) picked.add(int(rng, 0, CATALOG.length - 1));
    return [...picked].map((i) => {
      const c = CATALOG[i];
      return { description: c.description, hsn: c.hsn, unit: c.unit, qty: int(rng, c.qty[0], c.qty[1]), ratePaise: toPaise(c.rate), gstRatePct: c.gst };
    });
  };

  // 1. decide dates per customer: 3 older (history) + 3-4 recent
  const raw = [];
  customers.forEach((c, ci) => {
    const nRecent = ci < 4 ? 4 : 3;
    for (let k = 0; k < 3; k++) raw.push({ ci, recent: false, date: addDays(today, -183 + k * 18 + int(rng, 0, 8)) });
    const step = Math.floor(117 / nRecent);
    for (let k = 0; k < nRecent; k++) raw.push({ ci, recent: true, date: addDays(today, -120 + k * step + int(rng, 0, step - 1)) });
  });
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ci - b.ci));

  // 2. build invoices in date order so numbers are consecutive
  const invoices = [], numbers = [];
  for (const r of raw) {
    const c = customers[r.ci];
    const lines = makeLines();
    const calc = computeInvoice({ business: engineBiz, placeOfSupplyStateCode: c.stateCode, lines });
    const number = nextInvoiceNumber(numbers, r.date);
    numbers.push(number);
    invoices.push({
      id: uuid(rng), businessId: business.id, customerId: c.id, ci: r.ci, recent: r.recent, number,
      invoiceDate: r.date, dueDate: addDays(r.date, c.creditDays), docType: calc.docType, supply: calc.supply,
      placeOfSupplyCode: calc.placeOfSupply.code, lines: calc.lines.map((l, i) => ({ ...lines[i], ...l })),
      taxablePaise: calc.totals.taxable, cgstPaise: calc.totals.cgst, sgstPaise: calc.totals.sgst, igstPaise: calc.totals.igst,
      roundOffPaise: calc.totals.roundOff, totalPaise: calc.totals.grandTotal, statusOverride: null,
    });
  }

  // 3. one draft, not yet numbered
  {
    const ci = 2, c = customers[ci], lines = makeLines().slice(0, 1);
    const calc = computeInvoice({ business: engineBiz, placeOfSupplyStateCode: c.stateCode, lines });
    invoices.push({
      id: uuid(rng), businessId: business.id, customerId: c.id, ci, recent: true, number: null, invoiceDate: today, dueDate: addDays(today, c.creditDays),
      docType: calc.docType, supply: calc.supply, placeOfSupplyCode: calc.placeOfSupply.code, lines: calc.lines.map((l, i) => ({ ...lines[i], ...l })),
      taxablePaise: calc.totals.taxable, cgstPaise: calc.totals.cgst, sgstPaise: calc.totals.sgst, igstPaise: calc.totals.igst,
      roundOffPaise: calc.totals.roundOff, totalPaise: calc.totals.grandTotal, statusOverride: 'draft',
    });
  }

  // 4. payments, from how each customer pays
  const payments = [], allocations = [];
  const modes = ['upi', 'neft', 'upi', 'cheque'];
  const pay = (inv, amount, paidOn) => {
    const p = { id: uuid(rng), businessId: business.id, customerId: inv.customerId, amountPaise: amount, paidOn, reference: 'REF' + int(rng, 100000, 999999), mode: modes[int(rng, 0, 3)], source: 'seed', confirmed: true };
    payments.push(p);
    allocations.push({ paymentId: p.id, invoiceId: inv.id, amountPaise: amount });
  };
  const issued = invoices.filter((i) => i.statusOverride !== 'draft');
  const kulkarniLatest = [...issued].filter((i) => i.ci === 4).pop();
  let mehtaDone = false;
  for (const inv of issued) {
    const pr = profiles[inv.ci];
    if (inv === kulkarniLatest) { inv.statusOverride = 'disputed'; continue; }
    if (pr.stopsPayingAfter && inv.invoiceDate >= pr.stopsPayingAfter) continue;
    if (pr.ignoreDueBetween && inv.dueDate >= pr.ignoreDueBetween[0] && inv.dueDate <= pr.ignoreDueBetween[1]) continue;
    let payDate = addDays(inv.dueDate, pr.lateMean + int(rng, pr.jitter[0], pr.jitter[1]));
    if (payDate <= inv.invoiceDate) payDate = addDays(inv.invoiceDate, 1);
    if (payDate <= today) { pay(inv, inv.totalPaise, payDate); continue; }
    if (inv.ci === 9 && !mehtaDone) { // one part payment
      mehtaDone = true;
      pay(inv, Math.floor(inv.totalPaise / 2 / 100) * 100, today > inv.dueDate ? inv.dueDate : today);
    }
  }

  const creditEntries = CREDITS.map(([ci, rupees, note, ago, source]) => ({
    id: uuid(rng), businessId: business.id, customerId: customers[ci].id, amountPaise: toPaise(rupees), note, entryDate: addDays(today, -ago), source,
  }));
  const expenses = EXPENSES.map((e) => ({
    id: uuid(rng), businessId: business.id, label: e.label, category: e.category, amountPaise: toPaise(e.amount),
    recurrence: e.recurrence ?? null, dayOfMonth: e.dayOfMonth ?? null, dueDate: e.dueDate ?? null,
  }));

  const cleanInvoices = invoices.map(({ ci, recent, ...i }) => i);
  return { today, business, customers, invoices: cleanInvoices, payments, allocations, creditEntries, expenses };
}
