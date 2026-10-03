#!/usr/bin/env python3
"""Estado por requisito (REQ-PRO-017, T49): comprueba docs/spec/estado.md.

Python del sistema, sin dependencias. Uso, desde la raíz del repo:

    python3 tools/spec/estado.py              # comprueba y cuenta
    python3 tools/spec/estado.py --generar [--mapa MAPA.tsv] [--forzar]

docs/spec/estado.md tiene una fila por REQ de 09-requisitos.md con su estado:

  HECHO    construido y con una prueba automática que lo comprueba;
  PARCIAL  construido en parte, o construido sin prueba que lo compruebe;
  FALTA    sin construir, o sin evidencia todavía (revisión, medición…);
  L2       alcance L2 en 09 y sin construir;
  final    aplazado a la versión final (D-20: Supabase, correo, TOTP, editor
           visual, ticketera real…) o alcance «diferido»;
  retirado sin objeto por una decisión posterior, que la nota cita (D-NN);
           no se construye (plan 007 T85: REQ-ENT-028 por D-26).

La comprobación (exit 0 si todo está bien, 1 si no):
  - cada REQ de 09 aparece una sola vez, con el mismo alcance, y no sobra
    ninguno;
  - el estado es uno de los seis; L2 sólo si el alcance es L2; un retirado
    cita en su nota la decisión que lo retira;
  - toda evidencia enlazada existe; un HECHO enlaza al menos una prueba
    (`*.spec.ts`, `*.test.ts(x)`, `test_*.py`) que nombra el REQ o que
    contiene el título «…» escrito tras el enlace. Así ningún REQ se marca
    hecho sin una prueba real (REQ-PRO-017).
Imprime el conteo por estado y por área.

`--generar` escribe una primera versión: HECHO si una prueba nombra el REQ o
si el mapa (ID, estado test|parcial|nada, archivo, título; separado por
tabuladores) da una prueba cuyo título existe; PARCIAL si el código lo nombra
o el mapa lo da por construido; `final` para la lista FINAL de abajo; FALTA
el resto. Después el archivo se mantiene a mano.
"""
import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "docs" / "spec"
REQS = SPEC / "09-requisitos.md"
ESTADO = SPEC / "estado.md"

STATES = ("HECHO", "PARCIAL", "FALTA", "L2", "final", "retirado")
DECISION = re.compile(r"\bD-\d{2}\b")
TEST_FILE = re.compile(r"(\.spec\.ts|\.test\.tsx?|(^|/)test_[^/]*\.py)$")
LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)(?:\s*«([^»]+)»)?")
SKIP_DIRS = {"node_modules", ".next", "out", ".git", "__pycache__"}

# Aplazado a la versión final por D-20 (inventario v14 §4): Supabase, acceso
# por correo y fusión, login del Admin con TOTP y roles, editor visual,
# ticketera real con webhook, validación de recompensas en servidor, dominio y
# cuentas de BOIA, copias y restauración.
FINAL = {
    "REQ-PRO-021": "Cuentas de producción de BOIA (D-04, D-20)",
    "REQ-IDE-002": "Acceso por correo (D-20)",
    "REQ-IDE-003": "Acceso por correo (D-20)",
    "REQ-IDE-005": "Identidad de servidor (D-20)",
    "REQ-IDE-006": "Fusión del invitado (D-20)",
    "REQ-IDE-039": "Validación en servidor (D-20)",
    "REQ-COM-018": "Ticketera real (D-20)",
    "REQ-COM-019": "Ticketera real con webhook (D-20)",
    "REQ-ADM-003": "Login del Admin (D-20)",
    "REQ-ADM-006": "RLS en Supabase (D-20)",
    "REQ-ADM-009": "Editor visual (D-20)",
    "REQ-ARQ-002": "Supabase (D-20)",
    "REQ-ARQ-010": "Recompensas validadas en servidor (D-20)",
    "REQ-ARQ-011": "Identidad pública en servidor (D-20)",
    "REQ-ARQ-013": "Copias en servidor (D-20)",
    "REQ-ARQ-022": "Producción y dominio de BOIA (D-20)",
    "REQ-ARQ-023": "Copias y restauración (D-20)",
}
HUMAN = re.compile(r"^(Revisión|Medición|Registro|Aprobación|Informe|Lista|Inventario|Plano|Documento)|físic", re.I)


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split(" | ")]


