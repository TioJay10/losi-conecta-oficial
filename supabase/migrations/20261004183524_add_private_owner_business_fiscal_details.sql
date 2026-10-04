create table public.business_fiscal_details (
  business_id uuid primary key references public.business_profiles(id) on delete cascade,
  document text,
  constraint business_fiscal_document_format check (document is null or document ~ '^([0-9]{11}|[A-Z0-9]{12}[0-9]{2})$')
);
alter table public.business_fiscal_details enable row level security;
revoke all on public.business_fiscal_details from public, anon, authenticated;
grant select, insert, update on public.business_fiscal_details to authenticated;
grant all on public.business_fiscal_details to service_role;
create policy "Owner reads fiscal details" on public.business_fiscal_details for select to authenticated
using (exists(select 1 from public.business_profiles b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "Owner creates fiscal details" on public.business_fiscal_details for insert to authenticated
with check (exists(select 1 from public.business_profiles b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "Owner updates fiscal details" on public.business_fiscal_details for update to authenticated
using (exists(select 1 from public.business_profiles b where b.id=business_id and b.owner_id=(select auth.uid())))
with check (exists(select 1 from public.business_profiles b where b.id=business_id and b.owner_id=(select auth.uid())));