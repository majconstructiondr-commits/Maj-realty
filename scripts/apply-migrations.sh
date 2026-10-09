#!/usr/bin/env bash
# Aplica en orden las migraciones de supabase/migrations que aún no se hayan aplicado.
# Registra cada una en supabase_migrations.schema_migrations (la misma tabla que usa la CLI
# de Supabase), así que es seguro ejecutarlo varias veces. Uso:
#   SUPABASE_DB_URL='postgresql://…' ./scripts/apply-migrations.sh
set -euo pipefail
: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL}"
cd "$(dirname "$0")/.."
# Las cadenas que crea la integración de Vercel (POSTGRES_URL_NON_POOLING) traen parámetros
# que psql no acepta (supa=, pgbouncer=). Solo se conserva sslmode.
DB_URL=$(python3 -c 'import os,urllib.parse as u
p=u.urlsplit(os.environ["SUPABASE_DB_URL"])
q=[(k,v) for k,v in u.parse_qsl(p.query) if k=="sslmode"]
print(u.urlunsplit(p._replace(query=u.urlencode(q))))')
PSQL=(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1)
echo "Base de datos destino: $(python3 -c 'import sys,urllib.parse as u;p=u.urlsplit(sys.argv[1]);print((p.username or "?")+"@"+(p.hostname or "?"))' "$DB_URL")"

"${PSQL[@]}" -c "create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"

applied=0
for f in supabase/migrations/*.sql; do
  base=$(basename "$f" .sql)
  version=${base%%_*}
  name=${base#*_}
  if [ "$("${PSQL[@]}" -tA -c "select 1 from supabase_migrations.schema_migrations where version = '$version'")" = "1" ]; then
    echo "Ya aplicada: $base"
    continue
  fi
  echo "Aplicando: $base"
  # Cada migración y su registro van en una sola transacción: si falla, no queda a medias.
  "${PSQL[@]}" -1 -f "$f" -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
  applied=$((applied + 1))
done
echo "Listo: $applied migración(es) nueva(s)."
