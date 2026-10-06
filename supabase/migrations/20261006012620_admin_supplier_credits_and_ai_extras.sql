create table public.admin_credit_grants (
 id uuid primary key,
 business_id uuid not null references public.business_profiles(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 admin_user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('ads','proposal','material')),
 amount integer not null check(amount between 1 and 1000),
 reason text not null check(length(reason) between 3 and 300),
 created_at timestamptz not null default now()
);
create index admin_credit_grants_user_kind on public.admin_credit_grants(user_id,kind);
create index admin_credit_grants_business_created on public.admin_credit_grants(business_id,created_at desc);
alter table public.admin_credit_grants enable row level security;
revoke all on public.admin_credit_grants from public,anon,authenticated;
grant all on public.admin_credit_grants to service_role;
-- Read/write access for the admin UI goes exclusively through checked functions.
alter table public.losi_ai_generations add column uses_extra_credit boolean not null default false;
create index losi_ai_generations_extra on public.losi_ai_generations(user_id,kind,status) where uses_extra_credit;

alter function public.losi_ai_entitlement(uuid) rename to losi_ai_base_entitlement;
create function public.losi_ai_entitlement(p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare access_data jsonb; cycle_start timestamptz; cycle_end timestamptz; k text;
 granted integer; consumed integer; used_here integer; remaining integer; base_allowed boolean;
begin
 if exists(select 1 from public.profiles where id=p_user_id and blocked) then
  return jsonb_build_object('allowed',false); end if;
 access_data:=public.losi_ai_base_entitlement(p_user_id);
 base_allowed:=coalesce((access_data->>'allowed')::boolean,false);
 if base_allowed then
  cycle_start:=(access_data->>'periodStart')::timestamptz;
  cycle_end:=(access_data->>'periodEnd')::timestamptz;
 else
  cycle_start:=date_trunc('month',now());cycle_end:=cycle_start+interval '1 month';
  access_data:=jsonb_build_object('allowed',false,'periodStart',cycle_start,'periodEnd',cycle_end,'proposalLimit',0,'materialLimit',0);
 end if;
 for k in select unnest(array['proposal','material']) loop
  select coalesce(sum(amount),0) into granted from public.admin_credit_grants where user_id=p_user_id and kind=k;
  select count(*),count(*) filter(where period_start=cycle_start) into consumed,used_here
   from public.losi_ai_generations where user_id=p_user_id and kind=k and uses_extra_credit
   and (status='completed' or (status='pending' and created_at>now()-interval '5 minutes'));
  remaining:=greatest(0,granted-consumed);
  if not base_allowed then
   select count(*) into used_here from public.losi_ai_generations where user_id=p_user_id and kind=k and period_start=cycle_start
    and (status='completed' or (status='pending' and created_at>now()-interval '5 minutes'));
  end if;
  access_data:=access_data || jsonb_build_object(k||'BaseLimit',(access_data->>(k||'Limit'))::integer,
   k||'ExtraRemaining',remaining,k||'Limit',(access_data->>(k||'Limit'))::integer+remaining+used_here);
  if remaining>0 then access_data:=access_data||jsonb_build_object('allowed',true);end if;
 end loop;
 return access_data;
end $$;
revoke all on function public.losi_ai_entitlement(uuid) from public,anon,authenticated;
grant execute on function public.losi_ai_entitlement(uuid) to service_role;

create function private.admin_supplier_credits(
 p_action text,p_business_id uuid default null,p_kind text default null,p_amount integer default null,
 p_reason text default null,p_request_id uuid default null,p_query text default null,p_slug text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.business_profiles; old public.admin_credit_grants; result jsonb; access_data jsonb;
 used_proposal integer;used_material integer;v_balance integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and user_type='admin' and not coalesce(blocked,false)) then
  raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 if p_action='search' then
  if length(coalesce(p_query,''))>100 or length(coalesce(p_slug,''))>200 then raise exception 'INVALID_SEARCH';end if;
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (
   select bp.id,bp.business_name,bp.slug,bp.city,bp.state,p.full_name as owner_name
   from public.business_profiles bp join public.profiles p on p.id=bp.owner_id
   where (p_slug is not null and bp.slug=p_slug) or (p_slug is null and
    (coalesce(trim(p_query),'')='' or strpos(lower(concat_ws(' ',bp.business_name,p.full_name,bp.city,bp.whatsapp,p.phone)),lower(trim(p_query)))>0))
   order by bp.business_name,bp.id limit 30
  ) t;return result;
 end if;
 if p_action not in ('status','grant') then raise exception 'INVALID_ACTION';end if;
 select * into b from public.business_profiles where id=p_business_id;
 if not found then raise exception 'SUPPLIER_NOT_FOUND';end if;
 if p_action='grant' then
  if p_kind is null or p_kind not in ('ads','proposal','material') or p_amount is null or p_amount not between 1 and 1000
   or p_request_id is null or length(trim(coalesce(p_reason,''))) not between 3 and 300 then raise exception 'INVALID_GRANT';end if;
  if exists(select 1 from public.profiles where id=b.owner_id and blocked) then raise exception 'SUPPLIER_BLOCKED';end if;
  -- Same AI lock order as reservations; request lock prevents duplicated retries.
  perform pg_advisory_xact_lock(179115,42);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into old from public.admin_credit_grants where id=p_request_id;
  if found then
   if old.business_id<>b.id or old.kind<>p_kind or old.amount<>p_amount or old.admin_user_id<>auth.uid() then
    raise exception 'REQUEST_MISMATCH';end if;
  else
   if (select coalesce(sum(amount),0) from public.admin_credit_grants where user_id=b.owner_id and kind=p_kind)+p_amount>1000000 then
    raise exception 'CREDIT_LIMIT';end if;
   insert into public.admin_credit_grants(id,business_id,user_id,admin_user_id,kind,amount,reason)
    values(p_request_id,b.id,b.owner_id,auth.uid(),p_kind,p_amount,trim(p_reason));
   if p_kind='ads' then
    insert into public.losi_ads_wallets(user_id,balance) values(b.owner_id,p_amount)
     on conflict(user_id) do update set balance=public.losi_ads_wallets.balance+excluded.balance,updated_at=now();
    insert into public.losi_ads_credit_transactions(id,user_id,type,credits,amount_cents,status,external_reference,paid_at)
     values(p_request_id,b.owner_id,'grant',p_amount,0,'paid','admin-grant:'||p_request_id::text,now());
   end if;
   insert into public.admin_audit_logs(admin_user_id,action,entity_type,entity_id,entity_name,details)
    values(auth.uid(),'grant_credits','business',b.id,b.business_name,
     jsonb_build_object('kind',p_kind,'amount',p_amount,'reason',trim(p_reason),'request_id',p_request_id));
  end if;
 end if;
 access_data:=public.losi_ai_entitlement(b.owner_id);
 select count(*) filter(where kind='proposal'),count(*) filter(where kind='material') into used_proposal,used_material
  from public.losi_ai_generations where user_id=b.owner_id and period_start=(access_data->>'periodStart')::timestamptz
  and (status='completed' or (status='pending' and created_at>now()-interval '5 minutes'));
 select balance into v_balance from public.losi_ads_wallets where user_id=b.owner_id;
 return jsonb_build_object('business',jsonb_build_object('id',b.id,'business_name',b.business_name,'slug',b.slug,'city',b.city,'state',b.state),
  'adsBalance',coalesce(v_balance,0),'access',access_data,
  'used',jsonb_build_object('proposal',used_proposal,'material',used_material),
  'history',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
   select kind,amount,reason,created_at from public.admin_credit_grants where user_id=b.owner_id order by created_at desc limit 20)t));
