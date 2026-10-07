-- Keep existing storage privacy and 20 MiB limit; add video formats only.
update storage.buckets set allowed_mime_types=allowed_mime_types||array['video/mp4','video/quicktime','video/webm'] where id='losi-chat-attachments';
alter table public.losi_chat_uploads drop constraint losi_chat_uploads_kind_check;
alter table public.losi_chat_uploads add constraint losi_chat_uploads_kind_check check(kind in('image','document','video'));
create or replace function public.losi_chat_send_media(p_user uuid,p_upload uuid,p_request uuid,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; u public.losi_chat_uploads; m public.losi_chat_messages; t public.losi_chat_threads; recipient uuid; cost integer; g uuid;
begin
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 select * into u from public.losi_chat_uploads where id=p_upload and user_id=p_user;
 if not found or a.digital_number is null then raise exception 'ANEXO_INVALIDO';end if;
 if u.group_id is not null then
  select id into g from public.losi_chat_groups where id=u.group_id for update;
  if g is null or not exists(select 1 from public.losi_chat_group_members where group_id=g and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL';end if;
 else
  select * into t from public.losi_chat_threads where id=u.thread_id;
  if t.id is null or p_user not in(t.user_a,t.user_b) then raise exception 'CONVERSA_INDISPONIVEL';end if;
  recipient=case when t.user_a=p_user then t.user_b else t.user_a end;
  if exists(select 1 from public.profiles where id=recipient and blocked) or not exists(select 1 from public.losi_chat_accounts x join public.business_profiles b on b.id=x.business_id where x.user_id=recipient and x.digital_number is not null and b.active) then raise exception 'CONTATO_INDISPONIVEL';end if;
 end if;
 select * into u from public.losi_chat_uploads where id=p_upload for update;
 select * into m from public.losi_chat_messages where id=p_request;
 if found then
  if m.sender_id<>p_user or m.attachment_id is distinct from p_upload or m.body<>btrim(coalesce(p_body,'')) then raise exception 'ENVIO_INVALIDO';end if;
  return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
 end if;
 if u.sent or not u.verified or u.expires_at<clock_timestamp() then raise exception 'ANEXO_INVALIDO';end if;
 if length(coalesce(p_body,''))>4000 then raise exception 'TEXTO_INVALIDO';end if;
 if not exists(select 1 from public.business_profiles b join public.profiles p on p.id=p_user where b.id=a.business_id and b.active and not coalesce(p.blocked,false)) then raise exception 'FORNECEDOR_INDISPONIVEL';end if;
 cost=case when u.kind='video' then 10 when u.kind='image' then case when length(btrim(coalesce(p_body,'')))>0 then 3 else 2 end when u.byte_size<=2097152 then 2 when u.byte_size<=5242880 then 3 when u.byte_size<=10485760 then 4 else 8 end;
 if a.balance<cost then raise exception 'SALDO_INSUFICIENTE';end if;
 insert into public.losi_chat_messages(id,thread_id,group_id,sender_id,body,attachment_id,created_at) values(p_request,u.thread_id,u.group_id,p_user,btrim(coalesce(p_body,'')),u.id,clock_timestamp()) returning * into m;
 update public.losi_chat_accounts set balance=balance-cost where user_id=p_user returning * into a;
 insert into public.losi_chat_ledger(user_id,delta,message_id,reason) values(p_user,-cost,p_request,'message');
 update public.losi_chat_uploads set sent=true where id=u.id;
 return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
end $$;
