"""Author a fitted baseball cap as cap.glb for Beat It.

Modeled in Blender coords (Z-up, -Y = forward/out of the face). The glTF
exporter's Y-up conversion turns that into +Y up / +Z forward, matching the
game's head-local frame. Geometry is sized for the game's head: crown dome
radius 0.4 with the rim just past the brow line, so Scene3D can place the
root at (0, 0.15, -0.2) with unit scale.

Run:  Blender --background --python author_cap.py -- /path/to/cap.glb
"""

import math
import sys

import bmesh
import bpy

OUT_PATH = sys.argv[sys.argv.index("--") + 1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

# ── materials ────────────────────────────────────────────────────────────────

def make_material(name, rgb, roughness):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


shell_mat = make_material("cap_shell", (0.585, 0.055, 0.06), 0.86)
label_mat = make_material("cap_label_mat", (1.0, 1.0, 1.0), 0.76)

CROWN_R = 0.4
CROWN_SCALE = (1.02, 0.9, 0.95)  # x width, y depth, z height
RIM_THETA = 1.1  # polar cut angle
RIM_Z = CROWN_R * math.cos(RIM_THETA)  # ≈ 0.181 (pre-scale)


def link(obj):
    col.objects.link(obj)
    return obj


def new_mesh_obj(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    return link(obj)


def shade_smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


# ── crown: sphere dome cut past the brow, softly squashed ───────────────────

mesh = bpy.data.meshes.new("cap_crown")
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=26, radius=CROWN_R)
doomed = [v for v in bm.verts if v.co.z < RIM_Z - 1e-6]
bmesh.ops.delete(bm, geom=doomed, context="VERTS")
for v in bm.verts:
    v.co.x *= CROWN_SCALE[0]
    v.co.y *= CROWN_SCALE[1]
    v.co.z *= CROWN_SCALE[2]
bm.to_mesh(mesh)
bm.free()
crown = new_mesh_obj("cap_crown", mesh)
crown.data.materials.append(shell_mat)
shade_smooth(crown)

RIM_RING_R = CROWN_R * math.sin(RIM_THETA)  # ≈ 0.356 (pre-scale)
RIM_WORLD_Z = RIM_Z * CROWN_SCALE[2]  # ≈ 0.172

# ── sweatband: shallow torus hugging the rim ────────────────────────────────

mesh = bpy.data.meshes.new("cap_band")
bm = bmesh.new()
bmesh.ops.create_cone(
    bm,
    cap_ends=False,
    segments=48,
    radius1=RIM_RING_R * 1.015,
    radius2=RIM_RING_R * 0.985,
    depth=0.085,
)
for v in bm.verts:
    v.co.x *= CROWN_SCALE[0]
    v.co.y *= CROWN_SCALE[1]
bm.to_mesh(mesh)
bm.free()
band = new_mesh_obj("cap_band", mesh)
band.location = (0, 0, RIM_WORLD_Z + 0.01)
band.data.materials.append(shell_mat)
shade_smooth(band)

# ── visor: curved arc strip with thickness, drooping forward ────────────────

N = 24  # arc samples
LAYERS_R = 9  # radial samples
PHI_MAX = 0.72
R_IN = 0.285
THICK = 0.02
Z0 = RIM_WORLD_Z + 0.015


def visor_point(phi, t):
    """t in [0,1] from inner edge to outer edge along the visor."""
    r_out = 0.555 * math.cos(phi * 0.62) + 0.02 * math.cos(phi * 3)
    r = R_IN + (r_out - R_IN) * t
    x = math.sin(phi) * r * 1.04
    y = -math.cos(phi) * r
    droop = 0.30 * (r - R_IN) ** 2
    curl = 0.10 * (r - R_IN) * (phi / PHI_MAX) ** 2
    z = Z0 - droop + curl
    return (x, y, z)


mesh = bpy.data.meshes.new("cap_brim")
verts = []
faces = []
for layer, zoff in ((0, 0.0), (1, -THICK)):
    for i in range(N + 1):
        phi = -PHI_MAX + (2 * PHI_MAX) * i / N
        for j in range(LAYERS_R + 1):
            t = j / LAYERS_R
            x, y, z = visor_point(phi, t)
            verts.append((x, y, z + zoff))

stride = LAYERS_R + 1
top = 0
bot = (N + 1) * stride
for i in range(N):
    for j in range(LAYERS_R):
        a = top + i * stride + j
        b = a + stride
        faces.append((a, b, b + 1, a + 1))
        a2 = bot + i * stride + j
        b2 = a2 + stride
        faces.append((a2 + 1, b2 + 1, b2, a2))
# outer edge wall
for i in range(N):
    a = top + i * stride + LAYERS_R
    b = a + stride
    faces.append((a, b, bot + (i + 1) * stride + LAYERS_R, bot + i * stride + LAYERS_R))
# side walls
for side in (0, N):
    for j in range(LAYERS_R):
        a = top + side * stride + j
        b = bot + side * stride + j
        quad = (a, a + 1, b + 1, b)
        faces.append(quad if side == 0 else tuple(reversed(quad)))

mesh.from_pydata(verts, [], faces)
mesh.update()
visor = new_mesh_obj("cap_brim", mesh)
visor.data.materials.append(shell_mat)
shade_smooth(visor)

# ── button ──────────────────────────────────────────────────────────────────

mesh = bpy.data.meshes.new("cap_button")
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.045)
for v in bm.verts:
    v.co.z *= 0.62
bm.to_mesh(mesh)
bm.free()
button = new_mesh_obj("cap_button", mesh)
button.location = (0, 0, CROWN_R * CROWN_SCALE[2] + 0.004)
button.data.materials.append(shell_mat)
shade_smooth(button)

# ── label plane on the front panel ──────────────────────────────────────────

LABEL_Z = 0.27
ring_u = math.sqrt(max(CROWN_R**2 - (LABEL_Z / CROWN_SCALE[2]) ** 2, 0.0))
label_y = -(ring_u * CROWN_SCALE[1]) - 0.012

mesh = bpy.data.meshes.new("cap_label")
w, h = 0.36, 0.14
mesh.from_pydata(
    [(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)],
    [],
    [(0, 1, 2, 3)],
)
mesh.update()
uv = mesh.uv_layers.new(name="UVMap")
for loop_index, (u_, v_) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
    uv.data[loop_index].uv = (u_, v_)
label = new_mesh_obj("cap_label", mesh)
label.location = (0, label_y, LABEL_Z)
label.rotation_euler = (-0.40, 0, 0)  # lean top back against the dome slope
label.data.materials.append(label_mat)

# ── assemble & export ───────────────────────────────────────────────────────

root = link(bpy.data.objects.new("accessory_cap", None))
for obj in (crown, band, visor, button, label):
    obj.parent = root

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT_PATH, export_format="GLB", export_yup=True)
print("EXPORTED", OUT_PATH)
