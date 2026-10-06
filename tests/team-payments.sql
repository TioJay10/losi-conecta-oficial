-- Reversible integration test; no fixture or notification survives rollback.
begin;
do $$
declare business uuid; owner uuid; event_a uuid; event_b uuid; opening_a uuid; opening_b uuid;
 a uuid; b uuid; no_value uuid; no_scale uuid; result jsonb; paid_time timestamptz; phone text;
begin
 select bp.id,bp.owner_id into business,owner from public.business_profiles bp
 join auth.users u on u.id=bp.owner_id where lower(u.email)='contato@losigestaoemlazer.com.br' limit 1;
 if business is null then raise exception 'Test business missing'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner)::text,true);
 phone='55'||lpad((floor(random()*10000000000)::bigint)::text,11,'0');
 insert into public.team_events(business_id,title,event_date,status) values(business,'Teste Pagamento A','2097-10-17','draft') returning id into event_a;
 insert into public.team_events(business_id,title,event_date,status) values(business,'Teste Pagamento B','2097-10-18','draft') returning id into event_b;
 insert into public.team_event_openings(event_id,title,slots) values(event_a,'Teste pagamento',3) returning id into opening_a;
 insert into public.team_event_openings(event_id,title) values(event_b,'Teste pagamento') returning id into opening_b;
 insert into public.team_applications(event_id,opening_id,candidate_name,candidate_whatsapp,status,agreed_value)
 values(event_a,opening_a,'Teste Pagamento',phone,'confirmed',100) returning id into a;
 insert into public.team_applications(event_id,opening_id,candidate_name,candidate_whatsapp,status,agreed_value)
 values(event_b,opening_b,'Teste Pagamento',phone,'confirmed',200) returning id into b;
 insert into public.team_applications(event_id,opening_id,candidate_name,candidate_whatsapp,status)
 values(event_a,opening_a,'Teste Sem Valor',phone||'1','confirmed') returning id into no_value;
 insert into public.team_applications(event_id,opening_id,candidate_name,candidate_whatsapp,status,agreed_value)
 values(event_a,opening_a,'Teste Candidato',phone||'2','pending',50) returning id into no_scale;
 -- Exercise actual authenticated grants and RLS, rather than only privileged SQL.
 execute 'set local role authenticated';
 result=public.set_team_payment(a,'paid','pending');
 if result->>'payment_status'<>'paid' then raise exception 'FAIL: paid status'; end if;
 select paid_at into paid_time from public.team_applications where id=a;
 if paid_time is null or (select paid_by from public.team_applications where id=a)<>owner then raise exception 'FAIL: payment actor/timestamp'; end if;
 if (select payment_status from public.team_applications where id=b)<>'pending' then raise exception 'FAIL: payment leaked across events'; end if;
 begin
  perform public.set_team_payment(a,'pending','pending');raise exception 'FAIL: stale write accepted';
 exception when others then if sqlerrm not like 'O pagamento foi atualizado%' then raise; end if;end;
 begin
  update public.team_applications set agreed_value=150 where id=a;raise exception 'FAIL: paid amount changed';
 exception when check_violation then null;end;
 update public.team_applications set paid_at='2000-01-01' where id=a;
 if (select paid_at from public.team_applications where id=a)<>paid_time then raise exception 'FAIL: timestamp tampered'; end if;
 result=public.set_team_payment(a,'pending','paid');
 if (select paid_at from public.team_applications where id=a) is not null then raise exception 'FAIL: reopening did not clear timestamp';end if;
 update public.team_applications set agreed_value=150 where id=a;
 perform public.set_team_payment(a,'paid','pending');
 begin
  perform public.set_team_payment(no_value,'paid','pending');raise exception 'FAIL: undefined amount accepted';
 exception when others then if sqlerrm not like 'Defina um valor individual%' then raise; end if;end;
 begin
  perform public.set_team_payment(no_scale,'paid','pending');raise exception 'FAIL: candidate paid before scale';
 exception when others then if sqlerrm not like 'Só é possível registrar pagamento%' then raise; end if;end;
 begin
  perform public.set_team_payment(a,'invalid','paid');raise exception 'FAIL: invalid status';
 exception when others then if sqlerrm not like 'Status de pagamento inválido%' then raise; end if;end;
 update public.team_events set status='completed' where id=event_b;
 perform public.set_team_payment(b,'paid','pending');
 -- An unrelated authenticated identity cannot read or change these payments.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid())::text,true);
 if exists(select 1 from public.team_applications where id=a) then raise exception 'FAIL: another user read payment';end if;
 begin
  perform public.set_team_payment(a,'pending','paid');raise exception 'FAIL: another user changed payment';
 exception when others then if sqlerrm not like 'Pagamento não encontrado ou sem permissão%' then raise;end if;end;
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform public.set_team_payment(a,'paid','pending');raise exception 'FAIL: unauthenticated write';
 exception when others then if sqlerrm not like 'Entre na conta%' then raise;end if;end;
 execute 'reset role';
 if has_function_privilege('anon','public.set_team_payment(uuid,text,text)','EXECUTE') then raise exception 'FAIL: anonymous RPC grant';end if;
end $$;
rollback;
