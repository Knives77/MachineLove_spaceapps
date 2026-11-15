#!/usr/bin/env bash
# Descarga los CSV de FIRMS por país y año a data/historico_pais/. Reanudable: salta lo que ya existe.
# NOAA-21 (viirs-jpss2) no se publica en este formato.
set -uo pipefail
D="${1:-data/historico_pais}"
B=https://firms.modaps.eosdis.nasa.gov/data/country
list() {
  for c in Mexico Argentina; do
    for y in $(seq 2000 2025); do echo "modis $y $c"; done
    for y in $(seq 2012 2025); do echo "viirs-snpp $y $c"; done
    for y in $(seq 2018 2025); do echo "viirs-jpss1 $y $c"; done
  done
}
get() {
  local s=$1 y=$2 c=$3 o="$D/$c/$s/${s}_${y}_${c}.csv"
  mkdir -p "$(dirname "$o")"
  [ -s "$o" ] && { echo "SKIP $o"; return; }
  if curl -sf -m 900 --retry 3 -o "$o.part" "$B/$s/$y/${s}_${y}_${c}.csv"; then
    mv "$o.part" "$o"; echo "OK   $o"
  else
    rm -f "$o.part"; echo "FAIL $s $y $c"
  fi
}
export -f get; export D B
list | xargs -P 4 -L 1 bash -c 'get "$@"' _

