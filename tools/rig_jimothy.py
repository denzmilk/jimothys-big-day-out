# Skinned Jimothy (JIM-21). Replaces the seven-separate-solids approach with
# ONE continuous mesh bound to an armature, so the surface stretches across a
# joint instead of two rigid pieces sliding past each other.
#
#   blender --background --python tools/rig_jimothy.py -- <src.glb> <out.glb>
#
# Bone placement reuses the anatomy landmarks the old split already calibrated
# (neck / tail / leg-top fractions), so that hard-won tuning carries over --
# they become joint positions instead of cut planes.
#
# Blender is Z-up and the glTF importer maps glTF +Z to Blender -Y, so
# Jimothy's NOSE is at minus Y here and Z is height. Verified by colour-split
# render in milestone 06; do not "correct" it.
import bpy, bmesh, sys, json, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]

TARGET_TRIS = 40_000
TEXTURE_SIZE = 1024
WELD_DISTANCE = 1e-5
NECK_FRAC = 0.26
TAIL_FRAC = 0.16
LEG_TOP_FRAC = 0.42

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = obj

# Weld before decimating (JIM-10): glTF duplicates vertices at every UV and
# normal seam, and Decimate tears apart a mesh it thinks is disconnected.
bm = bmesh.new()
bm.from_mesh(obj.data)
before = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD_DISTANCE)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(obj.data)
bm.free()
obj.data.update()
print(f'RIGWELD {before} -> {len(obj.data.vertices)}')

obj.data.calc_loop_triangles()
tris = len(obj.data.loop_triangles)
if tris > TARGET_TRIS:
    mod = obj.modifiers.new('dec', 'DECIMATE')
    mod.ratio = TARGET_TRIS / tris
    bpy.ops.object.modifier_apply(modifier=mod.name)

for im in bpy.data.images:
    if im.size[0] > TEXTURE_SIZE:
        im.scale(TEXTURE_SIZE, TEXTURE_SIZE)

# --- anatomy landmarks (same fractions the split used) ---
bb = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
xs = [p.x for p in bb]; ys = [p.y for p in bb]; zs = [p.z for p in bb]
x_min, x_max = min(xs), max(xs)
y_min, y_max = min(ys), max(ys)   # y_min = nose end
z_min, z_max = min(zs), max(zs)   # z_min = feet
y_len = y_max - y_min
z_len = z_max - z_min
neck_y = y_min + NECK_FRAC * y_len
tail_y = y_max - TAIL_FRAC * y_len
leg_z = z_min + LEG_TOP_FRAC * z_len
y_mid = (y_min + y_max) / 2
# Body core sits above the leg tops; put the spine through the middle of it.
spine_z = leg_z + (z_max - leg_z) * 0.45
leg_x = (x_max - x_min) * 0.22           # how far out the hips sit
foot_z = z_min + z_len * 0.02

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.object
arm_obj.name = 'jimothy_arm'
arm = arm_obj.data
arm.edit_bones.remove(arm.edit_bones[0])   # drop the default bone

V = mathutils.Vector


def bone(name, head, tail, parent=None, connect=False):
    b = arm.edit_bones.new(name)
    b.head = V(head)
    b.tail = V(tail)
    if parent:
        b.parent = arm.edit_bones[parent]
        b.use_connect = connect
    return b


# Spine runs rump -> nose. `body` is the root everything hangs from, which
# matches how the game already thinks about him (a body with bits attached).
bone('body', (0, tail_y, spine_z), (0, y_mid, spine_z))
bone('neck', (0, y_mid, spine_z), (0, neck_y, spine_z), 'body', True)
bone('head', (0, neck_y, spine_z), (0, y_min + y_len * 0.04, spine_z + z_len * 0.05), 'neck', True)
bone('tail', (0, tail_y, spine_z), (0, y_max, spine_z + z_len * 0.08), 'body')