end $$;
revoke all on function private.admin_supplier_credits(text,uuid,text,integer,text,uuid,text,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_supplier_credits(text,uuid,text,integer,text,uuid,text,text) to authenticated;
create function public.admin_supplier_credits(
 p_action text,p_business_id uuid default null,p_kind text default null,p_amount integer default null,
 p_reason text default null,p_request_id uuid default null,p_query text default null,p_slug text default null
) returns jsonb language sql security invoker set search_path='' as $$
 select private.admin_supplier_credits(p_action,p_business_id,p_kind,p_amount,p_reason,p_request_id,p_query,p_slug);
$$;
revoke all on function public.admin_supplier_credits(text,uuid,text,integer,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_supplier_credits(text,uuid,text,integer,text,uuid,text,text) to authenticated;

create or replace function public.losi_ai_reserve(p_user_id uuid,p_kind text,p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare access_data jsonb; start_date timestamptz; end_date timestamptz; quota integer;
 existing public.losi_ai_generations; used integer; base_used integer; extra boolean;
begin
 if p_kind not in ('proposal','material') then raise exception 'INVALID_KIND'; end if;
 -- A global lock also makes the platform spending cap safe under parallel requests.
 perform pg_advisory_xact_lock(179115,42);
 access_data:=public.losi_ai_entitlement(p_user_id);
 if not coalesce((access_data->>'allowed')::boolean,false) then return jsonb_build_object('error','PLAN_REQUIRED'); end if;
 select * into existing from public.losi_ai_generations where id=p_request_id;
 if found then
  if existing.user_id<>p_user_id or existing.kind<>p_kind then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  if existing.status='completed' then return jsonb_build_object('cached',true,'result',existing.result); end if;
  return jsonb_build_object('error','REQUEST_ALREADY_USED');
 end if;
 start_date:=(access_data->>'periodStart')::timestamptz;
 end_date:=(access_data->>'periodEnd')::timestamptz;
 quota:=(access_data->>case when p_kind='proposal' then 'proposalLimit' else 'materialLimit' end)::integer;
 update public.losi_ai_generations set status='failed'
 where status='pending' and created_at<now()-interval '5 minutes';
 if exists(select 1 from public.losi_ai_generations where user_id=p_user_id and status='pending') then
  return jsonb_build_object('error','BUSY'); end if;
 if (select count(*) from public.losi_ai_generations where user_id=p_user_id and created_at>now()-interval '1 hour')>=30 then
  return jsonb_build_object('error','RATE_LIMIT'); end if;
 if (select count(*) from public.losi_ai_generations where created_at>=date_trunc('month',now()))>=3000 then
  return jsonb_build_object('error','PLATFORM_LIMIT'); end if;
 select count(*) into used from public.losi_ai_generations
 where user_id=p_user_id and kind=p_kind and period_start=start_date and status in ('pending','completed');
 if used>=quota then return jsonb_build_object('error','QUOTA_EXHAUSTED'); end if;
 select count(*) into base_used from public.losi_ai_generations
 where user_id=p_user_id and kind=p_kind and period_start=start_date and not uses_extra_credit and status in ('pending','completed');
 extra:=base_used >= (access_data->>(p_kind||'BaseLimit'))::integer;
 if extra and (access_data->>(p_kind||'ExtraRemaining'))::integer<=0 then return jsonb_build_object('error','QUOTA_EXHAUSTED');end if;
 insert into public.losi_ai_generations(id,user_id,kind,period_start,period_end,uses_extra_credit)
 values(p_request_id,p_user_id,p_kind,start_date,end_date,extra);
 return jsonb_build_object('reserved',true);
end $$;
revoke all on function public.losi_ai_reserve(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.losi_ai_reserve(uuid,text,uuid) to service_role;
