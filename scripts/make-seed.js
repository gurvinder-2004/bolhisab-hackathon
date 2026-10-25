import { writeFileSync } from 'node:fs';
import { buildDemoData } from '../src/data/index.js';

const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const insert = (table, cols, rows) =>
  rows.length ? `insert into ${table} (${cols.join(', ')}) values\n${rows.map((r) => '  (' + r.map(q).join(', ') + ')').join(',\n')};\n` : '';

export function seedSql(d = buildDemoData()) {
  const b = d.business;
  return [
    '-- Demo data for Baaki. Everything is made up. Re-running resets the demo.',
    'truncate table events, payment_allocations, payments, credit_entries, expenses, invoices, customers, businesses cascade;',
    insert('businesses', ['id','name','owner_name','address','state_code','gstin','registration_type','turnover_paise','udyam_registered','bank_name','bank_account','bank_ifsc','upi_id','cash_balance_paise','safety_buffer_paise'],
      [[b.id,b.name,b.ownerName,b.address,b.stateCode,b.gstin,b.registrationType,b.turnoverPaise,b.udyamRegistered,b.bankName,b.bankAccount,b.bankIfsc,b.upiId,b.cashBalancePaise,b.safetyBufferPaise]]),
    insert('customers', ['id','business_id','name','shop_name','area','city','state_code','gstin','phone','credit_days','lang'],
      d.customers.map((c) => [c.id,b.id,c.name,c.shopName,c.area,c.city,c.stateCode,c.gstin,c.phone,c.creditDays,c.lang])),
    insert('invoices', ['id','business_id','customer_id','number','invoice_date','due_date','doc_type','supply','place_of_supply_code','lines','taxable_paise','cgst_paise','sgst_paise','igst_paise','round_off_paise','total_paise','status_override'],
      d.invoices.map((i) => [i.id,i.businessId,i.customerId,i.number,i.invoiceDate,i.dueDate,i.docType,i.supply,i.placeOfSupplyCode,i.lines,i.taxablePaise,i.cgstPaise,i.sgstPaise,i.igstPaise,i.roundOffPaise,i.totalPaise,i.statusOverride])),
    insert('payments', ['id','business_id','customer_id','amount_paise','paid_on','reference','mode','source','confirmed'],
      d.payments.map((p) => [p.id,p.businessId,p.customerId,p.amountPaise,p.paidOn,p.reference,p.mode,p.source,p.confirmed])),
    insert('payment_allocations', ['payment_id','invoice_id','amount_paise'], d.allocations.map((a) => [a.paymentId,a.invoiceId,a.amountPaise])),
    insert('credit_entries', ['id','business_id','customer_id','amount_paise','note','entry_date','source'],
      d.creditEntries.map((c) => [c.id,c.businessId,c.customerId,c.amountPaise,c.note,c.entryDate,c.source])),
    insert('expenses', ['id','business_id','label','category','amount_paise','recurrence','day_of_month','due_date'],
      d.expenses.map((e) => [e.id,e.businessId,e.label,e.category,e.amountPaise,e.recurrence,e.dayOfMonth,e.dueDate])),
  ].join('\n');
}

if (process.argv[1].endsWith('make-seed.js')) {
  writeFileSync(new URL('../supabase/seed.sql', import.meta.url), seedSql());
  console.log('wrote supabase/seed.sql');
}
