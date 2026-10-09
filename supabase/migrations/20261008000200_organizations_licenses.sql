-- =====================================================================
-- Migración 0002: organizaciones (agencias), planes, licencias de publicación
-- "Licencia" = permiso contractual interno para publicar en MAJ.
-- No es una licencia profesional ni gubernamental.
-- =====================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  legal_name text check (char_length(legal_name) <= 200),
  rnc text check (char_length(rnc) <= 20),           -- privado: solo miembros gestores y personal
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 160),
  status text not null default 'pendiente' check (status in ('pendiente', 'activa', 'suspendida')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'agente' check (member_role in ('gestor', 'agente')),
  can_publish boolean not null default true,
  can_view_all_listings boolean not null default false,
  can_manage_members boolean not null default false,
  can_view_leads boolean not null default false,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create or replace function public.org_member_can(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org and m.user_id = auth.uid() and o.status <> 'suspendida'
      and case p_perm
        when 'member' then true
        when 'publish' then m.can_publish
        when 'view_all' then m.can_view_all_listings or m.member_role = 'gestor'
        when 'manage_members' then m.can_manage_members or m.member_role = 'gestor'
        when 'view_leads' then m.can_view_leads or m.member_role = 'gestor'
        else false end
  )
$$;
grant execute on function public.org_member_can(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Planes (precios, cuotas y vigencias definidos por el administrador)
-- price = NULL significa "precio pendiente de decisión de MAJ".
-- ---------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,40}$'),
  name text not null,
  description text,
  holder_type text not null check (holder_type in ('individual', 'organizacion')),
  price numeric(14, 2) check (price >= 0),
  currency public.currency_code not null default 'DOP',
  duration_days integer not null check (duration_days between 1 and 3660),
  active_listing_quota integer not null check (active_listing_quota >= 0),
  max_members integer not null default 1 check (max_members >= 1),
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.license_code_seq;

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('LIC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.license_code_seq')::text, 5, '0')),
  holder_user_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id),
  plan_id uuid not null references public.plans(id),
  status text not null default 'pendiente' check (status in ('pendiente', 'activa', 'vencida', 'suspendida', 'cancelada')),
  starts_at timestamptz,
  ends_at timestamptz,
  active_listing_quota integer not null check (active_listing_quota >= 0),  -- copia del plan al activar
  max_members integer not null default 1,
  permissions jsonb not null default '{}'::jsonb,
  status_reason text,
  expiry_notice_sent_at timestamptz,
  activated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((holder_user_id is null) <> (organization_id is null)),
  check (status <> 'activa' or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);
create index licenses_holder_idx on public.licenses(holder_user_id) where holder_user_id is not null;
create index licenses_org_idx on public.licenses(organization_id) where organization_id is not null;
create index licenses_ends_idx on public.licenses(ends_at) where status = 'activa';

-- Una licencia está vigente si está activa y dentro de fechas.
create or replace function public.license_valid(p_license uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.licenses
    where id = p_license and status = 'activa' and starts_at <= now() and ends_at > now()
  )
$$;
grant execute on function public.license_valid(uuid) to anon, authenticated;

-- Solicitudes para publicar (registro → verificación → perfil y condiciones → documentos → revisión → activación)
create table public.publisher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  applicant_type text not null check (applicant_type in ('propietario', 'vendedor', 'agencia')),
  organization_id uuid references public.organizations(id),
  requested_plan_id uuid references public.plans(id),
  terms_version text not null,
  terms_accepted_at timestamptz not null default now(),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'pendiente' check (status in ('pendiente', 'documentos_requeridos', 'aprobada', 'rechazada')),
  review_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index publisher_applications_user_idx on public.publisher_applications(user_id);

-- Pagos de licencia: manuales con comprobante, revisados por personal.
create table public.license_payments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  amount numeric(14, 2) not null check (amount > 0),
  currency public.currency_code not null,
  method text not null default 'transferencia' check (method in ('transferencia', 'deposito', 'efectivo', 'otro')),
  reference text check (char_length(reference) <= 120),
  receipt_path text,          -- en bucket privado "private-docs"
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  review_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Reglas de negocio en servidor
-- ---------------------------------------------------------------------
create or replace function public.licenses_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() and coalesce(current_setting('maj.system_job', true), '') <> 'on' then
    raise exception 'Solo el personal de MAJ puede crear o modificar licencias' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    -- copiar cuotas del plan si no se indicaron
    if new.active_listing_quota is null then
      select active_listing_quota into new.active_listing_quota from public.plans where id = new.plan_id;
    end if;
  end if;
  if new.status = 'activa' and (tg_op = 'INSERT' or old.status <> 'activa') then
    new.activated_by := auth.uid();
  end if;
  return new;
end $$;
create trigger licenses_guard before insert or update on public.licenses
  for each row execute function public.licenses_guard();
create trigger licenses_touch before update on public.licenses
  for each row execute function public.touch_updated_at();
create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger publisher_applications_touch before update on public.publisher_applications
  for each row execute function public.touch_updated_at();

create trigger audit_licenses after insert or update or delete on public.licenses
  for each row execute function public.audit_trigger();
create trigger audit_plans after insert or update or delete on public.plans
  for each row execute function public.audit_trigger();
