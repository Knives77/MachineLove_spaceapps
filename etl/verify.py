"""Validación de los pasos 4 y 5 contra las cifras de control de docs/contracts/acceptance.md.

  uv run python -m etl.verify                 # lee cell_day / calibration_country ya cargadas
  uv run python -m etl.verify --sandbox       # corre 4 y 5 en tablas TEMPORALES y valida (no escribe nada)

El modo --sandbox crea `cell`, `cell_day` y `calibration_country` temporales en la sesión
(sombrean a las oficiales), corre `cells.build` y `calibrate.build` y termina con ROLLBACK.
Sirve para validar contra la base oficial sin cargarla.
"""
from __future__ import annotations

import argparse
import math
import sys
import time
from dataclasses import dataclass
from statistics import median, median_high

import psycopg

from etl import calibrate, cells, config
from etl.reference import OVERLAP_END, OVERLAP_START, load_outages, months_between


@dataclass(frozen=True)
class Box:
    name: str
    country: str
    lat: tuple[float, float]
    lon: tuple[float, float]

    def cells(self) -> tuple[int, int, int, int]:
        """Celdas cuyo centro cae en el recuadro: floor(min·100) .. ceil(max·100) − 1.

        La celda cy cubre [cy/100, (cy+1)/100). Incluir floor(max·100) añadiría una fila y una
        columna de celdas que quedan fuera del recuadro (+4–6 % en Querétaro).
        """
        lo = lambda v: math.floor(round(v * 100, 6))     # noqa: E731
        hi = lambda v: math.ceil(round(v * 100, 6)) - 1  # noqa: E731
        return lo(self.lat[0]), hi(self.lat[1]), lo(self.lon[0]), hi(self.lon[1])


QRO = Box("Recuadro Querétaro", "MX", (20.0, 21.7), (-100.6, -99.0))
SG = Box("Sierra Gorda", "MX", (20.9, 21.7), (-100.6, -99.0))
CHI = Box("Chilecito", "AR", (-29.9, -28.4), (-68.3, -66.8))

# acceptance.md, sección ETL: celdas-día por año. None = no aplica.
#            año   Qro MODIS, S-NPP, N20   SG MODIS, S-NPP   Chi MODIS, S-NPP
CONTROL = {
    2003: ((268, None, None), (117, None), (496, None)),
    2011: ((410, None, None), (167, None), (104, None)),
    2012: ((190, 557, None), (83, 363), (45, 157)),
    2017: ((416, 1486, None), (99, 387), (713, 1637)),
    2019: ((414, 1374, 1409), (154, 563), (64, 218)),
    2024: ((306, 1017, 1033), (120, 332), (416, 840)),
    2025: ((562, 1688, 1702), (115, 389), (78, 289)),
}
# acceptance.md, sección Calibración: (k, loyo_annual_mape), con S-NPP en todo el traslape.
CALIBRATION = {QRO: (0.293, 0.068), SG: (0.262, 0.147), CHI: (0.395, 0.237)}

TOL_COUNT = 0.01   # 1 %
TOL_K = 0.01       # la regla oficial debe mover k menos de 0.01


class Report:
    def __init__(self) -> None:
        self.fails = 0
        self.checks = 0

    def check(self, label: str, got, want, ok: bool) -> None:
        self.checks += 1
        self.fails += not ok
        print(f"  [{'OK ' if ok else 'MAL'}] {label:52} obtenido {got!s:>10}  esperado {want!s:>10}")


def _box_sql(box: Box, alias: str) -> tuple[str, tuple]:
    y0, y1, x0, x1 = box.cells()
    return f"{alias}.cy BETWEEN %s AND %s AND {alias}.cx BETWEEN %s AND %s", (y0, y1, x0, x1)


