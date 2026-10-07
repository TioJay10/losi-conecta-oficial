-- Private immutable uploads; all writes go through the authenticated Edge service.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('losi-chat-attachments','losi-chat-attachments',false,20971520,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create policy losi_chat_storage_private on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'losi-chat-attachments') with check(bucket_id<>'losi-chat-attachments');
create table public.losi_chat_uploads(
 id uuid primary key,user_id uuid not null references public.losi_chat_accounts(user_id),
 thread_id uuid references public.losi_chat_threads(id),group_id uuid references public.losi_chat_groups(id),
 kind text not null check(kind in('image','document')),file_name text not null check(length(file_name) between 1 and 160),
 mime text not null,byte_size integer not null check(byte_size between 1 and 20971520),
 path text not null unique,verified boolean not null default false,sent boolean not null default false,
 created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '125 minutes'),
 check(num_nonnulls(thread_id,group_id)=1)
);
alter table public.losi_chat_uploads enable row level security;
create index losi_chat_uploads_user_created on public.losi_chat_uploads(user_id,created_at);
create index losi_chat_uploads_expiry on public.losi_chat_uploads(expires_at) where not sent;
revoke all on public.losi_chat_uploads from anon,authenticated;
grant all on public.losi_chat_uploads to service_role;
alter table public.losi_chat_messages add column attachment_id uuid unique references public.losi_chat_uploads(id);
alter table public.losi_chat_messages drop constraint losi_chat_messages_body_check;
alter table public.losi_chat_messages add constraint losi_chat_messages_body_check check(length(body)<=4000 and(length(btrim(body))>0 or attachment_id is not null));
create function public.losi_chat_send_media(p_user uuid,p_upload uuid,p_request uuid,p_body text) returns jsonb
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
 cost=case when u.kind='image' then case when length(btrim(coalesce(p_body,'')))>0 then 3 else 2 end when u.byte_size<=2097152 then 2 when u.byte_size<=5242880 then 3 when u.byte_size<=10485760 then 4 else 8 end;
 if a.balance<cost then raise exception 'SALDO_INSUFICIENTE';end if;
 insert into public.losi_chat_messages(id,thread_id,group_id,sender_id,body,attachment_id,created_at) values(p_request,u.thread_id,u.group_id,p_user,btrim(coalesce(p_body,'')),u.id,clock_timestamp()) returning * into m;
 update public.losi_chat_accounts set balance=balance-cost where user_id=p_user returning * into a;
 insert into public.losi_chat_ledger(user_id,delta,message_id,reason) values(p_user,-cost,p_request,'message');
 update public.losi_chat_uploads set sent=true where id=u.id;
 return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
end $$;
revoke all on function public.losi_chat_send_media(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.losi_chat_send_media(uuid,uuid,uuid,text) to service_role;

create or replace function public.losi_chat_send_group_text(p_user uuid,p_group uuid,p_request uuid,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; m public.losi_chat_messages; g uuid; sender text;
begin
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 select id into g from public.losi_chat_groups where id=p_group for update;
 if g is null or a.digital_number is null or not exists(select 1 from public.losi_chat_group_members where group_id=p_group and user_id=p_user and active) then raise exception 'GRUPO_INDISPONIVEL';end if;
 select * into m from public.losi_chat_messages where id=p_request;
 if found then
  if m.attachment_id is not null or m.sender_id<>p_user or m.group_id is distinct from p_group or m.body<>btrim(p_body) then raise exception 'ENVIO_INVALIDO';end if;
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

create or replace function public.losi_chat_send_text(p_user uuid,p_thread uuid,p_request uuid,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; t public.losi_chat_threads; m public.losi_chat_messages; recipient uuid;
begin
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 select * into t from public.losi_chat_threads where id=p_thread;
 if t.id is null or p_user not in(t.user_a,t.user_b) or a.digital_number is null then raise exception 'CONVERSA_INDISPONIVEL'; end if;
 select * into m from public.losi_chat_messages where id=p_request;
 if found then
  if m.attachment_id is not null or m.sender_id<>p_user or m.thread_id is distinct from p_thread or m.body<>btrim(p_body) then raise exception 'ENVIO_INVALIDO'; end if;
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
