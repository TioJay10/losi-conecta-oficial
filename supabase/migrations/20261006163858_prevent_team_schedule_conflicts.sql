-- Local event dates/times use half-open ranges: an event ending at 14:00
-- does not overlap one starting at 14:00. Missing hours reserve the whole day.
create or replace function public.team_schedule_window(p_date date,p_start time,p_end time)
returns tsrange language sql immutable set search_path='' as $$
 select case when p_start is null or p_end is null
 then tsrange(p_date::timestamp,(p_date+1)::timestamp,'[)')
 else tsrange(p_date+p_start,p_date+p_end+case when p_end<=p_start then interval '1 day' else interval '0' end,'[)') end;
$$;
create or replace function public.team_schedule_phone(p_phone text)
returns text language sql immutable set search_path='' as $$
 select case when length(n) in (10,11) then '55'||n else n end
 from (select regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') as n) x;
$$;

-- Internal only; generic errors never reveal another supplier's event or contacts.
create or replace function public.assert_team_schedule(
 p_event uuid,p_profile uuid,p_collaborator uuid,p_phone text,
 p_date date,p_start time,p_end time
) returns void language plpgsql security definer set search_path='' as $$
declare identity_profile uuid; identity_phone text; conflict_found boolean;
begin
 identity_profile=p_profile;
 if identity_profile is null and p_collaborator is not null then
  select c.profile_id into identity_profile from public.team_collaborators c where c.id=p_collaborator;
 end if;
 identity_phone=nullif(public.team_schedule_phone(p_phone),'');
 select exists(
  select 1 from public.team_applications a
  join public.team_events e on e.id=a.event_id
  left join public.team_collaborators c on c.id=a.collaborator_id
  where a.event_id<>p_event and a.status='confirmed'
  and coalesce(a.attendance_status,'')<>'unavailable'
  and e.status not in ('completed','cancelled')
  and (
   (identity_profile is not null and coalesce(a.profile_id,c.profile_id)=identity_profile)
   or (p_collaborator is not null and a.collaborator_id=p_collaborator)
   or (identity_phone is not null and public.team_schedule_phone(a.candidate_whatsapp)=identity_phone)
  )
  and public.team_schedule_window(e.event_date,e.starts_at,e.ends_at)
      && public.team_schedule_window(p_date,p_start,p_end)
 ) into conflict_found;
 if conflict_found then
  raise exception using errcode='23514',message='Conflito de horários: este colaborador já está escalado em outro evento neste período. Escolha outra pessoa ou ajuste os horários. Eventos sem início ou término informado reservam o dia inteiro.';
 end if;
end;
$$;

create or replace function public.guard_team_application_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
declare e public.team_events%rowtype;
begin
 if new.status<>'confirmed' or coalesce(new.attendance_status,'')='unavailable' then return new; end if;
 if tg_op='UPDATE' then
  if old.status='confirmed' and coalesce(old.attendance_status,'')<>'unavailable'
   and old.event_id is not distinct from new.event_id
   and old.profile_id is not distinct from new.profile_id
   and old.collaborator_id is not distinct from new.collaborator_id
   and old.candidate_whatsapp is not distinct from new.candidate_whatsapp then return new; end if;
 end if;
 -- One transaction lock serializes confirmations and timetable edits across suppliers.
 -- It also protects legacy/manual identities represented by differently formatted phones.
 perform pg_advisory_xact_lock(7261046385801::bigint);
 select * into e from public.team_events where id=new.event_id;
 if e.id is null or e.status in ('completed','cancelled') then return new; end if;
 perform public.assert_team_schedule(new.event_id,new.profile_id,new.collaborator_id,new.candidate_whatsapp,e.event_date,e.starts_at,e.ends_at);
 return new;
end;
$$;

create or replace function public.guard_team_event_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
declare a record;
begin
 if new.status in ('completed','cancelled') then return new; end if;
 if old.event_date is not distinct from new.event_date
  and old.starts_at is not distinct from new.starts_at
  and old.ends_at is not distinct from new.ends_at
  and old.status not in ('completed','cancelled') then return new; end if;
 perform pg_advisory_xact_lock(7261046385801::bigint);
 for a in select profile_id,collaborator_id,candidate_whatsapp from public.team_applications
  where event_id=new.id and status='confirmed' and coalesce(attendance_status,'')<>'unavailable'
 loop
  perform public.assert_team_schedule(new.id,a.profile_id,a.collaborator_id,a.candidate_whatsapp,new.event_date,new.starts_at,new.ends_at);
 end loop;
 return new;
end;
$$;

create trigger guard_team_application_schedule before insert or update of status,attendance_status,event_id,profile_id,collaborator_id,candidate_whatsapp
on public.team_applications for each row execute function public.guard_team_application_schedule();
create trigger guard_team_event_schedule before update of event_date,starts_at,ends_at,status
on public.team_events for each row execute function public.guard_team_event_schedule();

revoke all on function public.team_schedule_window(date,time,time) from public,anon,authenticated;
revoke all on function public.team_schedule_phone(text) from public,anon,authenticated;
revoke all on function public.assert_team_schedule(uuid,uuid,uuid,text,date,time,time) from public,anon,authenticated;
revoke all on function public.guard_team_application_schedule() from public,anon,authenticated;
revoke all on function public.guard_team_event_schedule() from public,anon,authenticated;
grant execute on function public.team_schedule_window(date,time,time),public.team_schedule_phone(text),public.assert_team_schedule(uuid,uuid,uuid,text,date,time,time),public.guard_team_application_schedule(),public.guard_team_event_schedule() to service_role;
