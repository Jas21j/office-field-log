"""Render the website's Blender assets from the saved Office Twin (the .blend is never saved).

Run from the parent workspace (Door Installation/):
  /Applications/Blender.app/Contents/MacOS/Blender -b motion/3d/office_twin/Office-Twin_v005.blend -S "OT | Dollhouse" \
      --python office-field-log/tools/render_cinematic.py -- <modes> [--only 3,17,40 | --only arrival,closet] [--probe]

modes (comma separated): build, mask, bp, plan, hero, all
  build  every scroll state twice: landscape (L, 2048x1280) for wide screens and portrait (P, 1080x1920) for phones
  mask   per state, the parts that are new since the previous state (white on black), for the green outlines
  bp     per camera, the finished room as a blueprint (green outlines, x-ray), for the plan -> built scans
  plan   per state, the room from straight above (the mini-map), plus plan.json with the inch -> pixel mapping
  hero   the landing orbit: one slow full turn around the finished room, transparent background
--probe renders small, fast versions into <out>/probe/ (cameras at their last state, a few hero angles).
Output: $OFFICE_RENDER_DIR (default /tmp/office-cinematic). Same look as the films: the dollhouse scene's
EEVEE setup and rig, with the films' softbox / bounce / closet fill inside the room.
"""
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
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opt = lambda k, d=None: ARGS[ARGS.index(k) + 1] if k in ARGS else d
MODES = set((ARGS[0] if ARGS and not ARGS[0].startswith("--") else "build").split(","))
if "all" in MODES:
    MODES = {"build", "mask", "bp", "plan", "hero"}
ONLY = set(filter(None, (opt("--only", "") or "").split(",")))
PROBE = "--probe" in ARGS
DIR = OUT / "probe" if PROBE else OUT
DIR.mkdir(parents=True, exist_ok=True)

SC = bpy.context.scene
assert SC.name == "OT | Dollhouse", "run with -S \"OT | Dollhouse\""
LAYER = SC.view_layers[0]
OB = bpy.data.objects
IN = 0.0254
W, D, H = SPEC["room"]["width_x"], SPEC["room"]["depth_y"], SPEC["room"]["ceiling_z"]
CLO = SPEC["closet"]
CXM = (CLO["inner_x0"] + CLO["inner_x1"]) / 2
CYF = -SPEC["walls"]["S"]["thickness"]
CYB = CYF - CLO["depth"]
FAN = SPEC["fan"]
FRAMES = CONFIG["frames"]
CAMS = CONFIG["cameras"]
SIZES = {"L": (1920, 1200), "P": (1080, 1920)}
PROBE_SIZES = {"L": (512, 320), "P": (270, 480)}
SAMPLES = int(opt("--samples", "8" if PROBE else "32"))
HIDE_ALWAYS = CONFIG.get("hide_always", [])           # the room's own door: open into the room it clutters every cutaway
COLL = {"N": "OT Wall N", "S": "OT Wall S", "E": "OT Wall E", "W": "OT Wall W", "Ceiling": "OT Ceiling", "Closet": "OT Closet"}

SC.render.image_settings.file_format = "PNG"
SC.render.image_settings.color_mode = "RGB"
SC.render.resolution_percentage = 100
SC.render.use_motion_blur = False
SC.render.film_transparent = False
ENGINE = SC.render.engine


def find_layer(node, name):
    if node.name == name:
        return node
    for child in node.children:
        found = find_layer(child, name)
        if found:
            return found
    return None


def area(name, size, size_y, watts, where, rot=(0, 0, 0), color=(1.0, 0.96, 0.9)):
    data = bpy.data.lights.new(name, "AREA")
    data.shape, data.size, data.size_y, data.energy, data.color = "RECTANGLE", size * IN, size_y * IN, watts, color
    lamp = OB.new(name, data)
    lamp.location = Vector(where) * IN
    lamp.rotation_euler = rot
    SC.collection.objects.link(lamp)
    return lamp


# the films' interior lights (shots_part45.py): a ceiling softbox, a floor bounce, and the walk-in's own fill
SOFT = area("SITE Softbox", 90, 110, 150, (W / 2, D * 0.55, H - 2))
BOUNCE = area("SITE Bounce", 90, 110, 22, (W / 2, D * 0.55, 30), (math.pi, 0, 0), (1.0, 0.97, 0.93))
CFILL = area("SITE Closet Fill", 80, 40, 70, (CXM, (CYB + CYF) / 2 + 6, CLO["ceiling_z"] - 3), color=(1.0, 0.95, 0.88))


def lights(mode):
    SOFT.hide_render = BOUNCE.hide_render = mode == "studio"
    CFILL.hide_render = mode != "closet"


CAM = OB.new("SITE CAM", bpy.data.cameras.new("SITE CAM"))
SC.collection.objects.link(CAM)
SC.camera = CAM
CAM.data.clip_start = 0.05
CAM.data.clip_end = 200


