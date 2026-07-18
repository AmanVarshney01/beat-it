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


def plane(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float],
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    owner: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(
        size=2,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = (dimensions[0] * 0.5, dimensions[1] * 0.5, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
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


def cone_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius_start: float,
    radius_end: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 24,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    return cone(
        name,
        tuple(midpoint),
        radius_start,
        radius_end,
        direction.length,
        mat,
        vertices=vertices,
        rotation=direction.to_track_quat("Z", "Y").to_euler(),
    )


def voxel_union(
    name: str,
    pieces: list[bpy.types.Object],
    mat: bpy.types.Material,
    *,
    voxel_size: float,
) -> bpy.types.Object:
    """Fuse overlapping primitives into one smooth, organic mesh."""
    bpy.ops.object.select_all(action="DESELECT")
    for piece in pieces:
        piece.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    obj = pieces[0]
    obj.name = name
    modifier = obj.modifiers.new("organic_union", "REMESH")
    modifier.mode = "VOXEL"
    modifier.voxel_size = voxel_size
    modifier.use_smooth_shade = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.clear()
    assign(obj, mat)
    smooth(obj)
    return obj


def make_materials() -> dict[str, bpy.types.Material]:
    return {
        "glove": material("oxblood_leather", (0.34, 0.008, 0.014, 1), roughness=0.43, coat=0.07),
        "glove_light": material("worn_leather_highlight", (0.48, 0.014, 0.018, 1), roughness=0.39, coat=0.08),
        "glove_dark": material("glove_trim", (0.095, 0.004, 0.007, 1), roughness=0.52),
        "skin": material("warm_skin", (0.61, 0.27, 0.145, 1), roughness=0.62),
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
        "cap": material("cap_fabric", (0.42, 0.025, 0.035, 1), roughness=0.72, coat=0.025),
        "cap_label": material("cap_label", (1.0, 1.0, 1.0, 1), roughness=0.76),
    }


def build_punch(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("weapon_punch")
    # Overlapping leather volumes are voxel-fused into one organic padded shell.
    # This keeps the mitt rounded from every angle and eliminates primitive seams.
    glove = voxel_union(
        "glove_shell",
        [
            uv_sphere("glove_core", (-0.06, 0.0, 0.08), (0.47, 0.28, 0.52), m["glove"]),
            uv_sphere("glove_knuckle_mass", (-0.04, -0.01, 0.47), (0.48, 0.28, 0.30), m["glove"]),
            uv_sphere("glove_lower_mass", (-0.10, 0.0, -0.25), (0.36, 0.25, 0.32), m["glove"]),
            uv_sphere("glove_thumb_base", (0.25, -0.02, -0.03), (0.24, 0.22, 0.28), m["glove"]),
            uv_sphere("glove_thumb", (0.40, -0.04, -0.19), (0.22, 0.20, 0.27), m["glove"]),
        ],
        m["glove"],
        voxel_size=0.035,
    )
    parent(glove, r)
    rounded_box(
        "cuff_face",
        (-0.04, -0.02, -0.62),
        (0.59, 0.39, 0.27),
        m["glove_dark"],
        bevel=0.075,
        owner=r,
    )
    rounded_box(
        "cuff_patch",
        (-0.04, -0.225, -0.62),
        (0.38, 0.025, 0.12),
        m["glove_light"],
        bevel=0.025,
        owner=r,
    )
    return r


def build_slap(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    r = root("weapon_slap")
    pieces = [
        uv_sphere("palm_core", (0.0, 0.0, -0.10), (0.38, 0.17, 0.47), m["skin"]),
        uv_sphere("thenar_mass", (0.23, -0.01, -0.18), (0.23, 0.17, 0.27), m["skin"]),
        uv_sphere("outer_palm_mass", (-0.23, 0.0, -0.15), (0.18, 0.15, 0.29), m["skin"]),
        cone_between("wrist", (0.0, 0.0, -0.81), (0.0, 0.0, -0.40), 0.19, 0.27, m["skin"]),
    ]
    for index, (start, end, base_radius, tip_radius) in enumerate(
        (
            ((-0.31, 0.0, 0.14), (-0.39, 0.0, 0.64), 0.095, 0.072),
            ((-0.11, 0.0, 0.17), (-0.15, 0.0, 0.82), 0.102, 0.076),
            ((0.10, 0.0, 0.18), (0.09, 0.0, 0.91), 0.105, 0.078),
            ((0.29, 0.0, 0.14), (0.34, 0.0, 0.77), 0.098, 0.074),
        )
    ):
        pieces.append(
            cone_between(
                f"finger_{index}",
                start,
                end,
                base_radius,
                tip_radius,
                m["skin"],
            )
        )
        pieces.append(
            uv_sphere(
                f"fingertip_{index}",
                end,
                (tip_radius, tip_radius * 1.08, tip_radius * 1.08),
                m["skin"],
                segments=24,
                rings=16,
            )
        )
    pieces.extend(
        [
            cone_between(
                "thumb",
                (0.30, -0.01, -0.18),
                (0.67, 0.0, 0.10),
                0.125,
                0.085,
                m["skin"],
            ),
            uv_sphere(
                "thumb_tip",
                (0.67, 0.0, 0.10),
                (0.09, 0.10, 0.095),
                m["skin"],
                segments=24,
                rings=16,
            ),
        ]
    )
    hand = voxel_union("open_hand", pieces, m["skin"], voxel_size=0.03)
    parent(hand, r)
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


def build_cap(m: dict[str, bpy.types.Material]) -> bpy.types.Object:
    """An oversized, structured baseball cap with a curved forward bill."""
    r = root("accessory_cap")

    # Build the crown from tapered elliptical rings instead of squashing a
    # sphere. The tall front and tighter top read as a fitted baseball cap,
    # while the open lower edge lets the photographed hair sit naturally
    # inside it.
    crown_segments = 48
    crown_rings = (
        (0.080, 0.410, 0.335, 0.175),
        (0.175, 0.425, 0.345, 0.050),
        (0.285, 0.395, 0.325, 0.000),
        (0.395, 0.300, 0.250, 0.000),
        (0.455, 0.150, 0.125, 0.000),
    )
    crown_vertices: list[tuple[float, float, float]] = []
    for z, radius_x, radius_y, front_drop in crown_rings:
        for index in range(crown_segments):
            angle = math.tau * index / crown_segments
            front_factor = max(0.0, -math.sin(angle)) ** 2
            crown_vertices.append(
                (
                    math.cos(angle) * radius_x,
                    math.sin(angle) * radius_y,
                    z - front_drop * front_factor,
                )
            )
    crown_vertices.append((0, 0, 0.485))
    crown_faces: list[tuple[int, ...]] = []
    for ring_index in range(len(crown_rings) - 1):
        start = ring_index * crown_segments
        next_start = start + crown_segments
        for index in range(crown_segments):
            next_index = (index + 1) % crown_segments
            crown_faces.append(
                (
                    start + index,
                    start + next_index,
                    next_start + next_index,
                    next_start + index,
                )
            )
    top_index = len(crown_vertices) - 1
    last_ring_start = (len(crown_rings) - 1) * crown_segments
    for index in range(crown_segments):
        next_index = (index + 1) % crown_segments
        crown_faces.append(
            (last_ring_start + index, last_ring_start + next_index, top_index)
        )
    crown_mesh = bpy.data.meshes.new("cap_crown_mesh")
    crown_mesh.from_pydata(crown_vertices, [], crown_faces)
    crown_mesh.update()
    crown = bpy.data.objects.new("cap_crown", crown_mesh)
    bpy.context.collection.objects.link(crown)
    smooth(assign(crown, m["cap"]))
    parent(crown, r)

    # A shallow structured front panel bridges the crown into the bill. It is
    # deliberately flat across the forehead so the cap sits on top of the
    # character instead of tracing the face oval.
    rounded_box(
        "cap_front_panel",
        (0, -0.340, 0.070),
        (0.335, 0.045, 0.070),
        m["cap"],
        bevel=0.018,
        owner=r,
    )

    # The bill projects toward -Y (the authored front), dips in the middle,
    # and rises at both sides. Its rounded outline and thin profile stop it
    # looking like a straight block laid across the forehead.
    bill_rows = (
        (-0.245, 0.290, 0.040, 0.000),
        (-0.315, 0.330, 0.039, 0.003),
        (-0.395, 0.365, 0.036, 0.007),
        (-0.480, 0.375, 0.032, 0.011),
        (-0.555, 0.355, 0.027, 0.014),
        (-0.615, 0.290, 0.022, 0.014),
        (-0.650, 0.140, 0.018, 0.008),
    )
    bill_columns = 17
    bill_thickness = 0.026
    bill_top: list[tuple[float, float, float]] = []
    for y, half_width, center_z, edge_lift in bill_rows:
        for column in range(bill_columns):
            u = -1 + 2 * column / (bill_columns - 1)
            bill_top.append(
                (
                    u * half_width,
                    y,
                    center_z + edge_lift * abs(u) ** 1.7,
                )
            )
    bill_vertices = bill_top + [
        (x, y, z - bill_thickness) for x, y, z in bill_top
    ]
    layer_size = len(bill_top)
    bill_faces: list[tuple[int, ...]] = []
    for row in range(len(bill_rows) - 1):
        for column in range(bill_columns - 1):
            a = row * bill_columns + column
            b = a + 1
            c = a + bill_columns + 1
            d = a + bill_columns
            bill_faces.append((a, b, c, d))
            bill_faces.append(
                (
                    layer_size + d,
                    layer_size + c,
                    layer_size + b,
                    layer_size + a,
                )
            )
    boundary = (
        list(range(bill_columns))
        + [
            row * bill_columns + bill_columns - 1
            for row in range(1, len(bill_rows))
        ]
        + list(
            range(
                (len(bill_rows) - 1) * bill_columns + bill_columns - 2,
                (len(bill_rows) - 1) * bill_columns - 1,
                -1,
            )
        )
        + [
            row * bill_columns
            for row in range(len(bill_rows) - 2, 0, -1)
        ]
    )
    for index, a in enumerate(boundary):
        b = boundary[(index + 1) % len(boundary)]
        bill_faces.append((a, layer_size + a, layer_size + b, b))
    bill_mesh = bpy.data.meshes.new("cap_brim_mesh")
    bill_mesh.from_pydata(bill_vertices, [], bill_faces)
    bill_mesh.update()
    bill = bpy.data.objects.new("cap_brim", bill_mesh)
    bpy.context.collection.objects.link(bill)
    smooth(assign(bill, m["cap"]))
    parent(bill, r)

    uv_sphere(
        "cap_button",
        (0, 0, 0.485),
        (0.052, 0.052, 0.030),
        m["cap"],
        segments=24,
        rings=14,
        owner=r,
    )
    # Blender's -Y is the front view used by the rest of the authored assets.
    # Rotating the plane makes its local +Z normal face toward that direction.
    plane(
        "cap_label",
        (0, -0.356, 0.235),
        (0.315, 0.115),
        m["cap_label"],
        rotation=(math.pi / 2, 0, 0),
        owner=r,
    )
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

    clear_scene()
    materials = make_materials()
    cap = build_cap(materials)
    cap_path = MODEL_DIR / "cap.glb"
    export_glb(cap_path, [cap])
    cap_vertices, cap_triangles = count_mesh_data([cap])

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
            "cap": {
                "url": "/assets/models/cap.glb",
                "root": "accessory_cap",
                "colorableMeshes": [
                    "cap_crown",
                    "cap_front_panel",
                    "cap_brim",
                    "cap_button",
                ],
                "labelMesh": "cap_label",
                "vertices": cap_vertices,
                "triangles": cap_triangles,
                "bytes": cap_path.stat().st_size,
            },
        },
        "thumbnails": {kind: f"/assets/weapons/{kind}.png" for kind in WEAPON_KINDS},
    }
    (MODEL_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
