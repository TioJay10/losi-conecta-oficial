
create table public.losi_ai_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 starts_at timestamptz not null default now(), ends_at timestamptz not null,
 proposal_limit integer not null default 4 check(proposal_limit between 0 and 100),
 material_limit integer not null default 5 check(material_limit between 0 and 100),
 check(ends_at > starts_at)
);
create table public.losi_ai_generations (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('proposal','material')),
 status text not null default 'pending' check(status in ('pending','completed','failed')),
 period_start timestamptz not null, period_end timestamptz not null,
 result jsonb, input_tokens integer, output_tokens integer,
 created_at timestamptz not null default now()
);
create index losi_ai_generations_user_period on public.losi_ai_generations(user_id,period_start,kind,status);
create index losi_ai_generations_created on public.losi_ai_generations(created_at);
create table public.losi_ai_materials (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 160),
 content text not null check(length(content) <= 60000),
 updated_at timestamptz not null default now()
);
alter table public.losi_ai_access enable row level security;
alter table public.losi_ai_generations enable row level security;
alter table public.losi_ai_materials enable row level security;
revoke all on public.losi_ai_access,public.losi_ai_generations,public.losi_ai_materials from public,anon,authenticated;
grant select on public.losi_ai_access,public.losi_ai_generations to authenticated;
grant select,insert,update,delete on public.losi_ai_materials to authenticated;
grant all on public.losi_ai_access,public.losi_ai_generations,public.losi_ai_materials to service_role;
create policy ai_access_owner on public.losi_ai_access for select to authenticated using(user_id=(select auth.uid()));
create policy ai_generations_owner on public.losi_ai_generations for select to authenticated using(user_id=(select auth.uid()));
create policy ai_materials_read on public.losi_ai_materials for select to authenticated using(user_id=(select auth.uid()));
create policy ai_materials_insert on public.losi_ai_materials for insert to authenticated with check(user_id=(select auth.uid()));
create policy ai_materials_update on public.losi_ai_materials for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy ai_materials_delete on public.losi_ai_materials for delete to authenticated using(user_id=(select auth.uid()));

-- Only the authenticated Edge Function's service client can execute these operations.
create function public.losi_ai_entitlement(p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare base timestamptz; expires timestamptz; cycle_start timestamptz; cycle_end timestamptz;
 pl integer:=4; ml integer:=5; allowed boolean:=false;
begin
 select a.starts_at,a.ends_at,a.proposal_limit,a.material_limit into base,expires,pl,ml
 from public.losi_ai_access a where a.user_id=p_user_id and now() between a.starts_at and a.ends_at;
 if found then allowed:=true;
 else
  pl:=4; ml:=5;
  select s.starts_at,s.ends_at into base,expires from public.business_subscriptions s
  join public.business_profiles b on b.id=s.business_id join public.plans p on p.id=s.plan_id
  where b.owner_id=p_user_id and p.slug='pro' and s.status='active'
    and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now())
  order by s.starts_at desc limit 1;
  if found then allowed:=true;
  elsif exists(select 1 from public.profiles where id=p_user_id and user_type='admin') then
   allowed:=true; base:=date_trunc('month',now()); expires:=base+interval '1 month';
  end if;
 end if;
 if not allowed then return jsonb_build_object('allowed',false); end if;
 select max(d) into cycle_start from generate_series(base,now(),interval '1 month') d;
 cycle_end:=least(cycle_start+interval '1 month',coalesce(expires,cycle_start+interval '1 month'));
 return jsonb_build_object('allowed',true,'periodStart',cycle_start,'periodEnd',cycle_end,
 'proposalLimit',pl,'materialLimit',ml);
end $$;
revoke all on function public.losi_ai_entitlement(uuid) from public,anon,authenticated;
grant execute on function public.losi_ai_entitlement(uuid) to service_role;

create function public.losi_ai_reserve(p_user_id uuid,p_kind text,p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare access_data jsonb; start_date timestamptz; end_date timestamptz; quota integer;
 existing public.losi_ai_generations; used integer;
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
 insert into public.losi_ai_generations(id,user_id,kind,period_start,period_end)
 values(p_request_id,p_user_id,p_kind,start_date,end_date);
 return jsonb_build_object('reserved',true);
end $$;
revoke all on function public.losi_ai_reserve(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.losi_ai_reserve(uuid,text,uuid) to service_role;
