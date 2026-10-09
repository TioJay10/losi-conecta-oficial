create table public.losi_forms (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 public_token uuid not null unique default gen_random_uuid(), title text not null check(length(title) between 1 and 160),
 description text not null default '' check(length(description)<=3000), template text not null default 'free',
 fields jsonb not null check(jsonb_typeof(fields)='array' and jsonb_array_length(fields) between 1 and 40),
 audience text not null default 'public' check(audience in ('public','suppliers','both')),
 status text not null default 'draft' check(status in ('draft','open','closed')),
 notify boolean not null default true, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index losi_forms_owner_created_idx on public.losi_forms(owner_id,created_at desc);
create table public.losi_form_invitations (
 id uuid primary key default gen_random_uuid(), form_id uuid not null references public.losi_forms(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
 unique(form_id,recipient_id)
);
create index losi_form_invitations_recipient_idx on public.losi_form_invitations(recipient_id,created_at desc);
create table public.losi_form_responses (
 id uuid primary key default gen_random_uuid(), form_id uuid not null references public.losi_forms(id) on delete cascade,
 request_id uuid not null, respondent_id uuid references auth.users(id) on delete set null,
 respondent_name text not null check(length(respondent_name) between 1 and 200),
 source text not null check(source in ('public','supplier')), answers jsonb not null, definition jsonb not null,
 status text not null default 'new' check(status in ('new','review','approved','archived')),
 ip_hash text not null, created_at timestamptz not null default now(), unique(form_id,request_id)
);
create index losi_form_responses_form_created_idx on public.losi_form_responses(form_id,created_at desc);
create index losi_form_responses_rate_idx on public.losi_form_responses(ip_hash,created_at desc);
create unique index losi_form_responses_supplier_idx on public.losi_form_responses(form_id,respondent_id) where source='supplier';
alter table public.losi_forms enable row level security;
alter table public.losi_form_invitations enable row level security;
alter table public.losi_form_responses enable row level security;
revoke all on public.losi_forms,public.losi_form_invitations,public.losi_form_responses from public,anon,authenticated;
grant all on public.losi_forms,public.losi_form_invitations,public.losi_form_responses to service_role;
-- All data goes through the function's verified ownership/token projections. No public table reads.
create policy losi_forms_service on public.losi_forms for all to service_role using(true) with check(true);
create policy losi_form_invitations_service on public.losi_form_invitations for all to service_role using(true) with check(true);
create policy losi_form_responses_service on public.losi_form_responses for all to service_role using(true) with check(true);
create function public.losi_forms_submit(p_token uuid,p_version integer,p_request uuid,p_name text,p_answers jsonb,p_ip text,p_user uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare f public.losi_forms; existing uuid; new_id uuid; src text;
begin
 select * into f from public.losi_forms where public_token=p_token for update;
 if not found then raise exception 'FORM_UNAVAILABLE'; end if;
 select id into existing from public.losi_form_responses where form_id=f.id and request_id=p_request and ip_hash=p_ip and respondent_id is not distinct from p_user;
 if existing is not null then return existing; end if;
 if f.status<>'open' or not exists(select 1 from public.business_profiles b join public.profiles p on p.id=b.owner_id where b.owner_id=f.owner_id and b.active=true and coalesce(p.blocked,false)=false) then raise exception 'FORM_UNAVAILABLE'; end if;
 if f.version<>p_version then raise exception 'FORM_CHANGED'; end if;
 if p_user is null then
  if f.audience not in ('public','both') then raise exception 'FORM_LOGIN_REQUIRED'; end if;
  src:='public';
 else
  if f.audience not in ('suppliers','both') or not exists(select 1 from public.losi_form_invitations where form_id=f.id and recipient_id=p_user) then raise exception 'FORM_INVITATION_REQUIRED'; end if;
  if not exists(select 1 from public.business_profiles b join public.profiles p on p.id=b.owner_id where b.owner_id=p_user and b.active=true and coalesce(p.blocked,false)=false) then raise exception 'FORM_INVITATION_REQUIRED'; end if;
  if exists(select 1 from public.losi_form_responses where form_id=f.id and respondent_id=p_user and source='supplier') then raise exception 'FORM_ALREADY_SENT'; end if;
  src:='supplier';
 end if;
 -- Serialize each IP bucket across forms as well as the per-form row lock.
 perform pg_advisory_xact_lock(hashtextextended(p_ip,0));
 if (select count(*) from public.losi_form_responses where ip_hash=p_ip and created_at>now()-interval '1 hour')>=20 or
    (select count(*) from public.losi_form_responses where form_id=f.id and created_at>now()-interval '1 hour')>=500 then raise exception 'FORM_RATE_LIMIT'; end if;
 insert into public.losi_form_responses(form_id,request_id,respondent_id,respondent_name,source,answers,definition,ip_hash)
 values(f.id,p_request,p_user,p_name,src,p_answers,jsonb_build_object('title',f.title,'fields',f.fields),p_ip) returning id into new_id;
 if f.notify then
  insert into public.notifications(user_id,type,title,message,link) values(f.owner_id,'form_response','Nova resposta de formulário',p_name||' respondeu: '||f.title,'/formularios');
 end if;
 return new_id;
end $$;
revoke all on function public.losi_forms_submit(uuid,integer,uuid,text,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.losi_forms_submit(uuid,integer,uuid,text,jsonb,text,uuid) to service_role;
