"""Subconjunto latino en woff2 de las fuentes de la web (plan 006 T74).

Las fuentes de partida se bajan de su fuente oficial (OFL, repositorio de
Google Fonts) y no se guardan en el repo; sólo el resultado, en
apps/web/public/fonts/, con su licencia al lado.

    python tools/fonts/subset.py titulo <fuente.ttf|otf> [--wdth 125 --wght 700]
    python tools/fonts/subset.py texto  <Inter[opsz,wght].ttf>

`titulo` deja una instancia estática (los ejes que se den se fijan) en
apps/web/public/fonts/titulo-latin.woff2: es el archivo que lee
apps/web/lib/fonts.ts. Para pasar a Druk Wide Medium cuando haya licencia:
    python tools/fonts/subset.py titulo DrukWide-Medium.otf
(ver README, «Tipografías»).

`texto` deja Inter variable (peso 400–900, tamaño óptico fijo en 14) en
apps/web/public/fonts/inter-latin.woff2.

Necesita fonttools y brotli (pip install fonttools brotli).
"""

import argparse
import io
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "apps", "web", "public", "fonts")

# El rango «latin» de Google Fonts más los símbolos que usa la interfaz
# (flechas, ≈ ≤ ≥ −, ✓ ✕, ★ ▸ ○). Los emoji salen de la fuente del sistema.
UNICODES = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2248,"
    "U+2260,U+2264-2265,U+25B8,U+25CB,U+2605,U+2713,U+2715,U+FEFF,U+FFFD"
)
FEATURES = "kern,liga,calt,tnum,case,ccmp,locl,mark,mkmk"
# La de títulos se precarga en la landing y cuenta en su presupuesto: sólo
# texto latino (con tildes, ñ, ¿, ¡, comillas y €) y kerning.
TITLE_UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201E,"
    "U+2022,U+2026,U+2039-203A,U+20AC,U+2122,U+2190-2193"
)
TITLE_FEATURES = "kern,liga,ccmp,locl,mark,mkmk"


def write_woff2(font: TTFont, dest: str, unicodes: str = UNICODES, features: str = FEATURES) -> None:
    # Se guarda y se relee: el subsetter falla con las tablas perezosas que
    # deja el instanciador.
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    font = TTFont(buf)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = features.split(",")
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=subset.parse_unicodes(unicodes))
    sub.subset(font)
    font.flavor = "woff2"
    font.save(dest)
    print(f"{dest}: {os.path.getsize(dest) / 1024:.1f} kB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["titulo", "texto"])
    ap.add_argument("src")
    ap.add_argument("--wdth", type=float)
    ap.add_argument("--wght", type=float)
    a = ap.parse_args()
    font = TTFont(a.src)
    if a.kind == "titulo":
        if "fvar" in font:
            loc = {k: v for k, v in (("wdth", a.wdth), ("wght", a.wght)) if v is not None}
            font = instancer.instantiateVariableFont(font, loc, updateFontNames=False)
        write_woff2(font, os.path.join(OUT, "titulo-latin.woff2"), TITLE_UNICODES, TITLE_FEATURES)
    else:
        font = instancer.instantiateVariableFont(font, {"opsz": 14, "wght": (400, 900)})
        write_woff2(font, os.path.join(OUT, "inter-latin.woff2"))


if __name__ == "__main__":
    main()