def read_reqs():
    """ID -> (título, alcance, criterio), en el orden de 09."""
    reqs = {}
    for line in REQS.read_text(encoding="utf8").splitlines():
        if line.startswith("| REQ-"):
            c = cells(line)
            reqs[c[0]] = (c[1], c[3], c[4])
    return reqs


def walk(roots=("apps", "packages", "tools")):
    for r in roots:
        for dp, dn, fn in os.walk(ROOT / r):
            dn[:] = [d for d in dn if d not in SKIP_DIRS]
            for f in fn:
                if f.endswith((".ts", ".tsx", ".py", ".mjs")):
                    yield Path(dp) / f


def rel(p):
    return p.relative_to(ROOT).as_posix()


def link(path, title=None):
    name = path.rsplit("/", 1)[-1]
    target = path.replace("(", "%28").replace(")", "%29")
    out = f"[{name}](../../{target})"
    return out + (f" «{title}»" if title else "")


def check():
    reqs = read_reqs()
    errors = []
    seen = Counter()
    states = Counter()
    by_area = {}
    if not ESTADO.exists():
        print(f"estado: falta {ESTADO.relative_to(ROOT)}")
        return 1
    for n, line in enumerate(ESTADO.read_text(encoding="utf8").splitlines(), 1):
        if not line.startswith("| REQ-"):
            continue
        c = cells(line)
        if len(c) != 6:
            errors.append(f"línea {n}: {len(c)} columnas, se esperan 6")
            continue
        rid, _title, scope, state, evidence, note = c
        seen[rid] += 1
        if rid not in reqs:
            errors.append(f"{rid}: no está en 09-requisitos.md")
            continue
        if scope != reqs[rid][1]:
            errors.append(f"{rid}: alcance «{scope}», en 09 es «{reqs[rid][1]}»")
        if state not in STATES:
            errors.append(f"{rid}: estado «{state}» no es uno de {', '.join(STATES)}")
            continue
        if state == "L2" and reqs[rid][1] != "L2":
            errors.append(f"{rid}: L2 sólo para alcance L2")
        if state == "retirado" and not DECISION.search(note):
            errors.append(f"{rid}: retirado sin citar en la nota la decisión (D-NN) que lo retira")
        tests = 0
        for m in LINK.finditer(evidence):
            target = (ESTADO.parent / unquote(m.group(1))).resolve()
            if not target.exists():
                errors.append(f"{rid}: la evidencia {m.group(1)} no existe")
                continue
            if TEST_FILE.search(target.as_posix()):
                text = target.read_text(encoding="utf8")
                title = m.group(2)
                if (title and title in text) or (not title and rid in text):
                    tests += 1
                elif title:
                    errors.append(f"{rid}: «{title}» no está en {m.group(1)}")
        if state == "HECHO" and not tests:
            errors.append(f"{rid}: HECHO sin una prueba que lo nombre o con su título")
        states[state] += 1
        area = rid.split("-")[1]
        by_area.setdefault(area, Counter())[state] += 1
    for rid in reqs:
        if seen[rid] == 0:
            errors.append(f"{rid}: falta en estado.md")
        elif seen[rid] > 1:
            errors.append(f"{rid}: aparece {seen[rid]} veces")
    total = sum(states.values())
    print(f"estado.md: {total} REQ · " + " · ".join(f"{s} {states[s]}" for s in STATES))
    for area, cnt in by_area.items():
        print(f"  {area}: " + " · ".join(f"{s} {cnt[s]}" for s in STATES if cnt[s]))
    for e in errors[:60]:
        print("ERROR", e)
    if errors:
        print(f"{len(errors)} errores")
        return 1
    return 0


