alter table public.losi_chat_group_members add column if not exists is_admin boolean not null default false;
update public.losi_chat_group_members m set is_admin=true from public.losi_chat_groups g where m.group_id=g.id and m.active and m.user_id in (g.owner_id,g.creator_id);
create or replace function public.losi_chat_manage_group(p_user uuid,p_group uuid,p_action text,p_number text default null,p_name text default null,p_description text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare g public.losi_chat_groups; target uuid;
begin
 select * into g from public.losi_chat_groups where id=p_group for update;
 if not found or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL';end if;
 if p_action='leave' then
  if not exists(select 1 from public.losi_chat_group_members where group_id=p_group and active and user_id<>p_user and (user_id=g.owner_id or user_id=g.creator_id or is_admin)) then raise exception 'TRANSFIRA_ADMINISTRACAO';end if;
  update public.losi_chat_group_members set active=false,is_admin=false where group_id=p_group and user_id=p_user;return;
 end if;
 if not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active and (user_id=g.owner_id or user_id=g.creator_id or is_admin)) then raise exception 'APENAS_ADMIN_GRUPO';end if;
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
   on conflict(group_id,user_id) do update set active=true,joined_at=clock_timestamp(),read_at=null,favorite=false,is_admin=false;
  insert into public.notifications(user_id,type,title,message,link) values(target,'chat_group','Novo grupo Chat LOSI','Você foi adicionado ao grupo '||g.name||'.','/chat-losi');
 elsif p_action='remove' then
  if target=g.creator_id or target=p_user then raise exception 'CRIADOR_GRUPO_PROTEGIDO';end if;
  update public.losi_chat_group_members set active=false,is_admin=false where group_id=p_group and user_id=target;
 elsif p_action in ('promote','transfer') then
  if not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=target and active) then raise exception 'CONTATO_INDISPONIVEL';end if;
  update public.losi_chat_group_members set is_admin=true where group_id=p_group and user_id=target;
 else raise exception 'GRUPO_ACAO_INVALIDA';end if;
end $$;

create or replace function public.losi_chat_group_details(p_user uuid,p_group uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare g public.losi_chat_groups; members jsonb;
begin
 select * into g from public.losi_chat_groups where id=p_group;
 if not found or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL';end if;
 select jsonb_agg(jsonb_build_object('name',b.business_name,'photo',b.logo_url,'number',a.digital_number,'owner',(m.is_admin or m.user_id=g.creator_id or m.user_id=g.owner_id),'creator',m.user_id=g.creator_id,'self',m.user_id=p_user) order by m.user_id=g.creator_id desc,(m.is_admin or m.user_id=g.owner_id) desc,b.business_name) into members
 from public.losi_chat_group_members m join public.losi_chat_accounts a on a.user_id=m.user_id join public.business_profiles b on b.id=a.business_id where m.group_id=p_group and m.active;
 return jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'isOwner',exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active and (user_id=g.owner_id or user_id=g.creator_id or is_admin)),'members',coalesce(members,'[]'::jsonb));
end $$;

create or replace function public.losi_chat_edit_group(p_user uuid,p_group uuid,p_name text,p_description text,p_change_photo boolean,p_photo_path text) returns void
language plpgsql security invoker set search_path='' as $$
declare g public.losi_chat_groups;
begin
 select * into g from public.losi_chat_groups where id=p_group for update;
 if not found or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL'; end if;
 if not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active and (user_id=g.owner_id or user_id=g.creator_id or is_admin)) then raise exception 'APENAS_ADMIN_GRUPO';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or length(coalesce(p_description,''))>500 then raise exception 'GRUPO_DADOS_INVALIDOS';end if;
 if p_change_photo and p_photo_path is not null and p_photo_path not like 'group-photos/'||p_group::text||'/%' then raise exception 'ANEXO_INVALIDO';end if;
 update public.losi_chat_groups set name=btrim(p_name),description=coalesce(p_description,''),photo_path=case when p_change_photo then p_photo_path else photo_path end where id=p_group;
end $$;
revoke all on function public.losi_chat_edit_group(uuid,uuid,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.losi_chat_edit_group(uuid,uuid,text,text,boolean,text) to service_role;
