#!/usr/bin/env python3
"""Pruebas de tools/spec/estado.py (REQ-PRO-017). Sin dependencias.

    python3 tools/spec/test_estado.py

Copia docs/spec/, el comprobador y las pruebas que enlaza estado.md a un
directorio temporal, rompe una cosa y comprueba que estado.py sale con 1. La
primera prueba exige que el estado real pase limpio.
"""
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
ESTADO = ROOT / "docs" / "spec" / "estado.md"


class EstadoChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="spec-estado-"))
        shutil.copytree(ROOT / "docs" / "spec", self.tmp / "docs" / "spec")
        (self.tmp / "tools" / "spec").mkdir(parents=True)
        shutil.copy(ROOT / "tools" / "spec" / "estado.py", self.tmp / "tools" / "spec")
        # Las evidencias enlazadas, en su misma ruta.
        for target in set(re.findall(r"\]\(\.\./\.\./([^)]+)\)", ESTADO.read_text("utf8"))):
            src = ROOT / unquote(target)
            dst = self.tmp / unquote(target)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_check(self):
        p = subprocess.run(
            [sys.executable, str(self.tmp / "tools" / "spec" / "estado.py")],
            capture_output=True,
            text=True,
        )
        return p.returncode, p.stdout

    def edit(self, fn):
        f = self.tmp / "docs" / "spec" / "estado.md"
        f.write_text(fn(f.read_text("utf8")), encoding="utf8")

    def assertFails(self, needle):
        code, out = self.run_check()
        self.assertEqual(code, 1, out)
        self.assertIn(needle, out)

    def test_estado_real_pasa(self):
        code, out = self.run_check()
        self.assertEqual(code, 0, out)
        self.assertRegex(
            out, r"HECHO \d+ · PARCIAL \d+ · FALTA \d+ · L2 \d+ · final \d+ · retirado \d+"
        )

    def test_hecho_sin_prueba(self):
        # Una fila FALTA marcada HECHO sin evidencia.
        self.edit(lambda s: re.sub(r"\| FALTA \| — \|", "| HECHO | — |", s, count=1))
        self.assertFails("HECHO sin una prueba")

    def test_titulo_que_no_existe(self):
        self.edit(lambda s: re.sub(r"\) «[^»]+»", ") «un título que no está»", s, count=1))
        self.assertFails("no está en")

    def test_falta_un_req(self):
        self.edit(lambda s: re.sub(r"^\| REQ-PRO-001 .*\n", "", s, count=1, flags=re.M))
        self.assertFails("REQ-PRO-001: falta en estado.md")

    def test_estado_desconocido(self):
        self.edit(lambda s: s.replace("| L1 | HECHO |", "| L1 | LISTO |", 1))
        self.assertFails("no es uno de")

    def test_l2_con_alcance_l1(self):
        self.edit(lambda s: s.replace("| L1 | FALTA |", "| L1 | L2 |", 1))
        self.assertFails("L2 sólo para alcance L2")

    def test_retirado_sin_decision(self):
        # Una fila FALTA marcada retirado con una nota que no cita ninguna D-NN.
        self.edit(
            lambda s: re.sub(r"\| FALTA \| — \| [^|]* \|$", "| retirado | — | ya no hace falta |", s, count=1, flags=re.M)
        )
        self.assertFails("retirado sin citar")

    def test_retirado_con_decision(self):
        self.edit(
            lambda s: re.sub(r"\| FALTA \| — \| [^|]* \|$", "| retirado | — | Sin objeto por D-26 |", s, count=1, flags=re.M)
        )
        code, out = self.run_check()
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
