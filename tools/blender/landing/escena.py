"""The hero scene of the landing assembled in Blender (plan 007, T78). MUESTRA.

The same props, palette and camera the live three.js scene uses (design
document sections 3, 5.2, 7 and 12): the deck camera inside the harbour
looking out through the mouth, the boat ahead, the breakwaters left and
right with their beacons, the coast on the left, the buoy on the right, the
sun (or the moon) low at x 66 %, real water (the Ocean modifier), low haze
(a volume box), stars at night. render_hero_still.py renders it; LAYOUT is
also written into art/landing/3d/manifest.json (`escena`) so T79 places the
GLBs the same way.

Blender axes: the camera looks to +Y (seaward), X is right, Z up, metres.
glTF: y up and -z seaward (comun.py); `gltf()` converts.
"""
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comun as K  # noqa: E402

# Section 12: horizon at 42 %, the sun at x 66 % and 4 degrees up, the boat at x 50 % / y 56 %, the
# breakwaters left and right of it, the coast on the left, the buoy at x ~84 %. Vertical FOV 40 degrees
# (section 5.2 at 1280 px); 16:10 frame. Pitch -3.33 degrees puts the horizon at 42 % from the top.
LAYOUT = {
    "camera": {"position": [0.0, 0.0, 10.0], "pitch_deg": -3.33, "fov_vertical_deg": 40.0, "aspect": 1.6,
               "focus": "barco"},
    "props": {
        "barco": {"position": [0.0, 105.0, 0.0], "yaw_deg": 0.0},
        "puerto": {"position": [0.0, 170.0, 0.0], "yaw_deg": 0.0},
        "boya": {"position": [42.0, 100.0, 0.0], "yaw_deg": 20.0},
        "costa": {"position": [-190.0, 330.0, 0.0], "yaw_deg": 0.0},
    },
    # Direction of the sun (golden) and the moon (night): azimuth right of seaward, elevation above the horizon.
    "sun": {"azimuth_deg": 10.6, "elevation_deg": 4.0},
    "moon": {"azimuth_deg": 10.6, "elevation_deg": 4.0},
}

PHASES = {
    "golden": {"grade": K.GRADES["golden"], "sun_strength": 3.0, "sun_angle_deg": 1.6, "sun_color": "#ffd9a0",
               "ambient": 0.3, "glow": 3.0, "stars": 0.25, "disc": "#ffd9a0", "disc_strength": 40.0,
               "disc_radius": 70.0, "haze_density": 0.0005, "haze_height": 55.0, "exposure": 0.0},
    "night": {"grade": K.GRADES["night"], "sun_strength": 0.4, "sun_angle_deg": 1.0, "sun_color": "#c8d4ff",
              "ambient": 1.3, "glow": 10.0, "stars": 1.0, "disc": "#dfe6ff", "disc_strength": 6.0,
              "disc_radius": 45.0, "haze_density": 0.0004, "haze_height": 45.0, "exposure": 0.0},
}

OCEAN = {"spatial_size": 90, "repeat": 14, "resolution": 11, "wave_scale": 0.32, "choppiness": 1.0,
         "wind_velocity": 5.0, "wave_alignment": 1.5, "wave_direction_deg": 25.0, "time": 7.3, "seed": 7}


def gltf(v):
    """Blender (x, y, z) -> glTF (x, y up, z): glTF -z is Blender +Y (seaward)."""
    return [round(v[0], 3) + 0.0, round(v[2], 3) + 0.0, round(-v[1], 3) + 0.0]


def layout_gltf():
    """LAYOUT with positions in glTF axes (what the manifest carries for T79)."""
    cam = dict(LAYOUT["camera"])
    cam["position"] = gltf(LAYOUT["camera"]["position"])
    props = {k: {"position": gltf(v["position"]), "yaw_deg": v["yaw_deg"]} for k, v in LAYOUT["props"].items()}
    return {"camera": cam, "props": props, "sun": LAYOUT["sun"], "moon": LAYOUT["moon"],
            "nota": "positions in glTF axes (y up, -z seaward: the camera looks to -z); yaw about the up axis, "
                    "degrees, 0 = the prop's own seaward side to -z"}


