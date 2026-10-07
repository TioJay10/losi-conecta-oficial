create table public.losi_chat_groups (
 id uuid primary key, owner_id uuid not null references public.losi_chat_accounts(user_id),
 creator_id uuid not null references public.losi_chat_accounts(user_id),
 name text not null check(length(btrim(name)) between 1 and 80),
 description text not null default '' check(length(description)<=500),created_at timestamptz not null default now()
);
create table public.losi_chat_group_members (
 group_id uuid not null references public.losi_chat_groups(id),user_id uuid not null references public.losi_chat_accounts(user_id),
 active boolean not null default true, joined_at timestamptz not null default clock_timestamp(),
 read_at timestamptz,favorite boolean not null default false, primary key(group_id,user_id)
);
create index losi_chat_groups_owner on public.losi_chat_groups(owner_id);
create index losi_chat_groups_creator on public.losi_chat_groups(creator_id);
create index losi_chat_group_members_user on public.losi_chat_group_members(user_id,active,group_id);
alter table public.losi_chat_messages alter column thread_id drop not null;
alter table public.losi_chat_messages add column group_id uuid references public.losi_chat_groups(id);
alter table public.losi_chat_messages add constraint losi_chat_message_target check(num_nonnulls(thread_id,group_id)=1);
create index losi_chat_messages_group on public.losi_chat_messages(group_id,created_at desc,id desc);
alter table public.losi_chat_groups enable row level security;
alter table public.losi_chat_group_members enable row level security;
revoke all on public.losi_chat_groups,public.losi_chat_group_members from anon,authenticated;
grant select on public.losi_chat_groups,public.losi_chat_group_members to authenticated;
grant all on public.losi_chat_groups,public.losi_chat_group_members to service_role;
create policy chat_own_group_membership on public.losi_chat_group_members for select to authenticated using(user_id=(select auth.uid()));
create policy chat_member_groups on public.losi_chat_groups for select to authenticated using(exists(select 1 from public.losi_chat_group_members m where m.group_id=losi_chat_groups.id and m.user_id=(select auth.uid()) and m.active));
create policy chat_member_group_messages on public.losi_chat_messages for select to authenticated using(exists(select 1 from public.losi_chat_group_members m where m.group_id=losi_chat_messages.group_id and m.user_id=(select auth.uid()) and m.active and losi_chat_messages.created_at>=m.joined_at));

create function public.losi_chat_create_group(p_user uuid,p_request uuid,p_name text,p_description text,p_numbers text[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare g public.losi_chat_groups; member uuid; n text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,1));
 if not exists(select 1 from public.losi_chat_accounts a join public.business_profiles b on b.id=a.business_id join public.profiles p on p.id=a.user_id where a.user_id=p_user and a.digital_number is not null and b.active and not coalesce(p.blocked,false)) then raise exception 'RESGATE_SEU_NUMERO';end if;
 select * into g from public.losi_chat_groups where id=p_request;
 if found then if g.creator_id<>p_user then raise exception 'GRUPO_INDISPONIVEL';end if;return g.id;end if;
 if exists(select 1 from public.losi_chat_threads where id=p_request) then raise exception 'GRUPO_DADOS_INVALIDOS';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or length(coalesce(p_description,''))>500 then raise exception 'GRUPO_DADOS_INVALIDOS';end if;
 if coalesce(array_length(p_numbers,1),0)>99 then raise exception 'GRUPO_LIMITE';end if;
 insert into public.losi_chat_groups(id,owner_id,creator_id,name,description) values(p_request,p_user,p_user,btrim(p_name),coalesce(p_description,''));
 insert into public.losi_chat_group_members(group_id,user_id) values(p_request,p_user);
 for n in select distinct unnest(p_numbers) loop
  select a.user_id into member from public.losi_chat_accounts a join public.business_profiles b on b.id=a.business_id join public.profiles p on p.id=a.user_id where a.digital_number=n and b.active and not coalesce(p.blocked,false);
  if member is null then raise exception 'CONTATO_INDISPONIVEL';end if;
  insert into public.losi_chat_group_members(group_id,user_id) values(p_request,member) on conflict do nothing;
  if member<>p_user then insert into public.notifications(user_id,type,title,message,link) values(member,'chat_group','Novo grupo Chat LOSI','Você foi adicionado ao grupo '||btrim(p_name)||'.','/chat-losi');end if;
 end loop;
 return p_request;
end $$;

