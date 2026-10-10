-- =====================================================================
-- Cobro de rentas por la plataforma (fase 1: transferencia con comprobante)
-- El inquilino ve sus cuotas mensuales y sube el comprobante; MAJ confirma el pago y
-- se registran la renta cobrada y la comisión de MAJ en el contrato de administración.
-- No es pasarela de pago: el dinero no pasa por el sistema.
-- =====================================================================

create table public.rental_leases (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.management_contracts(id) on delete cascade,
  unit_label text check (char_length(unit_label) <= 60),
  tenant_user_id uuid references public.profiles(id) on delete set null,
  tenant_name text not null check (char_length(tenant_name) between 2 and 160),
  tenant_email text check (char_length(tenant_email) <= 160),
  tenant_phone text check (char_length(tenant_phone) <= 40),
  rent_amount numeric(14, 2) not null check (rent_amount > 0),
  currency public.currency_code not null,
  due_day smallint not null check (due_day between 1 and 28),
  start_date date not null,
  end_date date,
  fee_percent numeric(5, 2) not null default 5 check (fee_percent >= 0 and fee_percent <= 100),
  status text not null default 'activo' check (status in ('activo', 'terminado')),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (tenant_email is not null or tenant_phone is not null)
);
create index rental_leases_contract_idx on public.rental_leases(contract_id);
create index rental_leases_tenant_idx on public.rental_leases(tenant_user_id);

create table public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.rental_leases(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  due_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency public.currency_code not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_revision', 'pagado', 'anulado')),
  paid_at timestamptz,
  fee_amount numeric(14, 2),
  owner_amount numeric(14, 2),
  reminder_sent_at timestamptz,
  overdue_notice_at timestamptz,
  void_reason text check (char_length(void_reason) <= 500),
  created_at timestamptz not null default now(),
  unique (lease_id, period),
  check (status <> 'anulado' or coalesce(void_reason, '') <> '')
);
create index rent_charges_status_idx on public.rent_charges(status, due_date);

create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.rent_charges(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  amount numeric(14, 2) not null check (amount > 0),
  currency public.currency_code not null,
  method text not null check (method in ('transferencia', 'deposito', 'efectivo', 'otro')),
  reference text check (char_length(reference) <= 120),
  receipt_path text check (char_length(receipt_path) <= 300),
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmado', 'rechazado')),
  review_reason text check (char_length(review_reason) <= 500),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reference is not null or receipt_path is not null)
);
create index rent_payments_charge_idx on public.rent_payments(charge_id);
create index rent_payments_status_idx on public.rent_payments(status, created_at);

-- Personal de MAJ, propietario del contrato o inquilino vinculado.
create or replace function public.lease_access(p_lease uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.rental_leases l join public.management_contracts c on c.id = l.contract_id
    where l.id = p_lease and (l.tenant_user_id = auth.uid() or c.owner_user_id = auth.uid()))
$$;
grant execute on function public.lease_access(uuid) to authenticated;

create trigger rental_leases_touch before update on public.rental_leases
  for each row execute function public.touch_updated_at();
create trigger audit_rental_leases after insert or update or delete on public.rental_leases
  for each row execute function public.audit_trigger();
create trigger audit_rent_charges after insert or update or delete on public.rent_charges
  for each row execute function public.audit_trigger();
create trigger audit_rent_payments after insert or update or delete on public.rent_payments
  for each row execute function public.audit_trigger();

-- Pago informado por el inquilino: siempre pendiente, de una cuota propia pendiente.
create or replace function public.rent_payments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_charge public.rent_charges;
begin
  if tg_op = 'INSERT' then
    select * into v_charge from public.rent_charges where id = new.charge_id for update;
    if not public.is_staff() then
      if not exists (select 1 from public.rental_leases l where l.id = v_charge.lease_id and l.tenant_user_id = auth.uid()) then
        raise exception 'Esta cuota no es suya' using errcode = '42501';
      end if;
      new.submitted_by := auth.uid();
    end if;
    if v_charge.status <> 'pendiente' then
      raise exception 'Esta cuota no está pendiente de pago' using errcode = 'P0001';
    end if;
    new.status := 'pendiente';
    new.reviewed_by := null; new.reviewed_at := null; new.review_reason := null;
    update public.rent_charges set status = 'en_revision' where id = new.charge_id;
    return new;
  end if;
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger rent_payments_guard before insert or update on public.rent_payments
  for each row execute function public.rent_payments_guard();

