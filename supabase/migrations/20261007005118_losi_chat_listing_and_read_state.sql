create function public.losi_chat_list_threads(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(q.item order by q.last_at desc),'[]'::jsonb) from (
  select jsonb_build_object('id',t.id,'name',b.business_name,'photo',b.logo_url,'number',a.digital_number,
   'last',case when m.id is null then null else to_jsonb(m) end,'favorite',coalesce(p.favorite,false),
   'unread',(select count(*) from public.losi_chat_messages u where u.thread_id=t.id and u.sender_id<>p_user and (p.read_at is null or u.created_at>p.read_at))) item,
   coalesce(m.created_at,t.created_at) last_at
  from public.losi_chat_threads t
  join public.losi_chat_accounts a on a.user_id=case when t.user_a=p_user then t.user_b else t.user_a end
  join public.business_profiles b on b.id=a.business_id
  left join public.losi_chat_thread_preferences p on p.thread_id=t.id and p.user_id=p_user
  left join lateral(select * from public.losi_chat_messages where thread_id=t.id order by created_at desc,id desc limit 1) m on true
  where p_user in(t.user_a,t.user_b)
 ) q
$$;
create function public.losi_chat_mark_read(p_user uuid,p_thread uuid,p_read timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.losi_chat_threads where id=p_thread and p_user in(user_a,user_b)) then raise exception 'CONVERSA_INDISPONIVEL';end if;
 insert into public.losi_chat_thread_preferences(thread_id,user_id,read_at) values(p_thread,p_user,p_read)
 on conflict(thread_id,user_id) do update set read_at=greatest(public.losi_chat_thread_preferences.read_at,excluded.read_at);
end $$;
create function public.losi_chat_favorite(p_user uuid,p_thread uuid,p_favorite boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.losi_chat_threads where id=p_thread and p_user in(user_a,user_b)) then raise exception 'CONVERSA_INDISPONIVEL';end if;
 insert into public.losi_chat_thread_preferences(thread_id,user_id,favorite) values(p_thread,p_user,p_favorite)
 on conflict(thread_id,user_id) do update set favorite=excluded.favorite;
end $$;
revoke all on function public.losi_chat_list_threads(uuid),public.losi_chat_mark_read(uuid,uuid,timestamptz),public.losi_chat_favorite(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.losi_chat_list_threads(uuid),public.losi_chat_mark_read(uuid,uuid,timestamptz),public.losi_chat_favorite(uuid,uuid,boolean) to service_role;
