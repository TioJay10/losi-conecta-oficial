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

 mid=gen_random_uuid();perform public.losi_chat_send_text(a,tid,mid,'Texto de teste');
 before_balance=(select balance from public.losi_chat_accounts where user_id=a);
 begin perform public.losi_chat_delete_media(c,mid,false);raise exception 'TEST_FAILED outsider';exception when others then if sqlerrm='TEST_FAILED outsider' then raise;end if;end;
 begin perform public.losi_chat_delete_media(b,mid,true);raise exception 'TEST_FAILED recipient everyone';exception when others then if sqlerrm='TEST_FAILED recipient everyone' then raise;end if;end;
 perform public.losi_chat_delete_media(b,mid,false);perform public.losi_chat_delete_media(b,mid,false);
 if jsonb_array_length(public.losi_chat_hidden_ids(b,tid,false))<>1 or jsonb_array_length(public.losi_chat_hidden_ids(a,tid,false))<>0 then raise exception 'Text hide visibility';end if;
 perform public.losi_chat_delete_media(a,mid,true);perform public.losi_chat_delete_media(a,mid,true);
 if (select deleted_at from public.losi_chat_messages where id=mid) is null then raise exception 'Text deletion';end if;
 if(select balance from public.losi_chat_accounts where user_id=a)<>before_balance then raise exception 'Text deletion refunded credits';end if;
 perform public.losi_chat_create_group(a,g,'Text delete test','',array[(select digital_number from public.losi_chat_accounts where user_id=b)]);
 mid=gen_random_uuid();perform public.losi_chat_send_group_text(a,g,mid,'Texto no grupo');
 begin perform public.losi_chat_delete_media(b,mid,true);raise exception 'TEST_FAILED group recipient everyone';exception when others then if sqlerrm='TEST_FAILED group recipient everyone' then raise;end if;end;
 perform public.losi_chat_delete_media(b,mid,false);
 perform public.losi_chat_manage_group(a,g,'remove',(select digital_number from public.losi_chat_accounts where user_id=b));
 begin perform public.losi_chat_delete_media(b,mid,false);raise exception 'TEST_FAILED removed member';exception when others then if sqlerrm='TEST_FAILED removed member' then raise;end if;end;
 perform public.losi_chat_delete_media(a,mid,true);
 if has_function_privilege('authenticated','public.losi_chat_delete_media(uuid,uuid,boolean)','execute') or has_function_privilege('anon','public.losi_chat_delete_media(uuid,uuid,boolean)','execute') then raise exception 'Unsafe deletion grants';end if;
end $$;
rollback;
select 'PASS: text hide/delete, private/group authorization, idempotence, no refunds, service-only grants; rolled back' as result;