def direction(azimuth_deg, elevation_deg):
    """Unit vector from the camera toward a sky point: azimuth right of seaward (+Y), elevation up."""
    az, el = math.radians(azimuth_deg), math.radians(elevation_deg)
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def place_props(scene):
    """Build every prop module and move it to its LAYOUT pose; returns {id: [objects]}."""
    import boya
    import costa
    import puerto
    import barco
    placed = {}
    for mod in (costa, puerto, barco, boya):
        info = mod.build()
        objs = list(info["main"]) + [ob for _, ob, _ in info["lights"]]
        pose = LAYOUT["props"][mod.ID]
        rot = Euler((0.0, 0.0, math.radians(pose["yaw_deg"])), "XYZ")
        for ob in objs:
            ob.matrix_world = Matrix.Translation(Vector(pose["position"])) @ rot.to_matrix().to_4x4() @ ob.matrix_world
        placed[mod.ID] = objs
    return placed


def set_glow(strength):
    for m in bpy.data.materials:
        if m.name.startswith("luz") and m.node_tree:
            b = m.node_tree.nodes.get("Principled BSDF")
            if b:
                b.inputs["Emission Strength"].default_value = strength


def water(scene, phase):
    """A plane with the Ocean modifier (real swell) and a dark glossy material: the sun path comes from the sun."""
    g = PHASES[phase]["grade"]
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, OCEAN["spatial_size"] * OCEAN["repeat"] * 0.25, 0.0))
    sea = bpy.context.active_object
    sea.name = "mar"
    mod = sea.modifiers.new("ocean", "OCEAN")
    mod.geometry_mode = "GENERATE"
    mod.spatial_size = OCEAN["spatial_size"]
    mod.repeat_x = OCEAN["repeat"]
    mod.repeat_y = OCEAN["repeat"]
    mod.resolution = OCEAN["resolution"]
    mod.viewport_resolution = OCEAN["resolution"]
    mod.wave_scale = OCEAN["wave_scale"]
    mod.choppiness = OCEAN["choppiness"]
    mod.wind_velocity = OCEAN["wind_velocity"]
    mod.wave_alignment = OCEAN["wave_alignment"]
    mod.wave_direction = math.radians(OCEAN["wave_direction_deg"])
    mod.random_seed = OCEAN["seed"]
    mod.time = OCEAN["time"]
    mod.use_normals = True
    mod.depth = 200.0
    mod.size = 1.0
    sea.data.materials.append(water_material(g))
    for p in sea.data.polygons:
        p.use_smooth = True
    # The far water out to the horizon: a flat plane under the ocean tile, same material.
    bpy.ops.mesh.primitive_plane_add(size=40000.0, location=(0.0, 0.0, -0.3))
    far = bpy.context.active_object
    far.name = "mar_lejos"
    far.data.materials.append(sea.data.materials[0])
    return sea


