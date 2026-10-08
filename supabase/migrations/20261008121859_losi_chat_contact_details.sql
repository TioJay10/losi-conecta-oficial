alter table public.losi_chat_thread_preferences
 add column blocked boolean not null default false,
 add column theme text not null default 'default' check(theme in('default','navy','light','gold'));

-- Serialize blocking with private message inserts. All sending RPCs remain atomic:
-- rejection also rolls back the balance, ledger and notification transaction.
create function public.losi_chat_enforce_contact_block() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.thread_id is null then return new; end if;
 perform 1 from public.losi_chat_threads where id=new.thread_id for update;
 if exists(select 1 from public.losi_chat_thread_preferences where thread_id=new.thread_id and blocked) then
  raise exception 'CONTATO_BLOQUEADO';
 end if;
 return new;
end $$;
create trigger losi_chat_contact_block before insert on public.losi_chat_messages
 for each row execute function public.losi_chat_enforce_contact_block();

create function public.losi_chat_contact_settings(p_user uuid,p_thread uuid,p_theme text default null,p_blocked boolean default null) returns void
language plpgsql security invoker set search_path='' as $$
declare t public.losi_chat_threads;
begin
 select * into t from public.losi_chat_threads where id=p_thread for update;
 if t.id is null or p_user not in(t.user_a,t.user_b) then raise exception 'CONVERSA_INDISPONIVEL'; end if;
 if p_theme is not null and p_theme not in('default','navy','light','gold') then raise exception 'CONVERSA_DADOS_INVALIDOS'; end if;
 insert into public.losi_chat_thread_preferences(thread_id,user_id,theme,blocked)
 values(p_thread,p_user,coalesce(p_theme,'default'),coalesce(p_blocked,false))
 on conflict(thread_id,user_id) do update set
 theme=coalesce(p_theme,public.losi_chat_thread_preferences.theme),
 blocked=coalesce(p_blocked,public.losi_chat_thread_preferences.blocked);
end $$;

create function public.losi_chat_contact_details(p_user uuid,p_thread uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; prefs public.losi_chat_thread_preferences;
begin
 if not exists(select 1 from public.losi_chat_threads where id=p_thread and p_user in(user_a,user_b)) then raise exception 'CONVERSA_INDISPONIVEL'; end if;
 select * into prefs from public.losi_chat_thread_preferences where thread_id=p_thread and user_id=p_user;
 select jsonb_build_object(
 'media',count(*) filter(where u.kind in('image','video','audio')),
 'documents',count(*) filter(where u.kind='document'),
 'links',count(*) filter(where m.body ~* 'https?://[^[:space:]]+'),
 'bytes',coalesce(sum(u.byte_size),0),
 'favorite',coalesce(prefs.favorite,false),'theme',coalesce(prefs.theme,'default'),
 'blocked',coalesce(prefs.blocked,false),
 'canSend',not exists(select 1 from public.losi_chat_thread_preferences where thread_id=p_thread and blocked)) into result
 from public.losi_chat_messages m left join public.losi_chat_uploads u on u.id=m.attachment_id and u.sent
 where m.thread_id=p_thread and m.deleted_at is null
 and not exists(select 1 from public.losi_chat_hidden_messages h where h.user_id=p_user and h.message_id=m.id);
 return result;
end $$;

create function public.losi_chat_contact_assets(p_user uuid,p_thread uuid,p_kind text,p_before_at timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare rows jsonb; more boolean; cursor_at timestamptz; cursor_id uuid;
begin
 if not exists(select 1 from public.losi_chat_threads where id=p_thread and p_user in(user_a,user_b)) then raise exception 'CONVERSA_INDISPONIVEL'; end if;
 if p_kind not in('media','documents','links','all') or (p_before_at is null)<>(p_before_id is null) then raise exception 'CONVERSA_DADOS_INVALIDOS'; end if;
 with visible as (
 select m.* from public.losi_chat_messages m left join public.losi_chat_uploads u on u.id=m.attachment_id and u.sent
 where m.thread_id=p_thread and m.deleted_at is null
 and not exists(select 1 from public.losi_chat_hidden_messages h where h.user_id=p_user and h.message_id=m.id)
 and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id))
 and (p_kind='all' or p_kind='media' and u.kind in('image','video','audio') or p_kind='documents' and u.kind='document' or p_kind='links' and m.body ~* 'https?://[^[:space:]]+')
 order by m.created_at desc,m.id desc limit 61
 ), numbered as(select visible.*,row_number() over(order by created_at desc,id desc) rn from visible)
 select coalesce(jsonb_agg(to_jsonb(numbered)-'rn' order by created_at desc,id desc) filter(where rn<=60),'[]'::jsonb),count(*)>60 into rows,more from numbered;
 cursor_at=(rows->-1->>'created_at')::timestamptz;cursor_id=(rows->-1->>'id')::uuid;
 return jsonb_build_object('messages',rows,'hasMore',more,'nextCursor',case when cursor_id is null then null else jsonb_build_object('at',cursor_at,'id',cursor_id) end);
end $$;
revoke all on function public.losi_chat_enforce_contact_block(),public.losi_chat_contact_settings(uuid,uuid,text,boolean),public.losi_chat_contact_details(uuid,uuid),public.losi_chat_contact_assets(uuid,uuid,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.losi_chat_enforce_contact_block(),public.losi_chat_contact_settings(uuid,uuid,text,boolean),public.losi_chat_contact_details(uuid,uuid),public.losi_chat_contact_assets(uuid,uuid,text,timestamptz,uuid) to service_role;