def generate(mapa, force):
    if ESTADO.exists() and not force:
        print("estado.md ya existe: se mantiene a mano (--forzar para rehacerlo)")
        return 1
    reqs = read_reqs()
    named_tests, named_code = {}, {}
    for p in walk():
        text = p.read_text(encoding="utf8", errors="ignore")
        ids = set(re.findall(r"REQ-[A-Z]{3}-\d{3}", text))
        target = named_tests if TEST_FILE.search(p.as_posix()) else named_code
        for rid in ids:
            target.setdefault(rid, []).append(rel(p))
    mapped = {}
    if mapa:
        for line in Path(mapa).read_text(encoding="utf8").splitlines():
            parts = line.split("\t")
            if len(parts) == 4 and parts[0].startswith("REQ-"):
                mapped[parts[0].strip()] = [x.strip() for x in parts[1:]]
    rows = []
    for rid, (title, scope, crit) in reqs.items():
        state, evidence, note = "FALTA", "—", ""
        tests = sorted(named_tests.get(rid, []), key=lambda f: (not f.endswith(".spec.ts"), f))
        m = mapped.get(rid)
        if tests:
            state, evidence = "HECHO", "; ".join(link(f) for f in tests[:2])
        elif m and m[0] == "test" and (ROOT / m[1]).exists() and m[2] in (ROOT / m[1]).read_text(encoding="utf8"):
            state, evidence = "HECHO", link(m[1], m[2])
        elif scope == "diferido":
            state, note = "final", "Alcance diferido"
        elif rid in FINAL:
            state, note = "final", FINAL[rid]
        elif scope == "L2":
            state = "L2"
        elif named_code.get(rid):
            state, evidence = "PARCIAL", link(sorted(named_code[rid])[0])
            note = "Construido; sin prueba que lo nombre"
        elif m and m[0] in ("parcial", "test") and m[1] != "-" and (ROOT / m[1]).exists():
            state, evidence = "PARCIAL", link(m[1])
            note = (
                "Una prueba lo cubre en parte"
                if TEST_FILE.search(m[1])
                else "Construido; sin prueba que lo nombre"
            )
        if state in ("FALTA", "PARCIAL") and HUMAN.search(crit):
            note = (note + "; " if note else "") + "pide revisión, medición o documento"
        rows.append(f"| {rid} | {title} | {scope} | {state} | {evidence} | {note or '—'} |")
    body = "\n".join(rows)
    ESTADO.write_text(
        f"""# Estado por requisito

Una fila por REQ de [09-requisitos](09-requisitos.md) con su estado y la
evidencia que lo sostiene (REQ-PRO-017). `python3 tools/spec/estado.py`
comprueba este archivo y cuenta por estado; corre con `pnpm test`.

| Estado | Qué quiere decir |
|---|---|
| HECHO | Construido y con una prueba automática que lo comprueba (enlazada; la prueba nombra el REQ o se cita su título «…») |
| PARCIAL | Construido en parte, o construido sin una prueba que lo compruebe |
| FALTA | Sin construir, o sin la evidencia que pide su criterio (revisión, medición en móvil, documento) |
| L2 | Alcance L2 en 09 y sin construir |
| final | Aplazado a la versión final (D-20: Supabase, correo, TOTP, editor visual, ticketera real) o alcance diferido |
| retirado | Sin objeto por una decisión posterior, que la nota cita (D-NN); no se construye |

Primera versión generada el 2026-09-30 (T49) con `--generar`: pruebas que
nombran el REQ, un repaso de las pruebas que lo cubren sin nombrarlo y el
código que lo nombra. Desde aquí se mantiene a mano: al terminar un encargo,
sube de estado lo que haya cerrado y enlaza su prueba.

<!-- estado:tabla -->
| ID | Requisito | Alcance | Estado | Evidencia | Nota |
|---|---|---|---|---|---|
{body}
""",
        encoding="utf8",
    )
    print(f"estado.md: {len(rows)} filas")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--generar", action="store_true")
    ap.add_argument("--mapa")
    ap.add_argument("--forzar", action="store_true")
    a = ap.parse_args()
    if a.generar:
        rc = generate(a.mapa, a.forzar)
        if rc:
            return rc
    return check()


if __name__ == "__main__":
    sys.exit(main())
