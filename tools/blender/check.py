#!/usr/bin/env python3
"""Comprueba todo el arte de art/ y sus manifiestos. Python del sistema, sin dependencias.

    python3 tools/blender/check.py                 # valida cada art/<id>/manifest.json
    python3 tools/blender/check.py --diff          # además compara con tools/blender/out/rerun/<id>
    python3 tools/blender/check.py --diff OTRA/DIR
    python3 tools/blender/check.py --art OTRA/RAIZ

El barco (kind "ship") se valida con manifest.schema.json y sus reglas del
encargo 01; el resto (sprite, tile, layers) con asset.schema.json y las reglas
de check_world(). Tienen que existir todos los recursos que lista render.py.
El arte de los mundos (art/mundos/<mundo>/<lugar>/, kind "place") se valida con
place.schema.json: una carpeta por lugar (y por extra) de lugares.json en cada mundo de
WORLDS, referencias a mapa.json, la misma cámara y densidad que el barco del
mundo, y por pieza anclajes, huella, pistas, animaciones, losas y esquinas.
El título 3D de la entrada (art/intro/titulo/, kind "title-sheet") lo valida
intro/check_titulo.py.
Las islas de Blender del mar 3D (art/islas/3d/, kind "island-glb", T69): el
manifiesto con isla3d.schema.json, un GLB por módulo de tools/blender/islas/ y
cada uno dentro del presupuesto de triángulos (export_islas_glb.MAX_TRIS).
Los props del hero de la landing (art/landing/3d/, kind "landing-glb", T78): el
manifiesto con landing3d.schema.json, un GLB por prop de
tools/blender/landing/export_landing_glb.PROPS, cada uno dentro de su presupuesto
de triángulos y con ≤ 4 materiales, el total dentro de TOTAL_TRIS / TOTAL_KB, una
malla principal más una por luz (nodos luz_*), y los stills de
art/landing/hero-still-*.webp dentro de sus kB (render_hero_still.LIMITS_KB).
Exit 0 si todo pasa; 1 si algo falla (lista cada fallo).
"""
import argparse
import ast
import json
import math
import os
import re
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import lugares as LG  # noqa: E402
from intro import check_titulo  # noqa: E402

# Lo que pide el encargo 01: 3 skins × 8 direcciones × con/sin pasajera + 8 fotogramas de balanceo base/S.
SKINS = ["base", "noche", "fiesta"]
DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
BOB = ("base", "S", 8)
BORDER_PX = 4
MAX_DIFF_FRACTION = 0.005          # reproducibilidad: ≤ 0,5 % de píxeles distintos por imagen
MIN_PASSENGER_PX = 150             # píxeles que la pasajera tiene que cambiar como mínimo
HEADING_TOL_DEG = 1.0
ANCHOR_NEAR_PX = 3                 # mast_top y slot_passenger tienen que caer sobre el barco


# --- JSON Schema (subconjunto usado por manifest.schema.json) ---------------
ANNOTATIONS = {"$schema", "$id", "title", "description", "$defs"}
TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
}


def validate(value, schema, root, path="$"):
    errs = []
    if "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/"):
            raise ValueError("$ref no soportada: " + ref)
        target = root
        for part in ref[2:].split("/"):
            target = target[part]
        return validate(value, target, root, path)
    for kw in schema:
        if kw in ANNOTATIONS:
            continue
        if kw not in {"type", "const", "enum", "required", "properties", "additionalProperties", "items",
                      "minItems", "maxItems", "minLength", "pattern", "minimum", "maximum"}:
            raise ValueError("palabra clave de esquema no soportada: %s (en %s)" % (kw, path))
    t = schema.get("type")
    if t and not TYPES[t](value):
        return ["%s: se esperaba %s" % (path, t)]
    if "const" in schema and value != schema["const"]:
        errs.append("%s: tiene que valer %r" % (path, schema["const"]))
    if "enum" in schema and value not in schema["enum"]:
        errs.append("%s: %r no está en %r" % (path, value, schema["enum"]))
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errs.append("%s: cadena demasiado corta" % path)
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errs.append("%s: %r no cumple %s" % (path, value, schema["pattern"]))
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errs.append("%s: %r < %r" % (path, value, schema["minimum"]))
        if "maximum" in schema and value > schema["maximum"]:
            errs.append("%s: %r > %r" % (path, value, schema["maximum"]))
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errs.append("%s: menos de %d elementos" % (path, schema["minItems"]))
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errs.append("%s: más de %d elementos" % (path, schema["maxItems"]))
        if "items" in schema:
            for i, item in enumerate(value):
                errs += validate(item, schema["items"], root, "%s[%d]" % (path, i))
    if isinstance(value, dict):
        for k in schema.get("required", []):
            if k not in value:
                errs.append("%s: falta %r" % (path, k))
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for k, v in value.items():
            if k in props:
                errs += validate(v, props[k], root, "%s.%s" % (path, k))
            elif extra is False:
                errs.append("%s: propiedad no permitida %r" % (path, k))
            elif isinstance(extra, dict):
                errs += validate(v, extra, root, "%s.%s" % (path, k))
    return errs


# --- PNG ---------------------------------------------------------------------
class Png:
    def __init__(self, path):
        with open(path, "rb") as f:
            data = f.read()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError("no es PNG")
        pos, idat = 8, []
        while pos < len(data):
            (length,) = struct.unpack(">I", data[pos:pos + 4])
            ctype, chunk = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
            pos += 12 + length
            if ctype == b"IHDR":
                self.w, self.h, depth, self.color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            elif ctype == b"IDAT":
                idat.append(chunk)
            elif ctype == b"IEND":
                break
        if depth != 8 or interlace:
            raise ValueError("sólo PNG de 8 bits sin entrelazado (depth=%d)" % depth)
        self.channels = {0: 1, 2: 3, 4: 2, 6: 4}[self.color_type]
        self.has_alpha = self.color_type in (4, 6)
        self.px = self._unfilter(zlib.decompress(b"".join(idat)))
        self.size = len(data)

    def _unfilter(self, raw):
        c, stride = self.channels, self.w * self.channels
        out = bytearray(self.h * stride)
        prev = bytearray(stride)
        i = 0
        for y in range(self.h):
            ft = raw[i]
            line = bytearray(raw[i + 1:i + 1 + stride])
            i += 1 + stride
            if ft == 1:
                for x in range(c, stride):
                    line[x] = (line[x] + line[x - c]) & 255
            elif ft == 2:
                line = bytearray((a + b) & 255 for a, b in zip(line, prev))
            elif ft == 3:
                for x in range(stride):
                    left = line[x - c] if x >= c else 0
                    line[x] = (line[x] + ((left + prev[x]) >> 1)) & 255
            elif ft == 4:
                for x in range(stride):
                    a = line[x - c] if x >= c else 0
                    b = prev[x]
                    cc = prev[x - c] if x >= c else 0
                    p = a + b - cc
                    pa, pb, pc = abs(p - a), abs(p - b), abs(p - cc)
                    pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else cc)
                    line[x] = (line[x] + pr) & 255
            elif ft != 0:
                raise ValueError("filtro PNG desconocido %d" % ft)
            out[y * stride:(y + 1) * stride] = line
            prev = line
        return out

    def alpha(self, x, y):
        return self.px[(y * self.w + x) * self.channels + self.channels - 1]

    def alpha_bbox(self):
        xs, ys = [], []
        for y in range(self.h):
            for x in range(self.w):
                if self.alpha(x, y):
                    xs.append(x)
                    ys.append(y)
        if not xs:
            return None
        return min(xs), min(ys), max(xs), max(ys)

    def border_opaque(self, b):
        n = 0
        for y in range(self.h):
            for x in range(self.w):
                if (x < b or y < b or x >= self.w - b or y >= self.h - b) and self.alpha(x, y):
                    n += 1
        return n

    def near_opaque(self, pt, r):
        cx, cy = int(pt[0]), int(pt[1])
        for y in range(max(0, cy - r), min(self.h, cy + r + 1)):
            for x in range(max(0, cx - r), min(self.w, cx + r + 1)):
                if self.alpha(x, y):
                    return True
        return False


def diff_pixels(a, b, threshold=0):
    """Píxeles en que algún canal difiere más que `threshold`."""
    c = a.channels
    n = 0
    pa, pb = a.px, b.px
    for i in range(0, len(pa), c):
        if pa[i:i + c] != pb[i:i + c]:
            if threshold == 0 or max(abs(x - y) for x, y in zip(pa[i:i + c], pb[i:i + c])) > threshold:
                n += 1
    return n


def expected_files(skins=SKINS):
    files = []
    for skin in skins:
        for p in ("", "_p"):
            for d in DIRECTIONS:
                files.append("%s/%s%s.png" % (skin, d, p))
    skin, d, n = BOB
    files += ["%s/%s_bob_%d.png" % (skin, d, k) for k in range(n)]
    return files


def expected_heading_deg(direction, elevation_deg):
    """Ángulo en pantalla (y hacia abajo, horario) del rumbo del casco en proyección dimétrica."""
    phi = math.radians(45.0 * DIRECTIONS.index(direction))
    sx, sy = -math.sin(phi), math.sin(math.radians(elevation_deg)) * math.cos(phi)
    return math.degrees(math.atan2(sy, sx)) % 360.0


def pngs_on_disk(root, skip_dirs=()):
    """PNG bajo `root` (rutas relativas), sin entrar en las subcarpetas de primer nivel `skip_dirs`."""
    out = []
    for dp, dns, fns in os.walk(root):
        if dp == root:
            dns[:] = [d for d in dns if d not in skip_dirs]
        out += [os.path.relpath(os.path.join(dp, fn), root).replace(os.sep, "/") for fn in fns if fn.endswith(".png")]
    return sorted(out)


