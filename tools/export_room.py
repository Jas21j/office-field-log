"""Export the actual Office Twin mesh and render closeups from its original timeline."""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

site = Path(__file__).resolve().parents[1]
source = site.parent / "motion/3d/office_twin"
settings = json.loads((site / "tools/room_views.json").read_text())
log = json.loads((source / "progress_log.json").read_text())
assets = site / "dist/assets"
scene = bpy.context.scene
root = bpy.data.collections["OT Twin"]
IN = 0.0254

def repair_fan_blades():
    # Blender's source fan has stretched blade vertices. Rebuild only the web copy
    # from its recorded center, drop, blade count, and blade length.
    ob = bpy.data.objects.get("fan")
    if not ob:
        return
    spec = json.loads((source / "room_spec.json").read_text())
    fan = spec["fan"]
    center = Vector((fan["x"], fan["y"], spec["room"]["ceiling_z"] - fan["drop"])) * IN
    mesh = bmesh.new()
    def cylinder(radius, depth, z, material):
        form = bmesh.ops.create_cone(mesh, cap_ends=True, segments=20, radius1=radius * IN,
                                      radius2=radius * IN, depth=depth * IN)
        vertices = form["verts"]
        bmesh.ops.translate(mesh, verts=vertices, vec=center + Vector((0, 0, z * IN)))
        for face in {face for vertex in vertices for face in vertex.link_faces}:
            face.material_index = material
    cylinder(3.7, 3.6, 2, 0)
    cylinder(3, .26, 0, 1)
    cylinder(.6, fan["drop"] - 3.5, (fan["drop"] + 3.5) / 2, 0)
    for index in range(fan["blades"]):
        rz = Matrix.Rotation(math.tau * index / fan["blades"] + .3, 3, "Z")
        result = bmesh.ops.create_cube(mesh, size=1)
        for vertex in result["verts"]:
            x, y, z = vertex.co
            local = Vector((3.5 + (x + .5) * fan["blade_len"], y * 5.2, 2 + z * .28)) * IN
            vertex.co = center + rz @ local
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    data = bpy.data.meshes.new("Web fan")
    for material in ob.data.materials:
        data.materials.append(material)
    mesh.to_mesh(data)
    mesh.free()
    ob.data = data

repair_fan_blades()

def collection_layer(name):
    def find(layer):
        return next((node for node in layer.children if node.name == name), None) or next(
            (match for node in layer.children if (match := find(node))), None)
    return find(scene.view_layers[0].layer_collection)

def exclude(names):
    for name in ("OT Wall N", "OT Wall S", "OT Wall E", "OT Wall W", "OT Ceiling", "OT Closet", "OT Outside", "OT Accents"):
        layer = collection_layer(name)
        if layer:
            layer.exclude = name in names

def frame_at(day, hour):
    return (day - 1) * 100 + 1 + round((hour - 7) / 12 * 98)

def hour(value):
    h, m = map(int, value.split(":"))
    return h + m / 60

def to_progress(day, time):
    start, end = settings["day_starts"][day - 1:day + 1]
    return round(start + (end - start) * (0.10 + 0.77 * (hour(time) - 7) / 12), 4)

def mesh_collection(ob):
    return ob.users_collection[0].name.removeprefix("OT ")

