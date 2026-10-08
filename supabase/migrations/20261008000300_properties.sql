-- =====================================================================
-- Migración 0003: inmuebles, ubicación pública/privada, precios, multimedia,
-- documentos privados, revisiones, cambios materiales, estadísticas y catálogo público.
-- =====================================================================

create type public.tri_state as enum ('si', 'no', 'desconocido', 'no_aplica');

-- Asesores autorizados (destino de WhatsApp por inmueble si la regla lo indica)
create table public.advisors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 80),
  title text check (char_length(title) <= 80),
  whatsapp text check (whatsapp ~ '^[0-9]{10,15}$'),   -- solo dígitos con código de país, p. ej. 18097706277
  photo_path text,
  bio text check (char_length(bio) <= 600),
  show_on_team_page boolean not null default false,     -- solo con datos y foto reales autorizados
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create sequence public.property_code_seq start 1001;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('MAJ-' || lpad(nextval('public.property_code_seq')::text, 6, '0')),
  slug text not null default '',
  title text not null check (char_length(title) between 5 and 140),
  operation text not null check (operation in ('venta', 'renta', 'ambas')),
  property_type text not null check (property_type in
    ('apartamento', 'casa', 'villa', 'solar', 'local', 'oficina', 'nave', 'finca', 'edificio', 'proyecto')),
  description text not null default '' check (char_length(description) <= 8000),
  condition text check (condition in ('nuevo', 'usado', 'remodelado', 'en_construccion')),
  status text not null default 'borrador' check (status in
    ('borrador', 'en_revision', 'publicado', 'pausado', 'reservado', 'vendido', 'rentado', 'rechazado', 'archivado')),
  available_from date,

  -- Titularidad de la publicación
  owner_user_id uuid not null references public.profiles(id),
  organization_id uuid references public.organizations(id),
  license_id uuid references public.licenses(id),
  advisor_id uuid references public.advisors(id) on delete set null,
  is_maj_listing boolean not null default false,  -- publicado directamente por MAJ (no consume licencia)
  is_demo boolean not null default false,         -- datos de demostración: nunca en producción

  -- Ubicación pública (aproximada)
  country text not null default 'República Dominicana',
  province text not null default '' check (char_length(province) <= 80),
  municipality text not null default '' check (char_length(municipality) <= 80),
  sector text not null default '' check (char_length(sector) <= 120),
  approx_lat numeric(7, 3) check (approx_lat between -90 and 90),
  approx_lng numeric(7, 3) check (approx_lng between -180 and 180),
  exact_address_public boolean not null default false,  -- solo con autorización del propietario
  public_address text check (char_length(public_address) <= 300),

  -- Dimensiones y distribución. NULL = desconocido; si el campo está en na_fields = no aplica; 0 = cero.
  built_area_m2 numeric(12, 2) check (built_area_m2 >= 0),
  land_area_m2 numeric(14, 2) check (land_area_m2 >= 0),
  bedrooms smallint check (bedrooms between 0 and 200),
  bathrooms smallint check (bathrooms between 0 and 200),
  half_bathrooms smallint check (half_bathrooms between 0 and 200),
  parking_spaces smallint check (parking_spaces between 0 and 2000),
  floor_number smallint check (floor_number between -10 and 200),
  levels smallint check (levels between 0 and 200),
  year_built smallint check (year_built between 1800 and 2100),
  service_room public.tri_state not null default 'desconocido',
  service_bathroom public.tri_state not null default 'desconocido',
  laundry_area public.tri_state not null default 'desconocido',
  balcony public.tri_state not null default 'desconocido',
  terrace public.tri_state not null default 'desconocido',
  patio public.tri_state not null default 'desconocido',
  roof_area public.tri_state not null default 'desconocido',
  roof_use_detail text check (char_length(roof_use_detail) <= 500),
  na_fields text[] not null default '{}',

  -- Características: {"codigo": {"v": "si|no|desconocido|no_aplica", "d": "detalle"}}
  features jsonb not null default '{}'::jsonb,
  condo_rules text check (char_length(condo_rules) <= 3000),
  restrictions text check (char_length(restrictions) <= 2000),

  -- Revisión
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 2000),
  published_at timestamptz,
  first_published_at timestamptz,
  pause_reason text,
  documents_reviewed_at date,            -- solo con revisión documental real por MAJ
  documents_review_scope text check (char_length(documents_review_scope) <= 300),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public_address is null or exact_address_public),
  check (jsonb_typeof(features) = 'object')
);
create index properties_status_idx on public.properties(status);
create index properties_owner_idx on public.properties(owner_user_id);
create index properties_org_idx on public.properties(organization_id) where organization_id is not null;
create index properties_license_idx on public.properties(license_id) where license_id is not null;
create index properties_location_idx on public.properties(province, municipality, sector);
create index properties_type_idx on public.properties(property_type);
create index properties_features_idx on public.properties using gin (features jsonb_path_ops);
create index properties_title_trgm_idx on public.properties using gin (title extensions.gin_trgm_ops);

