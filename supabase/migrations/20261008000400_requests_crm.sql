-- =====================================================================
-- Migración 0004: solicitudes de servicio (CRM), historial, archivos y consentimientos
-- Toda solicitud recibe número, fecha, responsable y seguimiento.
-- =====================================================================

create sequence public.request_number_seq;

create table public.legal_services (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text,
  enabled boolean not null default false,            -- habilitar solo con profesional competente
  responsible_professional text,                     -- nombre del profesional responsable
  sort_order integer not null default 0,
  check (not enabled or coalesce(responsible_professional, '') <> '')
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('SOL-' || to_char(now() at time zone 'America/Santo_Domingo', 'YYYY') || '-' || lpad(nextval('public.request_number_seq')::text, 6, '0')),
  kind text not null check (kind in (
    'contacto', 'info_inmueble', 'visita', 'venta_captacion', 'renta_publicar', 'administracion',
    'remodelacion', 'cotizacion', 'legal', 'busco_propiedad', 'publicar_propiedad', 'reporte')),
  status text not null default 'recibida' check (status in (
    'recibida', 'en_revision', 'documentos_requeridos', 'cotizada', 'aprobada', 'en_proceso', 'completada', 'cerrada', 'cancelada')),
  stage text not null default 'nuevo' check (stage in ('nuevo', 'contactado', 'visita', 'propuesta', 'cierre', 'descartado')),
  client_user_id uuid references public.profiles(id) on delete set null,
  contact_name text not null check (char_length(contact_name) between 2 and 160),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9+()\s-]{7,25}$'),
  preferred_channel text not null default 'whatsapp' check (preferred_channel in ('whatsapp', 'llamada', 'correo', 'chat')),
  property_id uuid references public.properties(id) on delete set null,
  property_ref text check (char_length(property_ref) <= 60),
  message text check (char_length(message) <= 4000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 20000),
  source text not null default 'web' check (source in ('web', 'whatsapp', 'telefono', 'referido', 'redes', 'presencial', 'otro')),
  assigned_to uuid references public.profiles(id),          -- responsable MAJ
  assigned_publisher_id uuid references public.profiles(id), -- vendedor/agencia al que se asigna el interesado
  next_action text check (char_length(next_action) <= 300),
  next_action_at timestamptz,
  contact_consent boolean not null,
  marketing_consent boolean not null default false,
  upload_token uuid not null default gen_random_uuid(),     -- permite adjuntar archivos justo después de crearla
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_email is not null or contact_phone is not null),
  check (contact_consent)
);
create index service_requests_kind_status_idx on public.service_requests(kind, status);
create index service_requests_assigned_idx on public.service_requests(assigned_to);
create index service_requests_client_idx on public.service_requests(client_user_id);
create index service_requests_created_idx on public.service_requests(created_at desc);
create index service_requests_email_idx on public.service_requests(lower(contact_email), created_at);

create table public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  kind text not null check (kind in ('creada', 'estado', 'etapa', 'asignacion', 'nota_privada', 'nota_cliente', 'archivo', 'proxima_accion')),
  from_value text,
  to_value text,
  body text check (char_length(body) <= 4000),
  is_private boolean not null default true,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index request_events_request_idx on public.request_events(request_id, created_at);

create table public.request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  storage_path text not null unique,   -- bucket privado "private-docs"
  file_name text not null check (char_length(file_name) <= 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15728640),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete set null,
  kind text not null check (kind in ('contacto', 'marketing', 'terminos', 'privacidad', 'condiciones_publicacion', 'autorizacion_propietario')),
  document_version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Acceso
-- ---------------------------------------------------------------------
create or replace function public.request_access(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.service_requests r
    where r.id = p_request and (
      r.client_user_id = auth.uid()
      or r.assigned_publisher_id = auth.uid()
      or (r.assigned_publisher_id is not null and exists (
            select 1 from public.organization_members m
            where m.user_id = r.assigned_publisher_id and public.org_member_can(m.organization_id, 'view_leads')))
    )
  )