create function public.losi_chat_manage_group(p_user uuid,p_group uuid,p_action text,p_number text default null,p_name text default null,p_description text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare g public.losi_chat_groups; target uuid;
begin
 select * into g from public.losi_chat_groups where id=p_group for update;
 if not found or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL';end if;
 if p_action='leave' then
  if g.owner_id=p_user then raise exception 'TRANSFIRA_ADMINISTRACAO';end if;
  update public.losi_chat_group_members set active=false where group_id=p_group and user_id=p_user;return;
 end if;
 if g.owner_id<>p_user then raise exception 'APENAS_ADMIN_GRUPO';end if;
 if p_action='rename' then
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or length(coalesce(p_description,''))>500 then raise exception 'GRUPO_DADOS_INVALIDOS';end if;
  update public.losi_chat_groups set name=btrim(p_name),description=coalesce(p_description,'') where id=p_group;return;
 end if;
 select user_id into target from public.losi_chat_accounts where digital_number=p_number;
 if target is null then raise exception 'CONTATO_INDISPONIVEL';end if;
 if p_action='add' then
  if not exists(select 1 from public.business_profiles b join public.losi_chat_accounts a on a.business_id=b.id join public.profiles p on p.id=a.user_id where a.user_id=target and b.active and not coalesce(p.blocked,false)) then raise exception 'CONTATO_INDISPONIVEL';end if;
  if exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=target and active) then return;end if;
  if (select count(*) from public.losi_chat_group_members where group_id=p_group and active)>=100 then raise exception 'GRUPO_LIMITE';end if;
  insert into public.losi_chat_group_members(group_id,user_id) values(p_group,target)
   on conflict(group_id,user_id) do update set active=true,joined_at=clock_timestamp(),read_at=null,favorite=false;
  insert into public.notifications(user_id,type,title,message,link) values(target,'chat_group','Novo grupo Chat LOSI','Você foi adicionado ao grupo '||g.name||'.','/chat-losi');
 elsif p_action='remove' then
  if target=g.owner_id then raise exception 'TRANSFIRA_ADMINISTRACAO';end if;
  update public.losi_chat_group_members set active=false where group_id=p_group and user_id=target;
 elsif p_action='transfer' then
  if not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=target and active) then raise exception 'CONTATO_INDISPONIVEL';end if;
  update public.losi_chat_groups set owner_id=target where id=p_group;
 else raise exception 'GRUPO_ACAO_INVALIDA';end if;
end $$;

create function public.losi_chat_group_details(p_user uuid,p_group uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare g public.losi_chat_groups; members jsonb;
begin
 select * into g from public.losi_chat_groups where id=p_group;
 if not found or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL';end if;
 select jsonb_agg(jsonb_build_object('name',b.business_name,'photo',b.logo_url,'number',a.digital_number,'owner',m.user_id=g.owner_id,'self',m.user_id=p_user) order by m.user_id=g.owner_id desc,b.business_name) into members
 from public.losi_chat_group_members m join public.losi_chat_accounts a on a.user_id=m.user_id join public.business_profiles b on b.id=a.business_id where m.group_id=p_group and m.active;
 return jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'isOwner',g.owner_id=p_user,'members',coalesce(members,'[]'::jsonb));
end $$;

create function public.losi_chat_list_groups(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(q.item order by q.last_at desc),'[]'::jsonb) from (
  select jsonb_build_object('id',g.id,'name',g.name,'photo',null,'number',null,'group',true,'favorite',me.favorite,
   'memberCount',(select count(*) from public.losi_chat_group_members where group_id=g.id and active),
   'last',case when m.id is null then null else to_jsonb(m) end,
   'unread',(select count(*) from public.losi_chat_messages u where u.group_id=g.id and u.sender_id<>p_user and u.created_at>=me.joined_at and (me.read_at is null or u.created_at>me.read_at))) item,
   coalesce(m.created_at,g.created_at) last_at
  from public.losi_chat_groups g join public.losi_chat_group_members me on me.group_id=g.id and me.user_id=p_user and me.active
  left join lateral(select * from public.losi_chat_messages where group_id=g.id and created_at>=me.joined_at order by created_at desc,id desc limit 1) m on true
 ) q
$$;

create function public.losi_chat_group_messages(p_user uuid,p_group uuid,p_before_at timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare me public.losi_chat_group_members; data jsonb; latest timestamptz;
begin
 select * into me from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active;
 if not found then raise exception 'GRUPO_INDISPONIVEL';end if;
 select coalesce(jsonb_agg(q.item order by q.created_at,q.id),'[]'::jsonb),max(q.created_at) into data,latest from (
  select to_jsonb(m)||jsonb_build_object('sender_name',b.business_name) item,m.created_at,m.id
  from public.losi_chat_messages m join public.losi_chat_accounts a on a.user_id=m.sender_id join public.business_profiles b on b.id=a.business_id
  where m.group_id=p_group and m.created_at>=me.joined_at and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id)) order by m.created_at desc,m.id desc limit 100
 ) q;
 if latest is not null and p_before_at is null then update public.losi_chat_group_members set read_at=greatest(read_at,latest) where group_id=p_group and user_id=p_user and active;end if;
 return jsonb_build_object('messages',data,'hasMore',jsonb_array_length(data)=100);