create trigger audit_license_payments after insert or update on public.license_payments
  for each row execute function public.audit_trigger();
create trigger audit_publisher_applications after insert or update on public.publisher_applications
  for each row execute function public.audit_trigger();
create trigger audit_org_members after insert or update or delete on public.organization_members
  for each row execute function public.audit_trigger();

-- Solicitante no puede auto-aprobarse
create or replace function public.publisher_applications_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then
    if new.status is distinct from old.status and tg_op = 'UPDATE' then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.user_id <> auth.uid() or new.status <> 'pendiente' or new.reviewed_by is not null then
      raise exception 'Solicitud inválida' using errcode = '42501';
    end if;
  else
    if new.status is distinct from old.status or new.review_reason is distinct from old.review_reason
       or new.reviewed_by is distinct from old.reviewed_by or new.user_id <> old.user_id then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger publisher_applications_guard before insert or update on public.publisher_applications
  for each row execute function public.publisher_applications_guard();

create or replace function public.license_payments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if new.submitted_by <> auth.uid() or new.status <> 'pendiente' then
    raise exception 'Pago inválido' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.licenses l
    where l.id = new.license_id
      and (l.holder_user_id = auth.uid() or (l.organization_id is not null and public.org_member_can(l.organization_id, 'manage_members')))
  ) then
    raise exception 'Licencia no encontrada' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger license_payments_guard before insert or update on public.license_payments
  for each row execute function public.license_payments_guard();

-- Límite de miembros según licencia de la organización; solo gestores o personal añaden miembros.
create or replace function public.org_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max integer;
  v_count integer;
begin
  if tg_op = 'DELETE' then
    if not (public.is_staff() or public.org_member_can(old.organization_id, 'manage_members')) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    return old;
  end if;
  if not (public.is_staff() or public.org_member_can(new.organization_id, 'manage_members')) then
    -- excepción: el creador de la organización se registra como gestor inicial
    if not (tg_op = 'INSERT' and new.user_id = auth.uid() and new.member_role = 'gestor'
            and exists (select 1 from public.organizations o where o.id = new.organization_id and o.created_by = auth.uid())
            and not exists (select 1 from public.organization_members m where m.organization_id = new.organization_id)) then
      raise exception 'No autorizado para gestionar miembros' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' then
    perform 1 from public.organizations where id = new.organization_id for update;
    select coalesce(max(l.max_members), 1) into v_max from public.licenses l
      where l.organization_id = new.organization_id and l.status = 'activa';
    select count(*) into v_count from public.organization_members where organization_id = new.organization_id;
    if v_count >= v_max then
      raise exception 'La licencia de la organización permite % miembro(s)', v_max using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger org_members_guard before insert or update or delete on public.organization_members
  for each row execute function public.org_members_guard();

create or replace function public.organizations_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if tg_op = 'INSERT' then
    if new.created_by <> auth.uid() or new.status <> 'pendiente' then
      raise exception 'Organización inválida' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status or new.created_by is distinct from old.created_by then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger organizations_guard before insert or update on public.organizations
  for each row execute function public.organizations_guard();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.plans enable row level security;
alter table public.licenses enable row level security;
alter table public.publisher_applications enable row level security;
alter table public.license_payments enable row level security;

create policy organizations_read on public.organizations for select
  using (public.is_staff() or public.org_member_can(id, 'member') or created_by = auth.uid());
create policy organizations_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid() or public.is_staff());
create policy organizations_update on public.organizations for update
  using (public.is_staff() or public.org_member_can(id, 'manage_members'))
  with check (public.is_staff() or public.org_member_can(id, 'manage_members'));

create policy org_members_read on public.organization_members for select
  using (public.is_staff() or user_id = auth.uid() or public.org_member_can(organization_id, 'manage_members'));
create policy org_members_write on public.organization_members for all to authenticated
  using (public.is_staff() or public.org_member_can(organization_id, 'manage_members'))
  with check (true); -- el disparador valida permisos y límites

create policy plans_read on public.plans for select using (is_active or public.is_staff());
create policy plans_admin on public.plans for all using (public.is_admin()) with check (public.is_admin());

create policy licenses_read on public.licenses for select
  using (public.is_staff() or holder_user_id = auth.uid()
         or (organization_id is not null and public.org_member_can(organization_id, 'member')));
create policy licenses_staff_write on public.licenses for all
  using (public.is_staff()) with check (public.is_staff());

create policy publisher_applications_read on public.publisher_applications for select
  using (user_id = auth.uid() or public.is_staff());
create policy publisher_applications_insert on public.publisher_applications for insert to authenticated
  with check (user_id = auth.uid());
create policy publisher_applications_update on public.publisher_applications for update
  using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());

create policy license_payments_read on public.license_payments for select
  using (public.is_staff() or submitted_by = auth.uid());
create policy license_payments_insert on public.license_payments for insert to authenticated
  with check (submitted_by = auth.uid());
create policy license_payments_staff on public.license_payments for update
  using (public.is_staff()) with check (public.is_staff());

revoke all on public.organizations, public.organization_members, public.licenses,
  public.publisher_applications, public.license_payments from anon;
