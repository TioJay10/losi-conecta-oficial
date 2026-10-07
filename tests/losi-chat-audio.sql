begin;
do $$
declare users uuid[];a uuid;b uuid;c uuid;u uuid;n text;tid uuid;g uuid=gen_random_uuid();up uuid;mid uuid;result jsonb;before_balance bigint;sz integer;caption text;
begin
 select array_agg(owner_id) into users from(select distinct x.owner_id from public.business_profiles x join public.profiles p on p.id=x.owner_id where x.active and not coalesce(p.blocked,false) and not exists(select 1 from public.losi_chat_accounts z where z.user_id=x.owner_id) limit 3)t;
 if coalesce(array_length(users,1),0)<>3 then raise exception 'Need three unused provider fixtures';end if;a=users[1];b=users[2];c=users[3];
 foreach u in array users loop
  loop n=(100000000+floor(random()*900000000))::bigint::text;exit when not exists(select 1 from public.losi_chat_accounts where digital_number=n);end loop;
  insert into public.losi_chat_accounts(user_id,business_id,digital_number,balance,claimed_at) select u,id,n,100,now() from public.business_profiles where owner_id=u and active limit 1;
 end loop;
 insert into public.losi_chat_threads(user_a,user_b) values(least(a,b),greatest(a,b)) returning id into tid;
 foreach sz in array array[100,20971520] loop
  foreach caption in array array['','Legenda de teste'] loop
   select balance into before_balance from public.losi_chat_accounts where user_id=a;up=gen_random_uuid();mid=gen_random_uuid();
   insert into public.losi_chat_uploads(id,user_id,thread_id,kind,file_name,mime,byte_size,path,verified) values(up,a,tid,'audio','voice.m4a','audio/mp4',sz,a||'/'||up,true);
   result=public.losi_chat_send_media(a,up,mid,caption);if(result->>'balance')::bigint<>before_balance-1 then raise exception 'Audio price must be 1';end if;
   perform public.losi_chat_send_media(a,up,mid,caption);if(select balance from public.losi_chat_accounts where user_id=a)<>before_balance-1 then raise exception 'Retry double debit';end if;
   if(select count(*) from public.losi_chat_ledger where message_id=mid and delta=-1)<>1 then raise exception 'Wrong ledger entry';end if;
   begin perform public.losi_chat_send_media(a,up,gen_random_uuid(),caption);raise exception 'TEST_FAILED upload reused';exception when others then if sqlerrm='TEST_FAILED upload reused' then raise;end if;end;
  end loop;
 end loop;
 if(select balance from public.losi_chat_accounts where user_id=b)<>100 then raise exception 'Receiver charged';end if;
 perform public.losi_chat_create_group(a,g,'Audio test','',array[(select digital_number from public.losi_chat_accounts where user_id=b)]);
 up=gen_random_uuid();mid=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,group_id,kind,file_name,mime,byte_size,path,verified) values(up,a,g,'audio','voice.m4a','audio/mp4',100,a||'/'||up,true);
 result=public.losi_chat_send_media(a,up,mid,'Legenda');if(result->>'balance')::integer<>95 then raise exception 'Group audio price';end if;
 if jsonb_array_length(public.losi_chat_group_messages(b,g)->'messages')<>1 then raise exception 'Group audio missing';end if;
 perform public.losi_chat_manage_group(a,g,'add',(select digital_number from public.losi_chat_accounts where user_id=c));if jsonb_array_length(public.losi_chat_group_messages(c,g)->'messages')<>0 then raise exception 'Historical audio leaked';end if;
 up=gen_random_uuid();mid=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,group_id,kind,file_name,mime,byte_size,path,verified) values(up,b,g,'audio','voice.weba','audio/webm',100,b||'/'||up,true);
 perform public.losi_chat_manage_group(a,g,'remove',(select digital_number from public.losi_chat_accounts where user_id=b));
 begin perform public.losi_chat_send_media(b,up,mid,'');raise exception 'TEST_FAILED removed member sends';exception when others then if sqlerrm='TEST_FAILED removed member sends' then raise;end if;end;
 if(select balance from public.losi_chat_accounts where user_id=b)<>100 then raise exception 'Removed member charged';end if;
 update public.losi_chat_accounts set balance=0 where user_id=a;up=gen_random_uuid();insert into public.losi_chat_uploads(id,user_id,thread_id,kind,file_name,mime,byte_size,path,verified) values(up,a,tid,'audio','voice.m4a','audio/mp4',100,a||'/'||up,true);
 begin perform public.losi_chat_send_media(a,up,gen_random_uuid(),'');raise exception 'TEST_FAILED insufficient credit';exception when others then if sqlerrm='TEST_FAILED insufficient credit' then raise;end if;end;
 if(select sent from public.losi_chat_uploads where id=up) or(select balance from public.losi_chat_accounts where user_id=a)<>0 then raise exception 'Failed audio changed wallet/upload';end if;
 if(select public from storage.buckets where id='losi-chat-attachments') or(select file_size_limit from storage.buckets where id='losi-chat-attachments')<>20971520 then raise exception 'Storage privacy/limit changed';end if;
 if not (select allowed_mime_types@>array['audio/mp4','audio/webm','video/mp4','image/png','application/pdf'] from storage.buckets where id='losi-chat-attachments') then raise exception 'Storage MIME list incomplete';end if;
end $$;
rollback;
select 'PASS: audio private/group cost, captions, retries, receiver free, membership/history, insufficient balance; rolled back' as result;
