import { roundDiv, toMilli, pctToBp } from './money.js';
import { amountInWords } from './words.js';
import { STATE_CODES } from './states.js';
import { GST_RATES, EINVOICE_THRESHOLD_PAISE } from '../config.js';

export const DOC_TYPES = {
  regular: { type: 'TAX_INVOICE', title: 'Tax Invoice', gst: true },
  composition: {
    type: 'BILL_OF_SUPPLY', title: 'Bill of Supply', gst: false,
    note: 'Composition taxable person, not eligible to collect tax on supplies',
  },
  unregistered: { type: 'INVOICE', title: 'Invoice', gst: false },
};

// supply: 'INTRA' (CGST+SGST), 'INTER' (IGST) or 'NONE' (no GST charged)
export function computeLine(line, supply) {
  const qtyMilli = toMilli(line.qty);
  const gross = roundDiv(qtyMilli * line.ratePaise, 1000);
  const pctDisc = roundDiv(gross * pctToBp(line.discountPct ?? 0), 10000);
  const discount = (line.discountPaise ?? 0) + pctDisc;
  if (discount > gross) throw new Error('Discount is more than the line value');
  const taxable = gross - discount;
  const rateBp = supply === 'NONE' ? 0 : pctToBp(line.gstRatePct ?? 0);

  let cgst = 0, sgst = 0, igst = 0;
  if (supply === 'INTRA') {
    cgst = roundDiv(taxable * rateBp, 20000); // half the rate, rounded separately
    sgst = roundDiv(taxable * rateBp, 20000);
  } else if (supply === 'INTER') {
    igst = roundDiv(taxable * rateBp, 10000);
  }
  const tax = cgst + sgst + igst;
  return { description: line.description ?? '', hsn: line.hsn ?? '', gross, discount, taxable, rateBp, cgst, sgst, igst, tax, lineTotal: taxable + tax };
}

export function computeInvoice({ business, placeOfSupplyStateCode, lines, reverseCharge = false }) {
  const doc = DOC_TYPES[business.registrationType];
  if (!doc) throw new Error(`Unknown registration type: ${business.registrationType}`);
  if (!lines?.length) throw new Error('Add at least one item');

  let supply = 'NONE';
  if (doc.gst) {
    if (!STATE_CODES[placeOfSupplyStateCode]) throw new Error('Place of supply state code is missing or unknown');
    supply = business.stateCode === placeOfSupplyStateCode ? 'INTRA' : 'INTER';
    for (const l of lines) {
      if (!GST_RATES.includes(Number(l.gstRatePct ?? 0))) {
        throw new Error(`GST rate ${l.gstRatePct}% is not in config.js`);
      }
    }
  }

  const out = lines.map((l) => computeLine(l, supply));
  const sum = (k) => out.reduce((a, l) => a + l[k], 0);
  const taxable = sum('taxable'), cgst = sum('cgst'), sgst = sum('sgst'), igst = sum('igst');
  const beforeRound = taxable + cgst + sgst + igst;
  const grandTotal = roundDiv(beforeRound, 100) * 100; // nearest rupee, half up
  return {
    docType: doc.type, title: doc.title, note: doc.note ?? null, supply, reverseCharge,
    placeOfSupply: doc.gst ? { code: placeOfSupplyStateCode, state: STATE_CODES[placeOfSupplyStateCode] } : null,
    lines: out,
    totals: { taxable, cgst, sgst, igst, tax: cgst + sgst + igst, beforeRound, roundOff: grandTotal - beforeRound, grandTotal },
    grandTotalWords: amountInWords(grandTotal),
  };
}

// e-invoicing (IRN) applies only ABOVE Rs 5 crore turnover.
export const einvoiceRequired = (turnoverPaise) => turnoverPaise > EINVOICE_THRESHOLD_PAISE;
// HSN digits: 4 up to Rs 5 crore turnover, 6 above.
export const hsnDigitsRequired = (turnoverPaise) => (turnoverPaise > EINVOICE_THRESHOLD_PAISE ? 6 : 4);
