"""Convert the downloaded Cap.obj into Beat It's cap.glb.

Normalizes the model into the game's head-local frame (Blender Z-up,
-Y = out of the face; the glTF exporter turns that into +Y up / +Z forward):
crown half-width 0.41 with the rim just past the brow line, so Scene3D keeps
its existing transform. Adds the front label plane so cap text keeps working.

Run:  Blender --background --python convert_cap.py -- <src.obj> <out.glb>
"""

import math
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
SRC, OUT = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

bpy.ops.wm.obj_import(filepath=SRC)
meshes = [o for o in scene.objects if o.type == "MESH"]

# join into one mesh and bake object transforms into the data
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
cap = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

verts = cap.data.vertices


def bbox():
    xs = [v.co.x for v in verts]
    ys = [v.co.y for v in verts]
    zs = [v.co.z for v in verts]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


(x0, x1), (y0, y1), (z0, z1) = bbox()
print("POST-APPLY BBOX", (x0, x1), (y0, y1), (z0, z1))

# Identify axes: up = axis of the crown dome, visor = horizontal axis with the
# largest asymmetry. Then rotate everything into Z-up / visor--Y.
spans = {"x": x1 - x0, "y": y1 - y0, "z": z1 - z0}
asym = {
    "x": abs(x1 + x0),
    "y": abs(y1 + y0),
    "z": abs(z1 + z0),
}
visor_axis = max(asym, key=lambda a: asym[a])
print("SPANS", spans, "ASYM", asym, "VISOR_AXIS", visor_axis)

# Rotate mesh data directly with matrices.
from mathutils import Matrix

# Game-forward is Blender +Y here (verified in-game with a flip test).
xform = Matrix.Identity(4)
if visor_axis == "y":
    if abs(y1) > abs(y0):
        pass  # visor already on +Y (game front)
    else:
        xform = Matrix.Rotation(math.pi, 4, "Z") @ xform
elif visor_axis == "z":
    xform = Matrix.Rotation(math.pi / 2, 4, "X") @ xform
    if abs(z0) > abs(z1):
        xform = Matrix.Rotation(math.pi, 4, "Z") @ xform
else:
    sign = 1 if abs(x1) > abs(x0) else -1
    xform = Matrix.Rotation(sign * math.pi / 2, 4, "Z") @ xform

cap.data.transform(xform)
cap.data.update()
(x0, x1), (y0, y1), (z0, z1) = bbox()
print("ORIENTED BBOX", (x0, x1), (y0, y1), (z0, z1))

# crown half-width drives scale; ×0.76 because this model flares wide at the
# rim and reads oversized at a literal fit
half_w = max(abs(x0), abs(x1))
s = (0.41 / half_w) * 0.76
cap.data.transform(Matrix.Diagonal((s, s, s * 0.8, 1)))
cap.data.update()
(x0, x1), (y0, y1), (z0, z1) = bbox()
print("SCALED BBOX", (x0, x1), (y0, y1), (z0, z1))

# position: center x, rim (bottom) at z 0.165, crown BACK (-Y) at -0.30;
# the bill extends toward +Y (game front)
dz = 0.165 - z0
dy = -0.3 - y0
cap.data.transform(Matrix.Translation((-(x0 + x1) / 2, dy, dz)))
cap.data.update()
(x0, x1), (y0, y1), (z0, z1) = bbox()
print("FINAL BBOX", (x0, x1), (y0, y1), (z0, z1))

# stretch and droop the bill only (verts beyond the crown front at y < -0.30,
# confirmed from exported accessor bounds) so it reads from the head-on camera
BILL_HINGE = 0.30
for v in cap.data.vertices:
    if v.co.y > BILL_HINGE:
        ext = v.co.y - BILL_HINGE
        v.co.y = BILL_HINGE + ext * 1.28
        v.co.z -= ext * 0.22
cap.data.update()

# decimate 46k verts to something sane and smooth it
mod = cap.modifiers.new("decimate", "DECIMATE")
mod.ratio = 0.22
bpy.context.view_layer.objects.active = cap
bpy.ops.object.modifier_apply(modifier="decimate")
# make normals consistent & outward — flipped bill normals get backface-culled
import bmesh
bm = bmesh.new()
bm.from_mesh(cap.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(cap.data)
bm.free()
for poly in cap.data.polygons:
    poly.use_smooth = True
cap.name = "cap_crown"
cap.data.name = "cap_crown"


def make_material(name, rgb, roughness):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


cap.data.materials.clear()
cap.data.materials.append(make_material("cap_shell", (0.585, 0.055, 0.06), 0.86))

# label plane on the front panel: find the front surface (min y) around the
# label height band, centered in x
# fixed anchor on the front panel (the curled visor defeats vertex scans)
LABEL_Z = 0.3
front_y = -0.29
print("LABEL front_y", front_y)

mesh = bpy.data.meshes.new("cap_label")
w, h = 0.34, 0.13
mesh.from_pydata(
    [(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)],
    [],
    [(0, 1, 2, 3)],
)
mesh.update()
uv = mesh.uv_layers.new(name="UVMap")
for loop_index, (u_, v_) in enumerate(((0, 1), (1, 1), (1, 0), (0, 0))):
    uv.data[loop_index].uv = (u_, v_)
label = bpy.data.objects.new("cap_label", mesh)
col.objects.link(label)
label.location = (0, front_y - 0.05, LABEL_Z - 0.02)
label.rotation_euler = (0.34, 0, 0)
label.data.materials.append(make_material("cap_label_mat", (1, 1, 1), 0.76))

root = bpy.data.objects.new("accessory_cap", None)
col.objects.link(root)
cap.parent = root
label.parent = root

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True)
print("EXPORTED", OUT)