-- Crea las cuotas de un período (AAAA-MM) para los contratos de alquiler activos y avisa al inquilino.
create or replace function public.generate_rent_charges(p_period text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_start date;
  v_end date;
  v_count integer;
begin
  if not public.is_staff() and coalesce(current_setting('maj.system_job', true), '') <> 'on' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período no válido (AAAA-MM)' using errcode = 'P0001';
  end if;
  v_start := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end := (v_start + interval '1 month - 1 day')::date;
  with created as (
    insert into public.rent_charges (lease_id, period, due_date, amount, currency)
    select l.id, p_period, make_date(extract(year from v_start)::int, extract(month from v_start)::int, l.due_day),
           l.rent_amount, l.currency
      from public.rental_leases l
      join public.management_contracts c on c.id = l.contract_id
     where l.status = 'activo' and c.status = 'activo'
       and l.start_date <= v_end and (l.end_date is null or l.end_date >= v_start)
    on conflict (lease_id, period) do nothing
    returning lease_id, period, due_date, amount, currency
  ), notified as (
    select public.notify(l.tenant_user_id, 'renta', 'Renta de ' || cr.period || ' disponible',
             'Monto: ' || cr.currency || ' ' || to_char(cr.amount, 'FM999,999,999,990.00') || '. Vence el ' || to_char(cr.due_date, 'DD/MM/YYYY') || '.',
             '/panel/rentas')
      from created cr join public.rental_leases l on l.id = cr.lease_id
     where l.tenant_user_id is not null
  )
  select (select count(*) from created) + 0 * (select count(*) from notified) into v_count;
  return v_count;
end $$;
grant execute on function public.generate_rent_charges(text) to authenticated;

-- MAJ confirma o rechaza un pago informado. Al confirmar: cuota pagada, comisión calculada y movimientos registrados.
create or replace function public.review_rent_payment(p_payment uuid, p_approve boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pay public.rent_payments;
  v_charge public.rent_charges;
  v_lease public.rental_leases;
  v_fee numeric(14, 2);
  v_label text;
begin
  if not public.is_staff() then
    raise exception 'Solo el personal de MAJ revisa pagos' using errcode = '42501';
  end if;
  select * into v_pay from public.rent_payments where id = p_payment for update;
  if v_pay.id is null or v_pay.status <> 'pendiente' then
    raise exception 'El pago no está pendiente de revisión' using errcode = 'P0001';
  end if;
  select * into v_charge from public.rent_charges where id = v_pay.charge_id for update;
  select * into v_lease from public.rental_leases where id = v_charge.lease_id;
  v_label := coalesce(v_lease.unit_label || ' · ', '') || v_lease.tenant_name;

  if not p_approve then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Indique el motivo del rechazo' using errcode = 'P0001';
    end if;
    update public.rent_payments set status = 'rechazado', review_reason = left(p_reason, 500), reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_payment;
    update public.rent_charges set status = 'pendiente' where id = v_charge.id and status = 'en_revision';
    if v_lease.tenant_user_id is not null then
      perform public.notify(v_lease.tenant_user_id, 'renta', 'Pago de renta ' || v_charge.period || ' no confirmado', left(p_reason, 300), '/panel/rentas');
    end if;
    return;
  end if;

  if v_pay.currency <> v_charge.currency or v_pay.amount <> v_charge.amount then
    raise exception 'El monto o la moneda del pago no coincide con la cuota (% %). Rechácelo con el motivo.', v_charge.currency, v_charge.amount using errcode = 'P0001';
  end if;
  v_fee := round(v_charge.amount * v_lease.fee_percent / 100, 2);
  update public.rent_payments set status = 'confirmado', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = null
   where id = p_payment;
  update public.rent_charges set status = 'pagado', paid_at = now(), fee_amount = v_fee, owner_amount = v_charge.amount - v_fee
   where id = v_charge.id;

  insert into public.management_movements (contract_id, kind, direction, amount, currency, movement_date, period, description, unit_label, receipt_path)
  values (v_lease.contract_id, 'renta_cobrada', 'ingreso', v_charge.amount, v_charge.currency,
          (now() at time zone 'America/Santo_Domingo')::date, v_charge.period,
          'Renta ' || v_charge.period || ' · ' || v_label, v_lease.unit_label, v_pay.receipt_path);
  if v_fee > 0 then
    insert into public.management_movements (contract_id, kind, direction, amount, currency, movement_date, period, description, unit_label)
    values (v_lease.contract_id, 'comision', 'egreso', v_fee, v_charge.currency,
            (now() at time zone 'America/Santo_Domingo')::date, v_charge.period,
            'Comisión MAJ ' || to_char(v_lease.fee_percent, 'FM990.##') || '% · renta ' || v_charge.period || ' · ' || v_label, v_lease.unit_label);
  end if;

  if v_lease.tenant_user_id is not null then
    perform public.notify(v_lease.tenant_user_id, 'renta', 'Pago de renta ' || v_charge.period || ' confirmado', 'Gracias. Su pago fue verificado por MAJ.', '/panel/rentas');
  end if;
  perform public.notify(c.owner_user_id, 'renta', 'Renta ' || v_charge.period || ' cobrada', v_label || ': ' || v_charge.currency || ' ' || to_char(v_charge.amount, 'FM999,999,999,990.00') || ' recibida.', '/panel/administracion/' || c.id)
    from public.management_contracts c where c.id = v_lease.contract_id;
end $$;
grant execute on function public.review_rent_payment(uuid, boolean, text) to authenticated;

-- Tareas diarias de rentas: cuotas del mes, recordatorio 3 días antes y aviso de atraso (una vez cada uno).
create or replace function public.run_rent_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_created integer;
  v_reminders integer;
  v_overdue integer;
begin
  perform set_config('maj.system_job', 'on', true);
  v_created := public.generate_rent_charges(to_char(v_today, 'YYYY-MM'));
  perform set_config('maj.system_job', 'off', true);

  with due as (
    update public.rent_charges set reminder_sent_at = now()
     where status = 'pendiente' and reminder_sent_at is null and due_date between v_today and v_today + 3
    returning id, lease_id, period, due_date, amount, currency
  )
  select count(*) into v_reminders from (
    select public.notify(l.tenant_user_id, 'renta', 'Recordatorio: renta de ' || d.period,
             'Vence el ' || to_char(d.due_date, 'DD/MM/YYYY') || '. Monto: ' || d.currency || ' ' || to_char(d.amount, 'FM999,999,999,990.00') || '.', '/panel/rentas')
      from due d join public.rental_leases l on l.id = d.lease_id where l.tenant_user_id is not null) s;

  with late as (
    update public.rent_charges set overdue_notice_at = now()
     where status = 'pendiente' and overdue_notice_at is null and due_date < v_today
    returning id, lease_id, period, due_date
  )
  select count(*) into v_overdue from (
    select public.notify(l.tenant_user_id, 'renta', 'Renta de ' || t.period || ' atrasada',
             'Venció el ' || to_char(t.due_date, 'DD/MM/YYYY') || '. Si ya pagó, suba el comprobante.', '/panel/rentas')
      from late t join public.rental_leases l on l.id = t.lease_id where l.tenant_user_id is not null) s;

  return jsonb_build_object('cuotas_creadas', v_created, 'recordatorios', v_reminders, 'avisos_atraso', v_overdue);
end $$;
revoke all on function public.run_rent_jobs() from public, anon, authenticated;
grant execute on function public.run_rent_jobs() to service_role;

create or replace function public.run_scheduled_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_expired integer;
  v_notices integer;
  v_quotes integer;
  v_rent jsonb;
  v_days integer := coalesce((public.setting('licenses.expiry_notice_days') #>> '{}')::int, 15);
begin
  v_expired := public.expire_due_licenses();

  -- Aviso de vencimiento próximo (una vez por licencia)
  perform set_config('maj.system_job', 'on', true);
  with due as (
    update public.licenses set expiry_notice_sent_at = now()
     where status = 'activa' and ends_at <= now() + make_interval(days => v_days) and expiry_notice_sent_at is null
    returning id, code, holder_user_id, organization_id, ends_at
  ), recipients as (
    select d.*, coalesce(d.holder_user_id, m.user_id) as user_id from due d
    left join public.organization_members m on m.organization_id = d.organization_id and m.member_role = 'gestor'
  )
  insert into public.notifications(user_id, kind, title, body, link)
  select user_id, 'licencia', 'Su licencia ' || code || ' vence pronto',
         'Vence el ' || to_char(ends_at at time zone 'America/Santo_Domingo', 'DD/MM/YYYY') || '. Al vencer, sus publicaciones se pausarán.',
         '/panel/licencia'
  from recipients where user_id is not null;
  get diagnostics v_notices = row_count;
  perform set_config('maj.system_job', 'off', true);

  -- Cotizaciones enviadas con vigencia pasada
  perform set_config('maj.quote_client_response', 'on', true);
  update public.quotes set status = 'vencida'
   where status = 'enviada' and valid_until < (now() at time zone 'America/Santo_Domingo')::date;
  get diagnostics v_quotes = row_count;
  perform set_config('maj.quote_client_response', 'off', true);

  v_rent := public.run_rent_jobs();

  return jsonb_build_object('licencias_vencidas', v_expired, 'avisos', v_notices, 'cotizaciones_vencidas', v_quotes, 'rentas', v_rent);
end $$;

create or replace function public.private_doc_access(p_path text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_parts text[] := string_to_array(p_path, '/');
  v_id uuid := public.try_uuid(v_parts[2]);
begin
  if v_id is null then return false; end if;
  case v_parts[1]
    when 'properties' then
      return public.property_access(v_id, case when p_write then 'edit' else 'view' end);
    when 'requests' then
      if p_write then
        return exists (select 1 from public.service_requests r where r.id = v_id
                       and ((r.upload_token::text = v_parts[3] and r.created_at > now() - interval '2 hours')
                            or public.request_access(r.id)));
      end if;
      return public.request_access(v_id);
    when 'conversations' then
      return public.is_participant(v_id) or public.is_staff();
    when 'licenses' then
      return public.is_staff() or exists (select 1 from public.licenses l where l.id = v_id
             and (l.holder_user_id = auth.uid() or (l.organization_id is not null and public.org_member_can(l.organization_id, 'manage_members'))));
    when 'management' then
      return case when p_write then public.is_staff() else public.contract_access(v_id) end;
    when 'rent' then
      -- rent/{charge_id}/...: el inquilino sube el comprobante de su cuota; lo ven inquilino, propietario y MAJ
      if p_write then
        return public.is_staff() or exists (select 1 from public.rent_charges c join public.rental_leases l on l.id = c.lease_id
                                            where c.id = v_id and l.tenant_user_id = auth.uid());
      end if;
      return exists (select 1 from public.rent_charges c where c.id = v_id and public.lease_access(c.lease_id));
    when 'profiles' then
      return v_id = auth.uid() or public.is_staff();
    else
      return public.is_staff();
  end case;
end $$;

insert into public.site_settings (key, value, is_public, description) values
  ('rent.payment_instructions', 'null', true, 'Datos de transferencia para que los inquilinos paguen la renta (banco, cuenta, titular). Los indica MAJ.')
on conflict (key) do nothing;

-- RLS
alter table public.rental_leases enable row level security;
alter table public.rent_charges enable row level security;
alter table public.rent_payments enable row level security;

create policy leases_read on public.rental_leases for select to authenticated using (public.lease_access(id));
create policy leases_staff on public.rental_leases for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy charges_read on public.rent_charges for select to authenticated using (public.lease_access(lease_id));
create policy charges_staff on public.rent_charges for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy rent_payments_read on public.rent_payments for select to authenticated
  using (exists (select 1 from public.rent_charges c where c.id = charge_id and public.lease_access(c.lease_id)));
create policy rent_payments_insert on public.rent_payments for insert to authenticated
  with check (submitted_by = auth.uid());
create policy rent_payments_staff on public.rent_payments for update to authenticated using (public.is_staff()) with check (public.is_staff());

revoke all on public.rental_leases, public.rent_charges, public.rent_payments from anon;

insert into public.site_settings (key, value, is_public, description) values
  ('rent.fee_percent', '5', true, 'Comisión de MAJ por administración de cobro de renta, en % de cada renta cobrada (la paga el propietario)')
on conflict (key) do nothing;

-- El inquilino que entra con un correo confirmado queda vinculado a los alquileres registrados con ese correo.
create or replace function public.link_my_leases() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_count integer;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update public.rental_leases set tenant_user_id = auth.uid()
   where tenant_user_id is null and lower(tenant_email) = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.link_my_leases() to authenticated;

-- Opción para propietarios que publican en renta: piden a MAJ la administración del cobro.
-- Crea el contrato (borrador) y el alquiler; MAJ lo revisa y lo activa. La comisión la paga el propietario.
create or replace function public.request_rent_collection(
  p_property uuid,
  p_tenant_name text,
  p_tenant_email text,
  p_tenant_phone text,
  p_rent_amount numeric,
  p_currency public.currency_code,
  p_due_day smallint,
  p_start_date date,
  p_unit_label text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prop public.properties;
  v_fee numeric := coalesce((public.setting('rent.fee_percent') #>> '{}')::numeric, 5);
  v_contract uuid;
begin
  select * into v_prop from public.properties where id = p_property;
  if v_prop.id is null or v_prop.owner_user_id is distinct from auth.uid() then
    raise exception 'Solo el titular de la publicación puede pedir el cobro de renta' using errcode = '42501';
  end if;
  if v_prop.operation not in ('renta', 'ambas') then
    raise exception 'La publicación no es de renta' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.management_contracts where property_id = p_property and status in ('borrador', 'activo')
             and 'cobro_rentas' = any(services)) then
    raise exception 'Esta propiedad ya tiene una solicitud de cobro de renta' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_tenant_name, ''))) < 2 then
    raise exception 'Indique el nombre del inquilino' using errcode = 'P0001';
  end if;
  if nullif(trim(p_tenant_email), '') is null and nullif(trim(p_tenant_phone), '') is null then
    raise exception 'Indique el correo o el teléfono del inquilino' using errcode = 'P0001';
  end if;

  insert into public.management_contracts (owner_user_id, property_id, property_label, location_summary, units, services, fee_terms, start_date, status, created_by)
  values (auth.uid(), p_property, left(v_prop.code || ' · ' || v_prop.title, 200),
          nullif(concat_ws(', ', nullif(v_prop.sector, ''), nullif(v_prop.municipality, ''), nullif(v_prop.province, '')), ''),
          1, array['cobro_rentas'],
          'Administración de cobro de renta: comisión de ' || to_char(v_fee, 'FM990.##') || '% de cada renta cobrada, descontada al propietario.',
          p_start_date, 'borrador', auth.uid())
  returning id into v_contract;

  insert into public.rental_leases (contract_id, unit_label, tenant_name, tenant_email, tenant_phone, rent_amount, currency, due_day, start_date, fee_percent, created_by)
  values (v_contract, nullif(trim(p_unit_label), ''), trim(p_tenant_name), nullif(lower(trim(p_tenant_email)), ''), nullif(trim(p_tenant_phone), ''),
          p_rent_amount, p_currency, p_due_day, p_start_date, v_fee, auth.uid());

  perform public.notify(r.user_id, 'renta', 'Nueva solicitud de cobro de renta', v_prop.code || ' · ' || v_prop.title, '/admin/administracion/' || v_contract)
    from (select distinct user_id from public.user_roles where role in ('staff', 'admin')) r;
  return v_contract;
end $$;
grant execute on function public.request_rent_collection(uuid, text, text, text, numeric, public.currency_code, smallint, date, text) to authenticated;