$$;
grant execute on function public.request_access(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Creación validada en servidor (visitantes y usuarios). Devuelve número real.
-- ---------------------------------------------------------------------
create or replace function public.create_service_request(
  p_kind text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_preferred_channel text,
  p_message text,
  p_details jsonb,
  p_property_id uuid,
  p_property_ref text,
  p_contact_consent boolean,
  p_marketing_consent boolean,
  p_consent_version text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_req public.service_requests;
  v_recent integer;
  v_email text := nullif(lower(trim(p_contact_email)), '');
  v_phone text := nullif(trim(p_contact_phone), '');
begin
  if p_kind not in ('contacto', 'info_inmueble', 'visita', 'venta_captacion', 'renta_publicar', 'administracion',
                    'remodelacion', 'cotizacion', 'legal', 'busco_propiedad', 'publicar_propiedad') then
    raise exception 'Tipo de solicitud no válido' using errcode = 'P0001';
  end if;
  if coalesce(p_contact_consent, false) is not true then
    raise exception 'Debe autorizar que le contactemos para atender la solicitud' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_contact_name, ''))) < 2 then
    raise exception 'Indique su nombre' using errcode = 'P0001';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'Indique un correo o un teléfono' using errcode = 'P0001';
  end if;
  if p_property_id is not null and not public.property_is_public(p_property_id) and not public.property_access(p_property_id, 'view') then
    raise exception 'Inmueble no disponible' using errcode = 'P0001';
  end if;
  if p_kind = 'legal' then
    if not exists (select 1 from public.legal_services where code = p_details ->> 'service_code' and enabled) then
      raise exception 'Este servicio legal no está habilitado actualmente' using errcode = 'P0001';
    end if;
  end if;
  if p_kind in ('info_inmueble', 'visita') and p_property_id is null then
    raise exception 'Falta el inmueble' using errcode = 'P0001';
  end if;

  -- Protección contra abuso: límites por contacto y globales para visitantes
  select count(*) into v_recent from public.service_requests
   where created_at > now() - interval '1 hour'
     and ((v_email is not null and lower(contact_email) = v_email) or (v_phone is not null and contact_phone = v_phone)
          or (auth.uid() is not null and client_user_id = auth.uid()));
  if v_recent >= coalesce((public.setting('limits.requests_per_contact_hour') #>> '{}')::int, 6) then
    raise exception 'Demasiadas solicitudes en poco tiempo. Intente más tarde o escríbanos por WhatsApp.' using errcode = 'P0001';
  end if;
  if auth.uid() is null then
    select count(*) into v_recent from public.service_requests where created_at > now() - interval '10 minutes' and client_user_id is null;
    if v_recent >= coalesce((public.setting('limits.anonymous_requests_per_10min') #>> '{}')::int, 60) then
      raise exception 'Servicio temporalmente saturado. Intente en unos minutos.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.service_requests(kind, client_user_id, contact_name, contact_email, contact_phone, preferred_channel,
    property_id, property_ref, message, details, contact_consent, marketing_consent, source)
  values (p_kind, auth.uid(), trim(p_contact_name), v_email, v_phone, coalesce(p_preferred_channel, 'whatsapp'),
    p_property_id, left(p_property_ref, 60), left(p_message, 4000), coalesce(p_details, '{}'::jsonb),
    true, coalesce(p_marketing_consent, false), 'web')
  returning * into v_req;

  insert into public.request_events(request_id, kind, to_value, is_private, actor_id)
  values (v_req.id, 'creada', v_req.status, false, auth.uid());
  insert into public.consents(user_id, request_id, kind, document_version, granted)
  values (auth.uid(), v_req.id, 'contacto', coalesce(p_consent_version, 'sin-version'), true),
         (auth.uid(), v_req.id, 'marketing', coalesce(p_consent_version, 'sin-version'), coalesce(p_marketing_consent, false));

  return jsonb_build_object('id', v_req.id, 'number', v_req.number, 'created_at', v_req.created_at, 'upload_token', v_req.upload_token);
end $$;
revoke all on function public.create_service_request(text, text, text, text, text, text, jsonb, uuid, text, boolean, boolean, text) from public;
grant execute on function public.create_service_request(text, text, text, text, text, text, jsonb, uuid, text, boolean, boolean, text) to anon, authenticated;

-- Registro de archivo adjunto tras subirlo al almacenamiento con el token de la solicitud
create or replace function public.attach_request_file(p_request uuid, p_token uuid, p_path text, p_name text, p_mime text, p_size integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  select (upload_token = p_token and created_at > now() - interval '2 hours') or public.request_access(id)
    into v_ok from public.service_requests where id = p_request;
  if not coalesce(v_ok, false) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_path not like ('requests/' || p_request::text || '/%') then
    raise exception 'Ruta no válida' using errcode = 'P0001';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'private-docs' and name = p_path) then
    raise exception 'Archivo no encontrado' using errcode = 'P0001';
  end if;
  if (select count(*) from public.request_files where request_id = p_request) >= 15 then
    raise exception 'Máximo 15 archivos por solicitud' using errcode = 'P0001';
  end if;
  insert into public.request_files(request_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  values (p_request, p_path, left(p_name, 200), p_mime, p_size, auth.uid());
  insert into public.request_events(request_id, kind, body, is_private, actor_id)
  values (p_request, 'archivo', left(p_name, 200), false, auth.uid());
end $$;
grant execute on function public.attach_request_file(uuid, uuid, text, text, text, integer) to anon, authenticated;

-- Historial automático de cambios hechos por el personal
create or replace function public.service_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el personal de MAJ gestiona solicitudes' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    insert into public.request_events(request_id, kind, from_value, to_value, is_private, actor_id)
    values (new.id, 'estado', old.status, new.status, false, auth.uid());
  end if;
  if new.stage is distinct from old.stage then
    insert into public.request_events(request_id, kind, from_value, to_value, actor_id)
    values (new.id, 'etapa', old.stage, new.stage, auth.uid());
  end if;
  if new.assigned_to is distinct from old.assigned_to or new.assigned_publisher_id is distinct from old.assigned_publisher_id then
    insert into public.request_events(request_id, kind, from_value, to_value, actor_id)
    values (new.id, 'asignacion', coalesce(old.assigned_to::text, '') || '/' || coalesce(old.assigned_publisher_id::text, ''),
            coalesce(new.assigned_to::text, '') || '/' || coalesce(new.assigned_publisher_id::text, ''), auth.uid());
  end if;
  if new.next_action is distinct from old.next_action or new.next_action_at is distinct from old.next_action_at then
    insert into public.request_events(request_id, kind, to_value, body, actor_id)
    values (new.id, 'proxima_accion', to_char(new.next_action_at at time zone 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI'), new.next_action, auth.uid());
  end if;
  -- campos de origen inmutables
  new.number := old.number; new.kind := old.kind; new.created_at := old.created_at;
  new.contact_consent := old.contact_consent; new.upload_token := old.upload_token;
  return new;
end $$;
create trigger service_requests_guard before update on public.service_requests
  for each row execute function public.service_requests_guard();
create trigger service_requests_touch before update on public.service_requests
  for each row execute function public.touch_updated_at();

-- Notas: personal (privadas o visibles al cliente). El cliente puede agregar comentarios visibles.
create or replace function public.add_request_note(p_request uuid, p_body text, p_private boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.request_access(p_request) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Nota vacía' using errcode = 'P0001';
  end if;
  insert into public.request_events(request_id, kind, body, is_private, actor_id)
  values (p_request,
          case when public.is_staff() and p_private then 'nota_privada' else 'nota_cliente' end,
          left(p_body, 4000), public.is_staff() and coalesce(p_private, true), auth.uid());
end $$;
grant execute on function public.add_request_note(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.legal_services enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_events enable row level security;
alter table public.request_files enable row level security;
alter table public.consents enable row level security;

create policy legal_services_read on public.legal_services for select using (enabled or public.is_staff());
create policy legal_services_admin on public.legal_services for all using (public.is_admin()) with check (public.is_admin());

create policy service_requests_read on public.service_requests for select to authenticated
  using (public.request_access(id));
create policy service_requests_staff_update on public.service_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy request_events_read on public.request_events for select to authenticated
  using (public.request_access(request_id) and (not is_private or public.is_staff()));
create policy request_files_read on public.request_files for select to authenticated
  using (public.request_access(request_id));
create policy consents_read on public.consents for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

revoke all on public.service_requests, public.request_events, public.request_files, public.consents from anon;
revoke insert, delete on public.service_requests from authenticated;
revoke insert, update, delete on public.request_events, public.request_files, public.consents from authenticated;
revoke insert, update, delete on public.legal_services from anon;
create trigger audit_service_requests after insert or update or delete on public.service_requests
  for each row execute function public.audit_trigger();
create trigger audit_legal_services after insert or update or delete on public.legal_services
  for each row execute function public.audit_trigger();
