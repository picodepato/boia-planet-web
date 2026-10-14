#!/usr/bin/env python3
"""Comprobación de coherencia de docs/spec/ (encargo 02).

Python del sistema, sin dependencias. Uso, desde la raíz del repo:

    python3 tools/spec/check.py

Comprueba:
  - que docs/spec/ tiene exactamente los 12 archivos previstos (más
    estado.md, el estado por REQ que comprueba tools/spec/estado.py);
  - que cada definición de REQ en 01..08 está bien formada, en el archivo de su
    área y con alcance L1, L2 o diferido, y que ningún ID se define dos veces;
  - que cada REQ definido aparece exactamente una vez en 09-requisitos.md, con
    la misma fuente y el mismo alcance, texto, criterio y las mismas marcas;
  - que no hay filas en 09 sin definición ni referencias a REQ inexistentes;
  - que los alias ENT 01..06, MAP 01 y ART 01 están cada uno en un solo REQ;
  - que las cadenas centinela existen en el archivo de su requisito (y las
    preguntas, también en la v14).

Imprime el conteo por área, por alcance y por marca. Sale con 0 si todo está
bien y con 1 si hay algún error.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "docs" / "spec"
V14 = ROOT / "docs" / "fuente" / "v14-maestro.md"

EXPECTED_FILES = [
    "00-indice.md",
    "01-producto-y-flujos.md",
    "02-entrada-y-landing.md",
    "03-mundo-y-motor.md",
    "04-aventura.md",
    "05-identidad-y-comunidad.md",
    "06-comercial.md",
    "07-admin.md",
    "08-arquitectura-y-datos.md",
    "09-requisitos.md",
    "10-filosofia.md",
    "11-glosario.md",
]
# Otros archivos permitidos, con su propio comprobador.
OPTIONAL_FILES = ["estado.md"]  # tools/spec/estado.py (REQ-PRO-017, T49)
# Área -> prefijo del archivo donde se definen sus REQ.
AREAS = {
    "PRO": "01", "ENT": "02", "MUN": "03", "AVE": "04",
    "IDE": "05", "COM": "06", "ADM": "07", "ARQ": "08",
}
SCOPES = ("L1", "L2", "diferido")
MARKERS = ("[pendiente Álvaro]", "[pendiente Hernán]", "[provisional]")
MAX_ERRORS = 40
ALIASES = ["ENT 01", "ENT 02", "ENT 03", "ENT 04", "ENT 05", "ENT 06", "MAP 01", "ART 01"]

# Las cinco preguntas públicas del Carnet, textuales (decisión de Álvaro, 2026-10-14;
# antes, v14 §44.1).
QUESTIONS = [
    "¿Qué momento te hizo pensar «yo quiero estar en esto»?",
    "¿Cuál es la canción que tienes en repeat ahora mismo?",
    "¿Qué estás creando o tramando estos días?",
    "¿Qué disco escucharías de principio a fin sin saltarte ninguna?",
    "Completa la frase: una buena fiesta necesita siempre…",
]
OTHER_SENTINELS = ["140", "1,5 s", "Alba Fitz", "Wet Kisses", "payment.success"]
# Cada centinela debe estar en el archivo donde vive su requisito; 00-indice
# los enumera y no cuenta.
SENTINEL_HOME = dict(
    [(q, "05-identidad-y-comunidad.md") for q in QUESTIONS]
    + [("140", "05-identidad-y-comunidad.md"), ("1,5 s", "04-aventura.md"),
       ("Alba Fitz", "06-comercial.md"), ("Wet Kisses", "06-comercial.md"),
       ("payment.success", "06-comercial.md")]
)

DEF_START = re.compile(r"^- \*\*REQ-")
DEF_RE = re.compile(
    r"^- \*\*(REQ-([A-Z]{3})-(\d{3}))\*\* `([^`]*)` — (.+?) \*Fuente: ([^*]+)\*\s*$"
)
ROW_START = re.compile(r"^\|\s*REQ-")
REF_RE = re.compile(r"REQ-[A-Z]{3}-\d{3}")


def markers_in(text):
    return {m for m in MARKERS if m in text}


def main():
    errors = []
    err = errors.append

    # 1. Archivos.
    present = sorted(p.name for p in SPEC.glob("*.md") if p.name not in OPTIONAL_FILES)
    if present != sorted(EXPECTED_FILES):
        missing = sorted(set(EXPECTED_FILES) - set(present))
        extra = sorted(set(present) - set(EXPECTED_FILES))
        if missing:
            err("faltan archivos en docs/spec/: " + ", ".join(missing))
        if extra:
            err("sobran archivos en docs/spec/: " + ", ".join(extra))
    texts = {name: (SPEC / name).read_text(encoding="utf-8")
             for name in EXPECTED_FILES if (SPEC / name).exists()}

    # 2. Definiciones en 01..08.
    defs = {}          # id -> dict
    dup_ids = []
    for name, text in texts.items():
        prefix = name[:2]
        in_fence = False
        for n, line in enumerate(text.splitlines(), 1):
            if line.startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence or not DEF_START.match(line):
                continue
            where = f"{name}:{n}"
            if prefix not in AREAS.values():
                err(f"{where}: definición de REQ fuera de 01..08")
                continue
            m = DEF_RE.match(line)
            if not m:
                err(f"{where}: definición mal formada (se espera "
                    "'- **REQ-XXX-nnn** `alcance` — texto *Fuente: ...*')")
                continue
            rid, area, _num, scope, body, source = m.groups()
            if area not in AREAS:
                err(f"{where}: {rid} tiene un área desconocida")
            elif AREAS[area] != prefix:
                err(f"{where}: {rid} debe definirse en el archivo {AREAS[area]}-*.md")
            if scope not in SCOPES:
                err(f"{where}: {rid} tiene alcance '{scope}', no L1, L2 ni diferido")
            if not source.strip():
                err(f"{where}: {rid} no tiene fuente")
            if rid in defs:
                dup_ids.append(rid)
                err(f"{where}: {rid} ya estaba definido en {defs[rid]['where']}")
                continue
            defs[rid] = {
                "where": where, "area": area, "scope": scope,
                "source": source.strip(), "markers": markers_in(body),
            }

    # 3. Tabla maestra 09.
    rows = {}
    table = texts.get("09-requisitos.md", "")
    for n, line in enumerate(table.splitlines(), 1):
        if not ROW_START.match(line):
            continue
        where = f"09-requisitos.md:{n}"
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 6:
            err(f"{where}: la fila tiene {len(cells)} columnas y deben ser 6 "
                "(ID · texto · fuente · alcance · criterio · notas)")
            continue
        rid, text, source, scope, criterion, notes = cells
        if not REF_RE.fullmatch(rid):
            err(f"{where}: ID mal formado '{rid}'")
            continue
        if rid in rows:
            err(f"{where}: {rid} aparece más de una vez en 09 (antes en {rows[rid]['where']})")
            continue
        rows[rid] = {"where": where}
        if not text:
            err(f"{where}: {rid} sin texto")
        if not source:
            err(f"{where}: {rid} sin fuente")
        if scope not in SCOPES:
            err(f"{where}: {rid} sin alcance válido ('{scope}')")
        if not criterion:
            err(f"{where}: {rid} sin criterio verificable")
        d = defs.get(rid)
        if d is None:
            err(f"{where}: {rid} está en 09 pero no se define en 01..08")
            continue
        if source != d["source"]:
            err(f"{where}: fuente de {rid} distinta de su definición "
                f"('{source}' frente a '{d['source']}')")
        if scope != d["scope"]:
            err(f"{where}: alcance de {rid} distinto de su definición "
                f"('{scope}' frente a '{d['scope']}')")
        if markers_in(notes) != d["markers"]:
            err(f"{where}: las marcas de {rid} en notas no coinciden con su definición")
    for rid, d in defs.items():
        if rid not in rows:
            err(f"{d['where']}: {rid} no aparece en 09-requisitos.md")

    # 4. Referencias colgantes.
    for name, text in texts.items():
        for n, line in enumerate(text.splitlines(), 1):
            for ref in REF_RE.findall(line):
                if ref not in defs:
                    err(f"{name}:{n}: referencia a {ref}, que no está definido")

    # 5. Alias de la v14.
    for alias in ALIASES:
        owners = [rid for rid, d in defs.items()
                  if re.search(r"alias " + re.escape(alias) + r"\b", d["source"])]
        if len(owners) != 1:
            err(f"el alias {alias} debe estar en exactamente un REQ (está en {len(owners)})")

    # 6. Centinelas.
    v14 = V14.read_text(encoding="utf-8") if V14.exists() else None
    sentinels = QUESTIONS + OTHER_SENTINELS
    found = 0
    for s in sentinels:
        home = SENTINEL_HOME[s]
        if s in texts.get(home, ""):
            found += 1
        else:
            err(f"centinela ausente en {home}: «{s}»")
    if v14 is not None:
        # Sólo la quinta sigue en la v14; las otras cuatro son de Álvaro (2026-10-14).
        q = QUESTIONS[-1]
        if q not in v14:
            err(f"la pregunta «{q}» no está en la v14: revisar check.py")

    # 7. Informe.
    print("Requisitos por área (L1 / L2 / diferido):")
    for area in AREAS:
        items = [d for d in defs.values() if d["area"] == area]
        by = {s: sum(1 for d in items if d["scope"] == s) for s in SCOPES}
        print(f"  {area}  {len(items):3d}   ({by['L1']} / {by['L2']} / {by['diferido']})")
    totals = {s: sum(1 for d in defs.values() if d["scope"] == s) for s in SCOPES}
    print("Por alcance: " + " · ".join(f"{s} {totals[s]}" for s in SCOPES))
    print("Marcas: " + " · ".join(
        f"{m} {sum(1 for d in defs.values() if m in d['markers'])}" for m in MARKERS))
    if errors:
        print(f"\n{len(errors)} errores:")
        for e in errors[:MAX_ERRORS]:
            print("  - " + e)
        if len(errors) > MAX_ERRORS:
            print(f"  … y {len(errors) - MAX_ERRORS} más")
    print(f"{len(defs)} requisitos, {len(dup_ids)} duplicados, "
          f"centinelas {found}/{len(sentinels)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
