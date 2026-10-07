alter table public.losi_chat_groups add column if not exists photo_path text;
create or replace function public.losi_chat_edit_group(p_user uuid,p_group uuid,p_name text,p_description text,p_change_photo boolean,p_photo_path text) returns void
language plpgsql security invoker set search_path='' as $$
declare g public.losi_chat_groups;
begin
 select * into g from public.losi_chat_groups where id=p_group for update;
 if not found or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL'; end if;
 if g.owner_id<>p_user then raise exception 'APENAS_ADMIN_GRUPO';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or length(coalesce(p_description,''))>500 then raise exception 'GRUPO_DADOS_INVALIDOS';end if;
 if p_change_photo and p_photo_path is not null and p_photo_path not like 'group-photos/'||p_group::text||'/%' then raise exception 'ANEXO_INVALIDO';end if;
 update public.losi_chat_groups set name=btrim(p_name),description=coalesce(p_description,''),photo_path=case when p_change_photo then p_photo_path else photo_path end where id=p_group;
end $$;
revoke all on function public.losi_chat_edit_group(uuid,uuid,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.losi_chat_edit_group(uuid,uuid,text,text,boolean,text) to service_role;