def check_ship(ship_dir, diff_dir=None, skins=SKINS, skip_dirs=()):
    """Un juego de sprites del barco: el del estilo actual (3 skins) o el de un estilo de exploración (base)."""
    class _A:
        pass
    a = _A()
    a.dir, a.diff = ship_dir, diff_dir
    fails = []
    info = []

    with open(os.path.join(HERE, "manifest.schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    man_path = os.path.join(a.dir, "manifest.json")
    with open(man_path, encoding="utf-8") as f:
        man = json.load(f)
    fails += validate(man, schema, schema)

    exp = expected_files(skins)
    if man.get("skins") != list(skins):
        fails.append("skins %r; se esperaba %r" % (man.get("skins"), list(skins)))
    listed = [im["file"] for im in man.get("images", [])]
    if sorted(listed) != sorted(exp):
        fails.append("el manifiesto lista %d imágenes; faltan %s; sobran %s" % (
            len(listed), sorted(set(exp) - set(listed))[:5], sorted(set(listed) - set(exp))[:5]))
    on_disk = pngs_on_disk(a.dir, skip_dirs)
    if on_disk != sorted(exp):
        fails.append("en disco hay %d PNG; faltan %s; sobran %s" % (
            len(on_disk), sorted(set(exp) - set(on_disk))[:5], sorted(set(on_disk) - set(exp))[:5]))
    for im in man.get("images", []):
        want = "%s/%s%s" % (im["skin"], im["direction"],
                            "_%s_%d" % (im["animation"], im["frame"]) if "animation" in im else ("_p" if im["passenger"] else ""))
        if im["file"] != want + ".png":
            fails.append("%s: skin/direction/frame/passenger no coinciden con el nombre" % im["file"])

    # Imágenes: alfa, borde transparente, márgenes.
    pngs = {}
    margins = []
    W = man["image"]["width"]
    H = man["image"]["height"]
    for name in exp:
        path = os.path.join(a.dir, name)
        if not os.path.exists(path):
            continue
        p = Png(path)
        pngs[name] = p
        if (p.w, p.h) != (W, H):
            fails.append("%s: mide %dx%d, se esperaba %dx%d" % (name, p.w, p.h, W, H))
        if not p.has_alpha:
            fails.append("%s: sin canal alfa" % name)
            continue
        n = p.border_opaque(BORDER_PX)
        if n:
            fails.append("%s: %d píxeles no transparentes en el borde de %d px" % (name, n, BORDER_PX))
        bb = p.alpha_bbox()
        if bb is None:
            fails.append("%s: imagen vacía" % name)
            continue
        margins.append((min(bb[0], bb[1], p.w - 1 - bb[2], p.h - 1 - bb[3]), name, bb))

    # Anclajes: pivote fijo, dentro de la imagen, sobre el barco; rumbo coherente.
    dirs = man.get("directions", {})
    pivot = man["projection"]["pivot_px"]
    elev = man["projection"]["camera_elevation_deg"]
    headings = []
    for d in DIRECTIONS:
        info_d = dirs.get(d)
        if not info_d:
            continue
        anc = info_d["anchors"]
        for k, pt in anc.items():
            if not (0 <= pt[0] <= W and 0 <= pt[1] <= H):
                fails.append("%s: anclaje %s fuera de la imagen %r" % (d, k, pt))
        if max(abs(anc["pivot"][0] - pivot[0]), abs(anc["pivot"][1] - pivot[1])) > 0.05:
            fails.append("%s: el pivote %r no coincide con pivot_px %r" % (d, anc["pivot"], pivot))
        dx, dy = anc["bow"][0] - anc["wake_origin"][0], anc["bow"][1] - anc["wake_origin"][1]
        ang = math.degrees(math.atan2(dy, dx)) % 360.0
        want = expected_heading_deg(d, elev)
        err = (ang - want + 180.0) % 360.0 - 180.0
        headings.append((d, ang, err))
        if abs(err) > HEADING_TOL_DEG:
            fails.append("%s: la proa apunta a %.1f° en pantalla; se esperaba %.1f°" % (d, ang, want))
        for skin in skins:
            for name, key in (("%s/%s.png" % (skin, d), "mast_top"), ("%s/%s_p.png" % (skin, d), "slot_passenger")):
                if name in pngs and not pngs[name].near_opaque(anc[key], ANCHOR_NEAR_PX):
                    fails.append("%s: el anclaje %s %r no cae sobre el barco" % (name, key, anc[key]))
    for (d0, a0, _), (d1, a1, _) in zip(headings, headings[1:] + headings[:1]):
        step = (a1 - a0) % 360.0
        if not 15.0 < step < 75.0:
            fails.append("rumbo %s→%s gira %.1f°: la secuencia no es horaria y continua" % (d0, d1, step))
    for im in man.get("images", []):
        if "anchors" in im:
            pv = im["anchors"]["pivot"]
            if max(abs(pv[0] - pivot[0]), abs(pv[1] - pivot[1])) > 0.05:
                fails.append("%s: el pivote se mueve en la animación %r" % (im["file"], pv))
            if im["file"] in pngs and not pngs[im["file"]].near_opaque(im["anchors"]["mast_top"], ANCHOR_NEAR_PX):
                fails.append("%s: mast_top no cae sobre el barco" % im["file"])

    # La pasajera se ve en todas las direcciones y skins.
    pvis = []
    for skin in skins:
        for d in DIRECTIONS:
            a0, a1 = pngs.get("%s/%s.png" % (skin, d)), pngs.get("%s/%s_p.png" % (skin, d))
            if a0 and a1:
                n = diff_pixels(a0, a1, threshold=24)
                pvis.append((n, "%s/%s" % (skin, d)))
                if n < MIN_PASSENGER_PX:
                    fails.append("%s/%s_p: la pasajera sólo cambia %d píxeles" % (skin, d, n))

    # Reproducibilidad.
    if a.diff:
        worst = (0.0, None)
        changed = 0
        for name in exp:
            other = os.path.join(a.diff, name)
            if name not in pngs:
                continue
            if not os.path.exists(other):
                fails.append("--diff: falta %s" % other)
                continue
            b = Png(other)
            frac = diff_pixels(pngs[name], b) / float(W * H)
            changed += frac > 0
            if frac > worst[0]:
                worst = (frac, name)
            if frac > MAX_DIFF_FRACTION:
                fails.append("--diff: %s difiere en %.3f %% de píxeles" % (name, 100 * frac))
        info.append("diff contra %s: %d/%d imágenes con algún píxel distinto; peor %.4f %% (%s)" % (
            os.path.relpath(a.diff, REPO), changed, len(pngs), 100 * worst[0], worst[1]))

    if margins:
        m = min(margins)
        info.append("margen mínimo hasta el borde: %d px (%s)" % (m[0], m[1]))
    if pvis:
        m = min(pvis)
        info.append("pasajera: mínimo %d píxeles cambiados (%s); media %d" % (m[0], m[1], sum(n for n, _ in pvis) // len(pvis)))
    if headings:
        info.append("rumbo en pantalla (°): " + ", ".join("%s %.1f" % (d, ang) for d, ang, _ in headings))
    sizes = [p.size for p in pngs.values()]
    if sizes:
        info.append("PNG: media %d bytes, mín %d, máx %d" % (sum(sizes) // len(sizes), min(sizes), max(sizes)))
    return fails, info, len(pngs)


# --- El barco en los estilos de exploración (T11) ----------------------------
STYLES_SUBDIR = "estilos"
import ship_skins  # noqa: E402  (T39: cada estilo en base, noche y fiesta, salvo los de ship_skins.HELD)


def check_ship_styles(rid, ship_dir, diff_root=None):
    """Cada entrada de `style_variants` del manifiesto raíz: su carpeta estilos/<id>/ con un
    manifiesto de barco completo (skins de ship_skins.skins_for) cuyo `style` es el id. No puede haber carpetas sin listar."""
    with open(os.path.join(ship_dir, "manifest.json"), encoding="utf-8") as f:
        root = json.load(f)
    variants = root.get("style_variants", [])
    results = []
    listed = []
    for v in variants:
        sid = v.get("id", "?")
        label = "%s/%s/%s" % (rid, STYLES_SUBDIR, sid)
        listed.append(sid)
        want = "%s/%s/manifest.json" % (STYLES_SUBDIR, sid)
        if v.get("manifest") != want:
            results.append((label, "ship", ["style_variants: manifest %r; se esperaba %r" % (v.get("manifest"), want)],
                            [], 0))
            continue
        sdir = os.path.join(ship_dir, STYLES_SUBDIR, sid)
        if not os.path.exists(os.path.join(sdir, "manifest.json")):
            results.append((label, "ship", ["falta %s" % os.path.relpath(os.path.join(sdir, "manifest.json"), REPO)],
                            [], 0))
            continue
        diff = os.path.join(diff_root, STYLES_SUBDIR, sid) if diff_root else None
        fails, info, n = check_ship(sdir, diff, skins=ship_skins.skins_for(sid))
        with open(os.path.join(sdir, "manifest.json"), encoding="utf-8") as f:
            man = json.load(f)
        if man.get("style") != sid:
            fails.append("style %r; se esperaba %r (el id de style_variants)" % (man.get("style"), sid))
        if man.get("status") != "muestra":
            fails.append("status %r; los estilos de exploración son muestra" % man.get("status"))
        results.append((label, "ship", fails, info, n))
    if len(set(listed)) != len(listed) or root.get("style") in listed:
        results.append(("%s/%s" % (rid, STYLES_SUBDIR), "ship", ["style_variants: ids repetidos %r" % listed], [], 0))
    sub = os.path.join(ship_dir, STYLES_SUBDIR)
    extra = sorted(set(os.listdir(sub)) - set(listed)) if os.path.isdir(sub) else []
    if extra:
        results.append(("%s/%s" % (rid, STYLES_SUBDIR), "ship", ["carpetas sin listar en style_variants: %s" % extra],
                        [], 0))
    return results


# --- Recursos del mundo (sprite, tile, layers) --------------------------------
TILE_FILL_MIN = 0.99               # fracción del borde de tierra que tiene que ser exactamente outer_fill
TILE_LAND_COLS = 2                 # columnas del lado de tierra que tienen que ser opacas
TILE_WATER_COLS = 4                # columnas del lado del agua que tienen que ser transparentes
SEAM_FACTOR = 3.0                  # la costura vertical no puede saltar más que 3× la mediana entre filas vecinas
REQUIRED_BY_KIND = {
    "sprite": ["image", "pivot_px", "anchors", "anchors_on_art", "footprint", "hitbox_hint"],
    "tile": ["image", "tile"],
    "layers": ["layers"],
}


def alpha_row(p, y):
    stride = p.w * p.channels
    return p.px[y * stride + p.channels - 1:(y + 1) * stride:p.channels]


def opaque_bbox(p):
    """Como Png.alpha_bbox, pero por filas (rápido en imágenes grandes)."""
    x0, y0, x1, y1 = p.w, None, -1, None
    for y in range(p.h):
        r = alpha_row(p, y)
        body = r.lstrip(b"\0")
        if not body:
            continue
        y0 = y if y0 is None else y0
        y1 = y
        x0 = min(x0, len(r) - len(body))
        x1 = max(x1, len(r.rstrip(b"\0")) - 1)
    return None if y0 is None else (x0, y0, x1, y1)


def border_opaque_fast(p, b):
    n = 0
    for y in range(p.h):
        r = alpha_row(p, y)
        if y < b or y >= p.h - b:
            n += len(r) - r.count(0)
        else:
            n += (b - r[:b].count(0)) + (b - r[-b:].count(0))
    return n


def row_diff(p, y0, y1):
    stride = p.w * p.channels
    a, b = p.px[y0 * stride:(y0 + 1) * stride], p.px[y1 * stride:(y1 + 1) * stride]
    return sum(abs(x - y) for x, y in zip(a, b)) / float(stride)


def inside(pt, w, h):
    return 0 <= pt[0] <= w and 0 <= pt[1] <= h


def check_sprite(man, pngs, fails, info):
    W, H = man["image"]["width"], man["image"]["height"]
    pv = man["pivot_px"]
    anchors = man["anchors"]
    if anchors.get("pivot") != pv:
        fails.append("anchors.pivot %r no coincide con pivot_px %r" % (anchors.get("pivot"), pv))
    missing_doc = sorted(set(anchors) - set(man["anchors_doc"]))
    if missing_doc:
        fails.append("anclajes sin documentar en anchors_doc: %s" % missing_doc)
    for im in man["images"]:
        anc = im.get("anchors", anchors)
        for k, pt in anc.items():
            if not inside(pt, W, H):
                fails.append("%s: anclaje %s fuera de la imagen %r" % (im["file"], k, pt))
        if max(abs(anc["pivot"][0] - pv[0]), abs(anc["pivot"][1] - pv[1])) > 0.05:
            fails.append("%s: el pivote se mueve %r" % (im["file"], anc["pivot"]))
        p = pngs.get(im["file"])
        for k in man["anchors_on_art"]:
            if k not in anc:
                fails.append("%s: anchors_on_art nombra %r, que no es un anclaje" % (im["file"], k))
            elif p and not p.near_opaque(anc[k], ANCHOR_NEAR_PX):
                fails.append("%s: el anclaje %s %r no cae sobre el arte" % (im["file"], k, anc[k]))
    # Huella, colisión y proximidad: coherentes entre sí y con la proyección 2:1.
    ppu = man["scale"]["pixels_per_unit"]
    pts = man["footprint"]["points_px"]
    for pt in pts:
        if not inside(pt, W, H):
            fails.append("huella: punto fuera de la imagen %r" % (pt,))
    radii = [math.hypot(x - pv[0], 2.0 * (y - pv[1])) for x, y in pts]     # radio en el agua, en px horizontales
    hit = man["hitbox_hint"]
    for name in ("hitbox_hint", "proximity_hint"):
        c = man.get(name)
        if c is None:
            continue
        if c["center_px"] != pv:
            fails.append("%s: el centro %r no es el pivote %r" % (name, c["center_px"], pv))
        if abs(c["radius_units"] * ppu - c["radius_px"]) > 0.05:
            fails.append("%s: radius_units × pixels_per_unit (%.2f) ≠ radius_px (%.2f)" % (
                name, c["radius_units"] * ppu, c["radius_px"]))
    if not min(radii) <= hit["radius_px"] <= max(radii) * 1.02:
        fails.append("hitbox_hint: radio %.1f px fuera de la huella (%.1f a %.1f)" % (hit["radius_px"], min(radii), max(radii)))
    r = hit["radius_px"]
    if not (0 <= pv[0] - r and pv[0] + r <= W and 0 <= pv[1] - r / 2 and pv[1] + r / 2 <= H):
        fails.append("hitbox_hint: la elipse de %.1f px no cabe en la imagen" % r)
    prox = man.get("proximity_hint")
    if prox and prox["radius_px"] < hit["radius_px"]:
        fails.append("proximity_hint más pequeño que hitbox_hint")
    info.append("huella %d puntos, radio %.0f–%.0f px; colisión %.0f px%s" % (
        len(pts), min(radii), max(radii), hit["radius_px"], "; proximidad %.0f px" % prox["radius_px"] if prox else ""))
    # Animaciones: fotogramas 0..n-1, con movimiento de verdad.
    for name, spec in man.get("animations", {}).items():
        frames = sorted((im["frame"], im["file"]) for im in man["images"] if im.get("animation") == name)
        if [f for f, _ in frames] != list(range(spec["frames"])):
            fails.append("animación %s: fotogramas %r, se esperaban 0..%d" % (name, [f for f, _ in frames], spec["frames"] - 1))
            continue
        distinct = len({bytes(pngs[f].px) for _, f in frames if f in pngs})
        if distinct < max(2, spec["frames"] // 2):
            fails.append("animación %s: sólo %d fotogramas distintos de %d" % (name, distinct, spec["frames"]))
        info.append("animación %s: %d fotogramas a %s fps, %d distintos" % (name, spec["frames"], spec["fps"], distinct))
    for im in man["images"]:
        if "animation" not in im and im["frame"] != 0:
            fails.append("%s: imagen fija con frame %d" % (im["file"], im["frame"]))


def check_tile(man, pngs, fails, info):
    W, H = man["image"]["width"], man["image"]["height"]
    t = man["tile"]
    if t["axis"] != "y" or t["period_px"] != H:
        fails.append("tile: sólo se admite axis y con period_px = alto de la imagen (%d)" % H)
        return
    files = sorted(v["file"] for v in t["variants"].values())
    if files != sorted(im["file"] for im in man["images"]):
        fails.append("tile: las variantes %s no son las imágenes del manifiesto" % files)
    for name, v in t["variants"].items():
        p = pngs.get(v["file"])
        if not p:
            continue
        left = v["land_side"] == "left"
        fill = tuple(int(v["outer_fill"][i:i + 2], 16) for i in (1, 3, 5))
        land_cols = range(TILE_LAND_COLS) if left else range(W - TILE_LAND_COLS, W)
        water_cols = range(W - TILE_WATER_COLS, W) if left else range(TILE_WATER_COLS)
        not_opaque = sum(1 for y in range(H) for x in land_cols if p.alpha(x, y) != 255)
        if not_opaque:
            fails.append("%s: %d píxeles no opacos en el borde de tierra" % (v["file"], not_opaque))
        same = 0
        for y in range(H):
            for x in land_cols:
                i = (y * W + x) * p.channels
                same += tuple(p.px[i:i + 3]) == fill
        frac = same / float(H * len(land_cols))
        if frac < TILE_FILL_MIN:
            fails.append("%s: sólo el %.1f %% del borde de tierra es outer_fill %s" % (v["file"], 100 * frac, v["outer_fill"]))
        not_clear = sum(1 for y in range(H) for x in water_cols if p.alpha(x, y) != 0)
        if not_clear:
            fails.append("%s: %d píxeles no transparentes en el borde del agua" % (v["file"], not_clear))
        s = v["shore_x_px"]
        c = v["collision_x_px"]
        if not (0 < s["min"] <= s["mean"] <= s["max"] < W):
            fails.append("%s: shore_x_px incoherente %r" % (v["file"], s))
        if not (0 < c < W) or (left and c <= s["max"]) or (not left and c >= s["min"]):
            fails.append("%s: collision_x_px %.1f no queda del lado del agua de la orilla" % (v["file"], c))
        # Los números tienen que describir el arte: tierra opaca antes de la orilla, agua detrás de la colisión.
        land_x = int(s["min"] - 4) if left else int(s["max"] + 4)
        water_x = int(c + 2) if left else int(c - 2)
        bad_land = sum(1 for y in range(H) if p.alpha(land_x, y) != 255)
        bad_water = sum(1 for y in range(H) if p.alpha(water_x, y) == 255)
        if bad_land:
            fails.append("%s: en x=%d (antes de la orilla) hay %d filas sin tierra opaca" % (v["file"], land_x, bad_land))
        if bad_water:
            fails.append("%s: en x=%d (pasada la colisión) hay %d filas opacas" % (v["file"], water_x, bad_water))
        # Costura: la última fila tiene que continuar en la primera como dos filas vecinas cualesquiera.
        diffs = sorted(row_diff(p, y, y + 1) for y in range(H - 1))
        median = diffs[len(diffs) // 2]
        seam = row_diff(p, H - 1, 0)
        limit = max(SEAM_FACTOR * median, diffs[int(0.95 * len(diffs))])
        if seam > limit:
            fails.append("%s: la costura vertical salta %.2f (límite %.2f)" % (v["file"], seam, limit))
        info.append("%s: tierra a la %s, orilla %.0f–%.0f px, colisión %.0f px, relleno %s (%.1f %%), costura %.2f (mediana %.2f, límite %.2f)" % (
            name, "izquierda" if left else "derecha", s["min"], s["max"], c, v["outer_fill"], 100 * frac, seam, median, limit))


def check_layers(man, pngs, fails, info, known_ids):
    layers = man["layers"]
    ids = [l["id"] for l in layers]
    by_id = {l["id"]: l for l in layers}
    if len(set(ids)) != len(ids):
        fails.append("capas repetidas: %r" % ids)
    if sorted(l["file"] for l in layers) != sorted(im["file"] for im in man["images"]):
        fails.append("las capas no son las imágenes del manifiesto")
    for im in man["images"]:
        l = by_id.get(im.get("layer"))
        if not l or l["file"] != im["file"]:
            fails.append("%s: la imagen no apunta a su capa (%r)" % (im["file"], im.get("layer")))
    for l in layers:
        p = pngs.get(l["file"])
        if not p:
            continue
        for k, pt in l["anchors"].items():
            if not inside(pt, l["width"], l["height"]):
                fails.append("%s: anclaje %s fuera de la capa %r" % (l["id"], k, pt))
        for k in l["anchors_on_art"]:
            if k not in l["anchors"]:
                fails.append("%s: anchors_on_art nombra %r, que no es un anclaje" % (l["id"], k))
            elif not p.near_opaque(l["anchors"][k], ANCHOR_NEAR_PX):
                fails.append("%s: el anclaje %s %r no cae sobre el arte" % (l["id"], k, l["anchors"][k]))
        ca = l.get("clear_around")
        if ca:
            cx, cy = l["anchors"][ca["anchor"]]
            r = ca["radius_px"]
            n = sum(1 for y in range(max(0, int(cy - r)), min(p.h, int(cy + r) + 1))
                    for x in range(max(0, int(cx - r)), min(p.w, int(cx + r) + 1))
                    if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r and p.alpha(x, y))
            if n:
                fails.append("%s: %d píxeles no transparentes a menos de %.0f px de %s" % (l["id"], n, r, ca["anchor"]))
        for target, anchor in l.get("place_on", {}).items():
            if target not in by_id or anchor not in by_id[target]["anchors"]:
                fails.append("%s: place_on apunta a %s.%s, que no existe" % (l["id"], target, anchor))
        if "matches" in l and l["matches"] not in known_ids:
            fails.append("%s: matches %r no es un recurso de art/" % (l["id"], l["matches"]))
        info.append("capa %s: %dx%d, %.2f px/unidad%s" % (
            l["id"], l["width"], l["height"], l["pixels_per_unit"], ", sobre %s" % ", ".join(sorted(l["place_on"])) if l.get("place_on") else ""))


def check_world(res_dir, schema, diff_dir, known_ids):
    fails, info = [], []
    with open(os.path.join(res_dir, "manifest.json"), encoding="utf-8") as f:
        man = json.load(f)
    fails += validate(man, schema, schema)
    if man.get("id") != os.path.basename(res_dir):
        fails.append("el id %r no es el nombre de la carpeta" % man.get("id"))
    for k in REQUIRED_BY_KIND.get(man.get("kind"), []):
        if k not in man:
            fails.append("kind %s exige %r" % (man.get("kind"), k))
    if fails:
        return fails, info, 0
    listed = [im["file"] for im in man["images"]]
    if len(set(listed)) != len(listed):
        fails.append("imágenes repetidas en el manifiesto")
    on_disk = sorted(os.path.relpath(os.path.join(dp, fn), res_dir).replace(os.sep, "/")
                     for dp, _, fns in os.walk(res_dir) for fn in fns if fn.endswith(".png"))
    if on_disk != sorted(listed):
        fails.append("en disco hay %s; el manifiesto lista %s" % (on_disk, sorted(listed)))
    if man["kind"] == "layers":
        dims = {l["file"]: (l["width"], l["height"], l["transparent_border_px"]) for l in man["layers"]}
    else:
        im = man["image"]
        dims = {f: (im["width"], im["height"], im["transparent_border_px"]) for f in listed}
    pngs = {}
    for name in listed:
        path = os.path.join(res_dir, name)
        if not os.path.exists(path) or name not in dims:
            continue
        p = Png(path)
        pngs[name] = p
        w, h, border = dims[name]
        if (p.w, p.h) != (w, h):
            fails.append("%s: mide %dx%d, se esperaba %dx%d" % (name, p.w, p.h, w, h))
        if not p.has_alpha:
            fails.append("%s: sin canal alfa" % name)
            continue
        if opaque_bbox(p) is None:
            fails.append("%s: imagen vacía" % name)
        if border:
            n = border_opaque_fast(p, border)
            if n:
                fails.append("%s: %d píxeles no transparentes en el borde de %d px" % (name, n, border))
    if man["kind"] == "sprite":
        check_sprite(man, pngs, fails, info)
    elif man["kind"] == "tile":
        check_tile(man, pngs, fails, info)
    else:
        check_layers(man, pngs, fails, info, known_ids)
    if diff_dir:
        same, worst = 0, (0.0, None)
        for name, p in sorted(pngs.items()):
            other = os.path.join(diff_dir, name)
            if not os.path.exists(other):
                fails.append("--diff: falta %s" % other)
                continue
            with open(other, "rb") as f1, open(os.path.join(res_dir, name), "rb") as f2:
                if f1.read() == f2.read():
                    same += 1
                    continue
            b = Png(other)
            frac = diff_pixels(p, b) / float(p.w * p.h) if (b.w, b.h) == (p.w, p.h) else 1.0
            if frac > worst[0]:
                worst = (frac, name)
            if frac > MAX_DIFF_FRACTION:
                fails.append("--diff: %s difiere en %.3f %% de píxeles" % (name, 100 * frac))
        info.append("diff: %d/%d PNG idénticos byte a byte; peor %.4f %% (%s)" % (same, len(pngs), 100 * worst[0], worst[1]))
    sizes = [p.size for p in pngs.values()]
    if sizes:
        info.append("PNG: %d bytes en total, máx %d" % (sum(sizes), max(sizes)))
    return fails, info, len(pngs)


# --- Mundos: art/mundos/<mundo>/<lugar>/manifest.json (place.schema.json) -----------------
MUNDOS_SUBDIR = "mundos"
NEEDS_FOOTPRINT = {"bloquear", "rebote", "ralentizar", "recoger"}
FADE_PX = 40                       # mundos_arte.FILL_FADE_PX: franja de tierra que funde hacia outer_fill


def near(a, b, tol=1e-3):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def col_diff(p, x0, x1):
    c = p.channels
    tot = 0
    for y in range(p.h):
        i, j = (y * p.w + x0) * c, (y * p.w + x1) * c
        tot += sum(abs(u - v) for u, v in zip(p.px[i:i + c], p.px[j:j + c]))
    return tot / float(p.h * c)


def check_anims(part, pngs, fails, info, label):
    anims = part.get("animations", {})
    for name, spec in anims.items():
        mine = sorted((im["frame"], im["file"]) for im in part["images"] if im.get("animation") == name)
        if "reverse_of" in spec:
            src = anims.get(spec["reverse_of"])
            if not src or "reverse_of" in src or src["frames"] != spec["frames"]:
                fails.append("%s: animación %s: reverse_of %r no es una animación con %d fotogramas" % (
                    label, name, spec["reverse_of"], spec["frames"]))
            if mine:
                fails.append("%s: animación %s: es reverse_of y no puede tener imágenes propias" % (label, name))
            continue
        if [f for f, _ in mine] != list(range(spec["frames"])):
            fails.append("%s: animación %s: fotogramas %r, se esperaban 0..%d" % (label, name, [f for f, _ in mine], spec["frames"] - 1))
            continue
        distinct = len({bytes(pngs[f].px) for _, f in mine if f in pngs})
        if distinct < max(2, spec["frames"] // 2):
            fails.append("%s: animación %s: sólo %d fotogramas distintos de %d" % (label, name, distinct, spec["frames"]))
    for im in part["images"]:
        if "animation" in im and im["animation"] not in anims:
            fails.append("%s: %s nombra la animación %r, que no está en animations" % (label, im["file"], im["animation"]))
        if "animation" not in im and im["frame"] != 0:
            fails.append("%s: %s: imagen fija con frame %d" % (label, im["file"], im["frame"]))
    variants = [im["variant"] for im in part["images"] if "variant" in im]
    if len(set(variants)) != len(variants):
        fails.append("%s: variantes repetidas %r" % (label, variants))


def check_part_sprite(part, pngs, fails, info, ppu, label):
    W, H = part["image"]["width"], part["image"]["height"]
    pv = part["pivot_px"]
    anchors = part["anchors"]
    if anchors.get("pivot") != pv:
        fails.append("%s: anchors.pivot %r no coincide con pivot_px %r" % (label, anchors.get("pivot"), pv))
    for k, pt in anchors.items():
        if not inside(pt, W, H):
            fails.append("%s: anclaje %s fuera de la imagen %r" % (label, k, pt))
    for k in part["anchors_on_art"]:
        if k not in anchors:
            fails.append("%s: anchors_on_art nombra %r, que no es un anclaje" % (label, k))
            continue
        for im in part["images"]:
            p = pngs.get(im["file"])
            if p and not p.near_opaque(anchors[k], ANCHOR_NEAR_PX):
                fails.append("%s: %s: el anclaje %s %r no cae sobre el arte" % (label, im["file"], k, anchors[k]))
    if part["role"] == "puerta" and not {"pie_a", "pie_b"} <= set(anchors):
        fails.append("%s: una puerta necesita los anclajes pie_a y pie_b" % label)
    if part["collision"] in NEEDS_FOOTPRINT and not ("footprint" in part and "hitbox_hint" in part):
        fails.append("%s: colisión %s sin footprint y hitbox_hint" % (label, part["collision"]))
    if "footprint" in part:
        pts = part["footprint"]["points_px"]
        for pt in pts:
            if not inside(pt, W, H):
                fails.append("%s: huella: punto fuera de la imagen %r" % (label, pt))
        radii = [math.hypot(x - pv[0], 2.0 * (y - pv[1])) for x, y in pts]
        hit = part.get("hitbox_hint")
        if not hit:
            fails.append("%s: footprint sin hitbox_hint" % label)
        else:
            if not min(radii) <= hit["radius_px"] <= max(radii) * 1.02:
                fails.append("%s: hitbox_hint: radio %.1f px fuera de la huella (%.1f a %.1f)" % (
                    label, hit["radius_px"], min(radii), max(radii)))
            r = hit["radius_px"]
            if not (0 <= pv[0] - r and pv[0] + r <= W and 0 <= pv[1] - r / 2 and pv[1] + r / 2 <= H):
                fails.append("%s: hitbox_hint: la elipse de %.1f px no cabe en la imagen" % (label, r))
    for name in ("hitbox_hint", "proximity_hint"):
        c = part.get(name)
        if c is None:
            continue
        if c["center_px"] != pv:
            fails.append("%s: %s: el centro %r no es el pivote %r" % (label, name, c["center_px"], pv))
        if abs(c["radius_units"] * ppu - c["radius_px"]) > 0.05:
            fails.append("%s: %s: radius_units × pixels_per_unit (%.2f) ≠ radius_px (%.2f)" % (
                label, name, c["radius_units"] * ppu, c["radius_px"]))
    if part.get("proximity_hint") and part.get("hitbox_hint") and \
            part["proximity_hint"]["radius_px"] < part["hitbox_hint"]["radius_px"]:
        fails.append("%s: proximity_hint más pequeño que hitbox_hint" % label)
    check_anims(part, pngs, fails, info, label)


class Along:
    """Vista de una losa con ejes (across, along): across va de tierra a agua o al revés; along, a lo largo de la costa."""

    def __init__(self, p, axis):
        self.p, self.axis = p, axis
        self.n_across, self.n_along = (p.w, p.h) if axis == "y" else (p.h, p.w)

    def xy(self, a, b):
        return (a, b) if self.axis == "y" else (b, a)

    def alpha(self, a, b):
        return self.p.alpha(*self.xy(a, b))

    def rgb(self, a, b):
        x, y = self.xy(a, b)
        i = (y * self.p.w + x) * self.p.channels
        return tuple(self.p.px[i:i + 3])


def check_place_tile(part, pngs, fails, info, label):
    t = part["tile"]
    axis, land = t["axis"], t["land_side"]
    if (axis == "y") != (land in ("left", "right")):
        fails.append("%s: losa de eje %s con tierra %s" % (label, axis, land))
        return
    if len(part["images"]) != 1:
        fails.append("%s: una losa lleva una sola imagen" % label)
    p = pngs.get(part["images"][0]["file"])
    if not p:
        return
    v = Along(p, axis)
    if t["period_px"] != v.n_along:
        fails.append("%s: period_px %d; la imagen mide %d a lo largo de la costa" % (label, t["period_px"], v.n_along))
    high = land in ("right", "bottom")          # la tierra está del lado de las coordenadas altas
    land_lines = range(v.n_across - TILE_LAND_COLS, v.n_across) if high else range(TILE_LAND_COLS)
    water_lines = range(TILE_WATER_COLS) if high else range(v.n_across - TILE_WATER_COLS, v.n_across)
    fill = tuple(int(t["outer_fill"][i:i + 2], 16) for i in (1, 3, 5))
    not_opaque = sum(1 for a in land_lines for b in range(v.n_along) if v.alpha(a, b) != 255)
    same = sum(1 for a in land_lines for b in range(v.n_along) if v.rgb(a, b) == fill)
    frac = same / float(len(land_lines) * v.n_along)
    if not_opaque:
        fails.append("%s: %d píxeles no opacos en el borde de tierra" % (label, not_opaque))
    if frac < TILE_FILL_MIN:
        fails.append("%s: sólo el %.1f %% del borde de tierra es outer_fill %s" % (label, 100 * frac, t["outer_fill"]))
    not_clear = sum(1 for a in water_lines for b in range(v.n_along) if v.alpha(a, b) != 0)
    if not_clear:
        fails.append("%s: %d píxeles no transparentes en el borde del agua" % (label, not_clear))
    s, c = t["shore_px"], t["collision_px"]
    if not (0 < s["min"] <= s["mean"] <= s["max"] < v.n_across):
        fails.append("%s: shore_px incoherente %r" % (label, s))
        return
    if not (0 < c < v.n_across) or (high and c >= s["min"]) or (not high and c <= s["max"]):
        fails.append("%s: collision_px %.1f no queda del lado del agua de la orilla" % (label, c))
        return
    if not 0 <= t["map_line"]["px"] <= v.n_across:
        fails.append("%s: map_line.px %.1f fuera de la losa" % (label, t["map_line"]["px"]))
    # Los números tienen que describir el arte: tierra opaca detrás de la orilla; agua pasada la colisión. En la
    # losa de abajo lo que está de pie en tierra (farolas, casitas) sube sobre el agua en pantalla: ahí sólo se
    # mide la tierra.
    land_a = int(s["max"] + 4) if high else int(s["min"] - 4)
    bad_land = sum(1 for b in range(v.n_along) if v.alpha(land_a, b) != 255)
    if bad_land:
        fails.append("%s: en %d (detrás de la orilla) hay %d líneas sin tierra opaca" % (label, land_a, bad_land))
    if axis == "y":
        water_a = int(c - 2) if high else int(c + 2)
        bad_water = sum(1 for b in range(v.n_along) if v.alpha(water_a, b) == 255)
        if bad_water:
            fails.append("%s: en %d (pasada la colisión) hay %d líneas opacas" % (label, water_a, bad_water))
    # Costura: la última línea tiene que continuar en la primera como dos líneas vecinas cualesquiera.
    diff = (lambda i, j: row_diff(p, i, j)) if axis == "y" else (lambda i, j: col_diff(p, i, j))
    diffs = sorted(diff(i, i + 1) for i in range(v.n_along - 1))
    median = diffs[len(diffs) // 2]
    seam = diff(v.n_along - 1, 0)
    limit = max(SEAM_FACTOR * median, diffs[int(0.95 * len(diffs))])
    if seam > limit:
        fails.append("%s: la costura salta %.2f (límite %.2f)" % (label, seam, limit))
    info.append("%s: losa en %s, tierra %s, orilla %.0f–%.0f px, colisión %.0f px, línea del mapa %.0f px, relleno %s "
                "(%.1f %%), costura %.2f (mediana %.2f, límite %.2f)" % (
                    label, axis, land, s["min"], s["max"], c, t["map_line"]["px"], t["outer_fill"], 100 * frac,
                    seam, median, limit))


def check_corner(part, pngs, fails, info, label):
    k = part["corner"]
    p = pngs.get(part["images"][0]["file"])
    if not p:
        return
    for side in k["land"]:
        fill_hex = k["outer_fill"].get(side)
        if not fill_hex:
            fails.append("%s: falta outer_fill de %s" % (label, side))
            continue
        fill = tuple(int(fill_hex[i:i + 2], 16) for i in (1, 3, 5))
        others = [s for s in k["land"] if s != side]
        v = Along(p, "y" if side in ("left", "right") else "x")
        lines = range(v.n_across - TILE_LAND_COLS, v.n_across) if side in ("right", "bottom") else range(TILE_LAND_COLS)

        def skip(b):
            # a lo largo del borde, la franja que funde hacia el otro lado de tierra tiene su propio color
            return any((o == "bottom" and b >= v.n_along - FADE_PX) or (o == "left" and b < FADE_PX)
                       or (o == "right" and b >= v.n_along - FADE_PX) for o in others)

        bs = [b for b in range(v.n_along) if not skip(b)]
        not_opaque = sum(1 for a in lines for b in range(v.n_along) if v.alpha(a, b) != 255)
        frac = sum(1 for a in lines for b in bs if v.rgb(a, b) == fill) / float(len(lines) * len(bs))
        if not_opaque:
            fails.append("%s: %d píxeles no opacos en el borde de tierra %s" % (label, not_opaque, side))
        if frac < TILE_FILL_MIN:
            fails.append("%s: sólo el %.1f %% del borde %s es outer_fill %s" % (label, 100 * frac, side, fill_hex))
    # La esquina opuesta a la tierra es agua.
    xs = range(p.w - 8, p.w) if "left" in k["land"] else range(8)
    corner_clear = all(p.alpha(x, y) == 0 for x in xs for y in range(8))
    if not corner_clear:
        fails.append("%s: la esquina del lado del agua no es transparente" % label)
    info.append("%s: esquina con tierra %s, relleno %s" % (label, "+".join(k["land"]), k["outer_fill"]))


def check_place(res_dir, wid, schema, ship_proj, catalog, M, diff_dir):
    fails, info = [], []
    with open(os.path.join(res_dir, "manifest.json"), encoding="utf-8") as f:
        man = json.load(f)
    fails += validate(man, schema, schema)
    if fails:
        return fails, info, 0
    pid = man["id"]
    if pid != os.path.basename(res_dir):
        fails.append("el id %r no es el nombre de la carpeta" % pid)
    if man["world"] != wid:
        fails.append("world %r; la carpeta es del mundo %r" % (man["world"], wid))
    entry = catalog.get(pid)
    pl = man["place"]
    if entry is None:
        fails.append("%r no es un lugar de tools/blender/lugares.json" % pid)
    else:
        try:
            LG.resolve(M, entry["ref"])
            pos = LG.point(LG.resolve(M, entry["pos"]))
            inst = LG.instances(M, entry) if entry.get("instancias") else None
        except (KeyError, ValueError) as e:
            fails.append("lugares.json apunta a algo que no está en mapa.json: %s" % e)
            pos, inst = pl["pos"], pl.get("instances")
        if pl["ref"] != entry["ref"]:
            fails.append("place.ref %r; lugares.json dice %r" % (pl["ref"], entry["ref"]))
        if not near(pl["pos"], pos, 1e-6):
            fails.append("place.pos %r; mapa.json dice %r" % (pl["pos"], pos))
        if inst is not None and (len(pl.get("instances", [])) != len(inst)
                                 or not all(near(a, b, 1e-6) for a, b in zip(pl.get("instances", []), inst))):
            fails.append("place.instances no son las de mapa.json (%d)" % len(inst))
        if pl["event_island"] != bool(entry.get("isla_evento")):
            fails.append("place.event_island %r; lugares.json dice %r" % (pl["event_island"], bool(entry.get("isla_evento"))))
        if pl["event_island"] and not pl["shared_name"]:
            fails.append("una isla de evento lleva el nombre compartido (shared_name)")
    # La misma cámara y densidad que el barco del mundo.
    proj = man["projection"]
    for k in ("camera_elevation_deg", "camera_azimuth_deg", "pixels_per_unit"):
        if abs(proj[k] - ship_proj[k]) > 1e-3:
            fails.append("projection.%s %r; el barco usa %r" % (k, proj[k], ship_proj[k]))
    ppu = man["scale"]["pixels_per_unit"]
    if abs(ppu - proj["pixels_per_unit"]) > 1e-6:
        fails.append("scale.pixels_per_unit no es projection.pixels_per_unit")
    parts = man["parts"]
    ids = [p["id"] for p in parts]
    if len(set(ids)) != len(ids):
        fails.append("piezas repetidas: %r" % ids)
    listed = [im["file"] for p in parts for im in p["images"]]
    if len(set(listed)) != len(listed):
        fails.append("imágenes repetidas entre piezas: %r" % sorted({f for f in listed if listed.count(f) > 1}))
    on_disk = sorted(fn for fn in os.listdir(res_dir) if fn.endswith(".png"))
    if on_disk != sorted(set(listed)):
        fails.append("en disco hay %s; el manifiesto lista %s" % (on_disk, sorted(set(listed))))
    undocumented = sorted({k for p in parts for k in p["anchors"]} - set(man["anchors_doc"]))
    if undocumented:
        fails.append("anclajes sin documentar en anchors_doc: %s" % undocumented)
    pngs = {}
    for part in parts:
        label = part["id"]
        if "map_pos" in part and "offset_units" in part:
            want = [part["map_pos"][0] - pl["pos"][0], part["map_pos"][1] - pl["pos"][1]]
            if not near(part["offset_units"], want):
                fails.append("%s: offset_units %r ≠ map_pos - place.pos %r" % (label, part["offset_units"], want))
        W, H, border = part["image"]["width"], part["image"]["height"], part["image"]["transparent_border_px"]
        mine = {}
        for im in part["images"]:
            path = os.path.join(res_dir, im["file"])
            if not os.path.exists(path):
                continue
            p = Png(path)
            mine[im["file"]] = pngs[im["file"]] = p
            if (p.w, p.h) != (W, H):
                fails.append("%s: %s mide %dx%d, se esperaba %dx%d" % (label, im["file"], p.w, p.h, W, H))
                continue
            if not p.has_alpha:
                fails.append("%s: %s sin canal alfa" % (label, im["file"]))
                continue
            if opaque_bbox(p) is None:
                fails.append("%s: %s: imagen vacía" % (label, im["file"]))
            if border:
                n = border_opaque_fast(p, border)
                if n:
                    fails.append("%s: %s: %d píxeles no transparentes en el borde de %d px" % (label, im["file"], n, border))
        if len(mine) != len(part["images"]) or any((q.w, q.h) != (W, H) for q in mine.values()):
            continue
        if "tile" in part:
            check_place_tile(part, mine, fails, info, label)
        elif "corner" in part:
            check_corner(part, mine, fails, info, label)
        else:
            check_part_sprite(part, mine, fails, info, ppu, label)
        if "attach" in part:
            path = os.path.join(REPO, part["attach"]["sprites"])
            if not os.path.exists(path):
                fails.append("%s: attach.sprites %s no existe" % (label, part["attach"]["sprites"]))
            else:
                with open(path, encoding="utf-8") as f:
                    ship_man = json.load(f)
                if part["attach"]["anchor"] not in ship_man.get("anchors_doc", {}):
                    fails.append("%s: el barco no tiene el anclaje %r" % (label, part["attach"]["anchor"]))
    if diff_dir:
        same, worst = 0, (0.0, None)
        for name, p in sorted(pngs.items()):
            other = os.path.join(diff_dir, name)
            if not os.path.exists(other):
                fails.append("--diff: falta %s" % other)
                continue
            with open(other, "rb") as f1, open(os.path.join(res_dir, name), "rb") as f2:
                if f1.read() == f2.read():
                    same += 1
                    continue
            b = Png(other)
            frac = diff_pixels(p, b) / float(p.w * p.h) if (b.w, b.h) == (p.w, p.h) else 1.0
            if frac > worst[0]:
                worst = (frac, name)
            if frac > MAX_DIFF_FRACTION:
                fails.append("--diff: %s difiere en %.3f %% de píxeles" % (name, 100 * frac))
        info.append("diff: %d/%d PNG idénticos byte a byte; peor %.4f %% (%s)" % (same, len(pngs), 100 * worst[0], worst[1]))
    kinds = {}
    for part in parts:
        kinds[part["role"]] = kinds.get(part["role"], 0) + 1
    info.append("%d piezas (%s), %d imágenes, %d bytes" % (len(parts), ", ".join("%s %d" % kv for kv in sorted(kinds.items())),
                                                          len(pngs), sum(p.size for p in pngs.values())))
    return fails, info, len(pngs)


def check_worlds(art, diff_root, worlds):
    """Cada mundo de WORLDS: una carpeta por lugar de lugares.json, ni una más; cada manifiesto válido."""
    with open(os.path.join(HERE, "place.schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    cat = LG.load_catalog()
    catalog = LG.by_id(cat)
    M = LG.load_map(cat)
    results = []
    for wid in worlds:
        wdir = os.path.join(art, MUNDOS_SUBDIR, wid)
        found = sorted(d for d in os.listdir(wdir) if os.path.isdir(os.path.join(wdir, d))) if os.path.isdir(wdir) else []
        missing = [pid for pid in catalog if pid not in found]
        extra = [d for d in found if d not in catalog]
        if missing or extra:
            results.append(("%s/%s" % (MUNDOS_SUBDIR, wid), "place",
                            ["lugares sin arte: %s; carpetas que no son lugares: %s" % (missing, extra)], [], 0))
        ship_path = None
        for pid in [p for p in catalog if p in found]:
            res_dir = os.path.join(wdir, pid)
            label = "%s/%s/%s" % (MUNDOS_SUBDIR, wid, pid)
            if not os.path.exists(os.path.join(res_dir, "manifest.json")):
                results.append((label, "place", ["falta manifest.json"], [], 0))
                continue
            if ship_path is None:
                with open(os.path.join(res_dir, "manifest.json"), encoding="utf-8") as f:
                    style = json.load(f).get("style")
                ship_path = os.path.join(art, "barco", STYLES_SUBDIR, style, "manifest.json")
                with open(ship_path, encoding="utf-8") as f:
                    ship_proj = json.load(f)["projection"]
            diff_dir = os.path.join(diff_root, MUNDOS_SUBDIR, wid, pid) if diff_root else None
            results.append((label, "place") + check_place(res_dir, wid, schema, ship_proj, catalog, M, diff_dir))
    return results


# --- Islas de Blender del mar 3D (T69): art/islas/3d/ ----------------------------------------
ISLAS_SUBDIR = os.path.join("islas", "3d")
ISLAS_DIR = os.path.join(HERE, "islas")
ISLAS_NOT_ISLANDS = {"__init__", "comun"}


def export_islas_max_tris():
    """MAX_TRIS de export_islas_glb.py: el presupuesto de triángulos de cada isla."""
    with open(os.path.join(HERE, "export_islas_glb.py"), encoding="utf-8") as f:
        tree = ast.parse(f.read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "MAX_TRIS" for t in node.targets):
            return ast.literal_eval(node.value)
    raise ValueError("export_islas_glb.py no define MAX_TRIS")


def glb_summary(path):
    """(triángulos, materiales, mallas, materiales emisivos) de un .glb, leyendo su trozo JSON."""
    with open(path, "rb") as f:
        data = f.read()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("no es un GLB")
    version, length = struct.unpack_from("<II", data, 4)
    clen, ctype = struct.unpack_from("<II", data, 12)
    if version != 2 or length != len(data) or ctype != 0x4E4F534A:
        raise ValueError("cabecera GLB inválida (versión %d, %d/%d bytes)" % (version, length, len(data)))
    doc = json.loads(data[20:20 + clen])
    tris = 0
    for mesh in doc.get("meshes", []):
        for prim in mesh["primitives"]:
            if prim.get("mode", 4) != 4:
                raise ValueError("primitiva que no es de triángulos (mode %r)" % prim.get("mode"))
            acc = prim.get("indices", prim["attributes"]["POSITION"])
            tris += doc["accessors"][acc]["count"] // 3
    mats = doc.get("materials", [])
    glowing = [m for m in mats if any(c > 0 for c in m.get("emissiveFactor", [0, 0, 0]))]
    return tris, len(mats), len(doc.get("meshes", [])), len(glowing)


def check_islas_3d(art):
    """-> (label, kind, fails, info, n_glb). Cada isla de tools/blender/islas/ con su GLB, en presupuesto."""
    label = ISLAS_SUBDIR.replace(os.sep, "/")
    fails, info = [], []
    res = os.path.join(art, ISLAS_SUBDIR)
    mpath = os.path.join(res, "manifest.json")
    modules = sorted(f[:-3] for f in os.listdir(ISLAS_DIR) if f.endswith(".py") and f[:-3] not in ISLAS_NOT_ISLANDS)
    if not os.path.exists(mpath):
        return label, "island-glb", ["falta %s (Blender -b -P tools/blender/export_islas_glb.py)"
                                     % os.path.relpath(mpath, REPO)], info, 0
    with open(mpath, encoding="utf-8") as f:
        man = json.load(f)
    with open(os.path.join(HERE, "isla3d.schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    errs = validate(man, schema, schema)
    if errs:
        return label, "island-glb", errs, info, 0
    budget = export_islas_max_tris()
    if man["max_tris"] != budget:
        fails.append("max_tris %d; export_islas_glb.MAX_TRIS es %d (vuelve a exportar)" % (man["max_tris"], budget))
    ids = [e["id"] for e in man["islas"]]
    if len(set(ids)) != len(ids):
        fails.append("ids repetidos: %s" % ids)
    for m in modules:
        if m not in ids:
            fails.append("tools/blender/islas/%s.py sin GLB en el manifiesto (exporta con --only %s)" % (m, m))
    on_disk = sorted(f for f in os.listdir(res) if f.endswith(".glb"))
    listed = sorted(e["file"] for e in man["islas"])
    if on_disk != listed:
        fails.append("GLB en la carpeta %s; en el manifiesto %s" % (on_disk, listed))
    for e in man["islas"]:
        iid = e["id"]
        if iid not in modules:
            fails.append("%s: sin módulo tools/blender/islas/%s.py" % (iid, iid))
        if e["file"] != iid + ".glb":
            fails.append("%s: el archivo se llama %r (se espera %s.glb)" % (iid, e["file"], iid))
        path = os.path.join(res, e["file"])
        if not os.path.exists(path):
            fails.append("%s: falta %s" % (iid, e["file"]))
            continue
        try:
            tris, n_mats, n_meshes, n_glow = glb_summary(path)
        except (ValueError, KeyError, IndexError, json.JSONDecodeError) as err:
            fails.append("%s: %s ilegible: %s" % (iid, e["file"], err))
            continue
        if tris > budget:
            fails.append("%s: %d triángulos > presupuesto %d" % (iid, tris, budget))
        if tris != e["tris"]:
            fails.append("%s: el GLB tiene %d triángulos; el manifiesto dice %d" % (iid, tris, e["tris"]))
        if n_meshes != 1:
            fails.append("%s: %d mallas (se juntan en una: una llamada de dibujo por material)" % (iid, n_meshes))
        if e["height"] <= e["top"]:
            fails.append("%s: alto %r no supera la cima %r" % (iid, e["height"], e["top"]))
        info.append("%s: %d/%d triángulos, %d materiales (%d emisivos), %d kB"
                    % (iid, tris, budget, n_mats, n_glow, os.path.getsize(path) // 1024))
    return label, "island-glb", fails, info, len(man["islas"])


# --- Enemigos de Blender del mar 3D (plan 015, T174): art/enemigos/3d/ ------------------------------
ENEMIGOS_SUBDIR = os.path.join("enemigos", "3d")
ENEMIGOS_DIR = os.path.join(HERE, "enemigos")
ENEMIGOS_NOT_ENEMIES = {"__init__"}


def export_enemigos_max_tris():
    """MAX_TRIS de export_enemigos_glb.py: el presupuesto de triángulos de cada enemigo."""
    return module_constants(os.path.join(HERE, "export_enemigos_glb.py"), ["MAX_TRIS"])["MAX_TRIS"]


def check_enemigos_3d(art):
    """-> (label, kind, fails, info, n_glb). Cada enemigo de tools/blender/enemigos/ con su GLB, en presupuesto,
    una sola malla, sin texturas ni transformaciones en los nodos (/mar lo aplana a una geometría con el color
    en los vértices y lo escala por `radius`)."""
    label = ENEMIGOS_SUBDIR.replace(os.sep, "/")
    fails, info = [], []
    res = os.path.join(art, ENEMIGOS_SUBDIR)
    mpath = os.path.join(res, "manifest.json")
    modules = sorted(f[:-3] for f in os.listdir(ENEMIGOS_DIR)
                     if f.endswith(".py") and f[:-3] not in ENEMIGOS_NOT_ENEMIES)
    if not os.path.exists(mpath):
        return label, "enemy-glb", ["falta %s (Blender -b -P tools/blender/export_enemigos_glb.py)"
                                    % os.path.relpath(mpath, REPO)], info, 0
    with open(mpath, encoding="utf-8") as f:
        man = json.load(f)
    with open(os.path.join(HERE, "enemigo3d.schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    errs = validate(man, schema, schema)
    if errs:
        return label, "enemy-glb", errs, info, 0
    budget = export_enemigos_max_tris()
    if man["max_tris"] != budget:
        fails.append("max_tris %d; export_enemigos_glb.MAX_TRIS es %d (vuelve a exportar)" % (man["max_tris"], budget))
    ids = [e["id"] for e in man["enemigos"]]
    if len(set(ids)) != len(ids):
        fails.append("ids repetidos: %s" % ids)
    for m in modules:
        if m not in ids:
            fails.append("tools/blender/enemigos/%s.py sin GLB en el manifiesto (exporta con --only %s)" % (m, m))
    on_disk = sorted(f for f in os.listdir(res) if f.endswith(".glb"))
    listed = sorted(e["file"] for e in man["enemigos"])
    if on_disk != listed:
        fails.append("GLB en la carpeta %s; en el manifiesto %s" % (on_disk, listed))
    for e in man["enemigos"]:
        eid = e["id"]
        if eid not in modules:
            fails.append("%s: sin módulo tools/blender/enemigos/%s.py" % (eid, eid))
        else:
            consts = module_constants(os.path.join(ENEMIGOS_DIR, eid + ".py"), ["RADIUS"])
            if abs(consts["RADIUS"] - e["radius"]) > 1e-9:
                fails.append("%s: radius %r en el manifiesto; RADIUS %r en el módulo" % (eid, e["radius"], consts["RADIUS"]))
        if e["file"] != eid + ".glb":
            fails.append("%s: el archivo se llama %r (se espera %s.glb)" % (eid, e["file"], eid))
        path = os.path.join(res, e["file"])
        if not os.path.exists(path):
            fails.append("%s: falta %s" % (eid, e["file"]))
            continue
        try:
            tris, n_mats, n_meshes, n_glow = glb_summary(path)
            doc = glb_doc(path)
        except (ValueError, KeyError, IndexError, json.JSONDecodeError) as err:
            fails.append("%s: %s ilegible: %s" % (eid, e["file"], err))
            continue
        if tris > budget:
            fails.append("%s: %d triángulos > presupuesto %d" % (eid, tris, budget))
        if tris != e["tris"]:
            fails.append("%s: el GLB tiene %d triángulos; el manifiesto dice %d" % (eid, tris, e["tris"]))
        if n_meshes != 1:
            fails.append("%s: %d mallas (se juntan en una: una llamada de dibujo por material)" % (eid, n_meshes))
        if doc.get("images") or doc.get("textures") or any("uri" in b for b in doc.get("buffers", [])):
            fails.append("%s: con texturas o archivos aparte (tiene que ir solo, un color plano por material)" % eid)
        if any(any(k in n for k in ("matrix", "translation", "rotation", "scale")) for n in doc.get("nodes", [])):
            fails.append("%s: nodos con transformación (la malla va en unidades del modelo, sin mover)" % eid)
        if e["length"] <= 0 or e["height"] <= 0:
            fails.append("%s: largo %r y alto %r tienen que ser positivos" % (eid, e["length"], e["height"]))
        info.append("%s: %d/%d triángulos, %d materiales (%d emisivos), %d kB"
                    % (eid, tris, budget, n_mats, n_glow, os.path.getsize(path) // 1024))
    return label, "enemy-glb", fails, info, len(man["enemigos"])


# --- Props del hero de la landing (T78): art/landing/3d/ y los stills ----------------------------
LANDING_SUBDIR = os.path.join("landing", "3d")
LANDING_TOOLS = os.path.join(HERE, "landing")


def module_constants(path, names):
    """Los literales de nivel superior `names` de un script (sin importarlo: usa bpy)."""
    with open(path, encoding="utf-8") as f:
        tree = ast.parse(f.read())
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if getattr(t, "id", None) in names:
                    out[t.id] = ast.literal_eval(node.value)
    missing = set(names) - set(out)
    if missing:
        raise ValueError("%s no define %s" % (os.path.relpath(path, REPO), ", ".join(sorted(missing))))
    return out


def glb_doc(path):
    """El trozo JSON de un .glb (cabecera comprobada)."""
    with open(path, "rb") as f:
        data = f.read()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("no es un GLB")
    version, length = struct.unpack_from("<II", data, 4)
    clen, ctype = struct.unpack_from("<II", data, 12)
    if version != 2 or length != len(data) or ctype != 0x4E4F534A:
        raise ValueError("cabecera GLB inválida (versión %d, %d/%d bytes)" % (version, length, len(data)))
    return json.loads(data[20:20 + clen])


def check_landing_3d(art):
    """-> (label, kind, fails, info, n_glb). Cada prop de export_landing_glb.PROPS con su GLB, en presupuesto."""
    label = LANDING_SUBDIR.replace(os.sep, "/")
    fails, info = [], []
    res = os.path.join(art, LANDING_SUBDIR)
    mpath = os.path.join(res, "manifest.json")
    consts = module_constants(os.path.join(LANDING_TOOLS, "export_landing_glb.py"), ("PROPS", "TOTAL_TRIS", "TOTAL_KB"))
    stills = module_constants(os.path.join(LANDING_TOOLS, "render_hero_still.py"), ("LIMITS_KB", "FILES"))
    if not os.path.exists(mpath):
        return label, "landing-glb", ["falta %s (Blender -b -P tools/blender/landing/export_landing_glb.py)"
                                      % os.path.relpath(mpath, REPO)], info, 0
    with open(mpath, encoding="utf-8") as f:
        man = json.load(f)
    with open(os.path.join(HERE, "landing3d.schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    errs = validate(man, schema, schema)
    if errs:
        return label, "landing-glb", errs, info, 0
    if man["max_tris"] != consts["TOTAL_TRIS"] or man["max_kb"] != consts["TOTAL_KB"]:
        fails.append("max_tris/max_kb %d/%d; export_landing_glb dice %d/%d (vuelve a exportar)"
                     % (man["max_tris"], man["max_kb"], consts["TOTAL_TRIS"], consts["TOTAL_KB"]))
    ids = [e["id"] for e in man["props"]]
    if ids != list(consts["PROPS"]):
        fails.append("props %s; export_landing_glb.PROPS es %s" % (ids, list(consts["PROPS"])))
    for pid in consts["PROPS"]:
        if not os.path.exists(os.path.join(LANDING_TOOLS, pid + ".py")):
            fails.append("%s: sin módulo tools/blender/landing/%s.py" % (pid, pid))
    on_disk = sorted(f for f in os.listdir(res) if f.endswith(".glb"))
    listed = sorted(e["file"] for e in man["props"])
    if on_disk != listed:
        fails.append("GLB en la carpeta %s; en el manifiesto %s" % (on_disk, listed))
    if set(man["escena"]["props"]) != set(ids):
        fails.append("escena.props %s no coincide con los props %s" % (sorted(man["escena"]["props"]), ids))
    total_tris, total_kb = 0, 0
    for e in man["props"]:
        pid = e["id"]
        if e["file"] != pid + ".glb":
            fails.append("%s: el archivo se llama %r (se espera %s.glb)" % (pid, e["file"], pid))
        path = os.path.join(res, e["file"])
        if not os.path.exists(path):
            fails.append("%s: falta %s" % (pid, e["file"]))
            continue
        try:
            doc = glb_doc(path)
            tris, n_mats, n_meshes, n_glow = glb_summary(path)
        except (ValueError, KeyError, IndexError, json.JSONDecodeError) as err:
            fails.append("%s: %s ilegible: %s" % (pid, e["file"], err))
            continue
        kb = -(-os.path.getsize(path) // 1024)
        total_tris += tris
        total_kb += kb
        if tris != e["tris"]:
            fails.append("%s: el GLB tiene %d triángulos; el manifiesto dice %d" % (pid, tris, e["tris"]))
        if kb != e["kb"]:
            fails.append("%s: el GLB pesa %d kB; el manifiesto dice %d" % (pid, kb, e["kb"]))
        if tris > e["budget_tris"]:
            fails.append("%s: %d triángulos > presupuesto %d" % (pid, tris, e["budget_tris"]))
        if n_mats > 4:
            fails.append("%s: %d materiales > 4" % (pid, n_mats))
        if n_meshes != 1 + len(e["lights"]):
            fails.append("%s: %d mallas (se espera 1 principal + %d luces)" % (pid, n_meshes, len(e["lights"])))
        nodes = {n.get("name") for n in doc.get("nodes", [])}
        for light in e["lights"]:
            if light["node"] not in nodes:
                fails.append("%s: el nodo %s no está en el GLB" % (pid, light["node"]))
        if n_glow != len({light["color"] for light in e["lights"]}) and e["lights"]:
            fails.append("%s: %d materiales emisivos para %d colores de luz" % (pid, n_glow, len({l["color"] for l in e["lights"]})))
        if "KHR_draco_mesh_compression" in doc.get("extensionsRequired", []):
            fails.append("%s: usa Draco (/mar no tiene descodificador)" % pid)
        if doc.get("images") or doc.get("textures"):
            fails.append("%s: lleva texturas (el presupuesto es por colores de vértice)" % pid)
        info.append("%s: %d/%d triángulos, %d materiales (%d emisivos), %d luces, %d kB"
                    % (pid, tris, e["budget_tris"], n_mats, n_glow, len(e["lights"]), kb))
    if total_tris != man["total_tris"] or total_kb != man["total_kb"]:
        fails.append("totales %d triángulos / %d kB; el manifiesto dice %d / %d"
                     % (total_tris, total_kb, man["total_tris"], man["total_kb"]))
    if total_tris > man["max_tris"]:
        fails.append("total %d triángulos > %d" % (total_tris, man["max_tris"]))
    if total_kb > man["max_kb"]:
        fails.append("total %d kB > %d" % (total_kb, man["max_kb"]))
    for phase, pattern in stills["FILES"].items():
        for size, limit in stills["LIMITS_KB"].items():
            spath = os.path.join(art, "landing", pattern % size)
            if not os.path.exists(spath):
                fails.append("falta el still %s (Blender -b -P tools/blender/landing/render_hero_still.py)"
                             % os.path.relpath(spath, REPO))
                continue
            with open(spath, "rb") as f:
                head = f.read(16)
            if head[:4] != b"RIFF" or head[8:12] != b"WEBP":
                fails.append("%s: no es WebP" % os.path.relpath(spath, REPO))
            skb = os.path.getsize(spath) / 1024.0
            if skb > limit:
                fails.append("%s: %.1f kB > %d" % (os.path.relpath(spath, REPO), skb, limit))
            info.append("still %s: %.1f/%d kB" % (pattern % size, skb, limit))
    info.append("total %d/%d triángulos, %d/%d kB" % (total_tris, man["max_tris"], total_kb, man["max_kb"]))
    return label, "landing-glb", fails, info, len(man["props"])


def expected_worlds():
    with open(os.path.join(HERE, "render.py"), encoding="utf-8") as f:
        tree = ast.parse(f.read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "WORLDS" for t in node.targets):
            return ast.literal_eval(node.value)
    return []


def expected_resources():
    """La lista RESOURCES de render.py: el check exige exactamente esas carpetas."""
    with open(os.path.join(HERE, "render.py"), encoding="utf-8") as f:
        tree = ast.parse(f.read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "RESOURCES" for t in node.targets):
            return ast.literal_eval(node.value)
    raise ValueError("render.py no define RESOURCES")


def check_decor_3d(art):
    """Standalone decor contract: editable source, local GLB, fixed navigable footprint."""
    label = "decor/3d"
    folder = os.path.join(art, "decor", "3d")
    fails = []
    try:
        with open(os.path.join(folder, "manifest.json"), encoding="utf-8") as f:
            man = json.load(f)
        with open(os.path.join(HERE, "decor3d.schema.json"), encoding="utf-8") as f:
            schema = json.load(f)
        fails += validate(man, schema, schema)
        if fails:
            return label, "decor-glb", fails, [], 0
        path = os.path.join(folder, man["file"])
        tris, mats, meshes, _ = glb_summary(path)
        size = os.path.getsize(path)
        if tris != man["tris"] or tris > man["max_tris"]:
            fails.append("GLB triangle count / budget mismatch")
        if size != man["bytes"] or size > man["max_bytes"]:
            fails.append("GLB byte count / budget mismatch")
        if meshes != 1 or mats > 8:
            fails.append("expected one mesh and at most eight materials")
        with open(os.path.join(folder, man["source"]), "rb") as f:
            if not f.read(7).startswith(b"BLENDER"):
                fails.append("editable Blender source missing or invalid")
        with open(path, "rb") as f:
            data = f.read()
        length = struct.unpack_from("<I", data, 12)[0]
        doc = json.loads(data[20:20 + length])
        binary = data[28 + length:]
        if doc.get("images") or any("uri" in b for b in doc.get("buffers", [])):
            fails.append("decor must be self-contained without textures")
        if any(any(k in node for k in ("matrix", "translation", "rotation", "scale")) for node in doc.get("nodes", [])):
            fails.append("decor transforms must be baked into scene units")
        for mesh in doc["meshes"]:
            for prim in mesh["primitives"]:
                acc = doc["accessors"][prim["attributes"]["POSITION"]]
                view = doc["bufferViews"][acc["bufferView"]]
                if acc["componentType"] != 5126 or acc["type"] != "VEC3":
                    fails.append("expected float VEC3 positions")
                    continue
                offset = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
                stride = view.get("byteStride", 12)
                for i in range(acc["count"]):
                    x, y, z = struct.unpack_from("<fff", binary, offset + i * stride)
                    if not all(math.isfinite(v) for v in (x, y, z)) or math.hypot(x, z) > man["radius"] + .001:
                        fails.append("geometry exceeds the existing radius-13 navigable footprint")
                        break
        return label, "decor-glb", fails, ["%d triangles, %d bytes, %d materials" % (tris, size, mats)], 1
    except (OSError, ValueError, KeyError, IndexError, struct.error) as err:
        return label, "decor-glb", [str(err)], [], 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--art", default=os.path.join(REPO, "art"), help="raíz con una carpeta por recurso")
    ap.add_argument("--diff", nargs="?", const=os.path.join(HERE, "out", "rerun"), default=None,
                    help="otra salida de render.py -- --all (misma estructura) con la que comparar")
    a = ap.parse_args()
    with open(os.path.join(HERE, "asset.schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    expected = expected_resources()
    found = sorted(d for d in os.listdir(a.art) if os.path.exists(os.path.join(a.art, d, "manifest.json")))
    total_fails = 0
    if sorted(expected) != found:
        print("FALLO recursos: render.py lista %s; en %s hay %s" % (sorted(expected), os.path.relpath(a.art, REPO), found))
        total_fails += 1
    counts = {}
    batches = []
    for rid in [r for r in expected if r in found] + [r for r in found if r not in expected]:
        res_dir = os.path.join(a.art, rid)
        diff_dir = os.path.join(a.diff, rid) if a.diff else None
        with open(os.path.join(res_dir, "manifest.json"), encoding="utf-8") as f:
            kind = json.load(f).get("kind", "ship")
        if kind == "ship":
            results = [(rid, kind) + check_ship(res_dir, diff_dir, skip_dirs=(STYLES_SUBDIR,))]
            results += check_ship_styles(rid, res_dir, diff_dir)
        else:
            results = [(rid, kind) + check_world(res_dir, schema, diff_dir, found)]
        batches.append(results)
    worlds = expected_worlds()
    batches.append(check_worlds(a.art, a.diff, worlds))
    batches.append([check_titulo.check_title(a.art, Png, a.diff)])   # art/intro/titulo/ (T27)
    batches.append([check_islas_3d(a.art)])   # art/islas/3d/ (T69)
    batches.append([check_landing_3d(a.art)])   # art/landing/3d/ y los stills (T78)
    batches.append([check_decor_3d(a.art)])   # art/decor/3d/ (T101)
    batches.append([check_enemigos_3d(a.art)])   # art/enemigos/3d/ (plan 015, T174)
    mdir = os.path.join(a.art, MUNDOS_SUBDIR)
    extra_worlds = sorted(set(os.listdir(mdir)) - set(worlds)) if os.path.isdir(mdir) else []
    if extra_worlds:
        print("FALLO mundos: hay carpetas de mundos que render.py no lista en WORLDS: %s" % extra_worlds)
        total_fails += 1
    for results in batches:
        for label, kind_, fails, info, n in results:
            for line in info:
                print("%s: %s" % (label, line))
            for f in fails:
                print("FALLO %s: %s" % (label, f))
            if fails:
                print("%s (%s): %d fallos" % (label, kind_, len(fails)))
            else:
                print("%s (%s): %d %s, manifest válido" % (label, kind_, n, "imagen" if n == 1 else "imágenes"))
                counts[label] = n
            total_fails += len(fails)
    if total_fails:
        print("%d fallos" % total_fails)
        return 1
    print("%d manifiestos válidos, %d imágenes (%s)" % (
        len(counts), sum(counts.values()), ", ".join("%s %d" % kv for kv in counts.items())))
    for wid in worlds:
        mine = {k: v for k, v in counts.items() if k.startswith("%s/%s/" % (MUNDOS_SUBDIR, wid))}
        print("mundo %s: %d lugares válidos, %d imágenes" % (wid, len(mine), sum(mine.values())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
