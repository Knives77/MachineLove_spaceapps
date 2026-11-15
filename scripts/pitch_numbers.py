"""Cifras del pitch sacadas de la API real (las mismas que ve el jurado en pantalla).

Uso (con la API en 8000, directo o por túnel):
    python3 scripts/pitch_numbers.py                 # los 3 presets
    python3 scripts/pitch_numbers.py qro-bajio       # uno solo
    API_URL=http://localhost:8000/api/v1 python3 scripts/pitch_numbers.py

Solo usa la biblioteca estándar de Python: no necesita uv ni dependencias.
"""
from __future__ import annotations

import json
import os
import statistics
import sys
import time
import urllib.request
from decimal import ROUND_HALF_UP, Decimal

API = os.environ.get("API_URL", "http://localhost:8000/api/v1").rstrip("/")
PRESETS = ["qro-sierra-gorda", "qro-bajio", "qro-recuadro"]
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
ORDEN = {"below": 0, "normal": 1, "above": 2, "critical": 3}


def post(path: str, body: dict) -> tuple[dict, float]:
    req = urllib.request.Request(
        API + path, data=json.dumps(body).encode(), headers={"content-type": "application/json"}
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    return data, time.perf_counter() - t0


def pct(x: float | None) -> str:
    return "—" if x is None else f"{x:.1%}"


def como_en_pantalla(x: float, decimales: int = 3) -> str:
    """Redondea como el front (Intl/toLocaleString: valor decimal tal como llega, mitades hacia arriba).

    La API manda k con 4 decimales (p. ej. 0.3035). `f"{x:.3f}"` redondea el binario 0.30349999… → 0.303,
    pero la pantalla muestra 0.304: el guion tiene que decir lo mismo que ve el jurado.
    """
    return str(Decimal(repr(x)).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP))


def mes(m: dict) -> str:
    return f"{MESES[m['month'] - 1]}-{m['year']}"


def report(preset: str) -> None:
    cal, secs = post("/calendar", {"aoi": {"preset_id": preset}})
    viirs, _ = post("/calendar", {"aoi": {"preset_id": preset}, "basis": "viirs_primary"})
    c = cal["calibration"]
    years = {y["year"]: y for y in cal["years"]}
    vyears = {y["year"]: y for y in viirs["years"]}

    print(f"\n=== {preset}  ({cal['aoi']['area_km2']:,.0f} km², respuesta en {secs:.2f} s)")
    print(f"k = {como_en_pantalla(c['k'])} ({c['scope']}), {c['overlap_months']} meses de traslape")
    print(f"error anual (mediana dejando un año fuera) {pct(c['loyo_annual_mape'])}, "
          f"peor año {pct(c['loyo_annual_max'])}; error mensual {pct(c['monthly_mape'])}")

    r11, r19 = years[2011]["raw_points"], years[2019]["raw_points"]
    h11, h19 = years[2011]["harmonized"], years[2019]["harmonized"]
    print(f"salto falso: crudo 2011 → 2019 = {r11:,} → {r19:,} puntos (×{r19 / r11:.1f}); "
          f"armonizado {h11} → {h19} (×{h19 / h11:.2f})")

    pico = max(range(12), key=lambda i: cal["seasonality"][i])
    top3 = sorted(range(12), key=lambda i: -cal["seasonality"][i])[:3]
    print(f"temporada: pico en {MESES[pico]}; {', '.join(MESES[i] for i in sorted(top3))} "
          f"concentran {sum(cal['seasonality'][i] for i in top3):.0%} del fuego")

    con_valor = [m for m in cal["months"] if m["harmonized"] is not None and m["status"] != "no_data"]
    print("5 meses más altos en 26 años:")
    for m in sorted(con_valor, key=lambda m: -m["harmonized"])[:5]:
        ratio = "" if m["anomaly_ratio"] is None else f", {m['anomaly_ratio']}× la mediana"
        print(f"   {mes(m):>9}  {m['harmonized']:>6} celdas-día  {m['status']}{ratio}  fuente {m['source']}")

    anual = sorted(
        (y for y in cal["years"] if y["complete"] and y["harmonized"] is not None),
        key=lambda y: -y["harmonized"],
    )[:3]
    print("3 años completos más altos: " + ", ".join(f"{y['year']} ({y['harmonized']})" for y in anual))

    lat = cal["latest"]
    m_lat = next(m for m in cal["months"] if (m["year"], m["month"]) == (lat["year"], lat["month"]))
    print(f"último mes completo (tarjeta): {mes(m_lat)} = {m_lat['harmonized']}, {m_lat['status']}, "
          f"mediana {m_lat['baseline']['median'] if m_lat['baseline'] else '—'}")
    m2026 = [m for m in cal["months"] if m["year"] == 2026 and m["status"] in ORDEN]
    print("2026 por mes: " + ", ".join(f"{MESES[m['month'] - 1]} {m['status']}" for m in m2026))

    diffs = [abs(vyears[y]["harmonized"] - years[y]["harmonized"]) / years[y]["harmonized"]
             for y in range(2012, 2026) if years[y]["harmonized"]]
    vm = {(m["year"], m["month"]): m["status"] for m in viirs["months"]}
    meses_ok = [m for m in cal["months"] if (2012, 2) <= (m["year"], m["month"]) < (2026, 1)
                and m["status"] in ORDEN and vm[(m["year"], m["month"])] in ORDEN]
    iguales = sum(m["status"] == vm[(m["year"], m["month"])] for m in meses_ok)
    cerca = sum(abs(ORDEN[m["status"]] - ORDEN[vm[(m["year"], m["month"])]]) <= 1 for m in meses_ok)
    print(f"sin MODIS (viirs_primary): serie anual cambia {statistics.median(diffs):.0%} en mediana "
          f"(peor año {max(diffs):.0%}); estado mensual igual en {iguales / len(meses_ok):.0%}, "
          f"a un nivel o menos en {cerca / len(meses_ok):.0%}")


def main() -> None:
    for p in sys.argv[1:] or PRESETS:
        report(p)


if __name__ == "__main__":
    main()
