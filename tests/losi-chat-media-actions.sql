begin;
do $$
declare users uuid[];a uuid;b uuid;c uuid;u uuid;n text;tid uuid;g uuid=gen_random_uuid();up uuid;mid uuid;result jsonb;before_balance bigint;sz integer;caption text;
begin
 select array_agg(owner_id) into users from(select distinct x.owner_id from public.business_profiles x join public.profiles p on p.id=x.owner_id where x.active and not coalesce(p.blocked,false) and x.owner_id<>'2883e8a0-de15-47d8-9064-9c5c49075619'::uuid limit 3)t;
 if coalesce(array_length(users,1),0)<>3 then raise exception 'Need three provider fixtures';end if;a=users[1];b=users[2];c=users[3];
 foreach u in array users loop
  loop n=(100000000+floor(random()*900000000))::bigint::text;exit when not exists(select 1 from public.losi_chat_accounts where digital_number=n);end loop;
  insert into public.losi_chat_accounts(user_id,business_id,digital_number,balance,claimed_at) select u,id,n,100,now() from public.business_profiles where owner_id=u and active limit 1 on conflict(user_id) do update set balance=100;
 end loop;
 insert into public.losi_chat_threads(user_a,user_b) values(least(a,b),greatest(a,b)) returning id into tid;

 up=gen_random_uuid();mid=gen_random_uuid();
 insert into public.losi_chat_uploads(id,user_id,thread_id,kind,file_name,mime,byte_size,path,verified) values(up,a,tid,'video','video.mp4','video/mp4',100,a||'/'||up,true);
 perform public.losi_chat_send_media(a,up,mid,'Teste');
 before_balance=(select balance from public.losi_chat_accounts where user_id=a);
 begin perform public.losi_chat_delete_media(c,mid,false);raise exception 'TEST_FAILED outsider';exception when others then if sqlerrm='TEST_FAILED outsider' then raise;end if;end;
 begin perform public.losi_chat_delete_media(b,mid,true);raise exception 'TEST_FAILED recipient everyone';exception when others then if sqlerrm='TEST_FAILED recipient everyone' then raise;end if;end;
 perform public.losi_chat_delete_media(b,mid,false);perform public.losi_chat_delete_media(b,mid,false);
 if jsonb_array_length(public.losi_chat_hidden_ids(b,tid,false))<>1 or jsonb_array_length(public.losi_chat_hidden_ids(a,tid,false))<>0 then raise exception 'Hide visibility';end if;
 if public.losi_chat_list_threads(b)->0->'last'<>'null'::jsonb or (public.losi_chat_list_threads(b)->0->>'unread')::int<>0 then raise exception 'Hidden list/unread';end if;
 if public.losi_chat_list_threads(a)->0->'last'->>'id'<>mid::text then raise exception 'Hide affected sender';end if;
 perform public.losi_chat_delete_media(a,mid,true);perform public.losi_chat_delete_media(a,mid,true);
 if jsonb_array_length(public.losi_chat_hidden_ids(a,tid,false))<>1 then raise exception 'Global hide';end if;
 if(select balance from public.losi_chat_accounts where user_id=a)<>before_balance or(select count(*) from public.losi_chat_ledger where message_id=mid)<>1 then raise exception 'Deletion changed credit ledger';end if;
 perform public.losi_chat_send_media(a,up,mid,'Teste');
 if(select balance from public.losi_chat_accounts where user_id=a)<>before_balance or(select deleted_at from public.losi_chat_messages where id=mid) is null then raise exception 'Retry resurrected or rebilled';end if;
 perform public.losi_chat_create_group(a,g,'Delete test','',array[(select digital_number from public.losi_chat_accounts where user_id=b)]);
 up=gen_random_uuid();mid=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,group_id,kind,file_name,mime,byte_size,path,verified) values(up,a,g,'audio','audio.m4a','audio/mp4',100,a||'/'||up,true);
 perform public.losi_chat_send_media(a,up,mid,'');perform public.losi_chat_delete_media(b,mid,false);
 if(public.losi_chat_list_groups(b)->0->>'unread')::int<>0 then raise exception 'Group hidden unread';end if;
 perform public.losi_chat_manage_group(a,g,'remove',(select digital_number from public.losi_chat_accounts where user_id=b));
 begin perform public.losi_chat_delete_media(b,mid,false);raise exception 'TEST_FAILED removed member';exception when others then if sqlerrm='TEST_FAILED removed member' then raise;end if;end;
 perform public.losi_chat_delete_media(a,mid,true);
end $$;
rollback;
select 'PASS: deletion authorization, own/everyone visibility, lists/unread, idempotence, no refunds/rebilling; rolled back' as result;
