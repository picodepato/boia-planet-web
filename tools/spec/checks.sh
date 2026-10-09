#!/bin/sh
# Comprobaciones en Python que corren al final de `pnpm test` (T49), desde la
# raíz del repo y con el Python del sistema:
#   - la spec (tools/spec/check.py) y el estado por requisito (REQ-PRO-017),
#     con sus pruebas;
#   - todo el arte de art/ y sus manifiestos (REQ-MUN-031).
# `pnpm test <filtro>` no las corre: sólo la suite entera.
cd "$(dirname "$0")/../.." || exit 1

# Corre un comprobador; si falla, enseña todo lo que dijo y sale con 1.
run() {
  lines=$1
  shift
  if ! out=$("$@" 2>&1); then
    printf '%s\n' "$out"
    echo "FALLA: $*"
    exit 1
  fi
  printf '%s\n' "$out" | tail -n "$lines"
}

run 1 python3 tools/spec/check.py
run 9 python3 tools/spec/estado.py
run 1 python3 tools/spec/test_check.py
run 1 python3 tools/spec/test_estado.py
run 1 python3 tools/spec/test_cobertura.py
run 2 python3 tools/blender/check.py
