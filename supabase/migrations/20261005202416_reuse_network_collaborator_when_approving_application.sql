CREATE OR REPLACE FUNCTION public.manage_team_application(p_application_id uuid, p_action text, p_assigned_role text DEFAULT NULL::text, p_agreed_value numeric DEFAULT NULL::numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
 a public.team_applications%rowtype;
 e public.team_events%rowtype;
 c public.team_collaborators%rowtype;
 p public.collaborator_profiles%rowtype;
 candidate_phone text;
 normalized_phone text;
begin
 select * into a from public.team_applications where id=p_application_id;
 if a.id is null then raise exception 'Candidatura não encontrada'; end if;
 select * into e from public.team_events where id=a.event_id;
 if not exists(select 1 from public.business_profiles b where b.id=e.business_id and b.owner_id=auth.uid()) then raise exception 'Sem permissão'; end if;
 -- Serialize approvals in one network; the unique index remains the final arbiter.
 perform pg_advisory_xact_lock(hashtextextended(e.business_id::text,0));
 select * into a from public.team_applications where id=p_application_id for update;

 if p_action='reject' then
  update public.team_applications set status='rejected' where id=a.id;
  return jsonb_build_object('success',true);
 end if;

 if p_action='approve' then
  if a.status='confirmed' and a.collaborator_id is not null then
   select * into c from public.team_collaborators where id=a.collaborator_id and business_id=e.business_id;
   if c.id is not null then
    return jsonb_build_object('success',true,'collaborator_id',c.id,'calendar_token',c.calendar_token);
   end if;
  end if;
  if a.profile_id is not null then
   select * into p from public.collaborator_profiles where id=a.profile_id;
   if p.id is null then raise exception 'Cadastro do colaborador não encontrado'; end if;
  end if;
  candidate_phone=coalesce(p.whatsapp,a.candidate_whatsapp);
  normalized_phone=regexp_replace(candidate_phone,'[^0-9]','','g');
  if length(normalized_phone) in (10,11) then normalized_phone='55'||normalized_phone; end if;

  -- First reuse the identity link, then match a legacy/manual network contact.
  select * into c from public.team_collaborators
   where business_id=e.business_id and p.id is not null and profile_id=p.id
   order by created_at,id limit 1 for update;
  if c.id is null then
   select * into c from public.team_collaborators
    where business_id=e.business_id and (
      whatsapp=candidate_phone or
      (length(normalized_phone) in (12,13) and
       case when length(regexp_replace(whatsapp,'[^0-9]','','g')) in (10,11)
         then '55'||regexp_replace(whatsapp,'[^0-9]','','g')
         else regexp_replace(whatsapp,'[^0-9]','','g') end=normalized_phone)
    )
    order by (whatsapp=candidate_phone) desc,created_at,id limit 1 for update;
  end if;
  if c.id is null then
   insert into public.team_collaborators as existing (
    business_id,profile_id,name,whatsapp,city,state,notes,source_application_id,network_status
   ) values (
    e.business_id,p.id,coalesce(p.full_name,a.candidate_name),candidate_phone,
    coalesce(p.city,a.candidate_city),coalesce(p.state,a.candidate_state),a.candidate_notes,a.id,'active'
   )
   on conflict (business_id,whatsapp) do update
    set network_status='active',profile_id=coalesce(existing.profile_id,excluded.profile_id)
    where existing.profile_id is null or excluded.profile_id is null or existing.profile_id=excluded.profile_id
   returning * into c;
   if c.id is null then raise exception 'Este WhatsApp está vinculado a outro ID de colaborador. Confira o cadastro antes de aprovar.'; end if;
  else
   if p.id is not null and c.profile_id is not null and c.profile_id<>p.id then
    raise exception 'Este WhatsApp está vinculado a outro ID de colaborador. Confira o cadastro antes de aprovar.';
   end if;
   update public.team_collaborators set network_status='active',profile_id=coalesce(profile_id,p.id)
    where id=c.id returning * into c;
  end if;

  update public.team_applications
   set status='approved',collaborator_id=c.id,approved_at=coalesce(approved_at,now())
   where id=a.id;
  return jsonb_build_object('success',true,'collaborator_id',c.id,'calendar_token',coalesce(p.calendar_token,c.calendar_token));
 end if;

 if p_action='confirm' then
  if nullif(trim(p_assigned_role),'') is null then raise exception 'Informe a função final'; end if;
  if a.collaborator_id is null then raise exception 'Aprove a candidatura antes de confirmar na escala'; end if;
  update public.team_applications
   set status='confirmed',assigned_role=trim(p_assigned_role),agreed_value=p_agreed_value,confirmed_at=now()
   where id=a.id;
  return jsonb_build_object('success',true);
 end if;
 raise exception 'Ação inválida';
end
$function$;
