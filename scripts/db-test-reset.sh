#!/usr/bin/env bash
# Recrea una base local con la simulación de Supabase y aplica todas las migraciones.
set -euo pipefail
PGHOST=${PGHOST:-/tmp}; PGPORT=${PGPORT:-54329}; DB=${TEST_DB:-maj_test}
export PGHOST PGPORT PGUSER=postgres
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f" || { echo "Falló $f"; exit 1; }
done
echo "Migraciones aplicadas en $DB"
