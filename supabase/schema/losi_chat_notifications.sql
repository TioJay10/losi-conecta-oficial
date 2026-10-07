-- One unread panel notification per conversation, linked to its latest message.
alter table public.notifications add column chat_message_id uuid references public.losi_chat_messages(id) on delete cascade;
create unique index notifications_chat_unread on public.notifications(user_id,link) where type='losi_chat_message' and read_at is null;
create function public.losi_chat_notify_recipient() returns trigger language plpgsql security invoker set search_path='' as $$
declare m public.losi_chat_messages; target text;
begin
 select * into m from public.losi_chat_messages where id=new.message_id;
 target:='/chat-losi?conversa='||coalesce(m.thread_id,m.group_id)::text;
 insert into public.notifications(user_id,type,title,message,link,created_at,chat_message_id)
 values(new.recipient_id,'losi_chat_message',case when m.group_id is null then 'Nova mensagem no Chat LOSI' else 'Nova mensagem em grupo' end,'Você recebeu uma mensagem. Abra a conversa para visualizar.',target,m.created_at,m.id)
 on conflict(user_id,link) where type='losi_chat_message' and read_at is null
 do update set created_at=excluded.created_at,chat_message_id=excluded.chat_message_id,title=excluded.title
 where notifications.created_at<=excluded.created_at;
 return new;
end $$;
create function public.losi_chat_read_notification() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.read_at is not null and old.read_at is null then
  update public.notifications set read_at=new.read_at where user_id=new.recipient_id and type='losi_chat_message' and chat_message_id=new.message_id and read_at is null;
 end if;
 return new;
end $$;
revoke all on function public.losi_chat_notify_recipient(),public.losi_chat_read_notification() from public,anon,authenticated;
grant execute on function public.losi_chat_notify_recipient(),public.losi_chat_read_notification() to service_role;
create trigger losi_chat_notification_created after insert on public.losi_chat_receipts for each row execute function public.losi_chat_notify_recipient();
create trigger losi_chat_notification_read after update of read_at on public.losi_chat_receipts for each row execute function public.losi_chat_read_notification();
