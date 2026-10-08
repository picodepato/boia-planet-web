"""Instala las tres fuentes de la web en apps/web/public/fonts/ (plan 019 T213).

Elección de Hernán (reunión del 2026-10-08, decisión 2; combinación 4 de las
muestras, todas de la lista de videojuegos de 1001freefonts):

- Títulos: Upheaval (Brian Kent, Ænigma Fonts). Freeware, uso personal y
  comercial; su licencia (`upheaval.txt`) no deja alterar el archivo, así que
  se copia el TTF original byte a byte, sin subconjunto ni conversión.
- Botones: Press Start 2P (CodeMan38), SIL OFL 1.1 con nombre reservado.
- Texto: 8-bit Operator+ (Grand Chaos Productions), SIL OFL 1.1 con nombre
  reservado, regular y negrita.

Las dos OFL se reempaquetan en woff2 sin tocar los glifos ni las tablas (sin
subconjunto: un subconjunto sería una «versión modificada» y no podría llevar
el nombre reservado).

Las fuentes de partida se bajan de su fuente oficial y no se guardan en el
repo; sólo el resultado, con su licencia al lado:

    python tools/fonts/subset.py <carpeta con upheavtt.ttf, upheaval.txt,
        PressStart2P-Regular.ttf, OFL-pressstart2p.txt,
        8bitOperatorPlus-Regular.ttf, 8bitOperatorPlus-Bold.ttf,
        OFL-8bitoperator.txt>

Orígenes:
- https://www.1001freefonts.com/es/upheaval.font (zip: upheavtt.ttf, upheaval.txt)
- https://www.1001freefonts.com/es/8-bit-operator.font (zip: 8bitOperatorPlus-*.ttf,
  «SIL Open Font License.txt» → OFL-8bitoperator.txt)
- https://github.com/google/fonts/tree/main/ofl/pressstart2p (también en la
  lista de 1001freefonts: https://www.1001freefonts.com/es/press-start-2p.font)

Necesita fonttools y brotli (pip install fonttools brotli).
"""

import argparse
import os
import shutil

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "apps", "web", "public", "fonts")

# origen → destino en public/fonts/
COPY = {
    "upheavtt.ttf": "upheavtt.ttf",
    "upheaval.txt": "LICENCIA-upheaval.txt",
    "OFL-pressstart2p.txt": "OFL-press-start-2p.txt",
    "OFL-8bitoperator.txt": "OFL-8bit-operator-plus.txt",
}
WOFF2 = {
    "PressStart2P-Regular.ttf": "press-start-2p.woff2",
    "8bitOperatorPlus-Regular.ttf": "8bit-operator-plus-regular.woff2",
    "8bitOperatorPlus-Bold.ttf": "8bit-operator-plus-bold.woff2",
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="carpeta con las fuentes y licencias de partida")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for src, dest in COPY.items():
        shutil.copyfile(os.path.join(a.src, src), os.path.join(OUT, dest))
        print(f"{dest}: copiado tal cual")
    for src, dest in WOFF2.items():
        font = TTFont(os.path.join(a.src, src))
        font.flavor = "woff2"
        path = os.path.join(OUT, dest)
        font.save(path)
        print(f"{dest}: {os.path.getsize(path) / 1024:.1f} kB")


if __name__ == "__main__":
    main()
