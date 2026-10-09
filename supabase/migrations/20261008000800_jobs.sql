-- =====================================================================
-- Migración 0008: tareas programadas (vencimientos, avisos)
-- Programar con pg_cron en Supabase (ver docs/DESPLIEGUE.md) o con la ruta /api/cron protegida.
-- =====================================================================
create or replace function public.run_scheduled_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_expired integer;
  v_notices integer;
  v_quotes integer;
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

  return jsonb_build_object('licencias_vencidas', v_expired, 'avisos', v_notices, 'cotizaciones_vencidas', v_quotes);
end $$;
revoke all on function public.run_scheduled_jobs() from public, anon, authenticated;
grant execute on function public.run_scheduled_jobs() to service_role;