def export_model():
    exclude({"OT Outside", "OT Accents"})
    events = {}
    for day in log["days"]:
        for event in day["events"]:
            if "target" in event and event["action"] in ("show", "hide", "move"):
                events.setdefault(event["target"], []).append((day["day"], event))
    meshes = [ob for ob in root.all_objects if ob.type == "MESH" and mesh_collection(ob) not in ("Outside", "Accents")]
    raw = {}
    poses = {}
    for ob in meshes:
        owner = ob
        while owner.parent and owner.name not in events:
            owner = owner.parent
        changes = events.get(owner.name, [])
        shift = .1 * (list(owner.children).index(ob) / max(1, len(owner.children) - 1)) if ob in list(owner.children) and any(
            owner.name.startswith(key) for key in ("slats_", "clo_slats")) else 0
        raw[ob.name] = {"key": ob.name, "section": mesh_collection(ob), "visible": not changes or changes[0][1]["action"] != "show",
                        "events": []}
        first_pose = 1
        for day, event in changes:
            action = event["action"]
            progress = to_progress(day, event["time"]) + (shift if action == "show" else 0)
            if day == 8 and owner.name in ("clo_counter", "clo_shelves", "clo_soffit", "desk_W", "desk_E"):
                progress += {"clo_counter": .055, "clo_shelves": .10, "clo_soffit": .13, "desk_W": .03, "desk_E": .08}[owner.name]
            if day == 12 and owner.name in ("desk_drawers_W", "desk_drawers_E"):
                progress -= .17
            if action == "show" and "params" in event:
                first_pose = frame_at(day, hour(event["time"]))
            raw[ob.name]["events"].append([round(progress, 4), action])
        scene.frame_set(first_pose)
        poses[ob.name] = ob.matrix_world.copy()
    export_collection = bpy.data.collections.new("Web export")
    scene.collection.children.link(export_collection)
    copies = []
    for ob in meshes:
        copy = ob.copy()
        copy.animation_data_clear()
        copy.parent = None
        copy.matrix_world = poses[ob.name]
        copy.hide_viewport = copy.hide_render = copy.hide_select = False
        copy["webId"] = ob.name
        export_collection.objects.link(copy)
        copies.append(copy)
    layer = scene.view_layers[0]
    layer.update()
    for ob in layer.objects:
        ob.select_set(False, view_layer=layer)
    for copy in copies:
        copy.hide_set(False, view_layer=layer)
        copy.select_set(True, view_layer=layer)
    # Match the procedural material base colors in browsers. Full shader detail is in the stills.
    for name, hex_code in {"OT Slat Wood": "644631", "OT LVP": "564d44"}.items():
        material = bpy.data.materials.get(name)
        if material:
            color = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"]
            for link in list(color.links):
                material.node_tree.links.remove(link)
            rgb = [int(hex_code[i:i + 2], 16) / 255 for i in (0, 2, 4)]
            color.default_value = tuple((v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4) for v in rgb) + (1,)
    bpy.ops.export_scene.gltf(filepath=str(assets / "office.glb"), use_selection=True, export_extras=True, export_animations=False)
    metadata = {"objects": raw, "cameras": settings["cameras"], "days": settings["day_starts"],
                "stills": [shot[0] for shot in settings["stills"]]}
    (assets / "room-states.json").write_text(json.dumps(metadata, separators=(",", ":")) + "\n")

def render_stills():
    cam = scene.camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = .4
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    ground = bpy.data.objects.get("Studio Ground")
    if ground:
        ground.hide_render = True

    def add_light(name, coord, power, color, size):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.color, data.size = power, color, size
        light = bpy.data.objects.new(name, data)
        light.location = Vector(coord) * IN
        scene.collection.objects.link(light)

    add_light("Web ceiling fill", (73, 80, 100), 170, (1, .95, .87), 2.25)
    add_light("Web closet fill", (69, -24, 94), 75, (1, .95, .88), 1.2)

    def render(name, frame, eye, target, fov, cut):
        scene.frame_set(frame)
        excluded = {"OT Outside", "OT Accents"}
        if cut:
            excluded.update(("OT Wall S", "OT Ceiling"))
        exclude(excluded)
        for ob_name in ("Closet Ceiling", "Closet Walls", "Door Leaf", "Door Hardware", "fan"):
            ob = bpy.data.objects.get(ob_name)
            if ob:
                ob.hide_render = cut
        cam.data.type = "PERSP"
        cam.data.sensor_width = 36
        cam.data.lens = 18 / math.tan(math.radians(fov) / 2)
        cam.data.clip_start = .025
        cam.location = Vector(eye) * IN
        cam.rotation_euler = (Vector(target) * IN - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.resolution_x, scene.render.resolution_y = (1220, 950) if name == "hero" else (840, 660)
        scene.render.resolution_percentage = 100
        scene.render.filepath = f"/tmp/office-v005-{name}.png"
        bpy.ops.render.render(write_still=True)
        print("OFFICE STILL", name, flush=True)

    render("hero", 1399, **settings["hero"])
    for name, frame, index in ([] if "--hero" in sys.argv else settings["stills"]):
        _, eye, target, fov, cut, _ = settings["cameras"][index]
        render(name, frame, eye, target, fov, cut)

if "--stills" in sys.argv or "--hero" in sys.argv:
    render_stills()
else:
    export_model()
