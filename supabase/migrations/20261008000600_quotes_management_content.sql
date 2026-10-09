-- =====================================================================
-- Migración 0006: cotizaciones, administración de propiedades, portafolio y contenidos
-- =====================================================================

create sequence public.quote_number_seq;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('COT-' || to_char(now() at time zone 'America/Santo_Domingo', 'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text, 5, '0')),
  request_id uuid references public.service_requests(id) on delete set null,
  client_user_id uuid references public.profiles(id),
  client_name text not null check (char_length(client_name) between 2 and 160),
  service text not null check (service in ('remodelacion', 'administracion', 'legal', 'venta', 'renta', 'otro')),
  title text not null check (char_length(title) between 3 and 200),
  currency public.currency_code not null,
  status text not null default 'borrador' check (status in ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'anulada')),
  valid_until date,
  tax_label text,                  -- p. ej. "ITBIS"; se configura, no se asume
  tax_rate numeric(6, 4) not null default 0 check (tax_rate >= 0 and tax_rate < 1),
  scope text check (char_length(scope) <= 4000),
  exclusions text check (char_length(exclusions) <= 4000),
  conditions text check (char_length(conditions) <= 4000),
  stages jsonb not null default '[]'::jsonb check (jsonb_typeof(stages) = 'array'),
  prepared_by uuid references public.profiles(id),
  supersedes_id uuid references public.quotes(id),
  sent_at timestamptz,
  responded_at timestamptz,
  client_comment text check (char_length(client_comment) <= 2000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'borrador' or valid_until is not null)
);
create index quotes_client_idx on public.quotes(client_user_id);
create index quotes_request_idx on public.quotes(request_id);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sort_order integer not null default 0,
  description text not null check (char_length(description) between 1 and 500),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null default 'unidad' check (char_length(unit) <= 30),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  taxable boolean not null default true
);
create index quote_items_quote_idx on public.quote_items(quote_id, sort_order);

