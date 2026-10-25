-- Run once in Supabase SQL Editor so the web dashboard updates live when the phone adds something.
-- Safe to re-run: only adds tables that are not already in the publication.
do $$
declare t text;
begin
  foreach t in array array['invoices','payments','payment_allocations','credit_entries','customers','events'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
