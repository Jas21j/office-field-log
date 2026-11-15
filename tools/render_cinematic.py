"""Render the website from the saved Office Twin, leaving the .blend untouched."""
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
CONFIG = json.loads((HERE / "cinematic_shots.json").read_text())
SPEC = json.loads((HERE.parent.parent / "motion/3d/office_twin/room_spec.json").read_text())
OUT = Path(os.environ.get("OFFICE_RENDER_DIR", "/tmp/office-cinematic"))
OUT.mkdir(parents=True, exist_ok=True)
SCENE = bpy.context.scene
ROOT = bpy.data.collections["OT Twin"]
LAYER = SCENE.view_layers[0]
IN = 0.0254
OB = bpy.data.objects
OPTIONS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
CAM = SCENE.camera
FAN_CENTER = Vector((SPEC["fan"]["x"] * IN, SPEC["fan"]["y"] * IN, 0))

CUTTABLE = ("Wall N", "Wall S", "Wall W", "Wall E", "Ceiling", "Closet", "Outside", "Accents")
SCENE.render.engine = "BLENDER_EEVEE" if "eevee" in OPTIONS else "CYCLES"
SCENE.render.threads_mode = "FIXED"
SCENE.render.threads = 5
SCENE.cycles.use_denoising = True
SCENE.cycles.max_bounces = 5
SCENE.cycles.diffuse_bounces = 3
SCENE.cycles.glossy_bounces = 2
SCENE.cycles.transparent_max_bounces = 4
SCENE.view_settings.view_transform = "AgX"
SCENE.view_settings.exposure = .36
SCENE.render.image_settings.file_format = "PNG"
SCENE.render.image_settings.color_mode = "RGBA"
SCENE.render.resolution_percentage = 100
SCENE.render.film_transparent = True

def find_layer(node, name):
    if node.name == name:
        return node
    for child in node.children:
        if found := find_layer(child, name):
            return found
    return None

def set_camera(eye, aim, fov):
    CAM.data.type = "PERSP"
    CAM.data.sensor_fit = "HORIZONTAL"
    CAM.data.sensor_width = 36
    CAM.data.lens = 18 / math.tan(math.radians(fov) / 2)
    CAM.data.clip_start = .025
    CAM.location = Vector(eye) * IN
    CAM.rotation_euler = (Vector(aim) * IN - CAM.location).to_track_quat("-Z", "Y").to_euler()

