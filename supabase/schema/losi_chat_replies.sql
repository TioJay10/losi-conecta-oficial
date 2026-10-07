alter table public.losi_chat_messages add column reply_to uuid references public.losi_chat_messages(id) on delete set null;
create index losi_chat_messages_reply on public.losi_chat_messages(reply_to) where reply_to is not null;
-- Delegate the charge and retry semantics to the established send functions.
create function public.losi_chat_send_reply(p_user uuid,p_target uuid,p_group boolean,p_request uuid,p_body text,p_reply uuid,p_upload uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare original public.losi_chat_messages; previous public.losi_chat_messages; result jsonb;
begin
 perform 1 from public.losi_chat_accounts where user_id=p_user for update;
 select * into previous from public.losi_chat_messages where id=p_request;
 if found then
  if previous.sender_id<>p_user or previous.reply_to is distinct from p_reply then raise exception 'RESPOSTA_INVALIDA';end if;
 else
  select * into original from public.losi_chat_messages where id=p_reply and deleted_at is null for share;
  if not found or p_reply=p_request or (case when p_group then original.group_id is distinct from p_target else original.thread_id is distinct from p_target end)
   or exists(select 1 from public.losi_chat_hidden_messages where user_id=p_user and message_id=p_reply)
   or not (exists(select 1 from public.losi_chat_threads t where t.id=original.thread_id and p_user in(t.user_a,t.user_b))
    or exists(select 1 from public.losi_chat_group_members g where g.group_id=original.group_id and g.user_id=p_user and g.active and g.joined_at<=original.created_at))
  then raise exception 'RESPOSTA_INVALIDA';end if;
 end if;
 if p_upload is not null then
  if not exists(select 1 from public.losi_chat_uploads u where u.id=p_upload and u.user_id=p_user and (case when p_group then u.group_id=p_target else u.thread_id=p_target end)) then raise exception 'RESPOSTA_INVALIDA';end if;
  result:=public.losi_chat_send_media(p_user,p_upload,p_request,p_body);
 elsif p_group then result:=public.losi_chat_send_group_text(p_user,p_target,p_request,p_body);
 else result:=public.losi_chat_send_text(p_user,p_target,p_request,p_body);end if;
 update public.losi_chat_messages set reply_to=p_reply where id=p_request and reply_to is null;
 return jsonb_set(result,'{message,reply_to}',to_jsonb(p_reply));
end $$;
create function public.losi_chat_reply_previews(p_user uuid,p_ids uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(q.id,case when o.id is null then jsonb_build_object('unavailable',true)
 else jsonb_build_object('name',coalesce(b.business_name,'Fornecedor LOSI'),'text',left(o.body,240),'kind',u.kind) end),'{}'::jsonb)
 from public.losi_chat_messages q
 left join public.losi_chat_messages o on o.id=q.reply_to and o.deleted_at is null
  and o.thread_id is not distinct from q.thread_id and o.group_id is not distinct from q.group_id
  and not exists(select 1 from public.losi_chat_hidden_messages h where h.user_id=p_user and h.message_id=o.id)
  and (o.group_id is null or exists(select 1 from public.losi_chat_group_members g where g.group_id=o.group_id and g.user_id=p_user and g.active and g.joined_at<=o.created_at))
 left join public.business_profiles b on b.owner_id=o.sender_id
 left join public.losi_chat_uploads u on u.id=o.attachment_id
 where q.id=any(p_ids) and q.reply_to is not null and q.deleted_at is null
 and not exists(select 1 from public.losi_chat_hidden_messages h where h.user_id=p_user and h.message_id=q.id)
 and (exists(select 1 from public.losi_chat_threads t where t.id=q.thread_id and p_user in(t.user_a,t.user_b))
 or exists(select 1 from public.losi_chat_group_members g where g.group_id=q.group_id and g.user_id=p_user and g.active and g.joined_at<=q.created_at));
$$;
revoke all on function public.losi_chat_send_reply(uuid,uuid,boolean,uuid,text,uuid,uuid),public.losi_chat_reply_previews(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.losi_chat_send_reply(uuid,uuid,boolean,uuid,text,uuid,uuid),public.losi_chat_reply_previews(uuid,uuid[]) to service_role;
