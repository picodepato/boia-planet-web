#!/usr/bin/env python3
"""Pruebas de la cobertura de la spec (REQ-PRO-015). Sin dependencias.

    python3 tools/spec/test_cobertura.py

La tabla «Lo que debe sobrevivir» de 01 no tiene filas sin REQ, y cada REQ que
cita existe en 09; el apéndice de desviaciones de 00 existe y tiene filas.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "docs" / "spec"
REQS = SPEC / "09-requisitos.md"
PRODUCTO = SPEC / "01-producto-y-flujos.md"
INDICE = SPEC / "00-indice.md"

REQ_ID = re.compile(r"REQ-[A-Z]+-\d{3}")


def tabla_cobertura():
    """Filas de la tabla bajo «Lo que debe sobrevivir» (sin cabecera ni separador)."""
    lines = PRODUCTO.read_text(encoding="utf8").splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith("## Lo que debe sobrevivir"))
    rows = []
    for line in lines[start + 1 :]:
        if line.startswith("## "):
            break
        if line.startswith("|") and not line.startswith("|---") and not line.startswith("| Punto"):
            rows.append(line)
    return rows


def apendice_desviaciones():
    """Líneas del apéndice «desviaciones respecto a la v14» de 00."""
    lines = INDICE.read_text(encoding="utf8").splitlines()
    start = next(
        (i for i, l in enumerate(lines) if l.startswith("## Apéndice: desviaciones")), None
    )
    if start is None:
        return None
    body = []
    for line in lines[start + 1 :]:
        if line.startswith("## "):
            break
        body.append(line)
    return body


class CoberturaTest(unittest.TestCase):
    def test_REQ_PRO_015_tabla_de_cobertura_sin_filas_sin_REQ(self):
        rows = tabla_cobertura()
        self.assertGreater(len(rows), 0, "la tabla de cobertura de 01 está vacía")
        existentes = set(REQ_ID.findall(REQS.read_text(encoding="utf8")))
        for row in rows:
            cells = [c.strip() for c in row.strip("|").split("|")]
            self.assertEqual(len(cells), 2, f"fila mal formada: {row}")
            ids = REQ_ID.findall(cells[1])
            self.assertTrue(ids, f"fila sin REQ: {row}")
            for rid in ids:
                self.assertIn(rid, existentes, f"{rid} no está en 09-requisitos.md")

    def test_REQ_PRO_015_desviaciones_listadas_en_00(self):
        body = apendice_desviaciones()
        self.assertIsNotNone(body, "falta el apéndice de desviaciones en 00-indice.md")
        filas = [l for l in body if l.startswith("|") and not l.startswith("|---")]
        self.assertGreater(len(filas), 1, "el apéndice de desviaciones no tiene filas")


if __name__ == "__main__":
    unittest.main()