def area(name, where, aim, watts, size, color=(1, .96, .90)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.size, data.color = watts, size, color
    lamp = bpy.data.objects.new(name, data)
    lamp.location = Vector(where) * IN
    lamp.rotation_euler = (Vector(aim) * IN - lamp.location).to_track_quat("-Z", "Y").to_euler()
    SCENE.collection.objects.link(lamp)
    return lamp

MAIN_FILL = area("Site room fill", (73, 65, 99), (70, 90, 3), 120, 2.7)
CLOSET_FILL = area("Site closet fill", (69, -30, 93), (67, -53, 0), 41, 1.25)
WINDOW_FILL = area("Site window fill", (63, 154, 69), (72, 26, 32), 25, 1.05, (.88, .94, 1))
SITE_CAN_LIGHTS = [
    area("Site downlight", (x, y, 99.5), (x, y, 3), 26, .18)
    for x, y in ((36, 44), (107, 44), (36, 117), (107, 117))
]
for item in OB:
    if item.type == "LIGHT" and item.name.startswith("L clo_led_"):
        item.data.energy *= 1.1

# The room opens in the film's dollhouse scene. Respect its geometry, but use our
# explicit cuts so each revision can pick up the latest .blend without viewport state.
def prepare(frame, cut):
    for obj in ROOT.all_objects:
        obj.delta_location = (0, 0, 0)
    SCENE.frame_set(frame)
    for key in CUTTABLE:
        layer = find_layer(LAYER.layer_collection, "OT " + key)
        if layer:
            layer.exclude = key in ("Outside", "Accents") or key in cut or key[-1] in cut and key.startswith("Wall ")
    if ground := OB.get("Studio Ground"):
        ground.hide_render = True

def hide(name):
    ob = OB.get(name)
    if ob:
        ob.delta_location.z = -100

def offset(name, *, x=0, y=0, z=0):
    if ob := OB.get(name):
        ob.delta_location = (x * IN, y * IN, z * IN)

def perform(beat):
    if beat == "bases":
        for name in ("clo_counter", "clo_shelves", "clo_soffit", "clo_slats"):
            hide(name)
        offset("clo_base_E", z=7)
    elif beat == "counter":
        for name in ("clo_shelves", "clo_soffit", "clo_slats"):
            hide(name)
        offset("clo_counter", z=6)
    elif beat == "shelves":
        hide("clo_slats")
        offset("clo_shelves", y=5)
    elif beat == "partial-slats":
        panels = sorted(OB["clo_slats"].children, key=lambda ob: ob.name)
        for obj in panels[len(panels)//2:]:
            obj.delta_location.z = -100
    elif beat == "drawers-moving":
        offset("desk_drawers_W", x=8)
        offset("desk_drawers_E", x=-8)
    elif beat == "doors-moving":
        offset("clo_doors", y=4)
    elif beat == "blinds-moving":
        offset("blinds_new", z=20)

def render(path, size, samples):
    SCENE.cycles.samples = samples
    SCENE.eevee.taa_render_samples = max(16, samples)
    SCENE.render.resolution_x, SCENE.render.resolution_y = size
    SCENE.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("SITE FRAME", path.name, flush=True)

def shot_series(selection=None):
    for index, config in enumerate(CONFIG["frames"]):
        if selection is not None and index not in selection:
            continue
        progress, frame, id, *beat = config
        eye, aim, fov, cut, _ = CONFIG["cameras"][id]
        prepare(frame, cut)
        MAIN_FILL.data.energy = 115 if frame < 1100 else 75
        CLOSET_FILL.data.energy = 47 if frame < 1100 else 17
        WINDOW_FILL.data.energy = 26 if frame < 1100 else 12
        if id == "arrival":
            hide("Closet Ceiling")
        if id == "closet" and progress == 4.54:
            SCENE.frame_set(799)
        if beat:
            perform(beat[0])
        camera_delta = (progress % 1 - .5) * 5
        eye = [eye[0] + camera_delta, eye[1] + camera_delta, eye[2]]
        set_camera(eye, aim, fov)
        render(OUT / f"build-{index:02}.png", (1344, 840), 7)

def hero_frame(index, count):
    pos = index / count
    arc = math.sin(pos * math.tau)
    prepare(1399, ("Ceiling", "E", "S"))
    hide("Closet Ceiling")
    hide("Door Leaf")
    hide("Door Hardware")
    MAIN_FILL.data.energy = 108
    CLOSET_FILL.data.energy = 19
    WINDOW_FILL.data.energy = 16
    # Retain the closet back and its entire U-shaped built-in, viewed from the room.
    eye = (277 + arc * 30, 183 + arc * 46, 270 + arc * 8)
    set_camera(eye, (70, 45, 34), 50)
    fan = OB.get("fan")
    if fan:
        angle = math.tau * pos * 3
        fan.rotation_euler.z = angle
        fan.location = (FAN_CENTER.x - math.cos(angle) * FAN_CENTER.x + math.sin(angle) * FAN_CENTER.y,
                        FAN_CENTER.y - math.sin(angle) * FAN_CENTER.x - math.cos(angle) * FAN_CENTER.y, 0)
    render(OUT / ("hero-poster.png" if count == 1 else f"hero-{index:03}.png"), (896, 828) if count > 1 else (1344, 1242), 7 if count > 1 else 16)

if "sample" in OPTIONS:
    hero_frame(0, 1)
    shot_series({0, 17, 28, 34, 47, 53})
elif "loop" in OPTIONS:
    for i in range(36):
        hero_frame(i, 36)
elif "all" in OPTIONS:
    hero_frame(0, 1)
    shot_series()
    for i in range(36):
        hero_frame(i, 36)
elif "hero" in OPTIONS:
    hero_frame(0, 1)
else:
    shot_series()
