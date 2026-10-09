#!/usr/bin/env bash
# Copia de seguridad lógica de los DATOS (public, auth y metadatos de storage).
# El esquema se reconstruye con las migraciones del repositorio (supabase/migrations).
# Complementa las copias automáticas de Supabase; guarde estas copias cifradas fuera del proveedor.
# Uso: SUPABASE_DB_URL=postgresql://... ./scripts/backup.sh [carpeta]
set -euo pipefail
: "${SUPABASE_DB_URL:?Defina SUPABASE_DB_URL (conexión directa o pooler en modo sesión)}"
OUT=${1:-backups}
mkdir -p "$OUT"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$OUT/maj-data-$STAMP.sql"
pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --exclude-table='auth.schema_migrations' --exclude-table='storage.migrations' \
  --exclude-table='auth.audit_log_entries' --exclude-table='auth.flow_state' \
  --file="$FILE"
gzip -9 "$FILE"
sha256sum "$FILE.gz" > "$FILE.gz.sha256"
echo "Copia creada: $FILE.gz"
echo "Los archivos de Storage (fotos y documentos) se respaldan aparte: ver docs/DESPLIEGUE.md."