create table public.property_private (
  property_id uuid primary key references public.properties(id) on delete cascade,
  street text check (char_length(street) <= 160),
  street_number text check (char_length(street_number) <= 30),
  building text check (char_length(building) <= 120),
  unit text check (char_length(unit) <= 40),
  exact_lat numeric(9, 6) check (exact_lat between -90 and 90),
  exact_lng numeric(9, 6) check (exact_lng between -180 and 180),
  owner_name text check (char_length(owner_name) <= 160),
  owner_phone text check (char_length(owner_phone) <= 40),
  owner_email text check (char_length(owner_email) <= 160),
  owner_id_type text check (owner_id_type in ('cedula', 'pasaporte', 'rnc', 'otro')),
  owner_id_number text check (char_length(owner_id_number) <= 40),
  publisher_relationship text check (publisher_relationship in ('propietario', 'representante', 'agente', 'otro')),
  publication_authorized boolean not null default false,
  authorization_date date,
  authorization_expires date,
  commission_terms text check (char_length(commission_terms) <= 1000),
  exclusivity boolean,
  exclusivity_expires date,
  -- Información declarada por el vendedor (NO verificada por MAJ)
  title_type text check (char_length(title_type) <= 120),
  title_registry_number text check (char_length(title_registry_number) <= 120),   -- matrícula
  cadastral_designation text check (char_length(cadastral_designation) <= 160),
  survey_status text check (survey_status in ('deslindado', 'no_deslindado', 'en_proceso', 'desconocido', 'no_aplica')),
  legal_status_certificate_date date,
  declared_liens text check (char_length(declared_liens) <= 2000),
  tax_notes text check (char_length(tax_notes) <= 2000),
  contract_notes text check (char_length(contract_notes) <= 2000),
  staff_notes text check (char_length(staff_notes) <= 4000),   -- solo personal
  updated_at timestamptz not null default now()
);

create table public.property_prices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  operation text not null check (operation in ('venta', 'renta')),
  amount numeric(16, 2) check (amount >= 0),       -- NULL = "precio a consultar"
  currency public.currency_code not null,
  negotiable boolean not null default false,
  maintenance_amount numeric(14, 2) check (maintenance_amount >= 0),
  maintenance_currency public.currency_code,
  maintenance_included public.tri_state not null default 'desconocido',
  additional_costs text check (char_length(additional_costs) <= 1000),
  rent_period text check (rent_period in ('mensual', 'diario', 'semanal', 'anual')),
  deposit_amount numeric(14, 2) check (deposit_amount >= 0),
  deposit_months numeric(4, 1) check (deposit_months >= 0),
  advance_months numeric(4, 1) check (advance_months >= 0),
  min_term_months smallint check (min_term_months >= 0),
  delivery_conditions text check (char_length(delivery_conditions) <= 1000),
  unique (property_id, operation),
  check (operation = 'renta' or rent_period is null),
  check (maintenance_amount is null or maintenance_currency is not null)
);
create index property_prices_amount_idx on public.property_prices(operation, currency, amount);

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null check (kind in ('foto', 'video', 'recorrido', 'plano')),
  storage_path text,          -- bucket "property-media"
  external_url text check (external_url ~ '^https://'),  -- video o recorrido virtual
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  width integer,
  height integer,
  approved boolean not null default false,   -- multimedia nueva en publicación activa espera revisión
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((storage_path is null) <> (external_url is null)),
  check (kind in ('video', 'recorrido') or storage_path is not null)
);
create index property_media_property_idx on public.property_media(property_id, sort_order);
create unique index property_media_one_cover on public.property_media(property_id) where is_cover;

create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'autorizacion_publicacion', 'identificacion_propietario', 'titulo', 'certificacion_estado_juridico',
    'plano_catastral', 'deslinde', 'impuestos', 'contrato', 'poder_representacion', 'otro')),
  storage_path text not null,     -- bucket privado "private-docs"
  file_name text not null check (char_length(file_name) <= 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15728640),
  uploaded_by uuid not null references public.profiles(id),
  review_status text not null default 'pendiente' check (review_status in ('pendiente', 'revisado', 'observado')),
  review_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index property_documents_property_idx on public.property_documents(property_id);

-- Historial de revisión (envíos, aprobaciones, rechazos, pausas)
create table public.property_reviews (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  action text not null,
  from_status text,
  to_status text,
  reason text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index property_reviews_property_idx on public.property_reviews(property_id, created_at desc);

-- Cambios materiales sobre publicaciones activas: quedan pendientes; la versión publicada se mantiene.
create table public.property_change_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),  -- {"property":{...},"prices":[...],"private":{...}}
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado', 'retirado')),
  review_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index property_change_requests_one_pending on public.property_change_requests(property_id) where status = 'pendiente';

create table public.property_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reporter_id uuid references public.profiles(id),
  reason text not null check (reason in ('informacion_falsa', 'no_disponible', 'precio_incorrecto', 'fraude', 'contenido_inapropiado', 'duplicado', 'otro')),
  details text check (char_length(details) <= 2000),
  contact_email text check (char_length(contact_email) <= 160),
  status text not null default 'abierto' check (status in ('abierto', 'en_revision', 'resuelto', 'descartado')),
  resolution text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Estadísticas: vistas, clics de WhatsApp y compartidos NO son contactos confirmados ni ventas.
