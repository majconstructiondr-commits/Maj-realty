-- =====================================================================
-- Migración 0009: alta de miembros de organización por correo, directorio de miembros,
-- uso de cuota de licencias y estadísticas agregadas de publicaciones para el panel del vendedor.
-- =====================================================================

-- Intentos de alta por correo (límite contra enumeración de cuentas). Solo lectura del personal.
create table public.org_member_lookup_attempts (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  found boolean not null,
  created_at timestamptz not null default now()
);
create index org_member_lookup_attempts_actor_idx on public.org_member_lookup_attempts(actor_id, created_at desc);
alter table public.org_member_lookup_attempts enable row level security;
create policy org_member_lookup_attempts_staff on public.org_member_lookup_attempts for select
  using (public.is_staff());
revoke all on public.org_member_lookup_attempts from anon, authenticated;
grant select on public.org_member_lookup_attempts to authenticated;

-- ---------------------------------------------------------------------
-- Añadir miembro por correo. Devuelve true si se añadió y false en cualquier otro caso
-- (correo sin cuenta, cuenta suspendida o ya miembro), sin distinguir el motivo: así no se
-- revela si un correo arbitrario tiene cuenta. Solo gestores (o con permiso de gestionar
-- miembros) de organizaciones ACTIVAS, o personal MAJ. Límite de intentos por hora.
-- El disparador org_members_guard sigue validando permisos y el máximo de miembros de la licencia.
-- ---------------------------------------------------------------------
create or replace function public.add_org_member_by_email(
  p_org uuid,
  p_email text,
  p_member_role text default 'agente',
  p_can_publish boolean default true,
  p_can_view_all boolean default false,
  p_can_manage boolean default false,
  p_can_view_leads boolean default false
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_staff boolean := public.is_staff();
  v_user uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_recent integer;
  v_max integer;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not (v_staff or public.org_member_can(p_org, 'manage_members')) then
    raise exception 'No autorizado para gestionar miembros' using errcode = '42501';
  end if;
  if not v_staff and not exists (select 1 from public.organizations where id = p_org and status = 'activa') then
    raise exception 'La organización debe estar activa (aprobada por MAJ) para añadir miembros' using errcode = 'P0001';
  end if;
  if p_member_role not in ('gestor', 'agente') then
    raise exception 'Rol de miembro no válido' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160 then
    raise exception 'Correo no válido' using errcode = 'P0001';
  end if;

  if not v_staff then
    select count(*) into v_recent from public.org_member_lookup_attempts
     where actor_id = auth.uid() and created_at > now() - interval '1 hour';
    if v_recent >= 20 then
      raise exception 'Demasiados intentos. Intente de nuevo más tarde.' using errcode = 'P0001';
    end if;
  end if;

  -- Cupo de miembros ANTES de buscar el correo: el resultado no debe depender de si el correo existe.
  select coalesce(max(l.max_members), 1) into v_max from public.licenses l
    where l.organization_id = p_org and l.status = 'activa';
  select count(*) into v_count from public.organization_members where organization_id = p_org;
  if v_count >= v_max then
    raise exception 'La licencia de la organización permite % miembro(s)', v_max using errcode = 'P0001';
  end if;

  select u.id into v_user
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = v_email and not p.is_suspended
  limit 1;

  if v_user is null or exists (
    select 1 from public.organization_members where organization_id = p_org and user_id = v_user
  ) then
    insert into public.org_member_lookup_attempts(actor_id, organization_id, found) values (auth.uid(), p_org, false);
    return false;
  end if;

  insert into public.org_member_lookup_attempts(actor_id, organization_id, found) values (auth.uid(), p_org, true);
  -- Bloque interno: si el disparador rechaza la inserción, el intento registrado arriba se conserva
  -- y la respuesta es la misma que para un correo sin cuenta.
  begin
    insert into public.organization_members(organization_id, user_id, member_role, can_publish,
      can_view_all_listings, can_manage_members, can_view_leads, added_by)
    values (p_org, v_user, p_member_role, coalesce(p_can_publish, true), coalesce(p_can_view_all, false),
      coalesce(p_can_manage, false), coalesce(p_can_view_leads, false), auth.uid());
  exception when others then
    return false;
  end;
  return true;
end $$;
revoke all on function public.add_org_member_by_email(uuid, text, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.add_org_member_by_email(uuid, text, text, boolean, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Directorio de miembros (nombre y correo) para quien gestiona la organización.
-- Los demás miembros solo ven su propia fila.
-- ---------------------------------------------------------------------
create or replace function public.org_member_directory(p_org uuid)
returns table (
  user_id uuid, full_name text, email text, member_role text, can_publish boolean,
  can_view_all_listings boolean, can_manage_members boolean, can_view_leads boolean, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name, u.email::text, m.member_role, m.can_publish, m.can_view_all_listings,
         m.can_manage_members, m.can_view_leads, m.created_at
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.organization_id = p_org
    and (public.is_staff() or public.org_member_can(p_org, 'manage_members') or m.user_id = auth.uid())
  order by m.member_role, p.full_name
$$;
revoke all on function public.org_member_directory(uuid) from public, anon;
grant execute on function public.org_member_directory(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Uso de cuota de una licencia (publicaciones en revisión, publicadas o reservadas),
-- visible para el titular y los miembros de la organización aunque no vean todas las publicaciones.
-- ---------------------------------------------------------------------
create or replace function public.license_usage(p_license uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when exists (
      select 1 from public.licenses l
      where l.id = p_license and (public.is_staff() or l.holder_user_id = auth.uid()
        or (l.organization_id is not null and public.org_member_can(l.organization_id, 'member'))))
    then (select count(*)::integer from public.properties
          where license_id = p_license and status in ('en_revision', 'publicado', 'reservado'))
  end
$$;
revoke all on function public.license_usage(uuid) from public, anon;
grant execute on function public.license_usage(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Estadísticas agregadas por publicación (respeta RLS: solo publicaciones visibles para quien consulta).
-- Vistas y clics de WhatsApp NO son contactos confirmados.
-- ---------------------------------------------------------------------
create or replace function public.listing_event_counts(p_ids uuid[])
returns table (property_id uuid, vistas bigint, clics_whatsapp bigint, compartidos bigint, favoritos bigint)
language sql stable security invoker set search_path = public as $$
  select e.property_id,
         count(*) filter (where e.kind = 'vista'),
         count(*) filter (where e.kind = 'clic_whatsapp'),
         count(*) filter (where e.kind = 'compartir'),
         count(*) filter (where e.kind = 'favorito')
  from public.property_events e
  where e.property_id = any(p_ids)
  group by e.property_id
$$;
revoke all on function public.listing_event_counts(uuid[]) from public, anon;
grant execute on function public.listing_event_counts(uuid[]) to authenticated;
