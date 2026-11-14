"""Configuración compartida del ETL. Todo sale de variables de entorno con valores por defecto locales."""
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://firms:firms_local@127.0.0.1:5432/firms")
DATA_DIR = Path(os.environ.get("FIRMS_DATA_DIR", REPO_ROOT / "data"))

COUNTRIES = {"Mexico": "MX", "Argentina": "AR"}

# Fuente A (por país y año) cubre hasta esta fecha; las solicitudes (B y C) aportan lo posterior.
COUNTRY_FILES_END = "2025-12-31"
REQUESTS_START = "2026-01-01"