# Four legs, each hip -> knee -> foot. TWO segments, not one: foot IK needs a
# limb that can bend, and a single hip-to-foot stick cannot plant a foot on
# uneven ground (Chris 2026-08-07: "physics aware footing you get with
# unity/unreal"). The knee also gives the sprawled, low-slung scamper pose
# somewhere to bend outward from.
#
# The knee is pushed slightly OUTWARD in x and forward/back in y, which is
# what pre-defines the bend direction — an IK solver needs to know which way
# the joint folds, and a perfectly straight limb is ambiguous.
KNEE_FRAC = 0.55          # how far down the leg the knee sits
KNEE_OUT = 0.35           # sideways bend hint, as a fraction of hip offset
for label, sx, fy, fwd in (
    ('FL', -1, y_mid - y_len * 0.22, -1), ('FR', 1, y_mid - y_len * 0.22, -1),
    ('RL', -1, y_mid + y_len * 0.20, 1), ('RR', 1, y_mid + y_len * 0.20, 1),
):
    hip = (sx * leg_x, fy, leg_z)
    knee = (
        sx * leg_x * (1 + KNEE_OUT),
        fy + fwd * y_len * 0.03,
        leg_z + (foot_z - leg_z) * KNEE_FRAC,
    )
    foot = (sx * leg_x * (1 + KNEE_OUT * 0.5), fy, foot_z)
    bone(f'leg_{label}', hip, knee, 'body')
    bone(f'shin_{label}', knee, foot, f'leg_{label}', True)

bpy.ops.object.mode_set(mode='OBJECT')

# Decimation leaves degenerate faces behind, which is what the exporter means
# by "Mesh is not valid". Clean them before binding.
obj.data.validate(verbose=False)

# --- bind ---
# Deliberately NOT Blender's automatic (bone-heat) weights. Those failed on
# this mesh -- "Bone Heat Weighting: failed to find solution for one or more
# bones", leaving all 18,766 vertices with zero influence -- and they fail
# *silently*, producing an armature that looks correct and deforms nothing.
#
# Distance-to-bone-segment weights instead: deterministic, impossible to fail,
# and trivially debuggable. Smooth falloff across a joint is all we need, and
# this is a deliberately sloppy raccoon, not a feature-film rig.
def dist_to_segment(p, a, b):
    ab = b - a
    denom = ab.dot(ab)
    t = 0.0 if denom == 0 else max(0.0, min(1.0, (p - a).dot(ab) / denom))
    return (p - (a + ab * t)).length


segments = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.bones]
groups = {name: obj.vertex_groups.new(name=name) for name, _, _ in segments}

# Higher power = tighter to the nearest bone; lower = softer, stretchier
# joints. 3.0 keeps limbs distinct while genuinely blending at the sockets,
# which is the whole point of this milestone.
FALLOFF = 3.0
MAX_INFLUENCES = 4   # glTF's standard per-vertex limit
EPS = 1e-4

weighted = 0
for v in obj.data.vertices:
    scored = sorted(
        ((name, 1.0 / (dist_to_segment(v.co, h, t) ** FALLOFF + EPS))
         for name, h, t in segments),
        key=lambda kv: kv[1], reverse=True,
    )[:MAX_INFLUENCES]
    total = sum(w for _, w in scored)
    if total <= 0:
        continue
    for name, w in scored:
        groups[name].add([v.index], w / total, 'REPLACE')
    weighted += 1

obj.parent = arm_obj
obj.matrix_parent_inverse = arm_obj.matrix_world.inverted()
mod = obj.modifiers.new('arm', 'ARMATURE')
mod.object = arm_obj

print(f'RIGBIND mode=distance weighted={weighted}/{len(obj.data.vertices)} '
      f'groups={[g.name for g in obj.vertex_groups]}')

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=False,
    export_yup=True, export_apply=False, export_skins=True,
)

print('RIGJSON' + json.dumps({
    'tris': tris,
    'verts': len(obj.data.vertices),
    'weighted': weighted,
    'bones': [b.name for b in arm.bones],
    'neck_y': round(neck_y, 3), 'tail_y': round(tail_y, 3), 'leg_z': round(leg_z, 3),
}) + 'ENDJSON')
