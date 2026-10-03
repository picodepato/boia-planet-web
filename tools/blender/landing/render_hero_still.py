"""The stills of the hero scene for the static version of the landing (plan 007, T78). MUESTRA.

Renders escena.py with EEVEE (volumetric haze, ray-traced reflections, depth
of field focused on the boat, bloom in the compositor) at 1600x1000, then a
post pass in numpy (vignette 0.45, film grain 7 %, the look of design
document section 3.1), and writes WebP at 1600 and 800 px within the size
limits of section 12 (the quality drops until the file fits):

    art/landing/hero-still-1600.webp        golden hour, <= 120 kB
    art/landing/hero-still-800.webp         <= 50 kB
    art/landing/hero-still-noche-1600.webp  night, same limits
    art/landing/hero-still-noche-800.webp

    blender -b -P tools/blender/landing/render_hero_still.py
    blender -b -P tools/blender/landing/render_hero_still.py -- --phase golden --samples 16 --scale 50 --out /tmp/x

Reproducible: fixed samples, fixed ocean time and seed, seeded grain; two runs
give the same look and the same file sizes, but EEVEE's GPU sampling is not
bit-exact, so the WebP bytes differ run to run (the GLBs of
export_landing_glb.py are byte-identical). Exit 1 if a still cannot fit its limit.
"""
import argparse
import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import escena  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(REPO, "art", "landing")
WIDTH, HEIGHT = 1600, 1000
SAMPLES = 64
LIMITS_KB = {1600: 120, 800: 50}
FILES = {"golden": "hero-still-%d.webp", "night": "hero-still-noche-%d.webp"}
GRAIN = 0.055
VIGNETTE = 0.45
GRAIN_SEED = 20261003


def setup_render(scene, samples, scale):
    r = scene.render
    r.engine = "BLENDER_EEVEE"
    r.resolution_x = WIDTH
    r.resolution_y = HEIGHT
    r.resolution_percentage = scale
    r.film_transparent = False
    r.filter_size = 1.3
    r.use_compositing = True
    r.use_sequencer = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    for attr in dir(r):
        if attr.startswith("use_stamp"):
            setattr(r, attr, False)
    e = scene.eevee
    e.taa_render_samples = samples
    e.use_raytracing = True
    e.use_volumetric_shadows = True
    e.volumetric_tile_size = "4"
    e.volumetric_samples = 96
    e.volumetric_start = 1.0
    e.volumetric_end = 4000.0
    e.use_shadows = True
    e.shadow_ray_count = 2
    e.shadow_step_count = 4
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0


def compositor(scene, phase):
    """Bloom on the bright points (sun disc, lamps, the sun path) before the numpy post (Blender 5: node group)."""
    ng = bpy.data.node_groups.new("hero_post", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    scene.compositing_node_group = ng
    rl = ng.nodes.new("CompositorNodeRLayers")
    glare = ng.nodes.new("CompositorNodeGlare")
    for value in ("Bloom", "BLOOM"):
        try:
            glare.inputs["Type"].default_value = value
            break
        except TypeError:
            continue
    for value in ("High", "HIGH"):
        try:
            glare.inputs["Quality"].default_value = value
            break
        except TypeError:
            continue
    night = phase == "night"
    for name, value in (("Threshold", 0.5 if night else 1.2), ("Strength", 0.4 if night else 0.22),
                        ("Size", 0.7 if night else 0.65), ("Saturation", 0.9), ("Smoothness", 0.4)):
        glare.inputs[name].default_value = value
    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
    ng.links.new(glare.outputs["Image"], out.inputs["Image"])


def post(path_png, phase):
    """Vignette and film grain on the rendered PNG; returns a float RGB array (h, w, 3) in display space."""
    img = bpy.data.images.load(path_png)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    rgb = px.reshape(h, w, 4)[:, :, :3]
    yy, xx = np.mgrid[0:h, 0:w]
    u = (xx / (w - 1) - 0.5) * 2.0
    v = (yy / (h - 1) - 0.5) * 2.0
    r2 = (u * u + v * v * 1.1) / 2.1
    vig = 1.0 - VIGNETTE * np.clip(r2, 0.0, 1.0) ** 1.6
    rgb = rgb * vig[:, :, None]
    rng = np.random.default_rng(GRAIN_SEED + (1 if phase == "night" else 0))
    noise = rng.standard_normal((h, w, 1)).astype(np.float32)
    # Grain shows in the mid tones and shadows, less in the highlights.
    lum = rgb.mean(axis=2, keepdims=True)
    rgb = rgb + noise * GRAIN * (0.35 + 0.65 * (1.0 - lum)) * 0.5
    return np.clip(rgb, 0.0, 1.0)


def write_webp(rgb, path, limit_kb):
    """Save as WebP, lowering the quality until the file fits; returns (kB, quality)."""
    h, w, _ = rgb.shape
    img = bpy.data.images.new("still", w, h, alpha=False, float_buffer=False)
    rgba = np.ascontiguousarray(np.concatenate([rgb, np.ones((h, w, 1), dtype=np.float32)], axis=2), dtype=np.float32).ravel()
    img.pixels.foreach_set(rgba)
    img.file_format = "WEBP"
    img.filepath_raw = path
    for q in (92, 88, 84, 80, 76, 72, 68, 64, 60, 55, 50, 45, 40, 35, 30):
        img.save(filepath=path, quality=q)
        kb = os.path.getsize(path) / 1024.0
        if kb <= limit_kb:
            bpy.data.images.remove(img)
            return kb, q
    bpy.data.images.remove(img)
    return kb, q


def downscale(rgb, factor):
    """Box-filter downscale by an integer factor."""
    h, w, c = rgb.shape
    return rgb[:h - h % factor, :w - w % factor].reshape(h // factor, factor, w // factor, factor, c).mean(axis=(1, 3))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", nargs="*", choices=list(FILES), default=list(FILES))
    ap.add_argument("--samples", type=int, default=SAMPLES)
    ap.add_argument("--scale", type=int, default=100, help="resolution percentage (previews)")
    ap.add_argument("--out", default=OUT, help="output folder (default: art/landing)")
    ap.add_argument("--keep-png", action="store_true", help="keep the raw render next to the WebP")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    failed = []
    for phase in a.phase:
        scene, _ = escena.assemble(phase)
        setup_render(scene, a.samples, a.scale)
        compositor(scene, phase)
        png = os.path.join(a.out, "hero-still-%s-raw.png" % phase)
        scene.render.filepath = png
        bpy.ops.render.render(write_still=True)
        rgb = post(png, phase)
        for size in (1600, 800):
            arr = rgb if size == 1600 else downscale(rgb, 2)
            path = os.path.join(a.out, FILES[phase] % size)
            kb, q = write_webp(arr, path, LIMITS_KB[size])
            print("[still] %s: %dx%d, %.1f kB (limit %d) at quality %d" % (os.path.relpath(path, REPO), arr.shape[1],
                                                                          arr.shape[0], kb, LIMITS_KB[size], q))
            if kb > LIMITS_KB[size]:
                failed.append("%s: %.1f kB > %d" % (path, kb, LIMITS_KB[size]))
        if not a.keep_png:
            os.remove(png)
    if failed:
        print("[still] over the size limit: %s" % "; ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
