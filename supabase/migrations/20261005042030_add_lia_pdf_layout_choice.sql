alter table public.losi_ai_documents add column layout text not null default 'classic' check(layout in ('classic','geometric'));
grant insert(layout),update(layout) on public.losi_ai_documents to authenticated;
