#!/usr/bin/env bash
# Copia el código (sin dependencias ni compilados) a la carpeta compartida del proyecto.
set -euo pipefail
DEST=/mnt/project-files/maj-realty
mkdir -p "$DEST"
git ls-files -co --exclude-standard | tar -cf - -T - | (cd "$DEST" && tar -xf -)
git bundle create "$DEST/../maj-realty.bundle" --all >/dev/null 2>&1 || true
