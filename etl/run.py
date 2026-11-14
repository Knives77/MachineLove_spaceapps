"""Punto de entrada del ETL.

  uv run python -m etl.run --all
  uv run python -m etl.run --step 1 --country MX --limit-years 2011,2012,2019

Pasos (ver .claude/skills/etl/SKILL.md). Implementados: 1 a 5.
"""
import argparse

from etl import calibrate, cells, ingest, mask, outages

STEPS = {
    1: ("ingesta -> detection", ingest.run),
    2: ("máscara estática -> static_cell, is_veg NRT", mask.run),
    3: ("caídas de sensor -> sensor_outage", outages.run),
    4: ("celdas-día -> cell, cell_day", cells.run),
    5: ("calibración -> calibration_country", calibrate.run),
}


def main() -> None:
    ap = argparse.ArgumentParser(description="ETL FIRMS MODIS/VIIRS")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--all", action="store_true", help="corre todos los pasos implementados")
    g.add_argument("--step", type=int, choices=sorted(STEPS), help="corre un solo paso")
    ap.add_argument("--country", choices=["MX", "AR"], action="append", help="limita a un país (repetible)")
    ap.add_argument("--limit-years", help="años separados por coma, para pruebas rápidas")
    args = ap.parse_args()

    countries = set(args.country) if args.country else None
    years = {int(y) for y in args.limit_years.split(",")} if args.limit_years else None
    steps = sorted(STEPS) if args.all else [args.step]
    for n in steps:
        name, fn = STEPS[n]
        print(f"== Paso {n}: {name}")
        fn(countries=countries, years=years)


if __name__ == "__main__":
    main()
