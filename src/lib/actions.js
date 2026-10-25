// Client-side writes. Every mutation here happens only AFTER the confirm popup —
// the voice path never touches the books on its own.

import { supabase } from './supabase.js';
import { todayIST, addDays } from '../engine/dates.js';
import { toPaise } from '../engine/money.js';
import { computeInvoice } from '../engine/gst.js';
import { nextInvoiceNumber } from '../engine/invoiceNo.js';
import { invoiceState } from '../domain/status.js';
import { mapInvoiceRow, customerBalanceFromRows } from './ledger.js';

let businessPromise = null;
export function getBusiness() {
  if (!businessPromise) {
    businessPromise = supabase.from('businesses').select('*').limit(1)
      .then(({ data, error }) => {
        if (error || !data?.length) { businessPromise = null; throw new Error(error?.message || 'no business row'); }
        return data[0];
      });
  }
  return businessPromise;
}

export async function insertCreditEntry({ customerId, amountRupees, note }) {
  const biz = await getBusiness();
  const { data, error } = await supabase.from('credit_entries').insert({
    business_id: biz.id,
    customer_id: customerId,
    amount_paise: toPaise(String(amountRupees)),
    note: note || null,
    entry_date: todayIST(),
    source: 'voice',
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// Record a payment and allocate it FIFO (oldest open invoice first).
// Leftover money stays unallocated = "on account" and shows in the balance.
export async function recordPayment({ customerId, amountRupees, method }) {
  const biz = await getBusiness();
  const amountPaise = toPaise(String(amountRupees));

  const { data: invRows } = await supabase.from('invoices').select('*').eq('customer_id', customerId).order('invoice_date', { ascending: true });
  const invoices = (invRows ?? []).map(mapInvoiceRow);
  const ids = invoices.map((i) => i.id);
  let allocations = [];
  if (ids.length) {
    const { data: allocRows } = await supabase.from('payment_allocations').select('*').in('invoice_id', ids);
    const paid = new Map();
    for (const a of allocRows ?? []) paid.set(a.invoice_id, (paid.get(a.invoice_id) ?? 0) + a.amount_paise);
    let left = amountPaise;
    for (const inv of invoices) {
      if (left <= 0) break;
      const st = invoiceState(inv, paid.get(inv.id) ?? 0, todayIST());
      if (inv.statusOverride === 'draft' || st.outstanding <= 0) continue;
      const use = Math.min(left, st.outstanding);
      allocations.push({ invoiceId: inv.id, amountPaise: use });
      left -= use;
    }
  }

  const { data: payment, error } = await supabase.from('payments').insert({
    business_id: biz.id,
    customer_id: customerId,
    amount_paise: amountPaise,
    paid_on: todayIST(),
    mode: method || null,
    source: 'voice',
    confirmed: true, // the confirm popup IS the owner's confirmation
  }).select().single();
  if (error) throw new Error(error.message);

  if (allocations.length) {
    const { error: aErr } = await supabase.from('payment_allocations').insert(
      allocations.map((a) => ({ payment_id: payment.id, invoice_id: a.invoiceId, amount_paise: a.amountPaise })),
    );
    if (aErr) throw new Error(aErr.message);
  }
  return { payment, allocatedTo: allocations };
}

// Bank-import confirm: writes the payment exactly as the owner confirmed it.
// TDS-deducted rows also record the deducted tax as a TDS entry (money owed BY us / to set off).
export async function importBankPayment({ customerId, amountPaise, paidOn, ref, allocations = [], tdsPaise = 0, note }) {
  const biz = await getBusiness();
  const { data: payment, error } = await supabase.from('payments').insert({
    business_id: biz.id,
    customer_id: customerId,
    amount_paise: amountPaise,
    paid_on: paidOn,
    reference: ref || null,
    mode: 'bank_import',
    source: 'bank_import',
    confirmed: true, // the confirm tap IS the owner's confirmation
  }).select().single();
  if (error) throw new Error(error.message);
  if (allocations.length) {
    const { error: aErr } = await supabase.from('payment_allocations').insert(
      allocations.map((a) => ({ payment_id: payment.id, invoice_id: a.invoiceId, amount_paise: a.amountPaise })),
    );
    if (aErr) throw new Error(aErr.message);
  }
  if (tdsPaise > 0) {
    await supabase.from('expenses').insert({
      business_id: biz.id,
      label: `TDS deducted by customer${note ? ' — ' + note : ''}`,
      category: 'tds',
      amount_paise: tdsPaise,
      recurrence: null, day_of_month: null, due_date: null,
    });
  }
  return payment;
}

// Voice bill: an itemized sale straight into the khata as a real invoice.
// One line per spoken item (qty 1, 0% GST khata line) through the same engine as
// /invoices/new — so the chase ladder, ageing, FIFO payments and the pay link
// (where the customer verifies each item) all see it.
export async function createVoiceBill({ customerId, items }) {
  const biz = await getBusiness();
  const { data: cust } = await supabase.from('customers').select('*').eq('id', customerId).single();
  if (!cust) throw new Error('customer not found');
  const date = todayIST();
  const engineLines = items.map((it) => ({
    description: it.label, hsn: '', unit: 'pcs', qty: 1,
    ratePaise: toPaise(String(it.amountRupees)), gstRatePct: 0,
  }));
  const calc = computeInvoice({
    business: { registrationType: biz.registration_type, stateCode: biz.state_code },
    placeOfSupplyStateCode: cust.state_code ?? biz.state_code,
    lines: engineLines,
  });
  const { data: existing } = await supabase.from('invoices').select('number').not('number', 'is', null);
  const number = nextInvoiceNumber((existing ?? []).map((r) => r.number), date);
  const { data, error } = await supabase.from('invoices').insert({
    business_id: biz.id,
    customer_id: customerId,
    number,
    invoice_date: date,
    due_date: addDays(date, cust.credit_days ?? 30),
    doc_type: calc.docType, supply: calc.supply, place_of_supply_code: calc.placeOfSupply?.code ?? null,
    lines: engineLines.map((l, i) => ({ ...l, ...calc.lines[i] })),
    taxable_paise: calc.totals.taxable, cgst_paise: calc.totals.cgst, sgst_paise: calc.totals.sgst,
    igst_paise: calc.totals.igst, round_off_paise: calc.totals.roundOff, total_paise: calc.totals.grandTotal,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertCustomer({ name, phone, area, city }) {
  const biz = await getBusiness();
  const { data, error } = await supabase.from('customers').insert({
    business_id: biz.id,
    name: name.trim(),
    phone: phone?.trim() || null,
    area: area?.trim() || null,
    city: city?.trim() || null,
    state_code: biz.state_code,
    credit_days: 30,
    lang: 'hi',
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function logEvent({ kind, customerId, payload }) {
  const biz = await getBusiness();
  await supabase.from('events').insert({ business_id: biz.id, customer_id: customerId ?? null, kind, payload: payload ?? {} });
}

// Undo within the short window after a confirmed write.
export async function undoWrite({ kind, id }) {
  if (kind === 'payment') await supabase.from('payments').delete().eq('id', id); // allocations cascade
  else if (kind === 'credit') await supabase.from('credit_entries').delete().eq('id', id);
  else if (kind === 'invoice') {
    await supabase.from('payment_allocations').delete().eq('invoice_id', id); // safety: a just-made bill has none
    await supabase.from('invoices').delete().eq('id', id);
  }
}

export async function outstandingForCustomer(customerId) {
  const [inv, pay, cred] = await Promise.all([
    supabase.from('invoices').select('*').eq('customer_id', customerId),
    supabase.from('payments').select('*').eq('customer_id', customerId),
    supabase.from('credit_entries').select('*').eq('customer_id', customerId),
  ]);
  const payments = pay.data ?? [];
  const invoices = (inv.data ?? []).map(mapInvoiceRow);
  let allocations = [];
  if (invoices.length) {
    const { data } = await supabase.from('payment_allocations').select('*').in('invoice_id', invoices.map((i) => i.id));
    allocations = data ?? [];
  }
  return customerBalanceFromRows({ invoices, payments, allocations, credits: cred.data ?? [] });
}
