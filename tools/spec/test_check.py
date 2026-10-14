#!/usr/bin/env python3
"""Pruebas de mutación de tools/spec/check.py. Sin dependencias.

Uso, desde la raíz del repo:

    python3 tools/spec/test_check.py

Cada prueba copia docs/spec/, la v14 y check.py a un directorio temporal,
rompe una cosa a propósito y comprueba que check.py sale con 1 y nombra el
error. La primera prueba exige que la spec real pase limpia.
"""
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class CheckMutations(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="spec-check-"))
        shutil.copytree(ROOT / "docs" / "spec", self.tmp / "docs" / "spec")
        (self.tmp / "docs" / "fuente").mkdir(parents=True)
        shutil.copy(ROOT / "docs" / "fuente" / "v14-maestro.md",
                    self.tmp / "docs" / "fuente" / "v14-maestro.md")
        (self.tmp / "tools" / "spec").mkdir(parents=True)
        shutil.copy(ROOT / "tools" / "spec" / "check.py",
                    self.tmp / "tools" / "spec" / "check.py")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_check(self):
        p = subprocess.run([sys.executable, str(self.tmp / "tools" / "spec" / "check.py")],
                           capture_output=True, text=True)
        return p.returncode, p.stdout

    def edit(self, name, fn):
        path = self.tmp / "docs" / "spec" / name
        text = path.read_text(encoding="utf-8")
        new = fn(text)
        self.assertNotEqual(text, new, "la mutación no cambió nada")
        path.write_text(new, encoding="utf-8")

    def assertFails(self, needle):
        code, out = self.run_check()
        self.assertEqual(code, 1, out)
        self.assertIn(needle, out)

    def first_def_line(self, name):
        text = (self.tmp / "docs" / "spec" / name).read_text(encoding="utf-8")
        return next(l for l in text.splitlines() if l.startswith("- **REQ-"))

    # --- la spec real ---------------------------------------------------
    def test_real_spec_passes(self):
        code, out = self.run_check()
        self.assertEqual(code, 0, out)
        self.assertRegex(out, r"\d+ requisitos, 0 duplicados, centinelas 11/11")

    # --- mutaciones -----------------------------------------------------
    def test_duplicate_definition(self):
        line = self.first_def_line("02-entrada-y-landing.md")
        self.edit("02-entrada-y-landing.md", lambda t: t + "\n" + line + "\n")
        self.assertFails("ya estaba definido")

    def test_row_missing_in_09(self):
        self.edit("09-requisitos.md",
                  lambda t: re.sub(r"^\| REQ-MUN-007 \|.*\n", "", t, flags=re.M))
        self.assertFails("REQ-MUN-007 no aparece en 09-requisitos.md")

    def test_row_twice_in_09(self):
        def dup(t):
            row = re.search(r"^\| REQ-COM-003 \|.*$", t, flags=re.M).group(0)
            return t.replace(row, row + "\n" + row)
        self.edit("09-requisitos.md", dup)
        self.assertFails("aparece más de una vez en 09")

    def test_scope_mismatch(self):
        self.edit("09-requisitos.md",
                  lambda t: re.sub(r"^(\| REQ-ARQ-001 \|[^|]*\|[^|]*\|) L1 \|",
                                   r"\1 L2 |", t, flags=re.M))
        self.assertFails("alcance de REQ-ARQ-001 distinto")

    def test_invalid_scope(self):
        self.edit("04-aventura.md",
                  lambda t: t.replace("**REQ-AVE-001** `L1`", "**REQ-AVE-001** `L3`", 1))
        self.assertFails("no L1, L2 ni diferido")

    def test_source_mismatch(self):
        self.edit("09-requisitos.md",
                  lambda t: re.sub(r"^(\| REQ-IDE-014 \|[^|]*\|)[^|]*\|",
                                   r"\1 §99 |", t, flags=re.M))
        self.assertFails("fuente de REQ-IDE-014 distinta")

    def test_missing_source(self):
        self.edit("06-comercial.md",
                  lambda t: re.sub(r"(\*\*REQ-COM-001\*\*.*?) \*Fuente: [^*]+\*",
                                   r"\1", t, count=1))
        self.assertFails("definición mal formada")

    def test_empty_criterion(self):
        self.edit("09-requisitos.md",
                  lambda t: re.sub(r"^(\| REQ-ADM-002 \|[^|]*\|[^|]*\|[^|]*\|)[^|]*\|",
                                   r"\1  |", t, flags=re.M))
        self.assertFails("REQ-ADM-002 sin criterio verificable")

    def test_marker_missing_in_notes(self):
        self.edit("09-requisitos.md",
                  lambda t: re.sub(r"^(\| REQ-AVE-030 \|.*)\[provisional\]",
                                   r"\1", t, flags=re.M))
        self.assertFails("las marcas de REQ-AVE-030")

    def test_wrong_area_file(self):
        line = self.first_def_line("03-mundo-y-motor.md")
        self.edit("03-mundo-y-motor.md", lambda t: t.replace(line + "\n", ""))
        self.edit("04-aventura.md", lambda t: t + "\n" + line + "\n")
        self.assertFails("debe definirse en el archivo 03-*.md")

    def test_dangling_reference(self):
        self.edit("01-producto-y-flujos.md", lambda t: t + "\nVer REQ-ENT-999.\n")
        self.assertFails("referencia a REQ-ENT-999")

    def test_alias_twice(self):
        self.edit("02-entrada-y-landing.md",
                  lambda t: t.replace("*Fuente: §4.4 · alias ENT 02*",
                                      "*Fuente: §4.4 · alias ENT 02 · alias MAP 01*", 1))
        self.assertFails("el alias MAP 01 debe estar en exactamente un REQ")

    def test_missing_sentinel(self):
        self.edit("06-comercial.md", lambda t: t.replace("Wet Kisses", "Wet K."))
        self.assertFails("centinela ausente en 06-comercial.md: «Wet Kisses»")

    def test_question_altered(self):
        self.edit("05-identidad-y-comunidad.md",
                  lambda t: t.replace("una buena fiesta necesita siempre…",
                                      "una buena fiesta necesita siempre..."))
        self.assertFails("centinela ausente")

    def test_extra_file(self):
        (self.tmp / "docs" / "spec" / "12-extra.md").write_text("# extra\n", encoding="utf-8")
        self.assertFails("sobran archivos en docs/spec/: 12-extra.md")

    def test_missing_file(self):
        (self.tmp / "docs" / "spec" / "11-glosario.md").unlink()
        self.assertFails("faltan archivos en docs/spec/: 11-glosario.md")

    def test_example_in_code_fence_is_ignored(self):
        line = self.first_def_line("02-entrada-y-landing.md")
        self.edit("00-indice.md", lambda t: t + "\n```\n" + line + "\n```\n")
        code, out = self.run_check()
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main(verbosity=1)
