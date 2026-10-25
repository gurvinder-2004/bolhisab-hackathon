-- Baaki schema. Paste into Supabase > SQL Editor > Run. Safe to re-run.
-- All money is whole paise (bigint). Dates are plain dates in IST.

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  address text,
  state_code text not null,
  gstin text,
  registration_type text not null check (registration_type in ('regular','composition','unregistered')),
  turnover_paise bigint not null default 0,
  udyam_registered boolean not null default false,
  bank_name text, bank_account text, bank_ifsc text, upi_id text,
  cash_balance_paise bigint not null default 0,
  safety_buffer_paise bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  shop_name text,
  area text,
  city text,
  state_code text not null,
  gstin text,
  phone text,
  credit_days int not null default 30,
  lang text not null default 'hi',
  created_at timestamptz not null default now()
);
create index if not exists customers_business_idx on customers(business_id);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  number text,                       -- null while a draft
  invoice_date date not null,
  due_date date not null,
  doc_type text not null check (doc_type in ('TAX_INVOICE','BILL_OF_SUPPLY','INVOICE')),
  supply text not null check (supply in ('INTRA','INTER','NONE')),
  place_of_supply_code text,
  lines jsonb not null default '[]',
  taxable_paise bigint not null, cgst_paise bigint not null default 0, sgst_paise bigint not null default 0,
  igst_paise bigint not null default 0, round_off_paise bigint not null default 0, total_paise bigint not null,
  status_override text check (status_override in ('draft','disputed')),
  reverse_charge boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, number)
);
create index if not exists invoices_customer_idx on invoices(customer_id);
create index if not exists invoices_due_idx on invoices(business_id, due_date);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  amount_paise bigint not null check (amount_paise > 0),
  paid_on date not null,
  reference text,
  mode text,
  source text not null default 'manual',      -- manual | voice | bank_import | seed
  confirmed boolean not null default true,    -- nothing counts as paid until the owner confirms
  created_at timestamptz not null default now()
);

create table if not exists payment_allocations (
  payment_id uuid not null references payments(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  primary key (payment_id, invoice_id)
);

-- Quick khata entries: "Gupta ji ne 400 ka samaan liya", no GST invoice yet.
create table if not exists credit_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  note text,
  entry_date date not null,
  source text not null default 'manual',      -- manual | voice | seed
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  label text not null,
  category text not null,
  amount_paise bigint not null check (amount_paise > 0),
  recurrence text check (recurrence in ('monthly')),
  day_of_month int check (day_of_month between 1 and 28),
  due_date date
);

-- Timeline: reminders sent, disputes, promises, voice commands (used from M4).
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- DEMO ONLY: open access so the phone and the web dashboard can share fake data without a login.
-- Before real use, replace these with per-user policies (Supabase Auth). Never store real data under these.
do $$
declare t text;
begin
  foreach t in array array['businesses','customers','invoices','payments','payment_allocations','credit_entries','expenses','events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_open on %I', t);
    execute format('create policy demo_open on %I for all using (true) with check (true)', t);
  end loop;
end $$;
