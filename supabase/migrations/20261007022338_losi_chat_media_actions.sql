alter table public.losi_chat_messages add column deleted_at timestamptz;
create table public.losi_chat_hidden_messages (
 user_id uuid not null references public.losi_chat_accounts(user_id),
 message_id uuid not null references public.losi_chat_messages(id),
 created_at timestamptz not null default clock_timestamp(), primary key(user_id,message_id)
);
alter table public.losi_chat_hidden_messages enable row level security;
revoke all on public.losi_chat_hidden_messages from anon,authenticated;
grant select on public.losi_chat_hidden_messages to authenticated;
grant all on public.losi_chat_hidden_messages to service_role;
create policy chat_own_hidden on public.losi_chat_hidden_messages for select to authenticated using(user_id=(select auth.uid()));
create policy chat_visible_messages on public.losi_chat_messages as restrictive for select to authenticated using(
 deleted_at is null and not exists(select 1 from public.losi_chat_hidden_messages h where h.user_id=(select auth.uid()) and h.message_id=losi_chat_messages.id));
create function public.losi_chat_delete_media(p_user uuid,p_message uuid,p_everyone boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare m public.losi_chat_messages;
begin
 select * into m from public.losi_chat_messages where id=p_message for update;
 if not found or m.attachment_id is null then raise exception 'ANEXO_INVALIDO';end if;
 if m.group_id is not null then
  if not exists(select 1 from public.losi_chat_group_members where group_id=m.group_id and user_id=p_user and active and joined_at<=m.created_at) then raise exception 'GRUPO_INDISPONIVEL';end if;
 elsif not exists(select 1 from public.losi_chat_threads where id=m.thread_id and p_user in(user_a,user_b)) then raise exception 'CONVERSA_INDISPONIVEL';end if;
 if p_everyone then
  if m.sender_id<>p_user then raise exception 'EXCLUSAO_NAO_PERMITIDA';end if;
  update public.losi_chat_messages set deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_message;
 else
  insert into public.losi_chat_hidden_messages(user_id,message_id) values(p_user,p_message) on conflict do nothing;
 end if;
end $$;
create function public.losi_chat_hidden_ids(p_user uuid,p_target uuid,p_group boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare joined timestamptz;
begin
 if p_group then
  select joined_at into joined from public.losi_chat_group_members where group_id=p_target and user_id=p_user and active;
  if not found then raise exception 'GRUPO_INDISPONIVEL';end if;
 elsif not exists(select 1 from public.losi_chat_threads where id=p_target and p_user in(user_a,user_b)) then raise exception 'CONVERSA_INDISPONIVEL';end if;
 return (select coalesce(jsonb_agg(m.id),'[]'::jsonb) from public.losi_chat_messages m
 where (case when p_group then m.group_id=p_target and m.created_at>=joined else m.thread_id=p_target end)
 and (m.deleted_at is not null or exists(select 1 from public.losi_chat_hidden_messages h where h.message_id=m.id and h.user_id=p_user)));
end $$;
revoke all on function public.losi_chat_delete_media(uuid,uuid,boolean),public.losi_chat_hidden_ids(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.losi_chat_delete_media(uuid,uuid,boolean),public.losi_chat_hidden_ids(uuid,uuid,boolean) to service_role;

create or replace function public.losi_chat_list_threads(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(q.item order by q.last_at desc),'[]'::jsonb) from (
  select jsonb_build_object('id',t.id,'name',b.business_name,'photo',b.logo_url,'number',a.digital_number,
   'last',case when m.id is null then null else to_jsonb(m) end,'favorite',coalesce(p.favorite,false),
   'unread',(select count(*) from public.losi_chat_messages u where u.thread_id=t.id and u.deleted_at is null and not exists(select 1 from public.losi_chat_hidden_messages h where h.message_id=u.id and h.user_id=p_user) and u.sender_id<>p_user and (p.read_at is null or u.created_at>p.read_at))) item,
   coalesce(m.created_at,t.created_at) last_at
  from public.losi_chat_threads t
  join public.losi_chat_accounts a on a.user_id=case when t.user_a=p_user then t.user_b else t.user_a end
  join public.business_profiles b on b.id=a.business_id
  left join public.losi_chat_thread_preferences p on p.thread_id=t.id and p.user_id=p_user
  left join lateral(select * from public.losi_chat_messages mm where mm.deleted_at is null and not exists(select 1 from public.losi_chat_hidden_messages h where h.message_id=mm.id and h.user_id=p_user) and thread_id=t.id order by created_at desc,id desc limit 1) m on true
  where p_user in(t.user_a,t.user_b)
 ) q
$$;

create or replace function public.losi_chat_list_groups(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(q.item order by q.last_at desc),'[]'::jsonb) from (
  select jsonb_build_object('id',g.id,'name',g.name,'photo',null,'number',null,'group',true,'favorite',me.favorite,
   'memberCount',(select count(*) from public.losi_chat_group_members where group_id=g.id and active),
   'last',case when m.id is null then null else to_jsonb(m) end,
   'unread',(select count(*) from public.losi_chat_messages u where u.group_id=g.id and u.deleted_at is null and not exists(select 1 from public.losi_chat_hidden_messages h where h.message_id=u.id and h.user_id=p_user) and u.sender_id<>p_user and u.created_at>=me.joined_at and (me.read_at is null or u.created_at>me.read_at))) item,
   coalesce(m.created_at,g.created_at) last_at
  from public.losi_chat_groups g join public.losi_chat_group_members me on me.group_id=g.id and me.user_id=p_user and me.active
  left join lateral(select * from public.losi_chat_messages mm where mm.deleted_at is null and not exists(select 1 from public.losi_chat_hidden_messages h where h.message_id=mm.id and h.user_id=p_user) and group_id=g.id and created_at>=me.joined_at order by created_at desc,id desc limit 1) m on true
 ) q
$$;
