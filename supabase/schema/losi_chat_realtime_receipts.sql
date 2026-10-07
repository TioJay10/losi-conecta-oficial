create table public.losi_chat_receipts (
 message_id uuid not null references public.losi_chat_messages(id) on delete cascade,
 sender_id uuid not null references public.losi_chat_accounts(user_id),
 recipient_id uuid not null references public.losi_chat_accounts(user_id),
 delivered_at timestamptz,read_at timestamptz,
 primary key(message_id,recipient_id),check(sender_id<>recipient_id),check(read_at is null or delivered_at is not null)
);
create index losi_chat_receipts_recipient on public.losi_chat_receipts(recipient_id,message_id);
create index losi_chat_receipts_sender on public.losi_chat_receipts(sender_id,message_id);
alter table public.losi_chat_receipts enable row level security;
revoke all on public.losi_chat_receipts from public,anon,authenticated;
grant select on public.losi_chat_receipts to authenticated;
grant all on public.losi_chat_receipts to service_role;
create policy chat_receipt_participants on public.losi_chat_receipts for select to authenticated
 using((sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and exists(select 1 from public.losi_chat_messages m where m.id=message_id));
create function public.losi_chat_seed_receipts() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.thread_id is not null then
  insert into public.losi_chat_receipts(message_id,sender_id,recipient_id)
  select new.id,new.sender_id,case when t.user_a=new.sender_id then t.user_b else t.user_a end from public.losi_chat_threads t where t.id=new.thread_id;
 else
  insert into public.losi_chat_receipts(message_id,sender_id,recipient_id)
  select new.id,new.sender_id,m.user_id from public.losi_chat_group_members m where m.group_id=new.group_id and m.active and m.user_id<>new.sender_id and m.joined_at<=new.created_at;
 end if;
 return new;
end $$;
revoke all on function public.losi_chat_seed_receipts() from public,anon,authenticated;
grant execute on function public.losi_chat_seed_receipts() to service_role;
create trigger losi_chat_message_receipts after insert on public.losi_chat_messages for each row execute function public.losi_chat_seed_receipts();
insert into public.losi_chat_receipts(message_id,sender_id,recipient_id,delivered_at,read_at)
select m.id,m.sender_id,case when t.user_a=m.sender_id then t.user_b else t.user_a end,
 case when p.read_at>=m.created_at then p.read_at end,case when p.read_at>=m.created_at then p.read_at end
from public.losi_chat_messages m join public.losi_chat_threads t on t.id=m.thread_id
left join public.losi_chat_thread_preferences p on p.thread_id=t.id and p.user_id=case when t.user_a=m.sender_id then t.user_b else t.user_a end where m.deleted_at is null
on conflict do nothing;
insert into public.losi_chat_receipts(message_id,sender_id,recipient_id,delivered_at,read_at)
select m.id,m.sender_id,g.user_id,case when g.read_at>=m.created_at then g.read_at end,case when g.read_at>=m.created_at then g.read_at end
from public.losi_chat_messages m join public.losi_chat_group_members g on g.group_id=m.group_id and g.active and g.joined_at<=m.created_at and g.user_id<>m.sender_id
where m.deleted_at is null on conflict do nothing;
create function public.losi_chat_acknowledge(p_user uuid,p_ids uuid[],p_read boolean) returns void language sql security invoker set search_path='' as $$
 update public.losi_chat_receipts r set delivered_at=coalesce(r.delivered_at,clock_timestamp()),read_at=case when p_read then coalesce(r.read_at,clock_timestamp()) else r.read_at end
 from public.losi_chat_messages m where m.id=r.message_id and r.recipient_id=p_user and r.message_id=any(p_ids)
 and (r.delivered_at is null or (p_read and r.read_at is null)) and m.deleted_at is null
 and not exists(select 1 from public.losi_chat_hidden_messages h where h.user_id=p_user and h.message_id=m.id)
 and (exists(select 1 from public.losi_chat_threads t where t.id=m.thread_id and p_user in(t.user_a,t.user_b))
 or exists(select 1 from public.losi_chat_group_members g where g.group_id=m.group_id and g.user_id=p_user and g.active and g.joined_at<=m.created_at));
$$;
create function public.losi_chat_receipt_status(p_user uuid,p_ids uuid[]) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(q.message_id,jsonb_build_object('recipients',q.total,'delivered',q.delivered,'read',q.read,'status',case when q.total>0 and q.read=q.total then 'read' when q.total>0 and q.delivered=q.total then 'delivered' else 'sent' end)),'{}'::jsonb)
 from(select r.message_id,count(*) total,count(r.delivered_at) delivered,count(r.read_at) read from public.losi_chat_receipts r where r.sender_id=p_user and r.message_id=any(p_ids) group by r.message_id) q;
$$;
revoke all on function public.losi_chat_acknowledge(uuid,uuid[],boolean),public.losi_chat_receipt_status(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.losi_chat_acknowledge(uuid,uuid[],boolean),public.losi_chat_receipt_status(uuid,uuid[]) to service_role;
do $$ declare t text;begin
 foreach t in array array['losi_chat_messages','losi_chat_receipts','losi_chat_group_members','losi_chat_groups','losi_chat_hidden_messages'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