def set_cam(eye, aim, lens, orient):
    CAM.data.type = "PERSP"
    CAM.data.sensor_fit = "HORIZONTAL" if orient == "L" else "VERTICAL"
    CAM.data.sensor_width = CAM.data.sensor_height = 36
    CAM.data.lens = lens
    CAM.location = Vector(eye) * IN
    CAM.rotation_euler = (Vector(aim) * IN - CAM.location).to_track_quat("-Z", "Y").to_euler()


PARKED = []


def park(ob, dz=-100.0):
    ob.delta_location = (0, 0, dz)
    PARKED.append(ob)


def offset(name, x=0, y=0, z=0):
    ob = OB.get(name)
    if ob:
        ob.delta_location = (x * IN, y * IN, z * IN)
        PARKED.append(ob)


def unpark():
    for ob in PARKED:
        ob.delta_location = (0, 0, 0)
    PARKED.clear()


def perform(beat):
    """Staged moments inside one documented milestone (the order is illustrative, the end state is from footage)."""
    hide = lambda *names: [park(OB[n]) for n in names if n in OB]
    if beat == "bases":
        hide("clo_counter", "clo_shelves", "clo_soffit", "clo_slats")
        offset("clo_base_E", z=7)
    elif beat == "counter":
        hide("clo_shelves", "clo_soffit", "clo_slats")
        offset("clo_counter", z=6)
    elif beat == "shelves":
        hide("clo_slats")
        offset("clo_shelves", y=5)
    elif beat == "partial-slats":
        panels = sorted(OB["clo_slats"].children, key=lambda o: o.name)
        for o in panels[len(panels) // 2:]:
            park(o)
    elif beat == "drawers-moving":
        offset("desk_drawers_W", x=8)
        offset("desk_drawers_E", x=-8)
    elif beat == "doors-moving":
        offset("clo_doors", y=4)
    elif beat == "blinds-moving":
        offset("blinds_new", z=20)


def state(frame, beat=None):
    """Twin state at a timeline frame (100 frames per day) plus a staged beat; no camera cuts yet."""
    unpark()
    SC.frame_set(frame)
    if beat:
        perform(beat)


def cuts(cut, hide=()):
    for key, name in COLL.items():
        lc = find_layer(LAYER.layer_collection, name)
        if lc:
            lc.exclude = key in cut
    for name in ("OT Outside", "OT Accents"):
        lc = find_layer(LAYER.layer_collection, name)
        if lc:
            lc.exclude = True
    for n in list(hide) + HIDE_ALWAYS:
        if n in OB and OB[n] not in PARKED:
            park(OB[n])
    ground = OB.get("Studio Ground")
    if ground:
        ground.hide_render = False


def render(path, size, samples=SAMPLES):
    SC.eevee.taa_render_samples = samples
    SC.render.resolution_x, SC.render.resolution_y = size
    SC.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("SITE", path.name, flush=True)


def present():
    """Mesh parts in the room right now (keyed visibility and staged parking; camera cuts ignored)."""
    LAYER.update()
    out = set()
    for ob in OB:
        if ob.type != "MESH" or ob.hide_render or ob.name.startswith(("SITE", "Studio")):
            continue
        if ob.matrix_world.translation.z < -40:          # parked (or carried by a parked parent)
            continue
        if any(c.name in ("OT Accents", "OT Outside", "OT Dollhouse Rig") for c in ob.users_collection):
            continue
        out.add(ob.name)
    return out


def workbench(kind):
    SC.render.engine = "BLENDER_WORKBENCH"
    sh = SC.display.shading
    sh.light = "FLAT"
    sh.show_shadows = sh.show_cavity = sh.show_specular_highlight = False
    SC.display.render_aa = "16"
    if kind == "bp":
        sh.color_type, sh.single_color = "SINGLE", (0.022, 0.034, 0.028)
        sh.show_object_outline, sh.object_outline_color = True, (0.235, 0.878, 0.294)
        sh.show_xray, sh.xray_alpha = True, 0.35
    else:
        sh.color_type = "OBJECT"
        sh.show_object_outline = sh.show_xray = False


def eevee():
    SC.render.engine = ENGINE


def shot(i):
    at, frame, cam, *beat = FRAMES[i]
    return at, frame, cam, (beat[0] if beat else None)


def wanted(i):
    return not ONLY or str(i) in ONLY or shot(i)[2] in ONLY


# ------------------------------------------------------------------ build + masks
def build_and_masks():
    prev = set()
    last_of_cam = {}
    for i in range(len(FRAMES)):
        last_of_cam[shot(i)[2]] = i
    for i in range(len(FRAMES)):
        at, frame, cam, beat = shot(i)
        state(frame, beat)
        now = present()
        new = now - prev
        prev = now
        if PROBE and last_of_cam[cam] != i:
            continue
        if not wanted(i):
            continue
        c = CAMS[cam]
        cuts(c["cut"], c.get("hide", ()))
        lights(c["light"])
        for o in ("L", "P"):
            eye, aim, lens = c[o]
            set_cam(eye, aim, lens, o)
            size = (PROBE_SIZES if PROBE else SIZES)[o]
            if "build" in MODES:
                eevee()
                render(DIR / (f"{cam}-{o}.png" if PROBE else f"build-{i:02}-{o}.png"), size)
            if "mask" in MODES and not PROBE and new:
                workbench("mask")
                SC.render.film_transparent = True              # background left empty: mask = white where a new part shows
                SC.render.image_settings.color_mode = "RGBA"
                saved = {}
                for ob in OB:
                    if ob.type == "MESH":
                        saved[ob.name] = tuple(ob.color)
                        ob.color = (1, 1, 1, 1) if ob.name in new else (0, 0, 0, 1)
                render(DIR / f"mask-{i:02}-{o}.png", size, 1)
                for n, col in saved.items():
                    OB[n].color = col
                SC.render.film_transparent = False
                SC.render.image_settings.color_mode = "RGB"
                eevee()
        (DIR / f"new-{i:02}.json").write_text(json.dumps(sorted(new)))


# ------------------------------------------------------------------ blueprints (finished room, per camera)
def blueprints():
    for cam, c in CAMS.items():
        if ONLY and cam not in ONLY:
            continue
        state(1399)
        cuts(c["cut"], c.get("hide", ()))
        workbench("bp")
        for o in ("L", "P"):
            eye, aim, lens = c[o]
            set_cam(eye, aim, lens, o)
            render(DIR / f"bp-{cam}-{o}.png", (PROBE_SIZES if PROBE else SIZES)[o], 1)
        eevee()


# ------------------------------------------------------------------ plan stills (mini-map)
PLAN = {"size": (540, 800), "span_in": 250.0}


def plans():
    XE = W + SPEC.get("door_alcove", {}).get("depth", 11)
    y0, y1 = CYB - SPEC["walls"]["S"]["thickness"], D + SPEC["walls"]["N"]["thickness"]
    cx, cy = XE / 2, (y0 + y1) / 2
    CAM.data.type = "ORTHO"
    CAM.data.sensor_fit = "VERTICAL"
    CAM.data.ortho_scale = PLAN["span_in"] * IN
    CAM.location = Vector((cx, cy, 600)) * IN
    CAM.rotation_euler = (0, 0, 0)
    ppi = PLAN["size"][1] / PLAN["span_in"]
    (DIR / "plan.json").write_text(json.dumps({"size": PLAN["size"], "ppi": ppi, "cx": cx, "cy": cy}))
    done = {}
    for i in range(len(FRAMES)):
        if not wanted(i):
            continue
        at, frame, cam, beat = shot(i)
        key = (frame, beat)
        if key in done and not PROBE:
            (DIR / f"plan-{i:02}.png").write_bytes((DIR / f"plan-{done[key]:02}.png").read_bytes())
            continue
        state(frame, beat)
        cuts(["Ceiling"], ["Closet Ceiling", "fan"])
        lights("closet")
        eevee()
        render(DIR / f"plan-{i:02}.png", PLAN["size"], 16 if PROBE else 48)
        done[key] = i
    CAM.data.type = "PERSP"


# ------------------------------------------------------------------ landing orbit
def hero():
    h = CONFIG["hero"]
    n = 8 if PROBE else h["frames"]
    state(h["frame"])
    cuts(h["cut"], h.get("hide", ()))
    lights("closet")
    ground = OB.get("Studio Ground")
    if ground:
        ground.hide_render = True
    SC.render.film_transparent = True
    SC.render.image_settings.color_mode = "RGBA"
    fan = OB.get("fan")
    fan_rot0 = fan.rotation_euler.z if fan else 0
    fan_loc0 = tuple(fan.location) if fan else None
    centre = Vector(h["center"])
    el = math.radians(h["elevation"])
    size = (400, 300) if PROBE else tuple(h["size"])
    for k in range(n):
        u = k / n
        az = math.radians(h["start_azimuth"]) + u * math.tau
        eye = centre + h["radius"] * Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        set_cam(eye, centre, h["lens"], "L")
        if fan:                                   # five blades: whole turns per loop keep the loop seamless
            a = math.tau * u * 3
            fan.rotation_euler.z = fan_rot0 + a
            fx, fy = FAN["x"] * IN, FAN["y"] * IN
            fan.location = (fan_loc0[0] + fx - math.cos(a) * fx + math.sin(a) * fy,
                            fan_loc0[1] + fy - math.sin(a) * fx - math.cos(a) * fy, fan_loc0[2])
        render(DIR / (f"hero-{k:03}.png"), size, 8 if PROBE else h.get("samples", 24))
    if fan:
        fan.rotation_euler.z, fan.location = fan_rot0, fan_loc0
    SC.render.film_transparent = False
    SC.render.image_settings.color_mode = "RGB"


if MODES & {"build", "mask"}:
    build_and_masks()
if "bp" in MODES:
    blueprints()
if "plan" in MODES:
    plans()
if "hero" in MODES:
    hero()
unpark()
print("SITE DONE", flush=True)