create table public.property_events (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null check (kind in ('vista', 'clic_whatsapp', 'compartir', 'favorito')),
  session_hash text check (char_length(session_hash) <= 64),
  created_at timestamptz not null default now()
);
create index property_events_property_idx on public.property_events(property_id, kind, created_at);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  query jsonb not null,
  notify boolean not null default false,
  created_at timestamptz not null default now()
);

-- Tasas de cambio introducidas por el personal, con fuente y fecha. No se inventan tasas.
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base public.currency_code not null,
  quote public.currency_code not null,
  rate numeric(14, 6) not null check (rate > 0),
  source text not null check (char_length(source) between 2 and 200),
  rate_date date not null,
  entered_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (base <> quote)
);

-- =====================================================================
-- Funciones de acceso
-- =====================================================================
create or replace function public.property_access(p_property uuid, p_level text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.properties p
    where p.id = p_property and (
      p.owner_user_id = auth.uid()
      or (p.organization_id is not null and (
            (p_level = 'view' and public.org_member_can(p.organization_id, 'view_all'))
         or (p_level = 'edit' and public.org_member_can(p.organization_id, 'manage_members'))))
    )
  )
$$;
grant execute on function public.property_access(uuid, text) to authenticated;

-- ¿Se muestran datos de demostración? (falso por defecto; nunca en producción)
create or replace function public.demo_visible() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((public.setting('site.show_demo_data') #>> '{}')::boolean, false)
$$;
grant execute on function public.demo_visible() to anon, authenticated;

-- ¿La publicación es visible al público?
create or replace function public.property_is_public(p_property uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property
      and p.status in ('publicado', 'reservado')
      and (p.is_maj_listing or public.license_valid(p.license_id))
      and (not p.is_demo or public.demo_visible())
  )
$$;
grant execute on function public.property_is_public(uuid) to anon, authenticated;

create or replace function public.slugify(p text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

-- Licencia aplicable a una publicación (organización o titular individual)
create or replace function public.applicable_license(p_owner uuid, p_org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select l.id from public.licenses l
  where l.status = 'activa' and l.starts_at <= now() and l.ends_at > now()
    and ((p_org is not null and l.organization_id = p_org) or (p_org is null and l.holder_user_id = p_owner))
  order by l.ends_at desc limit 1
$$;

-- Cuota: se bloquea la fila de la licencia para que dos envíos simultáneos no la excedan.
create or replace function public.assert_listing_quota(p_property uuid, p_license uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_quota integer;
  v_used integer;
begin
  select active_listing_quota into v_quota from public.licenses where id = p_license for update;
  if v_quota is null then
    raise exception 'Licencia no encontrada' using errcode = 'P0001';
  end if;
  select count(*) into v_used from public.properties
  where license_id = p_license and id <> p_property and status in ('en_revision', 'publicado', 'reservado');
  if v_used >= v_quota then
    raise exception 'Cuota de publicaciones activas agotada (% de %)', v_used, v_quota using errcode = 'P0001';
  end if;
end $$;

-- Requisitos mínimos para enviar a revisión
create or replace function public.assert_listing_complete(p public.properties) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_missing text[] := '{}';
begin
  if coalesce(p.province, '') = '' then v_missing := v_missing || 'provincia'; end if;
  if coalesce(p.municipality, '') = '' then v_missing := v_missing || 'municipio'; end if;
  if char_length(coalesce(p.description, '')) < 30 then v_missing := v_missing || 'descripción (mínimo 30 caracteres)'; end if;
  if p.operation in ('venta', 'ambas') and not exists (select 1 from public.property_prices where property_id = p.id and operation = 'venta') then
    v_missing := v_missing || 'precio de venta';
  end if;
  if p.operation in ('renta', 'ambas') and not exists (select 1 from public.property_prices where property_id = p.id and operation = 'renta') then
    v_missing := v_missing || 'precio de renta';
  end if;
  if not exists (select 1 from public.property_media where property_id = p.id and kind = 'foto') then
    v_missing := v_missing || 'al menos una foto';
  end if;
  if not coalesce((select publication_authorized from public.property_private where property_id = p.id), false) then
    v_missing := v_missing || 'autorización de publicación';
  end if;
  if array_length(v_missing, 1) > 0 then
    raise exception 'Faltan datos para enviar a revisión: %', array_to_string(v_missing, ', ') using errcode = 'P0001';
  end if;
end $$;

-- =====================================================================
-- Reglas de negocio de publicaciones (no dependen de la interfaz)
-- =====================================================================
create or replace function public.properties_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_staff boolean := public.is_staff();
  v_live constant text[] := array['en_revision', 'publicado', 'reservado'];
  v_old jsonb;
  v_new jsonb;
  v_free constant text[] := array['status', 'available_from', 'updated_at', 'submitted_at', 'license_id', 'pause_reason', 'published_at'];
begin
  new.slug := public.slugify(new.title);

  if tg_op = 'INSERT' then
    if not v_staff then
      if new.owner_user_id is distinct from auth.uid() then
        raise exception 'La publicación debe pertenecer al usuario autenticado' using errcode = '42501';
      end if;
      if new.status <> 'borrador' or new.is_maj_listing or new.is_demo then
        raise exception 'Las publicaciones nuevas se crean como borrador' using errcode = '42501';
      end if;
      if new.organization_id is not null and not public.org_member_can(new.organization_id, 'publish') then
        raise exception 'Sin permiso para publicar en esta organización' using errcode = '42501';
      end if;
      new.license_id := null; new.reviewed_by := null; new.reviewed_at := null; new.rejection_reason := null;
      new.published_at := null; new.first_published_at := null; new.documents_reviewed_at := null;
      new.documents_review_scope := null; new.advisor_id := null; new.submitted_at := null;
    end if;
    return new;
  end if;

  -- UPDATE --------------------------------------------------------------
  if not v_staff then
    if new.owner_user_id <> old.owner_user_id or new.organization_id is distinct from old.organization_id
       or new.code <> old.code or new.is_maj_listing <> old.is_maj_listing or new.is_demo <> old.is_demo
       or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at
       or new.rejection_reason is distinct from old.rejection_reason
       or new.first_published_at is distinct from old.first_published_at
       or new.documents_reviewed_at is distinct from old.documents_reviewed_at
       or new.documents_review_scope is distinct from old.documents_review_scope
       or new.advisor_id is distinct from old.advisor_id then
      raise exception 'Campo reservado al personal de MAJ' using errcode = '42501';
    end if;

    -- Publicación fuera de borrador/rechazado: los cambios de contenido pasan por solicitud de cambio.
    if old.status not in ('borrador', 'rechazado') then
      v_old := to_jsonb(old) - v_free - 'slug';
      v_new := to_jsonb(new) - v_free - 'slug';
      if v_old <> v_new then
        raise exception 'Los cambios en una publicación activa requieren revisión: envíe una solicitud de cambio' using errcode = 'P0001';
      end if;
    end if;

    if new.status <> old.status then
      if not ((old.status, new.status) in (
        ('borrador', 'en_revision'), ('rechazado', 'en_revision'), ('rechazado', 'borrador'),
        ('en_revision', 'borrador'), ('publicado', 'pausado'), ('publicado', 'reservado'),
        ('publicado', 'vendido'), ('publicado', 'rentado'), ('reservado', 'publicado'),
        ('reservado', 'vendido'), ('reservado', 'rentado'), ('pausado', 'en_revision'),
        ('borrador', 'archivado'), ('rechazado', 'archivado'), ('pausado', 'archivado'),
        ('vendido', 'archivado'), ('rentado', 'archivado'), ('publicado', 'archivado'))) then
        raise exception 'Cambio de estado no permitido: % → %', old.status, new.status using errcode = '42501';
      end if;
    end if;
    -- El usuario no asigna licencia ni fecha de publicación por su cuenta
    if new.status = old.status then
      new.license_id := old.license_id;
      new.published_at := old.published_at;
      new.submitted_at := old.submitted_at;
    end if;
  end if;

  if new.status <> old.status then
    -- Entrando en estados que consumen cuota
    if new.status = any(v_live) and not (old.status = any(v_live)) and not new.is_maj_listing then
      new.license_id := public.applicable_license(new.owner_user_id, new.organization_id);
      if new.license_id is null then
        raise exception 'Se necesita una licencia de publicación activa y vigente' using errcode = 'P0001';
      end if;
      perform public.assert_listing_quota(new.id, new.license_id);
    end if;
    if new.status = 'reservado' and old.status = 'publicado' then
      null;
    elsif new.status = 'publicado' and not new.is_maj_listing and not public.license_valid(new.license_id) then
      raise exception 'La licencia de esta publicación no está vigente' using errcode = 'P0001';
    end if;

    if new.status = 'en_revision' then
      perform public.assert_listing_complete(new);
      new.submitted_at := now();
      if not v_staff then new.published_at := null; end if;
    elsif new.status = 'publicado' and old.status <> 'reservado' then
      if not v_staff then
        raise exception 'Solo el personal de MAJ aprueba publicaciones' using errcode = '42501';
      end if;
      new.published_at := now();
      new.first_published_at := coalesce(old.first_published_at, now());
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      new.rejection_reason := null;
      new.pause_reason := null;
    elsif new.status = 'rechazado' then
      if coalesce(new.rejection_reason, '') = '' then
        raise exception 'Indique el motivo del rechazo' using errcode = 'P0001';
      end if;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger properties_guard before insert or update on public.properties
  for each row execute function public.properties_guard();
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();
create trigger audit_properties after insert or update or delete on public.properties
  for each row execute function public.audit_trigger();

-- Historial de estados + aprobación de multimedia al publicar
create or replace function public.properties_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.property_private(property_id) values (new.id) on conflict do nothing;
    insert into public.property_reviews(property_id, action, to_status, actor_id)
    values (new.id, 'creado', new.status, auth.uid());
  elsif new.status <> old.status then
    insert into public.property_reviews(property_id, action, from_status, to_status, reason, actor_id)
    values (new.id, 'cambio_estado', old.status, new.status,
            case when new.status = 'rechazado' then new.rejection_reason else new.pause_reason end, auth.uid());
    if new.status = 'publicado' and old.status = 'en_revision' then
      update public.property_media set approved = true where property_id = new.id and not approved;
    end if;
  end if;
  return null;
end $$;
create trigger properties_after after insert or update on public.properties
  for each row execute function public.properties_after();

-- Datos privados, precios y documentos: los cambios en publicaciones activas también requieren revisión.
create or replace function public.property_child_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prop uuid := coalesce(new.property_id, old.property_id);
  v_status text;
begin
  if public.is_staff() then
    return coalesce(new, old);
  end if;
  if not public.property_access(v_prop, 'edit') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select status into v_status from public.properties where id = v_prop;
  if tg_table_name = 'property_private' and tg_op = 'UPDATE' then
    if new.staff_notes is distinct from old.staff_notes then
      raise exception 'Campo reservado al personal de MAJ' using errcode = '42501';
    end if;
  end if;
  if tg_table_name in ('property_private', 'property_prices') and v_status not in ('borrador', 'rechazado') then
    raise exception 'Los cambios en una publicación activa requieren revisión: envíe una solicitud de cambio' using errcode = 'P0001';
  end if;
  if tg_table_name = 'property_media' then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      new.approved := false;  -- se aprueba al publicar o por revisión del personal
    elsif tg_op = 'UPDATE' and new.approved is distinct from old.approved then
      raise exception 'Solo el personal aprueba multimedia' using errcode = '42501';
    end if;
  end if;
  if tg_table_name = 'property_documents' then
    if tg_op = 'INSERT' then
      new.uploaded_by := auth.uid();
      new.review_status := 'pendiente';
      new.reviewed_by := null; new.reviewed_at := null;
    elsif tg_op = 'UPDATE' then
      raise exception 'Los documentos no se editan; cargue una nueva versión' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger property_private_guard before insert or update or delete on public.property_private
  for each row execute function public.property_child_guard();
create trigger property_prices_guard before insert or update or delete on public.property_prices
  for each row execute function public.property_child_guard();
create trigger property_media_guard before insert or update or delete on public.property_media
  for each row execute function public.property_child_guard();
create trigger property_documents_guard before insert or update or delete on public.property_documents
  for each row execute function public.property_child_guard();
create trigger property_private_touch before update on public.property_private
  for each row execute function public.touch_updated_at();
create trigger audit_property_private after update on public.property_private
  for each row execute function public.audit_trigger();
create trigger audit_property_prices after insert or update or delete on public.property_prices
  for each row execute function public.audit_trigger();
create trigger audit_property_documents after insert or update or delete on public.property_documents
  for each row execute function public.audit_trigger();

-- Ubicación aproximada pública derivada de la exacta (redondeo ~1 km)
create or replace function public.property_private_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.exact_lat is distinct from (case when tg_op = 'UPDATE' then old.exact_lat end)
     or new.exact_lng is distinct from (case when tg_op = 'UPDATE' then old.exact_lng end) then
    update public.properties
       set approx_lat = round(new.exact_lat, 2), approx_lng = round(new.exact_lng, 2)
     where id = new.property_id and status in ('borrador', 'rechazado');
  end if;
  return null;
end $$;
create trigger property_private_sync after insert or update on public.property_private
  for each row execute function public.property_private_sync();

-- Advertencia (no bloqueo) de posibles duplicados: misma dirección y unidad
create or replace function public.possible_duplicates(p_property uuid)
returns table (property_id uuid, code text, title text, status text)
language sql stable security definer set search_path = public as $$
  select p2.id, p2.code, p2.title, p2.status
  from public.property_private a
  join public.properties p1 on p1.id = a.property_id
  join public.property_private b on b.property_id <> a.property_id
  join public.properties p2 on p2.id = b.property_id
  where a.property_id = p_property
    and public.property_access(p_property, 'view')
    and p2.status not in ('archivado', 'rechazado')
    and coalesce(nullif(lower(a.street), ''), '-') = lower(coalesce(b.street, ''))
    and coalesce(lower(a.street_number), '') = coalesce(lower(b.street_number), '')
    and coalesce(lower(a.building), '') = coalesce(lower(b.building), '')
    and coalesce(lower(a.unit), '') = coalesce(lower(b.unit), '')   -- unidades distintas del mismo edificio NO coinciden
    and p1.property_type = p2.property_type
  limit 10
$$;
grant execute on function public.possible_duplicates(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Solicitudes de cambio
-- ---------------------------------------------------------------------
create or replace function public.submit_property_change(p_property uuid, p_changes jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.property_access(p_property, 'edit') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'Cambios vacíos' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_object_keys(p_changes) k where k not in ('property', 'prices', 'private')) then
    raise exception 'Sección de cambio no reconocida' using errcode = 'P0001';
  end if;
  update public.property_change_requests set status = 'retirado'
   where property_id = p_property and status = 'pendiente';
  insert into public.property_change_requests(property_id, requested_by, changes)
  values (p_property, auth.uid(), p_changes) returning id into v_id;
  insert into public.property_reviews(property_id, action, actor_id) values (p_property, 'cambio_solicitado', auth.uid());
  return v_id;
end $$;
grant execute on function public.submit_property_change(uuid, jsonb) to authenticated;

-- El personal aprueba o rechaza; al aprobar se aplican solo columnas permitidas.
create or replace function public.review_property_change(p_request uuid, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.property_change_requests;
  v_prop public.properties;
  v_priv public.property_private;
  v_price jsonb;
  v_allowed_prop constant text[] := array['title', 'operation', 'property_type', 'description', 'condition', 'province',
    'municipality', 'sector', 'exact_address_public', 'public_address', 'built_area_m2', 'land_area_m2', 'bedrooms',
    'bathrooms', 'half_bathrooms', 'parking_spaces', 'floor_number', 'levels', 'year_built', 'service_room',
    'service_bathroom', 'laundry_area', 'balcony', 'terrace', 'patio', 'roof_area', 'roof_use_detail', 'na_fields',
    'features', 'condo_rules', 'restrictions'];
  v_allowed_priv constant text[] := array['street', 'street_number', 'building', 'unit', 'exact_lat', 'exact_lng',
    'owner_name', 'owner_phone', 'owner_email', 'owner_id_type', 'owner_id_number', 'publisher_relationship',
    'publication_authorized', 'authorization_date', 'authorization_expires', 'commission_terms', 'exclusivity',
    'exclusivity_expires', 'title_type', 'title_registry_number', 'cadastral_designation', 'survey_status',
    'legal_status_certificate_date', 'declared_liens', 'tax_notes', 'contract_notes'];
  v_patch jsonb;
begin
  if not public.is_staff() then
    raise exception 'Solo el personal de MAJ revisa cambios' using errcode = '42501';
  end if;
  select * into r from public.property_change_requests where id = p_request for update;
  if r.id is null or r.status <> 'pendiente' then
    raise exception 'Solicitud no encontrada o ya revisada' using errcode = 'P0001';
  end if;
  if not p_approve then
    if coalesce(p_reason, '') = '' then raise exception 'Indique el motivo' using errcode = 'P0001'; end if;
    update public.property_change_requests set status = 'rechazado', review_reason = p_reason,
      reviewed_by = auth.uid(), reviewed_at = now() where id = p_request;
    insert into public.property_reviews(property_id, action, reason, actor_id) values (r.property_id, 'cambio_rechazado', p_reason, auth.uid());
    return;
  end if;

  if r.changes ? 'property' then
    select jsonb_object_agg(key, value) into v_patch from jsonb_each(r.changes -> 'property') where key = any(v_allowed_prop);
    if v_patch is not null then
      select * into v_prop from public.properties where id = r.property_id;
      v_prop := jsonb_populate_record(v_prop, v_patch);
      update public.properties set
        title = v_prop.title, operation = v_prop.operation, property_type = v_prop.property_type,
        description = v_prop.description, condition = v_prop.condition, province = v_prop.province,
        municipality = v_prop.municipality, sector = v_prop.sector, exact_address_public = v_prop.exact_address_public,
        public_address = v_prop.public_address, built_area_m2 = v_prop.built_area_m2, land_area_m2 = v_prop.land_area_m2,
        bedrooms = v_prop.bedrooms, bathrooms = v_prop.bathrooms, half_bathrooms = v_prop.half_bathrooms,
        parking_spaces = v_prop.parking_spaces, floor_number = v_prop.floor_number, levels = v_prop.levels,
        year_built = v_prop.year_built, service_room = v_prop.service_room, service_bathroom = v_prop.service_bathroom,
        laundry_area = v_prop.laundry_area, balcony = v_prop.balcony, terrace = v_prop.terrace, patio = v_prop.patio,
        roof_area = v_prop.roof_area, roof_use_detail = v_prop.roof_use_detail, na_fields = v_prop.na_fields,
        features = v_prop.features, condo_rules = v_prop.condo_rules, restrictions = v_prop.restrictions
      where id = r.property_id;
    end if;
  end if;

  if r.changes ? 'private' then
    select jsonb_object_agg(key, value) into v_patch from jsonb_each(r.changes -> 'private') where key = any(v_allowed_priv);
    if v_patch is not null then
      select * into v_priv from public.property_private where property_id = r.property_id;
      v_priv := jsonb_populate_record(v_priv, v_patch);
      update public.property_private set
        street = v_priv.street, street_number = v_priv.street_number, building = v_priv.building, unit = v_priv.unit,
        exact_lat = v_priv.exact_lat, exact_lng = v_priv.exact_lng, owner_name = v_priv.owner_name,
        owner_phone = v_priv.owner_phone, owner_email = v_priv.owner_email, owner_id_type = v_priv.owner_id_type,
        owner_id_number = v_priv.owner_id_number, publisher_relationship = v_priv.publisher_relationship,
        publication_authorized = v_priv.publication_authorized, authorization_date = v_priv.authorization_date,
        authorization_expires = v_priv.authorization_expires, commission_terms = v_priv.commission_terms,
        exclusivity = v_priv.exclusivity, exclusivity_expires = v_priv.exclusivity_expires,
        title_type = v_priv.title_type, title_registry_number = v_priv.title_registry_number,
        cadastral_designation = v_priv.cadastral_designation, survey_status = v_priv.survey_status,
        legal_status_certificate_date = v_priv.legal_status_certificate_date, declared_liens = v_priv.declared_liens,
        tax_notes = v_priv.tax_notes, contract_notes = v_priv.contract_notes
      where property_id = r.property_id;
      update public.properties set approx_lat = round(v_priv.exact_lat, 2), approx_lng = round(v_priv.exact_lng, 2)
       where id = r.property_id and v_priv.exact_lat is not null;
    end if;
  end if;

  if r.changes ? 'prices' and jsonb_typeof(r.changes -> 'prices') = 'array' then
    delete from public.property_prices where property_id = r.property_id;
    for v_price in select * from jsonb_array_elements(r.changes -> 'prices') loop
      insert into public.property_prices
      select (jsonb_populate_record(null::public.property_prices,
              jsonb_build_object('negotiable', false, 'maintenance_included', 'desconocido') || v_price
              || jsonb_build_object('id', gen_random_uuid(), 'property_id', r.property_id))).*;
    end loop;
  end if;

  update public.property_change_requests set status = 'aprobado', review_reason = p_reason,
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_request;
  insert into public.property_reviews(property_id, action, reason, actor_id) values (r.property_id, 'cambio_aprobado', p_reason, auth.uid());
end $$;
grant execute on function public.review_property_change(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- Licencias: al vencer/suspender/cancelar se pausan sus publicaciones (se conservan datos e historial)
-- ---------------------------------------------------------------------
create or replace function public.licenses_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('vencida', 'suspendida', 'cancelada') and old.status = 'activa' then
    update public.properties
       set status = 'pausado', pause_reason = 'Licencia ' || new.status
     where license_id = new.id and status in ('en_revision', 'publicado', 'reservado');
  end if;
  return null;
end $$;
create trigger licenses_after after update on public.licenses
  for each row execute function public.licenses_after();

-- Ejecutar periódicamente (pg_cron o tarea programada). Devuelve cuántas licencias vencieron.
create or replace function public.expire_due_licenses() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  -- Tarea del sistema: el disparador licenses_guard reconoce esta marca local de la transacción.
  perform set_config('maj.system_job', 'on', true);
  update public.licenses set status = 'vencida', status_reason = 'Vencimiento automático'
   where status = 'activa' and ends_at <= now();
  get diagnostics v_count = row_count;
  perform set_config('maj.system_job', 'off', true);
  return v_count;
end $$;
revoke all on function public.expire_due_licenses() from public, anon, authenticated;

-- =====================================================================
-- Catálogo público: SOLO campos públicos de publicaciones aprobadas.
-- Vista con privilegios del propietario y filtro explícito; los visitantes no acceden a las tablas base.
-- =====================================================================
create view public.catalog as
select
  p.id, p.code, p.slug, p.title, p.operation, p.property_type, p.description, p.condition, p.status,
  p.available_from, p.updated_at, p.published_at, p.is_demo, p.is_maj_listing,
  p.country, p.province, p.municipality, p.sector, p.approx_lat, p.approx_lng,
  case when p.exact_address_public then p.public_address end as public_address,
  p.built_area_m2, p.land_area_m2, p.bedrooms, p.bathrooms, p.half_bathrooms, p.parking_spaces,
  p.floor_number, p.levels, p.year_built, p.service_room, p.service_bathroom, p.laundry_area,
  p.balcony, p.terrace, p.patio, p.roof_area, p.roof_use_detail, p.na_fields, p.features,
  p.condo_rules, p.restrictions, p.documents_reviewed_at, p.documents_review_scope,
  sale.amount as sale_price, sale.currency as sale_currency, sale.negotiable as sale_negotiable,
  rent.amount as rent_price, rent.currency as rent_currency, rent.negotiable as rent_negotiable, rent.rent_period,
  cover.storage_path as cover_path, cover.alt_text as cover_alt,
  a.display_name as advisor_name, a.whatsapp as advisor_whatsapp,
  (select count(*) from public.property_media m where m.property_id = p.id and m.kind = 'foto' and m.approved) as photo_count
from public.properties p
left join public.property_prices sale on sale.property_id = p.id and sale.operation = 'venta'
left join public.property_prices rent on rent.property_id = p.id and rent.operation = 'renta'
left join lateral (
  select m.storage_path, m.alt_text from public.property_media m
  where m.property_id = p.id and m.kind = 'foto' and m.approved
  order by m.is_cover desc, m.sort_order, m.created_at limit 1
) cover on true
left join public.advisors a on a.id = p.advisor_id and a.is_active
where p.status in ('publicado', 'reservado')
  and (p.is_maj_listing or public.license_valid(p.license_id))
  and (not p.is_demo or public.demo_visible());

create view public.catalog_prices as
select pr.property_id, pr.operation, pr.amount, pr.currency, pr.negotiable, pr.maintenance_amount,
       pr.maintenance_currency, pr.maintenance_included, pr.additional_costs, pr.rent_period, pr.deposit_amount,
       pr.deposit_months, pr.advance_months, pr.min_term_months, pr.delivery_conditions
from public.property_prices pr
where public.property_is_public(pr.property_id);

create view public.catalog_media as
select m.id, m.property_id, m.kind, m.storage_path, m.external_url, m.alt_text, m.sort_order, m.is_cover, m.width, m.height
from public.property_media m
where m.approved and public.property_is_public(m.property_id);

grant select on public.catalog, public.catalog_prices, public.catalog_media to anon, authenticated;

-- =====================================================================
-- RLS de tablas base
-- =====================================================================
alter table public.advisors enable row level security;
alter table public.properties enable row level security;
alter table public.property_private enable row level security;
alter table public.property_prices enable row level security;
alter table public.property_media enable row level security;
alter table public.property_documents enable row level security;
alter table public.property_reviews enable row level security;
alter table public.property_change_requests enable row level security;
alter table public.property_reports enable row level security;
alter table public.property_events enable row level security;
alter table public.favorites enable row level security;
alter table public.saved_searches enable row level security;
alter table public.exchange_rates enable row level security;

create policy advisors_public on public.advisors for select using (is_active or public.is_staff());
create policy advisors_staff on public.advisors for all using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.advisors from anon;

-- Tablas base: solo titular, organización autorizada o personal. El público usa las vistas del catálogo.
create policy properties_read on public.properties for select to authenticated
  using (public.is_staff() or owner_user_id = auth.uid()
         or (organization_id is not null and public.org_member_can(organization_id, 'view_all')));
create policy properties_insert on public.properties for insert to authenticated
  with check (owner_user_id = auth.uid() or public.is_staff());
create policy properties_update on public.properties for update to authenticated
  using (public.property_access(id, 'edit')) with check (public.property_access(id, 'edit'));
create policy properties_delete on public.properties for delete to authenticated
  using (public.is_admin() or (owner_user_id = auth.uid() and status = 'borrador' and first_published_at is null));

create policy property_private_read on public.property_private for select to authenticated
  using (public.property_access(property_id, 'view'));
create policy property_private_write on public.property_private for update to authenticated
  using (public.property_access(property_id, 'edit')) with check (public.property_access(property_id, 'edit'));

create policy property_prices_read on public.property_prices for select to authenticated
  using (public.property_access(property_id, 'view'));
create policy property_prices_write on public.property_prices for all to authenticated
  using (public.property_access(property_id, 'edit')) with check (public.property_access(property_id, 'edit'));

create policy property_media_read on public.property_media for select to authenticated
  using (public.property_access(property_id, 'view'));
create policy property_media_write on public.property_media for all to authenticated
  using (public.property_access(property_id, 'edit')) with check (public.property_access(property_id, 'edit'));

create policy property_documents_read on public.property_documents for select to authenticated
  using (public.property_access(property_id, 'view'));
create policy property_documents_insert on public.property_documents for insert to authenticated
  with check (public.property_access(property_id, 'edit'));
create policy property_documents_staff on public.property_documents for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy property_documents_delete on public.property_documents for delete to authenticated
  using (public.is_admin() or (uploaded_by = auth.uid() and review_status = 'pendiente'));

create policy property_reviews_read on public.property_reviews for select to authenticated
  using (public.property_access(property_id, 'view'));

create policy change_requests_read on public.property_change_requests for select to authenticated
  using (public.property_access(property_id, 'view'));

create policy property_reports_insert_anon on public.property_reports for insert
  with check (status = 'abierto' and resolved_by is null and (reporter_id is null or reporter_id = auth.uid()));
create policy property_reports_staff on public.property_reports for select using (public.is_staff() or reporter_id = auth.uid());
create policy property_reports_staff_update on public.property_reports for update using (public.is_staff()) with check (public.is_staff());

create policy property_events_staff_read on public.property_events for select to authenticated
  using (public.property_access(property_id, 'view'));

create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.property_is_public(property_id));
create policy saved_searches_own on public.saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy exchange_rates_read on public.exchange_rates for select using (true);
create policy exchange_rates_staff on public.exchange_rates for all using (public.is_staff()) with check (public.is_staff());

revoke all on public.properties, public.property_private, public.property_prices, public.property_media,
  public.property_documents, public.property_reviews, public.property_change_requests, public.property_events,
  public.favorites, public.saved_searches from anon;
revoke insert, update, delete on public.exchange_rates from anon;
revoke update, delete on public.property_reports from anon;
revoke insert, update, delete on public.property_reviews, public.property_change_requests, public.property_events from authenticated;

-- Registro de eventos públicos (vistas, clics) sin acceso a la tabla
create or replace function public.track_property_event(p_property uuid, p_kind text, p_session text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('vista', 'clic_whatsapp', 'compartir', 'favorito') then
    raise exception 'Evento no válido' using errcode = 'P0001';
  end if;
  if not public.property_is_public(p_property) then
    return;
  end if;
  -- una vista por sesión y día
  if p_kind = 'vista' and p_session is not null and exists (
     select 1 from public.property_events where property_id = p_property and kind = 'vista'
       and session_hash = left(p_session, 64) and created_at > now() - interval '1 day') then
    return;
  end if;
  insert into public.property_events(property_id, kind, session_hash) values (p_property, p_kind, left(p_session, 64));
end $$;
grant execute on function public.track_property_event(uuid, text, text) to anon, authenticated;
