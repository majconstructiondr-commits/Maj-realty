-- =====================================================================
-- Migración 0010: herramientas del panel administrativo
-- Funciones de solo personal (is_staff: rol staff/admin + MFA) para buscar usuarios por correo,
-- mostrar etiquetas de usuarios y calcular indicadores del tablero.
-- Los correos viven en auth.users y nunca se exponen a usuarios sin rol de personal.
-- =====================================================================

-- Búsqueda exacta por correo (para vincular clientes, propietarios y titulares de licencia)
create or replace function public.staff_find_user(p_email text)
returns table (id uuid, full_name text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, u.email::text
      from auth.users u join public.profiles p on p.id = u.id
     where lower(u.email::text) = lower(trim(coalesce(p_email, '')))
     limit 1;
end $$;
revoke all on function public.staff_find_user(text) from public, anon;
grant execute on function public.staff_find_user(text) to authenticated;

-- Nombre y correo de varios usuarios (listas del panel)
create or replace function public.staff_user_labels(p_ids uuid[])
returns table (id uuid, full_name text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, u.email::text
      from public.profiles p left join auth.users u on u.id = p.id
     where p.id = any(coalesce(p_ids, '{}'::uuid[]));
end $$;
revoke all on function public.staff_user_labels(uuid[]) from public, anon;
grant execute on function public.staff_user_labels(uuid[]) to authenticated;

-- Directorio de usuarios con búsqueda por nombre o correo, filtro por rol y paginación
create or replace function public.staff_user_directory(p_search text, p_role text, p_suspended boolean, p_limit integer, p_offset integer)
returns table (
  id uuid, full_name text, display_name text, email text, roles text[], is_suspended boolean,
  identity_reviewed_at timestamptz, created_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    with base as (
      select p.id, p.full_name, p.display_name, u.email::text as email,
             coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = p.id), '{}') as roles,
             p.is_suspended, p.identity_reviewed_at, p.created_at
        from public.profiles p left join auth.users u on u.id = p.id
    )
    select b.*, count(*) over () as total_count
      from base b
     where (v_q is null or b.full_name ilike '%' || v_q || '%' or b.email ilike '%' || v_q || '%'
            or coalesce(b.display_name, '') ilike '%' || v_q || '%')
       and (nullif(p_role, '') is null or p_role = any(b.roles))
       and (p_suspended is null or b.is_suspended = p_suspended)
     order by b.created_at desc
     limit least(greatest(coalesce(p_limit, 25), 1), 200)
     offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.staff_user_directory(text, text, boolean, integer, integer) from public, anon;
grant execute on function public.staff_user_directory(text, text, boolean, integer, integer) to authenticated;

-- Indicadores del tablero. Separa vistas, clics de WhatsApp, consultas guardadas y cierres confirmados;
-- los importes se agrupan por moneda y nunca se suman monedas distintas.
create or replace function public.staff_dashboard(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 366);
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 366));
  v_notice integer := coalesce((public.setting('licenses.expiry_notice_days') #>> '{}')::int, 15);
  v_open_req constant text[] := array['completada', 'cerrada', 'cancelada'];
  v_out jsonb;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'days', v_days,
    'notice_days', v_notice,
    'properties_by_status', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) n from public.properties group by status) s), '{}'::jsonb),
    'pending_change_requests', (select count(*) from public.property_change_requests where status = 'pendiente'),
    'pending_media', (select count(*) from public.property_media m join public.properties p on p.id = m.property_id
                       where not m.approved and p.status in ('publicado', 'reservado', 'en_revision')),
    'pending_documents', (select count(*) from public.property_documents where review_status = 'pendiente'),
    'licenses_expiring', (select count(*) from public.licenses
                           where status = 'activa' and ends_at > now() and ends_at <= now() + make_interval(days => v_notice)),
    'licenses_pending', (select count(*) from public.licenses where status = 'pendiente'),
    'payments_pending', (select count(*) from public.license_payments where status = 'pendiente'),
    'applications_pending', (select count(*) from public.publisher_applications where status in ('pendiente', 'documentos_requeridos')),
    'unattended_requests', (select count(*) from public.service_requests
                             where stage = 'nuevo' and assigned_to is null and created_at < now() - interval '24 hours'
                               and not (status = any(v_open_req))),
    'open_requests_by_kind', coalesce((select jsonb_object_agg(kind, n) from (
        select kind, count(*) n from public.service_requests where not (status = any(v_open_req)) group by kind) s), '{}'::jsonb),
    'open_property_reports', (select count(*) from public.property_reports where status in ('abierto', 'en_revision')),
    'open_message_reports', (select count(*) from public.message_reports where status = 'abierto'),
    'upcoming_visits', (select count(*) from public.appointments
                         where status in ('solicitada', 'confirmada') and starts_at >= now() and starts_at < now() + interval '7 days'),
    'visits_to_confirm', (select count(*) from public.appointments where status = 'solicitada' and starts_at >= now()),
    -- Interés (no son ventas ni contactos confirmados)
    'views', (select count(*) from public.property_events where kind = 'vista' and created_at >= v_since),
    'whatsapp_clicks', (select count(*) from public.property_events where kind = 'clic_whatsapp' and created_at >= v_since),
    'shares', (select count(*) from public.property_events where kind = 'compartir' and created_at >= v_since),
    -- Consultas guardadas = solicitudes registradas con número
    'saved_inquiries', (select count(*) from public.service_requests where created_at >= v_since),
    -- Cierres confirmados por el personal
    'closed_properties', (select count(*) from public.property_reviews
                           where to_status in ('vendido', 'rentado') and created_at >= v_since),
    'closed_requests', (select count(*) from public.request_events
                         where kind = 'etapa' and to_value = 'cierre' and created_at >= v_since),
    'quotes_accepted', coalesce((select jsonb_object_agg(currency, jsonb_build_object('count', n, 'total', total)) from (
        select q.currency, count(*) n, sum(t.total) total
          from public.quotes q join public.quote_totals t on t.quote_id = q.id
         where q.status = 'aceptada' and coalesce(q.responded_at, q.updated_at) >= v_since
         group by q.currency) s), '{}'::jsonb),
    'quotes_open', coalesce((select jsonb_object_agg(currency, jsonb_build_object('count', n, 'total', total)) from (
        select q.currency, count(*) n, sum(t.total) total
          from public.quotes q join public.quote_totals t on t.quote_id = q.id
         where q.status = 'enviada'
         group by q.currency) s), '{}'::jsonb),
    'payments_approved', coalesce((select jsonb_object_agg(currency, jsonb_build_object('count', n, 'total', total)) from (
        select currency, count(*) n, sum(amount) total from public.license_payments
         where status = 'aprobado' and reviewed_at >= v_since group by currency) s), '{}'::jsonb),
    'management_balance', coalesce((select jsonb_object_agg(currency, jsonb_build_object('ingresos', ing, 'egresos', egr)) from (
        select currency, sum(case when direction = 'ingreso' then amount else 0 end) ing,
               sum(case when direction = 'egreso' then amount else 0 end) egr
          from public.management_movements where status <> 'anulado' and movement_date >= (v_since at time zone 'America/Santo_Domingo')::date
         group by currency) s), '{}'::jsonb)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.staff_dashboard(integer) from public, anon;
grant execute on function public.staff_dashboard(integer) to authenticated;