def water_material(g):
    m = bpy.data.materials.new("agua")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = K.hex_lin(g["water_deep"])
    b.inputs["Roughness"].default_value = 0.1
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["IOR"].default_value = 1.333
    b.inputs["Specular IOR Level"].default_value = 0.5
    # Small ripples on the swell: a bump from noise, so the sun path glitters.
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 2.2
    tex.inputs["Detail"].default_value = 6.0
    tex.inputs["Roughness"].default_value = 0.65
    coord = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(coord.outputs["Object"], tex.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    bump.inputs["Distance"].default_value = 0.1
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m


def sky(scene, phase):
    """World: a gradient by elevation from the palette (horizon haze, sky, zenith), stars at night."""
    g = PHASES[phase]["grade"]
    world = scene.world
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = PHASES[phase]["ambient"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "EASE"
    cr.elements[0].position = 0.0
    cr.elements[0].color = K.shade(K.hex_lin(g["water_far"]), 0.6)     # below the horizon (reflected by the water)
    e = cr.elements.new(0.49)
    e.color = K.shade(K.hex_lin(g["horizon"]), 0.7)
    e = cr.elements.new(0.5)
    e.color = K.hex_lin(g["horizon"])                                   # the horizon
    e = cr.elements.new(0.54)
    e.color = K.mix(K.hex_lin(g["horizon"]), K.hex_lin(g["sky"]), 0.6)
    e = cr.elements.new(0.62)
    e.color = K.hex_lin(g["sky"])
    cr.elements[-1].position = 1.0
    cr.elements[-1].color = K.hex_lin(g["zenith"])
    mapr = nt.nodes.new("ShaderNodeMapRange")
    mapr.inputs["From Min"].default_value = -1.0
    mapr.inputs["From Max"].default_value = 1.0
    nt.links.new(sep.outputs["Z"], mapr.inputs["Value"])
    nt.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
    stars = PHASES[phase]["stars"]
    if stars > 0:
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 140.0
        vor.inputs["Randomness"].default_value = 1.0
        nt.links.new(coord.outputs["Generated"], vor.inputs["Vector"])
        less = nt.nodes.new("ShaderNodeMath")
        less.operation = "LESS_THAN"
        less.inputs[1].default_value = 0.012
        nt.links.new(vor.outputs["Distance"], less.inputs[0])
        # Only above the horizon haze, fading in with elevation.
        fade = nt.nodes.new("ShaderNodeMapRange")
        fade.inputs["From Min"].default_value = 0.03
        fade.inputs["From Max"].default_value = 0.35
        nt.links.new(sep.outputs["Z"], fade.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(less.outputs["Value"], mul.inputs[0])
        nt.links.new(fade.outputs["Result"], mul.inputs[1])
        k = nt.nodes.new("ShaderNodeMath")
        k.operation = "MULTIPLY"
        k.inputs[1].default_value = 8.0 * stars
        nt.links.new(mul.outputs["Value"], k.inputs[0])
        add = nt.nodes.new("ShaderNodeMix")
        add.data_type = "RGBA"
        add.blend_type = "ADD"
        add.inputs["Factor"].default_value = 1.0
        nt.links.new(ramp.outputs["Color"], add.inputs[6])
        starcol = nt.nodes.new("ShaderNodeRGB")
        starcol.outputs[0].default_value = (0.9, 0.93, 1.0, 1.0)
        smul = nt.nodes.new("ShaderNodeMix")
        smul.data_type = "RGBA"
        smul.blend_type = "MULTIPLY"
        smul.inputs["Factor"].default_value = 1.0
        nt.links.new(starcol.outputs[0], smul.inputs[6])
        kcol = nt.nodes.new("ShaderNodeCombineColor")
        nt.links.new(k.outputs["Value"], kcol.inputs[0])
        nt.links.new(k.outputs["Value"], kcol.inputs[1])
        nt.links.new(k.outputs["Value"], kcol.inputs[2])
        nt.links.new(kcol.outputs["Color"], smul.inputs[7])
        nt.links.new(smul.outputs[2], add.inputs[7])
        nt.links.new(add.outputs[2], bg.inputs["Color"])
    else:
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def lights(scene, phase):
    """The sun (or the moon's light) as a sun lamp, and its disc as an emissive sphere far away."""
    p = PHASES[phase]
    key = LAYOUT["sun"] if phase != "night" else LAYOUT["moon"]
    d = direction(key["azimuth_deg"], key["elevation_deg"])
    sun_d = bpy.data.lights.new("sol", type="SUN")
    sun_d.energy = p["sun_strength"]
    sun_d.color = K.hex_lin(p["sun_color"])[:3]
    sun_d.angle = math.radians(p["sun_angle_deg"])
    sun_d.use_shadow = True
    sun = bpy.data.objects.new("sol", sun_d)
    scene.collection.objects.link(sun)
    sun.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    # The disc: 9 km away, so it sits behind everything; its size is cinematic, not astronomical.
    dist = 9000.0
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=p["disc_radius"],
                                         location=Vector(LAYOUT["camera"]["position"]) + d * dist)
    disc = bpy.context.active_object
    disc.name = "disco"
    m = bpy.data.materials.new("disco")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = K.hex_lin(p["disc"])
    em.inputs["Strength"].default_value = p["disc_strength"]
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    disc.data.materials.append(m)
    for pg in disc.data.polygons:
        pg.use_smooth = True
    return sun, disc


def haze(scene, phase):
    """Low haze: a volume box whose density falls with height (atmospheric perspective, the sun's glow)."""
    p = PHASES[phase]
    g = p["grade"]
    size = 6000.0
    h = p["haze_height"]
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, size * 0.3, h / 2.0 - 5.0))
    box = bpy.context.active_object
    box.name = "bruma"
    box.scale = (size, size, h)
    m = bpy.data.materials.new("bruma")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = K.hex_lin(g["haze"])
    vol.inputs["Anisotropy"].default_value = 0.4
    # Density: dense at the water, gone at the top of the box.
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    fall = nt.nodes.new("ShaderNodeMapRange")
    fall.inputs["From Min"].default_value = 0.0
    fall.inputs["From Max"].default_value = 1.0
    fall.inputs["To Min"].default_value = p["haze_density"]
    fall.inputs["To Max"].default_value = 0.0
    nt.links.new(sep.outputs["Z"], fall.inputs["Value"])
    nt.links.new(fall.outputs["Result"], vol.inputs["Density"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    box.data.materials.append(m)
    box.display_type = "WIRE"
    return box


HALO_SIZE = {"luz_verde": 2.4, "luz_roja": 2.4, "luz_muelle": 1.3, "luz_farol": 0.7, "luz_tope": 0.9,
             "luz_boya": 1.0}


def halos(scene, placed, phase):
    """A soft emissive billboard on every light mesh, as the live scene's sprite halos; scaled by `glow`."""
    cam_pos = Vector(LAYOUT["camera"]["position"])
    k = 1.0 if phase == "night" else 0.55
    mats = {}
    for pid, objs in placed.items():
        for ob in objs:
            if not ob.name.startswith("luz_"):
                continue
            key = next((n for n in HALO_SIZE if ob.name.startswith(n)), None)
            if key is None:
                continue
            color = ob.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value
            centre = ob.matrix_world @ ((Vector(ob.bound_box[0]) + Vector(ob.bound_box[6])) / 2.0)
            size = HALO_SIZE[key] * k
            bpy.ops.mesh.primitive_plane_add(size=size, location=centre)
            halo = bpy.context.active_object
            halo.name = "halo_" + ob.name
            halo.rotation_euler = (centre - cam_pos).to_track_quat("Z", "Y").to_euler()
            ckey = tuple(round(c, 3) for c in color[:3])
            if ckey not in mats:
                mats[ckey] = halo_material(color, 1.8 if phase == "night" else 1.2)
            halo.data.materials.append(mats[ckey])
            halo.visible_shadow = False


def halo_material(color, strength):
    m = bpy.data.materials.new("halo")
    m.use_nodes = True
    m.surface_render_method = "BLENDED"
    m.use_transparent_shadow = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    coord = nt.nodes.new("ShaderNodeTexCoord")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Location"].default_value = (-0.5, -0.5, 0.0)
    mapping.inputs["Scale"].default_value = (1.0, 1.0, 1.0)
    nt.links.new(coord.outputs["UV"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    power = nt.nodes.new("ShaderNodeMath")
    power.operation = "POWER"
    power.inputs[1].default_value = 2.2
    nt.links.new(grad.outputs["Fac"], power.inputs[0])
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    mixs = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(power.outputs["Value"], mixs.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mixs.inputs[1])
    nt.links.new(em.outputs["Emission"], mixs.inputs[2])
    nt.links.new(mixs.outputs["Shader"], out.inputs["Surface"])
    return m


def camera(scene, focus):
    cam_d = bpy.data.cameras.new("camara")
    cam_d.sensor_fit = "VERTICAL"
    cam_d.sensor_height = 24.0
    cam_d.lens = 12.0 / math.tan(math.radians(LAYOUT["camera"]["fov_vertical_deg"] / 2.0))
    cam_d.clip_start = 0.5
    cam_d.clip_end = 20000.0
    cam_d.dof.use_dof = True
    cam_d.dof.focus_object = focus
    cam_d.dof.aperture_fstop = 1.0
    cam_d.dof.aperture_blades = 6
    cam = bpy.data.objects.new("camara", cam_d)
    scene.collection.objects.link(cam)
    cam.location = Vector(LAYOUT["camera"]["position"])
    cam.rotation_euler = Euler((math.radians(90.0 + LAYOUT["camera"]["pitch_deg"]), 0.0, 0.0), "XYZ")
    scene.camera = cam
    return cam


def assemble(phase):
    """Everything in a fresh scene; returns (scene, placed props)."""
    scene = K.reset_scene()
    placed = place_props(scene)
    set_glow(PHASES[phase]["glow"])
    water(scene, phase)
    sky(scene, phase)
    lights(scene, phase)
    haze(scene, phase)
    halos(scene, placed, phase)
    boat = placed["barco"][0]
    camera(scene, boat)
    return scene, placed
