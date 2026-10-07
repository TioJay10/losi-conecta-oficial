-- Chat LOSI: independent from ADS and subscriptions. Writes are server-only.
create table public.losi_chat_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 business_id uuid not null unique references public.business_profiles(id) on delete cascade,
 digital_number text unique check (digital_number ~ '^[1-9][0-9]{8}$'),
 balance bigint not null default 0, show_public boolean not null default false,
 created_at timestamptz not null default now(), claimed_at timestamptz
);
create table public.losi_chat_orders (
 id uuid primary key, user_id uuid not null references public.losi_chat_accounts(user_id),
 package_key text not null, credits integer not null, amount_cents integer not null,
 kind text not null check(kind in ('initial','recharge')),
 status text not null default 'creating' check(status in ('creating','pending','paid','failed','cancelled','refunded')),
 external_reference text not null unique, asaas_payment_id text unique, customer_id text,
 invoice_url text, created_at timestamptz not null default now(), paid_at timestamptz,
 check((package_key='10k' and credits=10000 and amount_cents=2990) or (package_key='50k' and credits=50000 and amount_cents=7990))
);
create unique index losi_chat_one_pending_order on public.losi_chat_orders(user_id) where status in ('creating','pending');
create index losi_chat_orders_owner on public.losi_chat_orders(user_id,created_at desc);
create table public.losi_chat_threads (
 id uuid primary key default gen_random_uuid(), user_a uuid not null references public.losi_chat_accounts(user_id),
 user_b uuid not null references public.losi_chat_accounts(user_id), created_at timestamptz not null default now(),
 unique(user_a,user_b), check(user_a<user_b)
);
create index losi_chat_threads_user_b on public.losi_chat_threads(user_b);
create table public.losi_chat_messages (
 id uuid primary key, thread_id uuid not null references public.losi_chat_threads(id),
 sender_id uuid not null references public.losi_chat_accounts(user_id), body text not null check(length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index losi_chat_messages_thread on public.losi_chat_messages(thread_id,created_at desc,id desc);
create table public.losi_chat_thread_preferences (
 thread_id uuid not null references public.losi_chat_threads(id), user_id uuid not null references public.losi_chat_accounts(user_id),
 favorite boolean not null default false, read_at timestamptz, primary key(thread_id,user_id)
);
create table public.losi_chat_ledger (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.losi_chat_accounts(user_id),
 delta integer not null, order_id uuid references public.losi_chat_orders(id), message_id uuid unique references public.losi_chat_messages(id),
 reason text not null check(reason in ('purchase','refund','message')), created_at timestamptz not null default now(),
 unique(order_id,reason)
);
create index losi_chat_ledger_owner on public.losi_chat_ledger(user_id,created_at desc);
alter table public.losi_chat_accounts enable row level security;
alter table public.losi_chat_orders enable row level security;
alter table public.losi_chat_threads enable row level security;
alter table public.losi_chat_messages enable row level security;
alter table public.losi_chat_thread_preferences enable row level security;
alter table public.losi_chat_ledger enable row level security;
revoke all on public.losi_chat_accounts,public.losi_chat_orders,public.losi_chat_threads,public.losi_chat_messages,public.losi_chat_thread_preferences,public.losi_chat_ledger from anon,authenticated;
grant select on public.losi_chat_accounts,public.losi_chat_orders,public.losi_chat_threads,public.losi_chat_messages,public.losi_chat_thread_preferences,public.losi_chat_ledger to authenticated;
grant all on public.losi_chat_accounts,public.losi_chat_orders,public.losi_chat_threads,public.losi_chat_messages,public.losi_chat_thread_preferences,public.losi_chat_ledger to service_role;
create policy chat_own_account on public.losi_chat_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy chat_own_orders on public.losi_chat_orders for select to authenticated using(user_id=(select auth.uid()));
create policy chat_own_ledger on public.losi_chat_ledger for select to authenticated using(user_id=(select auth.uid()));
create policy chat_own_preferences on public.losi_chat_thread_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy chat_participant_threads on public.losi_chat_threads for select to authenticated using((select auth.uid()) in(user_a,user_b));
create policy chat_participant_messages on public.losi_chat_messages for select to authenticated using(exists(select 1 from public.losi_chat_threads t where t.id=thread_id and (select auth.uid()) in(t.user_a,t.user_b)));

create function public.losi_chat_reserve_order(p_user uuid,p_request uuid,p_package text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; o public.losi_chat_orders; b uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select id into b from public.business_profiles where owner_id=p_user and active=true limit 1;
 if b is null or exists(select 1 from public.profiles where id=p_user and blocked=true) then raise exception 'FORNECEDOR_INDISPONIVEL'; end if;
 insert into public.losi_chat_accounts(user_id,business_id) values(p_user,b) on conflict(user_id) do nothing;
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 if p_package not in ('10k','50k') then raise exception 'PACOTE_INVALIDO'; end if;
 select * into o from public.losi_chat_orders where id=p_request;
 if found then
  if o.user_id<>p_user then raise exception 'PEDIDO_INVALIDO'; end if;
  return jsonb_build_object('order',to_jsonb(o),'created',false);
 end if;
 select * into o from public.losi_chat_orders where user_id=p_user and status in ('creating','pending') order by created_at desc limit 1;
 if found then return jsonb_build_object('order',to_jsonb(o),'created',false); end if;
 -- Paid first purchase must be redeemed before a recharge.
 if a.digital_number is null and exists(select 1 from public.losi_chat_orders where user_id=p_user and status='paid') then raise exception 'RESGATE_SEU_NUMERO'; end if;
 insert into public.losi_chat_orders(id,user_id,package_key,credits,amount_cents,kind,external_reference)
 values(p_request,p_user,p_package,case p_package when '10k' then 10000 else 50000 end,case p_package when '10k' then 2990 else 7990 end,case when a.digital_number is null then 'initial' else 'recharge' end,'losi_chat:'||p_request)
 returning * into o;
 return jsonb_build_object('order',to_jsonb(o),'created',true);
end $$;

create function public.losi_chat_settle_order(p_reference text,p_payment text,p_customer text,p_amount integer,p_state text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare o public.losi_chat_orders; changed boolean=false;
begin
 select * into o from public.losi_chat_orders where external_reference=p_reference for update;
 if not found then raise exception 'PEDIDO_NAO_ENCONTRADO'; end if;
 if nullif(p_payment,'') is null or p_amount<>o.amount_cents or o.customer_id is distinct from p_customer or (o.asaas_payment_id is not null and o.asaas_payment_id<>p_payment) then raise exception 'PAGAMENTO_DIVERGENTE'; end if;
 if p_state in ('CONFIRMED','RECEIVED') and o.status not in ('paid','refunded','cancelled') then
  update public.losi_chat_accounts set balance=balance+o.credits where user_id=o.user_id;
  update public.losi_chat_orders set status='paid',asaas_payment_id=p_payment,paid_at=now() where id=o.id;
  insert into public.losi_chat_ledger(user_id,delta,order_id,reason) values(o.user_id,o.credits,o.id,'purchase');
  insert into public.notifications(user_id,type,title,message,link) values(o.user_id,'payment_accepted',case when o.kind='initial' then 'Resgate seu número digital LOSI' else 'Recarga Chat LOSI confirmada' end,case when o.kind='initial' then 'Seu pagamento foi confirmado. Resgate seu número no Chat LOSI.' else 'Os créditos da sua recarga já estão disponíveis no chat.' end,'/chat-losi');
  changed=true;
 elsif p_state in ('REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL') and o.status<>'refunded' then
  if o.status='paid' then
   update public.losi_chat_accounts set balance=balance-o.credits where user_id=o.user_id;
   insert into public.losi_chat_ledger(user_id,delta,order_id,reason) values(o.user_id,-o.credits,o.id,'refund');
  end if;
  update public.losi_chat_orders set status='refunded',asaas_payment_id=p_payment where id=o.id;
  changed=true;
 elsif p_state='DELETED' and o.status in ('pending','creating') then
  update public.losi_chat_orders set status='cancelled',asaas_payment_id=p_payment where id=o.id;
  changed=true;
 end if;
 return changed;
end $$;

create function public.losi_chat_claim(p_user uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; n text; attempt integer=0;
begin
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 if a.digital_number is not null then return a.digital_number; end if;
 if not exists(select 1 from public.losi_chat_orders where user_id=p_user and status='paid' and kind='initial') or a.balance<=0 then raise exception 'PAGAMENTO_PENDENTE'; end if;
 loop
  n=(100000000+floor(random()*900000000))::bigint::text;
  begin
   update public.losi_chat_accounts set digital_number=n,claimed_at=now() where user_id=p_user;
   return n;
  exception when unique_violation then attempt=attempt+1; if attempt>20 then raise exception 'TENTE_NOVAMENTE'; end if;
  end;
 end loop;
end $$;

create function public.losi_chat_send_text(p_user uuid,p_thread uuid,p_request uuid,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.losi_chat_accounts; t public.losi_chat_threads; m public.losi_chat_messages; recipient uuid;
begin
 select * into a from public.losi_chat_accounts where user_id=p_user for update;
 select * into t from public.losi_chat_threads where id=p_thread;
 if t.id is null or p_user not in(t.user_a,t.user_b) or a.digital_number is null then raise exception 'CONVERSA_INDISPONIVEL'; end if;
 select * into m from public.losi_chat_messages where id=p_request;
 if found then
  if m.sender_id<>p_user or m.thread_id<>p_thread or m.body<>btrim(p_body) then raise exception 'ENVIO_INVALIDO'; end if;
  return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
 end if;
 recipient=case when t.user_a=p_user then t.user_b else t.user_a end;
 if exists(select 1 from public.profiles where id in(p_user,recipient) and blocked=true) or not exists(select 1 from public.losi_chat_accounts x join public.business_profiles b on b.id=x.business_id where x.user_id=recipient and x.digital_number is not null and b.active=true) then raise exception 'CONTATO_INDISPONIVEL'; end if;
 if not exists(select 1 from public.business_profiles where id=a.business_id and active=true) then raise exception 'FORNECEDOR_INDISPONIVEL'; end if;
 if a.balance<1 then raise exception 'SALDO_INSUFICIENTE'; end if;
 if p_body is null or length(btrim(p_body)) not between 1 and 4000 then raise exception 'TEXTO_INVALIDO'; end if;
 insert into public.losi_chat_messages(id,thread_id,sender_id,body) values(p_request,p_thread,p_user,btrim(p_body)) returning * into m;
 update public.losi_chat_accounts set balance=balance-1 where user_id=p_user returning * into a;
 insert into public.losi_chat_ledger(user_id,delta,message_id,reason) values(p_user,-1,p_request,'message');
 return jsonb_build_object('message',to_jsonb(m),'balance',a.balance);
end $$;
revoke all on function public.losi_chat_reserve_order(uuid,uuid,text),public.losi_chat_settle_order(text,text,text,integer,text),public.losi_chat_claim(uuid),public.losi_chat_send_text(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.losi_chat_reserve_order(uuid,uuid,text),public.losi_chat_settle_order(text,text,text,integer,text),public.losi_chat_claim(uuid),public.losi_chat_send_text(uuid,uuid,uuid,text) to service_role;

create index losi_chat_messages_sender on public.losi_chat_messages(sender_id);
create index losi_chat_preferences_owner on public.losi_chat_thread_preferences(user_id);
