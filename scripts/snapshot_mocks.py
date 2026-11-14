"""Copia las respuestas reales de la API a los mocks del front (web/src/mocks/).

Así el front, sin túnel, ve los mismos datos que con la API real.
Uso (API en 8000): python3 scripts/snapshot_mocks.py
"""
from __future__ import annotations

import json
import os
import time
import urllib.request
from pathlib import Path

API = os.environ.get("API_URL", "http://localhost:8000/api/v1").rstrip("/")
MOCKS = Path(__file__).resolve().parent.parent / "web" / "src" / "mocks"
PRESETS = ["qro-sierra-gorda", "qro-bajio", "qro-recuadro"]


def fetch(path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main() -> None:
    stamp = time.strftime("%d-%b-%Y %H:%M")
    for p in PRESETS:
        out = {"_note": f"Copia de la API real ({stamp}). Para actualizar: python3 scripts/snapshot_mocks.py"}
        out.update(fetch("/calendar", {"aoi": {"preset_id": p}}))
        (MOCKS / f"calendar.demo.{p}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
        print(f"OK {p}")
    (MOCKS / "presets.response.json").write_text(json.dumps(fetch("/presets"), ensure_ascii=False, indent=2))
    print("OK presets")


if __name__ == "__main__":
    main()