create table public.quote_events (
  id bigint generated always as identity primary key,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  action text not null,
  comment text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create view public.quote_totals with (security_invoker = true) as
select q.id as quote_id, q.currency,
  coalesce(sum(round(i.quantity * i.unit_price, 2)), 0) as subtotal,
  round(coalesce(sum(case when i.taxable then round(i.quantity * i.unit_price, 2) else 0 end), 0) * q.tax_rate, 2) as tax,
  coalesce(sum(round(i.quantity * i.unit_price, 2)), 0)
    + round(coalesce(sum(case when i.taxable then round(i.quantity * i.unit_price, 2) else 0 end), 0) * q.tax_rate, 2) as total
from public.quotes q left join public.quote_items i on i.quote_id = q.id
group by q.id, q.currency, q.tax_rate;
grant select on public.quote_totals to authenticated;

create or replace function public.quotes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Respuesta del cliente (solo desde respond_quote): únicamente estado, fecha y comentario
  if tg_op = 'UPDATE' and coalesce(current_setting('maj.quote_client_response', true), '') = 'on' then
    if old.status <> 'enviada' or new.status not in ('aceptada', 'rechazada', 'vencida')
       or (to_jsonb(new) - array['status', 'updated_at', 'responded_at', 'client_comment'])
          <> (to_jsonb(old) - array['status', 'updated_at', 'responded_at', 'client_comment']) then
      raise exception 'Respuesta no válida' using errcode = '42501';
    end if;
    insert into public.quote_events(quote_id, action, comment, actor_id) values (new.id, new.status, new.client_comment, auth.uid());
    return new;
  end if;
  if not public.is_staff() then
    raise exception 'Solo personal autorizado prepara cotizaciones' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if old.status <> 'borrador' then
      -- una cotización enviada no cambia su contenido: se crea una nueva versión
      if (to_jsonb(new) - array['status', 'updated_at', 'responded_at', 'client_comment'])
         <> (to_jsonb(old) - array['status', 'updated_at', 'responded_at', 'client_comment']) then
        raise exception 'La cotización ya fue enviada; cree una nueva versión' using errcode = 'P0001';
      end if;
      if new.status <> old.status and not (old.status = 'enviada' and new.status in ('anulada', 'vencida'))
         and not (old.status in ('aceptada','rechazada') and new.status = 'anulada') then
        raise exception 'Cambio de estado no permitido' using errcode = 'P0001';
      end if;
    elsif new.status = 'enviada' then
      if not exists (select 1 from public.quote_items where quote_id = new.id) then
        raise exception 'La cotización no tiene partidas' using errcode = 'P0001';
      end if;
      if new.valid_until is null or new.valid_until < (now() at time zone 'America/Santo_Domingo')::date then
        raise exception 'Indique una vigencia futura' using errcode = 'P0001';
      end if;
      new.sent_at := now();
    elsif new.status not in ('borrador', 'anulada') then
      raise exception 'Cambio de estado no permitido' using errcode = 'P0001';
    end if;
    if new.status <> old.status then
      insert into public.quote_events(quote_id, action, actor_id) values (new.id, new.status, auth.uid());
      if new.status = 'enviada' and new.client_user_id is not null then
        perform public.notify(new.client_user_id, 'cotizacion', 'Nueva cotización ' || new.number, new.title, '/panel/cotizaciones/' || new.id);
      end if;
    end if;
  else
    new.prepared_by := auth.uid();
    if new.status <> 'borrador' then raise exception 'Se crea como borrador' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
create trigger quotes_guard before insert or update on public.quotes
  for each row execute function public.quotes_guard();
create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();
create trigger audit_quotes after insert or update or delete on public.quotes
  for each row execute function public.audit_trigger();

create or replace function public.quote_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if exists (select 1 from public.quotes where id = coalesce(new.quote_id, old.quote_id) and status <> 'borrador') then
    raise exception 'La cotización ya fue enviada; cree una nueva versión' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger quote_items_guard before insert or update or delete on public.quote_items
  for each row execute function public.quote_items_guard();

-- El cliente acepta o rechaza; queda historial.
create or replace function public.respond_quote(p_quote uuid, p_accept boolean, p_comment text)
returns text language plpgsql security definer set search_path = public as $$
declare
  q public.quotes;
  v_status text;
begin
  select * into q from public.quotes where id = p_quote for update;
  if q.id is null or q.client_user_id is distinct from auth.uid() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if q.status <> 'enviada' then
    raise exception 'Esta cotización no está pendiente de respuesta' using errcode = 'P0001';
  end if;
  v_status := case
    when q.valid_until < (now() at time zone 'America/Santo_Domingo')::date then 'vencida'
    when p_accept then 'aceptada' else 'rechazada' end;
  perform set_config('maj.quote_client_response', 'on', true);
  update public.quotes set status = v_status, responded_at = now(),
    client_comment = case when v_status = 'vencida' then null else left(p_comment, 2000) end
  where id = p_quote;
  perform set_config('maj.quote_client_response', 'off', true);
  if q.prepared_by is not null then
    perform public.notify(q.prepared_by, 'cotizacion', 'Cotización ' || q.number || ' ' || v_status,
      p_comment, '/admin/cotizaciones/' || q.id);
  end if;
  return v_status;  -- 'vencida' si la vigencia ya pasó: el cliente debe solicitar actualización
end $$;
grant execute on function public.respond_quote(uuid, boolean, text) to authenticated;



-- Duplicar como nueva versión (personal)
create or replace function public.duplicate_quote(p_quote uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_new uuid;
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.quotes(request_id, client_user_id, client_name, service, title, currency, tax_label, tax_rate,
    scope, exclusions, conditions, stages, supersedes_id)
  select request_id, client_user_id, client_name, service, title, currency, tax_label, tax_rate,
    scope, exclusions, conditions, stages, id from public.quotes where id = p_quote
  returning id into v_new;
  insert into public.quote_items(quote_id, sort_order, description, quantity, unit, unit_price, taxable)
  select v_new, sort_order, description, quantity, unit, unit_price, taxable from public.quote_items where quote_id = p_quote;
  insert into public.quote_events(quote_id, action, comment, actor_id) values (v_new, 'nueva_version', p_quote::text, auth.uid());
  return v_new;
end $$;
grant execute on function public.duplicate_quote(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Administración de propiedades (registro operativo; no es banca ni contabilidad fiscal certificada)
-- ---------------------------------------------------------------------
create table public.management_contracts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  property_id uuid references public.properties(id) on delete set null,
  property_label text not null check (char_length(property_label) between 2 and 200),
  location_summary text check (char_length(location_summary) <= 300),
  units integer not null default 1 check (units between 1 and 10000),
  services text[] not null default '{}',
  fee_terms text check (char_length(fee_terms) <= 2000),
  start_date date not null,
  end_date date,
  status text not null default 'borrador' check (status in ('borrador', 'activo', 'suspendido', 'terminado')),
  request_id uuid references public.service_requests(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index management_contracts_owner_idx on public.management_contracts(owner_user_id);

create table public.management_movements (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.management_contracts(id) on delete cascade,
  kind text not null check (kind in ('renta_cobrada', 'gasto', 'mantenimiento', 'comision', 'pago_al_propietario', 'ajuste')),
  direction text not null check (direction in ('ingreso', 'egreso')),
  amount numeric(14, 2) not null check (amount > 0),
  currency public.currency_code not null,
  movement_date date not null,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  description text not null check (char_length(description) between 2 and 500),
  unit_label text check (char_length(unit_label) <= 60),
  receipt_path text,          -- comprobante en bucket privado
  status text not null default 'registrado' check (status in ('registrado', 'conciliado', 'anulado')),
  void_reason text,
  reconciled_by uuid references public.profiles(id),
  reconciled_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index management_movements_contract_idx on public.management_movements(contract_id, period);

create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.management_contracts(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text check (char_length(description) <= 3000),
  priority text not null default 'normal' check (priority in ('baja', 'normal', 'alta', 'urgente')),
  status text not null default 'abierto' check (status in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  estimated_cost numeric(14, 2),
  currency public.currency_code,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.management_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.management_contracts(id) on delete cascade,
  kind text not null check (kind in ('contrato', 'estado_cuenta', 'informe', 'comprobante', 'otro')),
  title text not null,
  period text check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  storage_path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.contract_access(p_contract uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (select 1 from public.management_contracts where id = p_contract and owner_user_id = auth.uid())
$$;
grant execute on function public.contract_access(uuid) to authenticated;

create or replace function public.movements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.status := 'registrado';
    if new.kind in ('renta_cobrada') and new.direction <> 'ingreso' then raise exception 'Una renta cobrada es ingreso'; end if;
    if new.kind in ('gasto', 'mantenimiento', 'comision', 'pago_al_propietario') and new.direction <> 'egreso' then
      raise exception 'Este movimiento es un egreso';
    end if;
    return new;
  end if;
  -- Los movimientos no se editan: se concilian o se anulan con motivo
  if (to_jsonb(new) - array['status', 'void_reason', 'reconciled_by', 'reconciled_at', 'receipt_path'])
     <> (to_jsonb(old) - array['status', 'void_reason', 'reconciled_by', 'reconciled_at', 'receipt_path']) then
    raise exception 'Los movimientos no se modifican; anule y registre de nuevo' using errcode = 'P0001';
  end if;
  if new.status = 'anulado' and coalesce(new.void_reason, '') = '' then
    raise exception 'Indique el motivo de anulación' using errcode = 'P0001';
  end if;
  if new.status = 'conciliado' and old.status <> 'conciliado' then
    new.reconciled_by := auth.uid(); new.reconciled_at := now();
  end if;
  return new;
end $$;
create trigger movements_guard before insert or update on public.management_movements
  for each row execute function public.movements_guard();
create trigger audit_movements after insert or update or delete on public.management_movements
  for each row execute function public.audit_trigger();
create trigger audit_contracts after insert or update or delete on public.management_contracts
  for each row execute function public.audit_trigger();
create trigger contracts_touch before update on public.management_contracts
  for each row execute function public.touch_updated_at();
create trigger tickets_touch before update on public.maintenance_tickets
  for each row execute function public.touch_updated_at();

-- Estado de cuenta por período y moneda (nunca se suman monedas distintas)
create view public.management_statements with (security_invoker = true) as
select contract_id, period, currency,
  sum(case when direction = 'ingreso' then amount else 0 end) as ingresos,
  sum(case when direction = 'egreso' then amount else 0 end) as egresos,
  sum(case when direction = 'ingreso' then amount else -amount end) as balance,
  count(*) filter (where status = 'registrado') as pendientes_conciliar
from public.management_movements
where status <> 'anulado'
group by contract_id, period, currency;
grant select on public.management_statements to authenticated;

-- ---------------------------------------------------------------------
-- Portafolio de remodelaciones (solo con autorización de uso de imágenes)
-- ---------------------------------------------------------------------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text check (char_length(description) <= 2000),
  location_summary text check (char_length(location_summary) <= 160),
  before_path text,
  after_path text,
  image_use_authorized boolean not null default false,
  authorization_reference text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (not published or (image_use_authorized and after_path is not null))
);

-- Textos editables sin tocar código
create table public.content_blocks (
  key text not null check (key ~ '^[a-z0-9_.-]{2,80}$'),
  locale text not null default 'es' check (locale in ('es', 'en')),
  title text,
  body text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);
create trigger audit_content_blocks after insert or update or delete on public.content_blocks
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_events enable row level security;
alter table public.management_contracts enable row level security;
alter table public.management_movements enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.management_documents enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.content_blocks enable row level security;

create policy quotes_read on public.quotes for select to authenticated
  using (public.is_staff() or (client_user_id = auth.uid() and status <> 'borrador'));
create policy quotes_staff on public.quotes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy quote_items_read on public.quote_items for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id
                 and (public.is_staff() or (q.client_user_id = auth.uid() and q.status <> 'borrador'))));
create policy quote_items_staff on public.quote_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy quote_events_read on public.quote_events for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id
                 and (public.is_staff() or (q.client_user_id = auth.uid() and q.status <> 'borrador'))));

create policy contracts_read on public.management_contracts for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff());
create policy contracts_staff on public.management_contracts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy movements_read on public.management_movements for select to authenticated
  using (public.contract_access(contract_id));
create policy movements_staff on public.management_movements for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy tickets_read on public.maintenance_tickets for select to authenticated
  using (public.contract_access(contract_id));
create policy tickets_owner_insert on public.maintenance_tickets for insert to authenticated
  with check (public.contract_access(contract_id) and created_by = auth.uid() and status = 'abierto');
create policy tickets_staff on public.maintenance_tickets for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy mdocs_read on public.management_documents for select to authenticated
  using (public.contract_access(contract_id));
create policy mdocs_staff on public.management_documents for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy portfolio_public on public.portfolio_items for select using (published or public.is_staff());
create policy portfolio_staff on public.portfolio_items for all using (public.is_staff()) with check (public.is_staff());
create policy content_public on public.content_blocks for select using (true);
create policy content_staff on public.content_blocks for all using (public.is_staff()) with check (public.is_staff());

revoke all on public.quotes, public.quote_items, public.quote_events, public.management_contracts,
  public.management_movements, public.maintenance_tickets, public.management_documents from anon;
revoke insert, update, delete on public.portfolio_items, public.content_blocks from anon;
revoke insert, update, delete on public.quote_events from authenticated;