def yearly_cell_days(cur, box: Box) -> dict[int, dict[str, int]]:
    """Por año: celdas-día de cell_day (modis_veg, viirs_veg) y, directo de detection, S-NPP y N20."""
    w, p = _box_sql(box, "cd")
    cur.execute(
        f"""SELECT extract(year FROM acq_date)::int, count(*) FILTER (WHERE modis_veg),
                   count(*) FILTER (WHERE viirs_veg), sum(raw_points)
            FROM cell_day cd WHERE {w} GROUP BY 1""", p)
    out = {y: {"modis": m, "viirs_ref": v, "raw": r} for y, m, v, r in cur.fetchall()}
    w, p = _box_sql(box, "d")
    cur.execute(
        f"""SELECT y, count(*) FILTER (WHERE snpp), count(*) FILTER (WHERE n20) FROM (
              SELECT extract(year FROM acq_date)::int y,
                     bool_or(satellite = 'SNPP' AND is_veg) snpp, bool_or(satellite = 'N20' AND is_veg) n20
              FROM detection d WHERE {w} AND family = 'VIIRS' GROUP BY cy, cx, acq_date, 1) t GROUP BY 1""", p)
    for y, s, n in cur.fetchall():
        out.setdefault(y, {}).update(snpp=s, n20=n)
    return out


def snpp_only_series(cur, box: Box) -> dict[tuple[int, int], tuple[int, int]]:
    """M(m) y V(m) con S-NPP como VIIRS en todo el traslape, directo de detection (como el control)."""
    w, p = _box_sql(box, "d")
    cur.execute(
        f"""SELECT y, m, count(*) FILTER (WHERE mo), count(*) FILTER (WHERE sn) FROM (
              SELECT extract(year FROM acq_date)::int y, extract(month FROM acq_date)::int m,
                     bool_or(family = 'MODIS' AND is_veg) mo, bool_or(satellite = 'SNPP' AND is_veg) sn
              FROM detection d
              WHERE {w} AND acq_date BETWEEN '2012-02-01' AND '2025-12-31'
              GROUP BY cy, cx, acq_date, 1, 2) t GROUP BY 1, 2""", p)
    return {(y, m): (mo, sn) for y, m, mo, sn in cur.fetchall()}


def close(got: int | None, want: int) -> bool:
    return got is not None and abs(got - want) <= max(3, TOL_COUNT * want)


