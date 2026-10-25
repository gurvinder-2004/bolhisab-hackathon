// Pure row-mapping + balance math shared by the web UI and (later) the Android client.
// Supabase rows are snake_case; the domain code (match.js, status.js) is camelCase.

import { invoiceState } from '../domain/status.js';
import { todayIST } from '../engine/dates.js';

export const mapCustomerRow = (r) => ({
  id: r.id, businessId: r.business_id, name: r.name, shopName: r.shop_name,
  area: r.area, city: r.city, phone: r.phone, stateCode: r.state_code,
  gstin: r.gstin, creditDays: r.credit_days, lang: r.lang,
});

export const mapInvoiceRow = (r) => ({
  id: r.id, customerId: r.customer_id, number: r.number,
  invoiceDate: r.invoice_date, dueDate: r.due_date, totalPaise: r.total_paise,
  statusOverride: r.status_override,
  docType: r.doc_type, supply: r.supply, placeOfSupplyCode: r.place_of_supply_code,
  taxablePaise: r.taxable_paise, cgstPaise: r.cgst_paise, sgstPaise: r.sgst_paise,
  igstPaise: r.igst_paise, roundOffPaise: r.round_off_paise, lines: r.lines,
});

// What one customer owes: open invoices + quick khata credits - unallocated payments.
export function customerBalanceFromRows({ invoices, payments, allocations, credits, today = todayIST() }) {
  const paid = new Map();
  for (const a of allocations) {
    const key = a.invoiceId ?? a.invoice_id;
    paid.set(key, (paid.get(key) ?? 0) + (a.amountPaise ?? a.amount_paise ?? 0));
  }
  const paidSum = (id) => paid.get(id) ?? 0;

  let invoiceOutstanding = 0;
  const openInvoices = [];
  for (const inv of invoices) {
    const st = invoiceState(inv, paidSum(inv.id), today);
    if (st.outstanding > 0) { invoiceOutstanding += st.outstanding; openInvoices.push({ ...inv, outstandingPaise: st.outstanding, status: st.status, daysOverdue: st.daysOverdue }); }
  }
  const creditsPaise = credits.reduce((s, c) => s + (c.amountPaise ?? c.amount_paise ?? 0), 0);
  const paidTotal = payments.reduce((s, p) => s + (p.amountPaise ?? p.amount_paise ?? 0), 0);
  const allocatedTotal = allocations.reduce((s, a) => s + (a.amountPaise ?? a.amount_paise ?? 0), 0);
  const onAccountPaise = Math.max(0, paidTotal - allocatedTotal);
  return {
    invoiceOutstandingPaise: invoiceOutstanding,
    creditsPaise,
    onAccountPaise,
    balancePaise: invoiceOutstanding + creditsPaise - onAccountPaise,
    openInvoices,
  };
}
