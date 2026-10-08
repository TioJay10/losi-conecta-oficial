create table public.losi_chat_message_reactions (
 message_id uuid not null references public.losi_chat_messages(id) on delete cascade,
 user_id uuid not null references public.losi_chat_accounts(user_id) on delete cascade,
 emoji text not null check(emoji in('👍','❤️','👏','🤝','✅','💡','🎉','💼','🏆','🚀','🎯','📈','📊','💰','💵','🧾','📄','📝','📅','⏰','📌','📎','✍️','📞','📧','💻','🛠️','⚙️','📦','🚚','🏢','🌟','🔥','🙌','😊','💪','🙏','🎤','🎪','🎨','🎁','📣')),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(message_id,user_id)
);
alter table public.losi_chat_message_reactions enable row level security;
revoke all on public.losi_chat_message_reactions from public,anon,authenticated;
grant select on public.losi_chat_message_reactions to authenticated;
grant all on public.losi_chat_message_reactions to service_role;
-- The existing message RLS includes private membership, group history and hidden/deleted messages.
create policy chat_reactions_visible on public.losi_chat_message_reactions for select to authenticated using(
 exists(select 1 from public.losi_chat_messages m where m.id=message_id)
);

create function public.losi_chat_reaction_status(p_user uuid,p_ids uuid[]) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_user is null or p_ids is null or coalesce(array_length(p_ids,1),0)>100 then raise exception 'REACAO_INVALIDA'; end if;
 return (select coalesce(jsonb_object_agg(m.id,coalesce(r.items,'[]'::jsonb)),'{}'::jsonb)
 from public.losi_chat_messages m
 left join lateral(
  select jsonb_agg(jsonb_build_object('emoji',a.emoji,'count',a.total,'mine',a.mine) order by a.total desc,a.emoji) items
  from (select emoji,count(*) total,bool_or(user_id=p_user) mine from public.losi_chat_message_reactions where message_id=m.id group by emoji) a
 ) r on true
 where m.id=any(p_ids) and m.deleted_at is null
 and not exists(select 1 from public.losi_chat_hidden_messages h where h.message_id=m.id and h.user_id=p_user)
 and (exists(select 1 from public.losi_chat_threads t where t.id=m.thread_id and p_user in(t.user_a,t.user_b))
 or exists(select 1 from public.losi_chat_group_members g where g.group_id=m.group_id and g.user_id=p_user and g.active and g.joined_at<=m.created_at)));
end $$;

-- Explicit desired state makes retries safe: null removes, an emoji replaces the person's reaction.
create function public.losi_chat_set_reaction(p_user uuid,p_message uuid,p_emoji text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m public.losi_chat_messages;
begin
 if p_user is null or (p_emoji is not null and p_emoji not in('👍','❤️','👏','🤝','✅','💡','🎉','💼','🏆','🚀','🎯','📈','📊','💰','💵','🧾','📄','📝','📅','⏰','📌','📎','✍️','📞','📧','💻','🛠️','⚙️','📦','🚚','🏢','🌟','🔥','🙌','😊','💪','🙏','🎤','🎪','🎨','🎁','📣')) then raise exception 'REACAO_INVALIDA'; end if;
 select * into m from public.losi_chat_messages where id=p_message for update;
 if m.id is null or m.deleted_at is not null
 or exists(select 1 from public.losi_chat_hidden_messages h where h.message_id=m.id and h.user_id=p_user)
 or not(exists(select 1 from public.losi_chat_threads t where t.id=m.thread_id and p_user in(t.user_a,t.user_b))
 or exists(select 1 from public.losi_chat_group_members g where g.group_id=m.group_id and g.user_id=p_user and g.active and g.joined_at<=m.created_at)) then raise exception 'REACAO_INDISPONIVEL'; end if;
 if p_emoji is not null and m.thread_id is not null and exists(select 1 from public.losi_chat_thread_preferences where thread_id=m.thread_id and blocked) then raise exception 'CONTATO_BLOQUEADO'; end if;
 if p_emoji is null then delete from public.losi_chat_message_reactions where message_id=m.id and user_id=p_user;
 else insert into public.losi_chat_message_reactions(message_id,user_id,emoji) values(m.id,p_user,p_emoji)
 on conflict(message_id,user_id) do update set emoji=excluded.emoji,updated_at=clock_timestamp(); end if;
 return coalesce(public.losi_chat_reaction_status(p_user,array[m.id])->m.id::text,'[]'::jsonb);
end $$;
revoke all on function public.losi_chat_reaction_status(uuid,uuid[]),public.losi_chat_set_reaction(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.losi_chat_reaction_status(uuid,uuid[]),public.losi_chat_set_reaction(uuid,uuid,text) to service_role;
alter publication supabase_realtime add table public.losi_chat_message_reactions;