def verify(conn: psycopg.Connection) -> Report:
    rep = Report()
    with conn.cursor() as cur:
        print("\n== Celdas-día por año (acceptance.md, ETL)")
        data = {b: yearly_cell_days(cur, b) for b in (QRO, SG, CHI)}
        for year, (qro, sg, chi) in CONTROL.items():
            for box, want in ((QRO, qro), (SG, sg), (CHI, chi)):
                row = data[box].get(year, {})
                rep.check(f"{box.name} {year} MODIS (cell_day)", row.get("modis"), want[0], close(row.get("modis"), want[0]))
                if want[1] is not None:
                    # Antes del relevo la referencia es S-NPP: se valida cell_day.viirs_veg.
                    col = "viirs_ref" if year < 2018 else "snpp"
                    src = "cell_day" if year < 2018 else "detection"
                    rep.check(f"{box.name} {year} S-NPP ({src})", row.get(col), want[1], close(row.get(col), want[1]))
                if len(want) > 2 and want[2] is not None:
                    rep.check(f"{box.name} {year} N20 (detection)", row.get("n20"), want[2], close(row.get("n20"), want[2]))
                    # Después del relevo la referencia es N20 salvo días de caída: debe quedar a < 1 %.
                    rep.check(f"{box.name} {year} VIIRS ref (cell_day) ≈ N20", row.get("viirs_ref"), want[2],
                              close(row.get("viirs_ref"), want[2]))

        print("\n== Calibración por recuadro (acceptance.md, Calibración)")
        outages = load_outages(cur)
        all_months = months_between(OVERLAP_START, OVERLAP_END)
        for box, (k_want, loyo_want) in CALIBRATION.items():
            series = snpp_only_series(cur, box)
            snpp = calibrate.calibrate(series, all_months)
            used, excl = calibrate.overlap_months(box.country, outages)
            w, p = _box_sql(box, "c")
            official = calibrate.calibrate(calibrate.monthly_series(cur, w, p), used, len(excl))
            rep.check(f"{box.name} k, S-NPP todo el traslape", round(snpp.k, 3), k_want, abs(snpp.k - k_want) <= 0.003)
            # Las cifras de control se midieron con la mediana ALTA (elemento n/2 de los 14 años
            # ordenados). El contrato y calibration_country usan la mediana estándar: se informan ambas.
            upper = median_high(calibrate.loyo_errors(series, all_months).values())
            rep.check(f"{box.name} LOYO anual S-NPP (mediana alta)", round(upper, 3), loyo_want,
                      abs(upper - loyo_want) <= 0.003)
            print(f"        mediana estándar (contrato): {snpp.loyo_annual_mape:.3f}")
            rep.check(f"{box.name} k regla oficial (excluye {len(excl)} meses)", round(official.k, 3), k_want,
                      abs(official.k - k_want) < TOL_K)
            print(f"        oficial: LOYO anual {official.loyo_annual_mape:.3f} (máx {official.loyo_annual_max:.3f}), "
                  f"error mensual {official.monthly_mape:.3f}, M={official.modis_cell_days} V={official.viirs_cell_days}")

        print("\n== Adelanto de la sección API (con datos del ETL)")
        sg = data[SG]
        r19, r11 = sg[2019]["raw"], sg[2011]["raw"]
        rep.check("Sierra Gorda raw_points 2019 / 2011 > 5", round(r19 / r11, 2), "> 5", r19 / r11 > 5)
        m19, m11 = sg[2019]["modis"], sg[2011]["modis"]
        rep.check("Sierra Gorda armonizado 2019 / 2011 < 1.5", round(m19 / m11, 2), "< 1.5", m19 / m11 < 1.5)
        used, _ = calibrate.overlap_months("MX", outages)
        w, p = _box_sql(SG, "c")
        series = calibrate.monthly_series(cur, w, p)
        k = calibrate.calibrate(series, used).k
        diffs = {}
        for y in range(2012, 2026):
            my = sum(series.get((y, m), (0, 0))[0] for m in range(1, 13))
            vy = sum(series.get((y, m), (0, 0))[1] for m in range(1, 13) if (y, m) >= (2012, 2))
            pre = sum(series.get((y, m), (0, 0))[0] for m in range(1, 13) if (y, m) < (2012, 2))
            diffs[y] = abs(k * vy + pre - my) / my if my else 0
        worst = max(diffs, key=diffs.get)
        rep.check(f"viirs_primary vs modis_primary, máx anual < 45 % ({worst})", f"{diffs[worst]:.1%}", "< 45%",
                  diffs[worst] < 0.45)
        diffs = list(diffs.values())
        rep.check("viirs_primary vs modis_primary, mediana < 20 %", f"{median(diffs):.1%}", "< 20%", median(diffs) < 0.20)

        print("\n== Tablas")
        cur.execute("SELECT count(*), count(*) FILTER (WHERE modis_veg), count(*) FILTER (WHERE viirs_veg) FROM cell_day")
        n, m, v = cur.fetchone()
        print(f"  cell_day {n:,} filas · modis_veg {m:,} · viirs_veg {v:,}")
        cur.execute("SELECT country, count(*) FROM cell GROUP BY 1 ORDER BY 1")
        print("  cell", dict(cur.fetchall()))
        cur.execute("SELECT country, round(k::numeric, 4), overlap_months, modis_cell_days, viirs_cell_days, "
                    "round(loyo_annual_mape::numeric, 3) FROM calibration_country ORDER BY 1")
        for row in cur.fetchall():
            print("  calibration_country", row)
    return rep


def sandbox(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        for t in ("cell", "cell_day", "calibration_country"):
            cur.execute(f"CREATE TEMP TABLE {t} (LIKE public.{t} INCLUDING ALL)")
            cur.execute("SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                        "WHERE c.oid = %s::regclass", (t,))
            schema = cur.fetchone()[0]
            if not schema.startswith("pg_temp"):
                raise SystemExit(f"'{t}' resuelve a {schema}, no a una tabla temporal. Abortando.")
    print("Sandbox: cell, cell_day y calibration_country son temporales en esta sesión.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Valida los pasos 4 y 5 contra acceptance.md")
    ap.add_argument("--sandbox", action="store_true", help="corre 4 y 5 en tablas temporales y no escribe nada")
    ap.add_argument("--dsn", default=config.DATABASE_URL)
    args = ap.parse_args()
    t0 = time.time()
    with psycopg.connect(args.dsn) as conn:
        if args.sandbox:
            sandbox(conn)
            print("== Paso 4 (sandbox)")
            cells.build(conn)
            print("== Paso 5 (sandbox)")
            calibrate.build(conn)
        rep = verify(conn)
        conn.rollback()
    print(f"\n{rep.checks - rep.fails}/{rep.checks} comprobaciones OK en {time.time() - t0:.0f} s")
    sys.exit(1 if rep.fails else 0)


if __name__ == "__main__":
    main()
