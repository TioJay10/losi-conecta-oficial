-- Run as the database owner. All fixtures and emitted database notifications roll back.
begin;
do $$
declare
 business uuid; owner uuid; phone text; collaborator uuid;
 event_a uuid; event_b uuid; event_c uuid; event_night uuid;
 opening_a uuid; opening_b uuid; opening_c uuid; opening_night uuid;
 application_a uuid; application_b uuid; result jsonb;
begin
 select b.id,b.owner_id into business,owner from public.business_profiles b
 join auth.users u on u.id=b.owner_id where lower(u.email)='contato@losigestaoemlazer.com.br' limit 1;
 if business is null then raise exception 'Test owner business not found'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner)::text,true);
 phone='55'||lpad((floor(random()*10000000000)::bigint)::text,11,'0');
 insert into public.team_events(business_id,title,event_date,starts_at,ends_at,status)
 values(business,'Teste conflito A','2098-10-15','09:00','12:00','draft') returning id into event_a;
 insert into public.team_events(business_id,title,event_date,starts_at,ends_at,status)
 values(business,'Teste conflito B','2098-10-15','11:00','13:00','draft') returning id into event_b;
 insert into public.team_events(business_id,title,event_date,starts_at,ends_at,status)
 values(business,'Teste conflito C','2098-10-15','12:00','15:00','draft') returning id into event_c;
 insert into public.team_events(business_id,title,event_date,starts_at,ends_at,status)
 values(business,'Teste conflito noite','2098-10-16','22:00','02:00','draft') returning id into event_night;
 insert into public.team_event_openings(event_id,title) values(event_a,'Recreador') returning id into opening_a;
 insert into public.team_event_openings(event_id,title) values(event_b,'Recreador') returning id into opening_b;
 insert into public.team_event_openings(event_id,title) values(event_c,'Recreador') returning id into opening_c;
 insert into public.team_event_openings(event_id,title) values(event_night,'Recreador') returning id into opening_night;
 insert into public.team_applications(event_id,opening_id,candidate_name,candidate_whatsapp)
 values(event_a,opening_a,'Teste conflito',phone) returning id into application_a;
 result=public.manage_team_application(application_a,'approve');
 collaborator=(result->>'collaborator_id')::uuid;
 perform public.manage_team_application(application_a,'confirm','Recreador',100);
 -- Direct inserts (supplier replacement flow) must enforce the same protection.
 begin
  insert into public.team_applications(event_id,opening_id,collaborator_id,candidate_name,candidate_whatsapp,status)
  values(event_b,opening_b,collaborator,'Teste conflito',phone,'confirmed');
  raise exception 'FAIL: replacement bypassed conflict';
 exception when check_violation then null; end;
 insert into public.team_applications(event_id,opening_id,collaborator_id,candidate_name,candidate_whatsapp,status)
 values(event_b,opening_b,collaborator,'Teste conflito',phone,'approved') returning id into application_b;
 begin
  perform public.manage_team_application(application_b,'confirm','Recreador',200);
  raise exception 'FAIL: RPC confirmation bypassed conflict';
 exception when check_violation then null; end;
 if (select status from public.team_applications where id=application_b)<>'approved' then raise exception 'FAIL: conflict changed application'; end if;
 -- Back-to-back events are allowed.
 insert into public.team_applications(event_id,opening_id,collaborator_id,candidate_name,candidate_whatsapp,status)
 values(event_c,opening_c,collaborator,'Teste conflito',phone,'confirmed');
 begin
  update public.team_events set starts_at='10:00' where id=event_c;
  raise exception 'FAIL: timetable edit bypassed conflict';
 exception when check_violation then null; end;
 if (select starts_at from public.team_events where id=event_c)<>'12:00'::time then raise exception 'FAIL: edit was not rolled back'; end if;
 -- Matching legacy contacts ignores punctuation and country-code formatting.
 begin
  perform public.assert_team_schedule(event_b,null,null,'('||substr(phone,3,2)||') '||substr(phone,5), '2098-10-15','10:00','11:00');
  raise exception 'FAIL: formatted phone bypassed identity matching';
 exception when check_violation then null; end;
 -- Missing hours reserve the day, including when only one hour is known.
 begin
  perform public.assert_team_schedule(event_b,null,collaborator,phone,'2098-10-15','18:00',null);
  raise exception 'FAIL: unspecified end time bypassed conflict';
 exception when check_violation then null; end;
 -- Cancelled and unavailable reservations no longer block other events.
 update public.team_events set status='cancelled' where id=event_a;
 update public.team_events set ends_at='12:00' where id=event_b;
 perform public.manage_team_application(application_b,'confirm','Recreador',200);
 update public.team_applications set attendance_status='unavailable' where id=application_b;
 perform public.assert_team_schedule(event_a,null,collaborator,phone,'2098-10-15','11:00','12:00');
 -- Restoring attendance and reopening an event must enforce the same rule.
 update public.team_events set status='draft' where id=event_a;
 begin
  update public.team_applications set attendance_status='confirmed' where id=application_b;
  raise exception 'FAIL: restored attendance bypassed conflict';
 exception when check_violation then null; end;
 update public.team_events set status='completed' where id=event_a;
 update public.team_applications set attendance_status='confirmed' where id=application_b;
 begin
  update public.team_events set status='draft' where id=event_a;
  raise exception 'FAIL: reactivated event bypassed conflict';
 exception when check_violation then null; end;
 -- Overnight intervals overlap the following day.
 insert into public.team_applications(event_id,opening_id,collaborator_id,candidate_name,candidate_whatsapp,status)
 values(event_night,opening_night,collaborator,'Teste conflito',phone,'confirmed');
 begin
  perform public.assert_team_schedule(event_b,null,collaborator,phone,'2098-10-17','01:00','03:00');
  raise exception 'FAIL: overnight reservation bypassed conflict';
 exception when check_violation then null; end;
 perform public.assert_team_schedule(event_b,null,collaborator,phone,'2098-10-17','02:00','03:00');
 -- An unrelated collaborator is never blocked by another person's schedule.
 perform public.assert_team_schedule(event_b,null,null,phone||'9','2098-10-15','09:00','11:00');
 if has_function_privilege('anon','public.assert_team_schedule(uuid,uuid,uuid,text,date,time,time)','EXECUTE') then raise exception 'FAIL: anonymous internal access'; end if;
 if has_function_privilege('authenticated','public.assert_team_schedule(uuid,uuid,uuid,text,date,time,time)','EXECUTE') then raise exception 'FAIL: authenticated internal access'; end if;
end $$;
rollback;
