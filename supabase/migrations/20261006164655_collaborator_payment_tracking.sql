alter table public.team_applications
 add column payment_status text not null default 'pending' check(payment_status in ('pending','paid')),
 add column paid_at timestamptz,
 add column paid_by uuid references auth.users(id) on delete set null,
 add constraint team_payment_timestamp_consistent check(
  (payment_status='pending' and paid_at is null and paid_by is null)
  or (payment_status='paid' and paid_at is not null)
 );

create function public.guard_team_payment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.payment_status='paid' and new.agreed_value is distinct from old.agreed_value then
   raise exception using errcode='23514',message='Reabra o pagamento como pendente antes de alterar o valor individual.';
  end if;
 end if;
 if new.payment_status='pending' then new.paid_at=null;new.paid_by=null;
 elsif tg_op='INSERT' or old.payment_status<>'paid' then
  if new.status not in ('confirmed','removed') then raise exception 'Só é possível registrar pagamento de uma participação escalada.'; end if;
  if new.agreed_value is null or new.agreed_value<0 then raise exception 'Defina um valor individual válido antes de marcar como pago.'; end if;
  if auth.uid() is null or not exists(
   select 1 from public.team_events e join public.business_profiles b on b.id=e.business_id
   where e.id=new.event_id and b.owner_id=auth.uid()
  ) then raise exception 'Sem permissão para registrar este pagamento.'; end if;
  new.paid_at=now();new.paid_by=auth.uid();
 elsif tg_op='UPDATE' then new.paid_at=old.paid_at;new.paid_by=old.paid_by;
 end if;
 return new;
end;
$$;
create trigger guard_team_payment before insert or update of payment_status,paid_at,paid_by,agreed_value
 on public.team_applications for each row execute function public.guard_team_payment();
revoke all on function public.guard_team_payment() from public,anon,authenticated;

create function public.set_team_payment(p_application_id uuid,p_status text,p_expected_status text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.team_applications%rowtype;
begin
 if auth.uid() is null then raise exception 'Entre na conta do fornecedor.'; end if;
 if p_status not in ('pending','paid') or p_status is null then raise exception 'Status de pagamento inválido.'; end if;
 select t.* into a from public.team_applications t
 join public.team_events e on e.id=t.event_id join public.business_profiles b on b.id=e.business_id
 where t.id=p_application_id and b.owner_id=auth.uid() for update of t;
 if a.id is null then raise exception 'Pagamento não encontrado ou sem permissão.'; end if;
 if a.status not in ('confirmed','removed') then raise exception 'Só é possível registrar pagamento de uma participação escalada.'; end if;
 if p_expected_status is distinct from a.payment_status then raise exception 'O pagamento foi atualizado em outra tela. Atualize a página antes de continuar.'; end if;
 update public.team_applications set payment_status=p_status where id=a.id returning * into a;
 return jsonb_build_object('id',a.id,'payment_status',a.payment_status,'paid_at',a.paid_at,'agreed_value',a.agreed_value);
end;
$$;
revoke all on function public.set_team_payment(uuid,text,text) from public,anon;
grant execute on function public.set_team_payment(uuid,text,text) to authenticated;
