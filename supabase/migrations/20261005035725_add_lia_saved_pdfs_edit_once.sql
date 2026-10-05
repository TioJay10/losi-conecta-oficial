create table public.losi_ai_documents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),
 content text not null check(length(btrim(content)) between 1 and 60000),
 pdf_base64 text not null check(length(pdf_base64) between 20 and 2800000 and pdf_base64 ~ '^JVBERi0[A-Za-z0-9+/]*={0,2}$'),
 edit_count smallint not null default 0 check(edit_count between 0 and 1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index losi_ai_documents_owner_created on public.losi_ai_documents(user_id,created_at desc);
alter table public.losi_ai_documents enable row level security;
revoke all on public.losi_ai_documents from public,anon,authenticated;
grant select,delete on public.losi_ai_documents to authenticated;
grant insert(title,content,pdf_base64) on public.losi_ai_documents to authenticated;
grant update(title,content,pdf_base64) on public.losi_ai_documents to authenticated;
grant all on public.losi_ai_documents to service_role;
create policy ai_documents_read on public.losi_ai_documents for select to authenticated using(user_id=(select auth.uid()));
create policy ai_documents_insert on public.losi_ai_documents for insert to authenticated with check(user_id=(select auth.uid()) and edit_count=0);
create policy ai_documents_update on public.losi_ai_documents for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy ai_documents_delete on public.losi_ai_documents for delete to authenticated using(user_id=(select auth.uid()));
-- The counter cannot be written by clients. PostgreSQL locks the row for updates,
-- so concurrent edits also allow only one successful save.
create function public.losi_ai_document_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.edit_count >= 1 then raise exception 'PDF_EDIT_LIMIT'; end if;
 if new.id <> old.id or new.user_id <> old.user_id then raise exception 'PDF_OWNER_IMMUTABLE'; end if;
 new.edit_count := old.edit_count + 1;
 new.created_at := old.created_at;
 new.updated_at := now();
 return new;
end $$;
revoke all on function public.losi_ai_document_guard() from public,anon,authenticated;
create trigger losi_ai_document_edit_once before update on public.losi_ai_documents
for each row execute function public.losi_ai_document_guard();

