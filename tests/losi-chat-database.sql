begin;
-- Uses two existing provider owners only as FK fixtures. All changes roll back.
do $$
declare users uuid[]; a uuid; b uuid; r uuid=gen_random_uuid(); r2 uuid=gen_random_uuid(); mid uuid=gen_random_uuid(); tid uuid; n text; result jsonb; count_before bigint;
begin
 select array_agg(owner_id) into users from (select distinct x.owner_id from public.business_profiles x join public.profiles p on p.id=x.owner_id where x.active=true and not coalesce(p.blocked,false) and not exists(select 1 from public.losi_chat_accounts c where c.user_id=x.owner_id) limit 2) f;
 if array_length(users,1)<>2 then raise exception 'Need two unused provider fixtures'; end if;
 a=users[1];b=users[2];perform set_config('test.chat_user',a::text,true);perform set_config('test.chat_other',b::text,true);
 result=public.losi_chat_reserve_order(a,r,'10k');
 if not (result->>'created')::boolean then raise exception 'New order expected';end if;
 result=public.losi_chat_reserve_order(a,gen_random_uuid(),'50k');
 if result->'order'->>'id'<>r::text or (result->>'created')::boolean then raise exception 'Pending order duplicated';end if;
 begin perform public.losi_chat_claim(a);raise exception 'TEST_FAILED: claim before payment';exception when others then if sqlerrm='TEST_FAILED: claim before payment' then raise;end if;end;
 update public.losi_chat_orders set customer_id='test_customer' where id=r;
 begin perform public.losi_chat_settle_order('losi_chat:'||r,'test_payment_a','test_customer',1,'RECEIVED');raise exception 'TEST_FAILED: amount mismatch';exception when others then if sqlerrm='TEST_FAILED: amount mismatch' then raise;end if;end;
 if not public.losi_chat_settle_order('losi_chat:'||r,'test_payment_a','test_customer',2990,'CONFIRMED') then raise exception 'Grant expected';end if;
 if public.losi_chat_settle_order('losi_chat:'||r,'test_payment_a','test_customer',2990,'RECEIVED') then raise exception 'Duplicate grant';end if;
 if (select balance from public.losi_chat_accounts where user_id=a)<>10000 then raise exception 'Wrong balance';end if;
 n=public.losi_chat_claim(a);if n !~ '^[1-9][0-9]{8}$' or public.losi_chat_claim(a)<>n then raise exception 'Number invalid/changed';end if;
 result=public.losi_chat_reserve_order(b,r2,'50k');update public.losi_chat_orders set customer_id='test_customer_b' where id=r2;
 perform public.losi_chat_settle_order('losi_chat:'||r2,'test_payment_b','test_customer_b',7990,'RECEIVED');perform public.losi_chat_claim(b);
 insert into public.losi_chat_threads(user_a,user_b) values(least(a,b),greatest(a,b)) returning id into tid;
 perform set_config('test.chat_thread',tid::text,true);
 result=public.losi_chat_send_text(a,tid,mid,'Olá, parceiro!');
 if (result->>'balance')::bigint<>9999 then raise exception 'Text must cost exactly one';end if;
 result=public.losi_chat_send_text(a,tid,mid,'Olá, parceiro!');if (result->>'balance')::bigint<>9999 then raise exception 'Retry charged twice';end if;
 if (select balance from public.losi_chat_accounts where user_id=b)<>50000 then raise exception 'Receiver charged';end if;
 if (select count(*) from public.losi_chat_messages where thread_id=tid)<>1 then raise exception 'Duplicate message';end if;
 if (public.losi_chat_list_threads(b)->0->>'unread')::integer<>1 then raise exception 'Unread count';end if;
 perform public.losi_chat_favorite(b,tid,true);perform public.losi_chat_mark_read(b,tid,now());perform public.losi_chat_mark_read(b,tid,now()-interval '1 hour');
 if (public.losi_chat_list_threads(b)->0->>'unread')::integer<>0 or not (public.losi_chat_list_threads(b)->0->>'favorite')::boolean then raise exception 'Read/favorite state lost';end if;
 update public.losi_chat_accounts set balance=0 where user_id=a;
 begin perform public.losi_chat_send_text(a,tid,gen_random_uuid(),'Sem saldo');raise exception 'TEST_FAILED: zero balance send';exception when others then if sqlerrm='TEST_FAILED: zero balance send' then raise;end if;end;
 if (select count(*) from public.losi_chat_messages where thread_id=tid)<>1 then raise exception 'Failed send persisted';end if;
 -- Refund cannot grant again via out-of-order delivery; number is preserved.
 perform public.losi_chat_settle_order('losi_chat:'||r,'test_payment_a','test_customer',2990,'REFUNDED');
 perform public.losi_chat_settle_order('losi_chat:'||r,'test_payment_a','test_customer',2990,'REFUNDED');
 if public.losi_chat_settle_order('losi_chat:'||r,'test_payment_a','test_customer',2990,'RECEIVED') then raise exception 'Refunded order regranted';end if;
 if (select digital_number from public.losi_chat_accounts where user_id=a)<>n then raise exception 'Refund changed number';end if;
 if has_function_privilege('authenticated','public.losi_chat_send_text(uuid,uuid,uuid,text)','execute') or has_table_privilege('authenticated','public.losi_chat_accounts','update') or has_table_privilege('anon','public.losi_chat_accounts','select') then raise exception 'Unsafe grants';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$begin
 if (select count(*) from public.losi_chat_accounts where user_id=current_setting('test.chat_other')::uuid)<>0 then raise exception 'Other wallet visible';end if;
 if (select count(*) from public.losi_chat_accounts where user_id=current_setting('test.chat_user')::uuid)<>1 then raise exception 'Own wallet hidden';end if;
 if (select count(*) from public.losi_chat_messages where thread_id=current_setting('test.chat_thread')::uuid)<>1 then raise exception 'Participant message hidden';end if;
 -- An unrelated authenticated user cannot read this thread/messages.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 if (select count(*) from public.losi_chat_messages where thread_id=current_setting('test.chat_thread')::uuid)<>0 then raise exception 'Private message leaked';end if;
end $$;
reset role;
rollback;
select 'PASS: reservation, amounts, claim, duplicate webhook/send, debit, refunds, RLS; rolled back' as result;
