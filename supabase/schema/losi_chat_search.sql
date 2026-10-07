create function public.losi_chat_search_messages(p_user uuid,p_target uuid,p_group boolean,p_query text,p_before_at timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare joined timestamptz; result jsonb;
begin
 if p_query is null or length(btrim(p_query)) not between 1 and 120 or (p_before_at is null)<>(p_before_id is null) then raise exception 'BUSCA_INVALIDA';end if;
 if p_group then
  select joined_at into joined from public.losi_chat_group_members where group_id=p_target and user_id=p_user and active;
  if not found then raise exception 'GRUPO_INDISPONIVEL';end if;
 elsif not exists(select 1 from public.losi_chat_threads where id=p_target and p_user in(user_a,user_b)) then raise exception 'CONVERSA_INDISPONIVEL';end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id desc),'[]'::jsonb) into result from (
  select m.* from public.losi_chat_messages m left join public.losi_chat_uploads u on u.id=m.attachment_id
  where (case when p_group then m.group_id=p_target and m.created_at>=joined else m.thread_id=p_target end)
   and m.deleted_at is null and not exists(select 1 from public.losi_chat_hidden_messages h where h.user_id=p_user and h.message_id=m.id)
   and (position(lower(btrim(p_query)) in lower(m.body))>0 or position(lower(btrim(p_query)) in lower(u.file_name))>0)
   and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id))
  order by m.created_at desc,m.id desc limit 51
 ) m;
 return jsonb_build_object('messages',case when jsonb_array_length(result)>50 then result-50 else result end,'hasMore',jsonb_array_length(result)>50);
end $$;
revoke all on function public.losi_chat_search_messages(uuid,uuid,boolean,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.losi_chat_search_messages(uuid,uuid,boolean,text,timestamptz,uuid) to service_role;
