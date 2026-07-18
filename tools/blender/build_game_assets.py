"""Build the authored beat-it GLB assets and transparent UI thumbnails.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python tools/blender/build_game_assets.py

The script is intentionally deterministic and self-contained so binary GLBs are
reproducible from reviewable source. Blender is an offline authoring tool only;
the browser never depends on Blender.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "apps" / "web" / "public" / "assets"
MODEL_DIR = ASSET_ROOT / "models"
ICON_DIR = ASSET_ROOT / "weapons"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
ICON_DIR.mkdir(parents=True, exist_ok=True)

WEAPON_KINDS = (
    "punch",
    "slap",
    "mallet",
    "tomato",
    "egg",
)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.5,
    metallic: float = 0.0,
    coat: float = 0.0,
) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    coat_input = shader.inputs.get("Coat Weight")
    if coat_input:
        coat_input.default_value = coat
    return mat


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)
    return obj


def smooth(obj: bpy.types.Object) -> bpy.types.Object:
    if isinstance(obj.data, bpy.types.Mesh):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def root(name: str) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj["beat_it_kind"] = name.removeprefix("weapon_")
    bpy.context.collection.objects.link(obj)
    return obj


def parent(obj: bpy.types.Object, owner: bpy.types.Object) -> bpy.types.Object:
    obj.parent = owner
    return obj


def uv_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    segments: int = 32,
    rings: int = 20,
    owner: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(assign(obj, mat))
    if owner:
        parent(obj, owner)
    return obj


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 32,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    bevel: float = 0.0,
    owner: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("soft_edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    smooth(assign(obj, mat))
    if owner:
        parent(obj, owner)
    return obj


def rounded_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    bevel: float,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    owner: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("soft_edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    smooth(assign(obj, mat))
    if owner:
        parent(obj, owner)
    return obj


def torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    owner: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=36,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    smooth(assign(obj, mat))
    if owner:
        parent(obj, owner)
    return obj


def curve_tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    mat: bpy.types.Material,
    *,
    cyclic: bool = False,
    owner: bpy.types.Object | None = None,
) -> bpy.types.Object:
    data = bpy.data.curves.new(name, type="CURVE")
    data.dimensions = "3D"
    data.resolution_u = 2
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    if owner:
        parent(obj, owner)
    return obj


def cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 24,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    owner: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    smooth(assign(obj, mat))
    if owner:
        parent(obj, owner)
    return obj


def make_materials() -> dict[str, bpy.types.Material]:
    return {
        "glove": material("rubber_glove", (0.58, 0.015, 0.025, 1), roughness=0.32, coat=0.18),
        "glove_dark": material("glove_trim", (0.18, 0.008, 0.012, 1), roughness=0.42),
        "skin": material("stylized_skin", (0.66, 0.30, 0.17, 1), roughness=0.58),
        "skin_crease": material("skin_crease", (0.22, 0.055, 0.025, 1), roughness=0.66),
        "nail": material("fingernail", (0.82, 0.52, 0.40, 1), roughness=0.4, coat=0.08),
        "wood": material("warm_wood", (0.27, 0.095, 0.025, 1), roughness=0.56),
        "wood_light": material("wood_handle", (0.50, 0.22, 0.055, 1), roughness=0.48),
        "steel": material("brushed_steel", (0.22, 0.25, 0.29, 1), roughness=0.30, metallic=0.82),
        "tomato": material("tomato_skin", (0.72, 0.018, 0.008, 1), roughness=0.28, coat=0.3),
        "green": material("leaf_green", (0.04, 0.24, 0.055, 1), roughness=0.55),
        "egg": material("egg_shell", (0.93, 0.90, 0.79, 1), roughness=0.58),
        "egg_speckle": material("egg_shell_speckle", (0.29, 0.16, 0.075, 1), roughness=0.72),
        "dummy": material("dummy_rubber", (0.035, 0.045, 0.065, 1), roughness=0.58, coat=0.06),
        "dummy_dark": material("dummy_red_accent", (0.34, 0.008, 0.014, 1), roughness=0.44, coat=0.08),
        "dummy_metal": material("dummy_base_metal", (0.08, 0.09, 0.11, 1), roughness=0.31, metallic=0.72),
    }


def build_punch(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("weapon_punch")
    # The camera sees the model from -Y after glTF's Y-up conversion. Keep the
    # broad striking surface in X/Z and put the knuckle forms toward -Y so the
    # glove always reads knuckles-first instead of as a side-view icon.
    rounded_box("glove_palm", (0.02, 0.0, -0.04), (0.82, 0.42, 0.70), m["glove"], bevel=0.22, owner=r)
    uv_sphere("glove_back_mass", (-0.06, 0.01, 0.14), (0.44, 0.23, 0.40), m["glove"], owner=r)
    rounded_box(
        "knuckle_pad",
        (0.0, -0.13, 0.38),
        (0.76, 0.43, 0.34),
        m["glove"],
        bevel=0.16,
        owner=r,
    )
    uv_sphere("glove_thumb", (0.38, -0.19, -0.08), (0.22, 0.17, 0.29), m["glove"], owner=r)
    uv_sphere("thumb_fold", (0.27, -0.22, 0.03), (0.18, 0.10, 0.17), m["glove_dark"], owner=r)
    cylinder("glove_cuff", (0.0, 0.0, -0.61), 0.31, 0.42, m["glove_dark"], bevel=0.055, owner=r)
    cylinder("cuff_face", (0.0, -0.11, -0.61), 0.255, 0.34, m["glove"], bevel=0.04, owner=r)
    curve_tube(
        "glove_seam",
        [(-0.32, -0.225, -0.22), (-0.05, -0.252, -0.30), (0.27, -0.225, -0.22)],
        0.014,
        m["glove_dark"],
        owner=r,
    )
    curve_tube(
        "knuckle_seam",
        [(-0.32, -0.31, 0.27), (0.0, -0.34, 0.22), (0.32, -0.31, 0.27)],
        0.010,
        m["glove_dark"],
        owner=r,
    )
    return r


def build_slap(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("weapon_slap")
    # Palm faces -Y; fingers extend along +Z. This is the contact view used by
    # the game camera, not a hand laid flat on its side.
    rounded_box("palm", (0.0, 0.0, -0.06), (0.72, 0.24, 0.78), m["skin"], bevel=0.18, owner=r)
    uv_sphere("thenar_pad", (0.22, -0.09, -0.18), (0.24, 0.10, 0.28), m["skin"], owner=r)
    finger_lengths = (0.66, 0.80, 0.75, 0.62)
    finger_x = (-0.27, -0.09, 0.10, 0.29)
    for index, (x, length) in enumerate(zip(finger_x, finger_lengths)):
        cylinder(
            f"finger_{index}",
            (x, 0.0, 0.28 + length * 0.5),
            0.095,
            length,
            m["skin"],
            bevel=0.085,
            owner=r,
        )
        uv_sphere(
            f"fingertip_{index}",
            (x, 0.0, 0.28 + length),
            (0.095, 0.105, 0.105),
            m["skin"],
            segments=24,
            rings=16,
            owner=r,
        )
    cylinder(
        "thumb",
        (0.43, 0.0, -0.02),
        0.105,
        0.50,
        m["skin"],
        rotation=(0.0, 0.86, 0.0),
        bevel=0.09,
        owner=r,
    )
    uv_sphere("thumb_tip", (0.62, 0.0, 0.10), (0.11, 0.115, 0.12), m["skin"], owner=r)
    cylinder("wrist", (0.0, 0.0, -0.64), 0.24, 0.48, m["skin"], bevel=0.075, owner=r)
    curve_tube(
        "life_line",
        [(0.24, -0.135, 0.18), (0.03, -0.145, 0.04), (0.09, -0.14, -0.29)],
        0.012,
        m["skin_crease"],
        owner=r,
    )
    curve_tube(
        "heart_line",
        [(-0.27, -0.137, 0.14), (-0.03, -0.15, 0.20), (0.27, -0.137, 0.15)],
        0.010,
        m["skin_crease"],
        owner=r,
    )
    curve_tube(
        "wrist_crease",
        [(-0.20, -0.132, -0.43), (0.0, -0.145, -0.46), (0.20, -0.132, -0.43)],
        0.010,
        m["skin_crease"],
        owner=r,
    )
    return r


def build_mallet(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("weapon_mallet")
    cylinder("handle", (0, 0, -0.10), 0.105, 1.50, m["wood_light"], bevel=0.045, owner=r)
    cylinder(
        "mallet_head",
        (0, 0, 0.70),
        0.40,
        1.18,
        m["wood"],
        rotation=(0, math.pi / 2, 0),
        bevel=0.10,
        owner=r,
    )
    for x in (-0.57, 0.57):
        torus("head_band", (x, 0, 0.70), 0.365, 0.04, m["steel"], rotation=(0, math.pi / 2, 0), owner=r)
    torus("grip_ring", (0, 0, -0.81), 0.095, 0.022, m["steel"], owner=r)
    return r


def build_tomato(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("weapon_tomato")
    uv_sphere("tomato", (0, 0, 0), (0.52, 0.50, 0.46), m["tomato"], segments=40, rings=24, owner=r)
    for i in range(6):
        angle = i * math.tau / 6
        cone(
            f"leaf_{i}",
            (math.cos(angle) * 0.13, math.sin(angle) * 0.13, 0.48),
            0.11,
            0.015,
            0.32,
            m["green"],
            rotation=(math.sin(angle) * 0.9, -math.cos(angle) * 0.9, angle),
            owner=r,
        )
    cylinder("tomato_stem", (0, 0, 0.63), 0.045, 0.25, m["green"], bevel=0.018, owner=r)
    return r


def build_egg(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("weapon_egg")
    egg = uv_sphere("egg_shell", (0, 0, 0), (0.42, 0.42, 0.60), m["egg"], segments=40, rings=24, owner=r)
    for vertex in egg.data.vertices:
        height = max(-1.0, min(1.0, vertex.co.z / 0.60))
        taper = 1.0 - height * 0.18
        vertex.co.x *= taper
        vertex.co.y *= taper
    egg.data.update()

    # Sparse, shallow shell freckles stop the projectile reading as a plastic
    # white ball. They share one material and remain subtle during tumble.
    speckles = (
        (-0.18, -0.37, 0.17, 0.018),
        (0.14, -0.38, 0.28, 0.014),
        (0.23, -0.34, -0.08, 0.016),
        (-0.09, -0.42, -0.28, 0.013),
        (0.05, -0.42, 0.02, 0.011),
    )
    for index, (x, y, z, size) in enumerate(speckles):
        uv_sphere(
            f"egg_speckle_{index}",
            (x, y, z),
            (size, size * 0.35, size * 1.2),
            m["egg_speckle"],
            segments=12,
            rings=8,
            owner=r,
        )
    return r


def build_arsenal(m: dict[str, bpy.types.Material]) -> dict[str, bpy.types.Object]:
    return {
        "punch": build_punch(m),
        "slap": build_slap(m),
        "mallet": build_mallet(m),
        "tomato": build_tomato(m),
        "egg": build_egg(m),
    }


def build_dummy(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("dummy")
    rounded_box("torso_core", (0, 0, 0.22), (1.42, 0.68, 1.55), m["dummy"], bevel=0.27, owner=r)
    rounded_box("shoulder_pad", (0, 0, 0.82), (1.56, 0.72, 0.38), m["dummy"], bevel=0.18, owner=r)
    torus("chest_ring", (0, -0.39, 0.36), 0.27, 0.025, m["dummy_metal"], rotation=(math.pi / 2, 0, 0), owner=r)
    cylinder("base_stem", (0, 0, -0.68), 0.32, 0.52, m["dummy_metal"], bevel=0.04, owner=r)
    cylinder("base", (0, 0, -1.0), 0.72, 0.18, m["dummy_metal"], bevel=0.055, owner=r)
    return r


def descendants(owner: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = [owner]
    stack = list(owner.children)
    while stack:
        child = stack.pop()
        result.append(child)
        stack.extend(child.children)
    return result


def select_roots(roots: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for owner in roots:
        for obj in descendants(owner):
            obj.select_set(True)
    if roots:
        bpy.context.view_layer.objects.active = roots[0]


def export_glb(path: Path, roots: list[bpy.types.Object]) -> None:
    select_roots(roots)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
    )


def bbox_for(owner: bpy.types.Object) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in descendants(owner):
        if obj.type not in {"MESH", "CURVE"}:
            continue
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        return Vector((-1, -1, -1)), Vector((1, 1, 1))
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_icons(roots: dict[str, bpy.types.Object]) -> None:
    for stale_icon in ICON_DIR.glob("*.png"):
        if stale_icon.stem not in roots:
            stale_icon.unlink()

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 128
    scene.render.resolution_y = 128
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100

    camera_data = bpy.data.cameras.new("icon_camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("icon_camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    key_data = bpy.data.lights.new("icon_key", type="AREA")
    key_data.energy = 900
    key_data.shape = "DISK"
    key_data.size = 4.0
    key = bpy.data.objects.new("icon_key", key_data)
    key.location = (3.2, -4.0, 5.2)
    bpy.context.collection.objects.link(key)

    fill_data = bpy.data.lights.new("icon_fill", type="AREA")
    fill_data.energy = 500
    fill_data.size = 3.0
    fill = bpy.data.objects.new("icon_fill", fill_data)
    fill.location = (-3.0, -1.5, 2.0)
    bpy.context.collection.objects.link(fill)

    rim_data = bpy.data.lights.new("icon_rim", type="AREA")
    rim_data.energy = 700
    rim_data.size = 2.5
    rim = bpy.data.objects.new("icon_rim", rim_data)
    rim.location = (1.0, 3.0, 4.0)
    bpy.context.collection.objects.link(rim)

    for kind, owner in roots.items():
        for other in roots.values():
            hidden = other is not owner
            for obj in descendants(other):
                obj.hide_render = hidden

        minimum, maximum = bbox_for(owner)
        center = (minimum + maximum) * 0.5
        size = max(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)
        camera_data.ortho_scale = max(1.5, size * 1.32)
        if kind in {"punch", "slap"}:
            # Show the same contact-facing silhouette players see in game.
            camera.location = center + Vector((0.35, -4.2, 0.25)) * max(size, 1.0)
        else:
            camera.location = center + Vector((2.4, -3.5, 2.3)) * max(size, 1.0)
        point_camera(camera, center)
        scene.render.filepath = str(ICON_DIR / f"{kind}.png")
        bpy.ops.render.render(write_still=True)

    for owner in roots.values():
        for obj in descendants(owner):
            obj.hide_render = False
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(key, do_unlink=True)
    bpy.data.objects.remove(fill, do_unlink=True)
    bpy.data.objects.remove(rim, do_unlink=True)


def count_mesh_data(roots: list[bpy.types.Object]) -> tuple[int, int]:
    vertices = 0
    triangles = 0
    for owner in roots:
        for obj in descendants(owner):
            if obj.type != "MESH":
                continue
            vertices += len(obj.data.vertices)
            triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
    return vertices, triangles


def main() -> None:
    clear_scene()
    materials = make_materials()
    arsenal = build_arsenal(materials)
    render_icons(arsenal)
    arsenal_path = MODEL_DIR / "arsenal.glb"
    export_glb(arsenal_path, list(arsenal.values()))
    arsenal_vertices, arsenal_triangles = count_mesh_data(list(arsenal.values()))

    clear_scene()
    materials = make_materials()
    dummy = build_dummy(materials)
    dummy_path = MODEL_DIR / "dummy.glb"
    export_glb(dummy_path, [dummy])
    dummy_vertices, dummy_triangles = count_mesh_data([dummy])

    manifest = {
        "generator": "Blender 5.2",
        "canonicalAxes": {"up": "+Y in glTF", "weaponForward": "+X"},
        "models": {
            "arsenal": {
                "url": "/assets/models/arsenal.glb",
                "roots": {kind: f"weapon_{kind}" for kind in WEAPON_KINDS},
                "vertices": arsenal_vertices,
                "triangles": arsenal_triangles,
                "bytes": arsenal_path.stat().st_size,
            },
            "dummy": {
                "url": "/assets/models/dummy.glb",
                "root": "dummy",
                "vertices": dummy_vertices,
                "triangles": dummy_triangles,
                "bytes": dummy_path.stat().st_size,
            },
        },
        "thumbnails": {kind: f"/assets/weapons/{kind}.png" for kind in WEAPON_KINDS},
    }
    (MODEL_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
