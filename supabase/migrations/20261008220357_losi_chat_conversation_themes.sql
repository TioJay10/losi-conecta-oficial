-- Add optional conversation appearances; existing values, membership and blocking stay intact.
alter table public.losi_chat_thread_preferences drop constraint losi_chat_thread_preferences_theme_check;
alter table public.losi_chat_thread_preferences add constraint losi_chat_thread_preferences_theme_check check(theme in('default','navy','light','gold','blue','lavender','rose','teal','plum','linen','waves','confetti','petals','stars','arches','terrazzo','diamonds'));

create or replace function public.losi_chat_contact_settings(p_user uuid,p_thread uuid,p_theme text default null,p_blocked boolean default null) returns void
language plpgsql security invoker set search_path='' as $$
declare t public.losi_chat_threads;
begin
 select * into t from public.losi_chat_threads where id=p_thread for update;
 if t.id is null or p_user not in(t.user_a,t.user_b) then raise exception 'CONVERSA_INDISPONIVEL'; end if;
 if p_theme is not null and p_theme not in('default','navy','light','gold','blue','lavender','rose','teal','plum','linen','waves','confetti','petals','stars','arches','terrazzo','diamonds') then raise exception 'CONVERSA_DADOS_INVALIDOS'; end if;
 insert into public.losi_chat_thread_preferences(thread_id,user_id,theme,blocked)
 values(p_thread,p_user,coalesce(p_theme,'default'),coalesce(p_blocked,false))
 on conflict(thread_id,user_id) do update set
 theme=coalesce(p_theme,public.losi_chat_thread_preferences.theme),
 blocked=coalesce(p_blocked,public.losi_chat_thread_preferences.blocked);
end $$;