end $$;

create function public.losi_chat_group_favorite(p_user uuid,p_group uuid,p_favorite boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 update public.losi_chat_group_members set favorite=p_favorite where group_id=p_group and user_id=p_user and active;
 if not found then raise exception 'GRUPO_INDISPONIVEL';end if;
end $$;

create function public.losi_chat_send_group_text(p_user uuid,p_group uuid,p_request uuid,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; m public.losi_chat_messages; g uuid; sender text;
begin
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 select id into g from public.losi_chat_groups where id=p_group for update;
 if g is null or a.digital_number is null or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL';end if;
 select * into m from public.losi_chat_messages where id=p_request;
 if found then
  if m.sender_id<>p_user or m.group_id is distinct from p_group or m.body<>btrim(p_body) then raise exception 'ENVIO_INVALIDO';end if;
  return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
 end if;
 if not exists(select 1 from public.business_profiles b join public.profiles p on p.id=p_user where b.id=a.business_id and b.active and not coalesce(p.blocked,false)) then raise exception 'FORNECEDOR_INDISPONIVEL';end if;
 if a.balance<1 then raise exception 'SALDO_INSUFICIENTE';end if;
 if p_body is null or length(btrim(p_body)) not between 1 and 4000 then raise exception 'TEXTO_INVALIDO';end if;
 insert into public.losi_chat_messages(id,group_id,sender_id,body,created_at) values(p_request,p_group,p_user,btrim(p_body),clock_timestamp()) returning * into m;
 update public.losi_chat_accounts set balance=balance-1 where user_id=p_user returning * into a;
 insert into public.losi_chat_ledger(user_id,delta,message_id,reason) values(p_user,-1,p_request,'message');
 select business_name into sender from public.business_profiles where id=a.business_id;
 return jsonb_build_object('message',to_jsonb(m)||jsonb_build_object('sender_name',sender),'balance',a.balance);
end $$;
revoke all on function public.losi_chat_create_group(uuid,uuid,text,text,text[]),public.losi_chat_manage_group(uuid,uuid,text,text,text,text),public.losi_chat_group_details(uuid,uuid),public.losi_chat_list_groups(uuid),public.losi_chat_group_messages(uuid,uuid,timestamptz,uuid),public.losi_chat_group_favorite(uuid,uuid,boolean),public.losi_chat_send_group_text(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.losi_chat_create_group(uuid,uuid,text,text,text[]),public.losi_chat_manage_group(uuid,uuid,text,text,text,text),public.losi_chat_group_details(uuid,uuid),public.losi_chat_list_groups(uuid),public.losi_chat_group_messages(uuid,uuid,timestamptz,uuid),public.losi_chat_group_favorite(uuid,uuid,boolean),public.losi_chat_send_group_text(uuid,uuid,uuid,text) to service_role;

-- Keep retry identifiers isolated between private and group messages.
create or replace function public.losi_chat_send_text(p_user uuid,p_thread uuid,p_request uuid,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; t public.losi_chat_threads; m public.losi_chat_messages; recipient uuid;
begin
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 select * into t from public.losi_chat_threads where id=p_thread;
 if t.id is null or p_user not in(t.user_a,t.user_b) or a.digital_number is null then raise exception 'CONVERSA_INDISPONIVEL'; end if;
 select * into m from public.losi_chat_messages where id=p_request;
 if found then
  if m.sender_id<>p_user or m.thread_id is distinct from p_thread or m.body<>btrim(p_body) then raise exception 'ENVIO_INVALIDO'; end if;
  return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
 end if;
 recipient=case when t.user_a=p_user then t.user_b else t.user_a end;
 if exists(select 1 from public.profiles where id in(p_user,recipient) and blocked=true) or not exists(select 1 from public.losi_chat_accounts x join public.business_profiles b on b.id=x.business_id where x.user_id=recipient and x.digital_number is not null and b.active=true) then raise exception 'CONTATO_INDISPONIVEL'; end if;
 if not exists(select 1 from public.business_profiles where id=a.business_id and active=true) then raise exception 'FORNECEDOR_INDISPONIVEL'; end if;
 if a.balance<1 then raise exception 'SALDO_INSUFICIENTE'; end if;
 if p_body is null or length(btrim(p_body)) not between 1 and 4000 then raise exception 'TEXTO_INVALIDO'; end if;
 insert into public.losi_chat_messages(id,thread_id,sender_id,body) values(p_request,p_thread,p_user,btrim(p_body)) returning * into m;
 update public.losi_chat_accounts set balance=balance-1 where user_id=p_user returning * into a;
 insert into public.losi_chat_ledger(user_id,delta,message_id,reason) values(p_user,-1,p_request,'message');
 return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
end $$;
