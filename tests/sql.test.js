import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { buildDemoData } from '../src/data/index.js';
import { seedSql } from '../scripts/make-seed.js';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const d = buildDemoData();
const one = async (db, sql) => (await db.query(sql)).rows[0];

test('schema.sql and seed.sql load into real Postgres and agree with the JS data', async () => {
  const db = new PGlite();
  await db.exec(schema);
  await db.exec(schema); // safe to re-run
  await db.exec(seedSql(d));
  await db.exec(seedSql(d)); // re-seed resets, no duplicates
  assert.equal((await one(db, 'select count(*)::int n from invoices')).n, 77);
  assert.equal((await one(db, 'select count(*)::int n from customers')).n, 12);
  assert.equal((await one(db, 'select count(*)::int n from credit_entries')).n, 8);
  assert.equal((await one(db, 'select count(*)::int n from expenses')).n, 8);
  assert.equal((await one(db, 'select sum(total_paise)::text s from invoices')).s, String(d.invoices.reduce((s, i) => s + i.totalPaise, 0)));
  assert.equal((await one(db, 'select sum(amount_paise)::text s from payments')).s, String(d.payments.reduce((s, p) => s + p.amountPaise, 0)));
  assert.equal((await one(db, "select count(*)::int n from invoices where status_override = 'draft' and number is null")).n, 1);
  assert.equal((await one(db, "select lines->0->>'hsn' h from invoices where number = 'INV/26-27/0001'")).h.length, 4);
});

test('constraints: no duplicate invoice numbers, no zero or negative payments', async () => {
  const db = new PGlite();
  await db.exec(schema);
  await db.exec(seedSql(d));
  const i = d.invoices.find((x) => x.number);
  await assert.rejects(db.query(`insert into invoices (business_id, customer_id, number, invoice_date, due_date, doc_type, supply, taxable_paise, total_paise)
    values ('${i.businessId}', '${i.customerId}', '${i.number}', '2026-10-24', '2026-11-24', 'TAX_INVOICE', 'INTRA', 100, 100)`));
  await assert.rejects(db.query(`insert into payments (business_id, amount_paise, paid_on) values ('${i.businessId}', 0, '2026-10-24')`));
});
