begin;
do $$
declare users uuid[]; a uuid;b uuid;c uuid;u uuid;n text;tid uuid;g uuid=gen_random_uuid();up uuid;mid uuid;r jsonb;start_balance bigint;sz integer;expected integer;
begin
 select array_agg(owner_id) into users from(select distinct x.owner_id from public.business_profiles x join public.profiles p on p.id=x.owner_id where x.active and not coalesce(p.blocked,false) and not exists(select 1 from public.losi_chat_accounts z where z.user_id=x.owner_id) limit 3)t;
 if coalesce(array_length(users,1),0)<>3 then raise exception 'Need three unused provider fixtures';end if;a=users[1];b=users[2];c=users[3];
 foreach u in array users loop
  loop n=(100000000+floor(random()*900000000))::bigint::text;exit when not exists(select 1 from public.losi_chat_accounts where digital_number=n);end loop;
  insert into public.losi_chat_accounts(user_id,business_id,digital_number,balance,claimed_at) select u,id,n,100,now() from public.business_profiles where owner_id=u and active limit 1;
 end loop;
 insert into public.losi_chat_threads(user_a,user_b) values(least(a,b),greatest(a,b)) returning id into tid;
 foreach sz in array array[2097152,2097153,5242881,10485761] loop
  expected=case when sz<=2097152 then 2 when sz<=5242880 then 3 when sz<=10485760 then 4 else 8 end;up=gen_random_uuid();mid=gen_random_uuid();select balance into start_balance from public.losi_chat_accounts where user_id=a;
  insert into public.losi_chat_uploads(id,user_id,thread_id,kind,file_name,mime,byte_size,path,verified) values(up,a,tid,'document','test.pdf','application/pdf',sz,a||'/'||up,true);
  r=public.losi_chat_send_media(a,up,mid,'');if(r->>'balance')::bigint<>start_balance-expected then raise exception 'Wrong document price';end if;
  perform public.losi_chat_send_media(a,up,mid,'');if(select balance from public.losi_chat_accounts where user_id=a)<>start_balance-expected then raise exception 'Retry charged twice';end if;
  begin perform public.losi_chat_send_media(a,up,gen_random_uuid(),'');raise exception 'TEST_FAILED reused upload';exception when others then if sqlerrm='TEST_FAILED reused upload' then raise;end if;end;
  begin perform public.losi_chat_send_text(a,tid,mid,'');raise exception 'TEST_FAILED text/media retry';exception when others then if sqlerrm='TEST_FAILED text/media retry' then raise;end if;end;
 end loop;
 if(select balance from public.losi_chat_accounts where user_id=b)<>100 then raise exception 'Receiver charged';end if;
 up=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,thread_id,kind,file_name,mime,byte_size,path) values(up,a,tid,'image','image.png','image/png',100,a||'/'||up);
 begin perform public.losi_chat_send_media(a,up,gen_random_uuid(),'');raise exception 'TEST_FAILED unverified';exception when others then if sqlerrm='TEST_FAILED unverified' then raise;end if;end;
 update public.losi_chat_uploads set verified=true where id=up;mid=gen_random_uuid();r=public.losi_chat_send_media(a,up,mid,'');if(r->>'balance')::integer<>81 then raise exception 'Image price';end if;
 up=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,thread_id,kind,file_name,mime,byte_size,path,verified) values(up,a,tid,'image','image.png','image/png',100,a||'/'||up,true);mid=gen_random_uuid();r=public.losi_chat_send_media(a,up,mid,'Legenda');if(r->>'balance')::integer<>78 then raise exception 'Caption image price';end if;
 perform public.losi_chat_create_group(a,g,'Media test','',array[(select digital_number from public.losi_chat_accounts where user_id=b)]);
 up=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,group_id,kind,file_name,mime,byte_size,path,verified) values(up,a,g,'image','group.png','image/png',100,a||'/'||up,true);mid=gen_random_uuid();perform public.losi_chat_send_media(a,up,mid,'');
 if jsonb_array_length(public.losi_chat_group_messages(b,g)->'messages')<>1 then raise exception 'Group media missing';end if;
 perform public.losi_chat_manage_group(a,g,'add',(select digital_number from public.losi_chat_accounts where user_id=c));if jsonb_array_length(public.losi_chat_group_messages(c,g)->'messages')<>0 then raise exception 'Historical media leaked';end if;
 perform public.losi_chat_manage_group(a,g,'remove',(select digital_number from public.losi_chat_accounts where user_id=c));
 begin perform public.losi_chat_send_media(c,up,gen_random_uuid(),'');raise exception 'TEST_FAILED outsider';exception when others then if sqlerrm='TEST_FAILED outsider' then raise;end if;end;
 up=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,thread_id,kind,file_name,mime,byte_size,path,verified) values(up,a,tid,'image','image.png','image/png',100,a||'/'||up,true);
 update public.losi_chat_accounts set balance=0 where user_id=a;
 begin perform public.losi_chat_send_media(a,up,gen_random_uuid(),'');raise exception 'TEST_FAILED insufficient balance';exception when others then if sqlerrm='TEST_FAILED insufficient balance' then raise;end if;end;
 if(select sent from public.losi_chat_uploads where id=up) then raise exception 'Failed send marked sent';end if;
 update public.losi_chat_uploads set expires_at=now()-interval '1 minute' where user_id=a and not sent;
 if (select count(*) from public.losi_chat_expired_uploads(a))<>1 then raise exception 'Cleanup claimed sent upload';end if;
 if has_function_privilege('authenticated','public.losi_chat_send_media(uuid,uuid,uuid,text)','execute') or has_table_privilege('authenticated','public.losi_chat_uploads','select') then raise exception 'Unsafe media grants';end if;
 insert into storage.objects(bucket_id,name) values('losi-chat-attachments',a||'/private-test.png');perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$begin if exists(select 1 from storage.objects where bucket_id='losi-chat-attachments') then raise exception 'Storage RLS leak';end if;end $$;
reset role;
rollback;
