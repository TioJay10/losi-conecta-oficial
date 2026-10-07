-- Claim expired uploads under row locks before deleting Storage objects.
-- SKIP LOCKED excludes a message send currently committing its attachment.
create function public.losi_chat_expired_uploads(p_user uuid) returns table(id uuid,path text)
language sql security invoker set search_path='' as $$
 update public.losi_chat_uploads u set verified=false
 where u.id in(select x.id from public.losi_chat_uploads x where x.user_id=p_user and not x.sent and x.expires_at<clock_timestamp() order by x.expires_at limit 20 for update skip locked)
 and not u.sent
 returning u.id,u.path
$$;
revoke all on function public.losi_chat_expired_uploads(uuid) from public,anon,authenticated;
grant execute on function public.losi_chat_expired_uploads(uuid) to service_role;
