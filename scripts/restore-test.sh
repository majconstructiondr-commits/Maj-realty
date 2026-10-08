#!/usr/bin/env bash
# Restaura una copia de datos en una base de PRUEBA (nunca producción):
#   1) la base debe tener el esquema de Supabase (proyecto nuevo, o la simulación local)
#   2) se aplican las migraciones del repositorio
#   3) se vacía la configuración inicial y se cargan los datos sin disparadores
#   4) se verifican conteos y que las políticas existen
# Uso: RESTORE_DB_URL=postgresql://... ./scripts/restore-test.sh backups/maj-data-XXXX.sql.gz [--skip-migrations]
set -euo pipefail
FILE=${1:?Indique el archivo .sql.gz}
: "${RESTORE_DB_URL:?Defina RESTORE_DB_URL (base de pruebas)}"
sha256sum -c "$FILE.sha256"
if [[ "${2:-}" != "--skip-migrations" ]]; then
  for f in supabase/migrations/*.sql; do psql "$RESTORE_DB_URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
fi
{
  echo "set session_replication_role = replica;"
  echo "truncate public.site_settings, public.plans, public.legal_services, public.audit_log cascade;"
  echo "delete from storage.buckets;"
  gunzip -c "$FILE"
} | psql "$RESTORE_DB_URL" -q --single-transaction -v ON_ERROR_STOP=1 >/dev/null
psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -c "select
  (select count(*) from auth.users) usuarios,
  (select count(*) from public.properties) inmuebles,
  (select count(*) from public.service_requests) solicitudes,
  (select count(*) from public.licenses) licencias,
  (select count(*) from public.site_settings) configuracion,
  (select count(*) from pg_policies where schemaname in ('public','storage')) politicas"
echo "Restauración verificada."
