#!/usr/bin/env bash
# Descarga las 8 solicitudes de FIRMS (MX 2024-01-01 → 2026-11-01 y AR 2026-01-01 → 2026-11-14)
# publicadas como release de GitHub, comprueba su SHA-256 y las descomprime donde las busca el ETL:
#   data/<carpeta>/<DL_FIRE_...>/fire_archive_*.csv y fire_nrt_*.csv
#
# Uso:   scripts/download_requests.sh            # MX y AR
#        scripts/download_requests.sh MX         # solo México (MVP)
# El histórico 2000–2025 por país se baja aparte con scripts/download_history.sh.
set -euo pipefail

REPO="Knives77/MachineLove_spaceapps"
TAG="${FIRMS_RELEASE_TAG:-datos-2026-11-14}"
BASE="https://github.com/$REPO/releases/download/$TAG"
DATA="${FIRMS_DATA_DIR:-data}"
ONLY="${1:-}"

# zip|país|carpeta destino
FILES=(
  "DL_FIRE_M-C61_844352.zip|MX|México-Querétaro"
  "DL_FIRE_SV-C2_844355.zip|MX|México-Querétaro"
  "DL_FIRE_J1V-C2_844353.zip|MX|México-Querétaro"
  "DL_FIRE_J2V-C2_844354.zip|MX|México-Querétaro"
  "DL_FIRE_M-C61_849410.zip|AR|Argentina"
  "DL_FIRE_SV-C2_849413.zip|AR|Argentina"
  "DL_FIRE_J1V-C2_849411.zip|AR|Argentina"
  "DL_FIRE_J2V-C2_849412.zip|AR|Argentina"
)

command -v unzip >/dev/null || { echo "Falta unzip"; exit 1; }
SUMS=$(mktemp); trap 'rm -f "$SUMS"' EXIT
curl -fsSL --retry 3 -o "$SUMS" "$BASE/SHA256SUMS.txt"

for entry in "${FILES[@]}"; do
  IFS='|' read -r zip country folder <<<"$entry"
  [ -n "$ONLY" ] && [ "$ONLY" != "$country" ] && continue
  dir="$DATA/$folder"; mkdir -p "$dir"
  if [ ! -s "$dir/$zip" ]; then
    echo "Bajando $zip"
    curl -fL --progress-bar --retry 3 -o "$dir/$zip.part" "$BASE/$zip" && mv "$dir/$zip.part" "$dir/$zip"
  fi
  want=$(awk -v f="$zip" '$2 == f {print $1}' "$SUMS")
  got=$(sha256sum "$dir/$zip" | awk '{print $1}')
  [ "$want" = "$got" ] || { echo "SHA-256 no coincide en $zip (borra el archivo y reintenta)"; exit 1; }
  out="$dir/${zip%.zip}"
  id="${zip%.zip}"; id="${id##*_}"
  # Si esos CSV ya existen en cualquier subcarpeta, no se descomprimen otra vez: el ETL los leería dos veces.
  if find "$dir" -mindepth 2 -maxdepth 2 -name "fire_*_${id}.csv" | grep -q .; then
    echo "OK   $zip (sus CSV ya están en $dir)"
  else
    unzip -oq "$dir/$zip" -d "$out" && echo "OK   $zip → $out"
  fi
done

echo "Listo. Siguiente: uv run python -m etl.run --step 1"
