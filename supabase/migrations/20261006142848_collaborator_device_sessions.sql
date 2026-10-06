create table public.collaborator_sessions (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.collaborator_profiles(id) on delete cascade,
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index collaborator_sessions_profile_idx on public.collaborator_sessions(profile_id);
alter table public.collaborator_sessions enable row level security;
revoke all on public.collaborator_sessions from public, anon, authenticated;
grant all on public.collaborator_sessions to service_role;

create function public.link_collaborator_network_profile(p_profile_id uuid)
returns void language sql security invoker set search_path = '' as $$
 update public.team_collaborators c set profile_id = p.id
 from public.collaborator_profiles p
 where p.id = p_profile_id and c.profile_id is null
 and (case when length(regexp_replace(c.whatsapp, '[^0-9]', '', 'g')) in (10,11)
 then '55' || regexp_replace(c.whatsapp, '[^0-9]', '', 'g')
 else regexp_replace(c.whatsapp, '[^0-9]', '', 'g') end) = p.whatsapp_normalized;
$$;
revoke all on function public.link_collaborator_network_profile(uuid) from public, anon, authenticated;
grant execute on function public.link_collaborator_network_profile(uuid) to service_role;
