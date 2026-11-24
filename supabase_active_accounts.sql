-- Run after supabase_schema.sql and supabase_v12_users.sql.
begin;
drop policy if exists "only active accounts use app state" on public.app_state;
create policy "only active accounts use app state"
  on public.app_state as restrictive for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_active))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_active));
commit;
