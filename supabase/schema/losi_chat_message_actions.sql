-- Keep legacy RPC name; authorize deletion for both text and attachments.
create or replace function public.losi_chat_delete_media(p_user uuid,p_message uuid,p_everyone boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare m public.losi_chat_messages;
begin
 select * into m from public.losi_chat_messages where id=p_message for update;
 if not found then raise exception 'ANEXO_INVALIDO';end if;
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

revoke all on function public.losi_chat_delete_media(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.losi_chat_delete_media(uuid,uuid,boolean) to service_role;
