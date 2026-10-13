-- Ever After — live updates (row-level security still applies to every change a client receives)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bills') then alter publication supabase_realtime add table public.bills; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bill_periods') then alter publication supabase_realtime add table public.bill_periods; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then alter publication supabase_realtime add table public.profiles; end if;
end $$;
alter table public.bill_periods replica identity full;
