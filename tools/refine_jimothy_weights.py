"""Keep paw motion out of the torso, preserving the existing mesh and armature.

Blender --background --python-exit-code 1 --python tools/refine_jimothy_weights.py -- source.glb output.glb source.blend
Use the original rig export as source; see assets/blender/jimothy/README.md.
"""
import bpy, sys, json
from pathlib import Path
source, output, editable = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
mesh = next(o for o in bpy.data.objects if o.type == 'MESH' and o.vertex_groups.get('body'))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
hips = [arm.matrix_world @ b.head_local for b in arm.data.bones if b.name.startswith('leg_')]
hip_z = sum(p.z for p in hips) / len(hips)
world = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
low = min(p.z for p in world)
# Anatomical bands scale with the exported leg, independent of world units.
leg_height = hip_z - low
blend_low, blend_high = hip_z - leg_height * .08, hip_z + leg_height * .24
paw_top = low + leg_height * .18
names = {g.index: g.name for g in mesh.vertex_groups}
body = mesh.vertex_groups['body']
changed, upper_before, upper_after = 0, 0, 0

def smooth(a, b, v):
    t = max(0, min(1, (v-a)/(b-a)))
    return t*t*(3-2*t)

for v, p in zip(mesh.data.vertices, world):
    weights = {names[g.group]: g.weight for g in v.groups}
    before = dict(weights)
    limb = [n for n in weights if n.startswith(('leg_', 'shin_'))]
    if p.z > blend_high:
        upper_before = max(upper_before, sum(weights[n] for n in limb))
    factor = 1 - smooth(blend_low, blend_high, p.z)
    transferred = 0
    for name in limb:
        transferred += weights[name] * (1-factor)
        weights[name] *= factor
    weights['body'] = weights.get('body', 0) + transferred
    # A planted paw needs to follow its shin. Retain a soft transition into
    # the ankle; distance-only weights also pulled toes with the opposite leg.
    if p.z < paw_top and limb:
        shins = [n for n in limb if n.startswith('shin_')]
        if shins:
            owner = max(shins, key=lambda n: weights[n])
            rigid = 1 - smooth(low + leg_height * .07, paw_top, p.z)
            for name in weights:
                weights[name] *= 1-rigid
            weights[owner] += rigid
    if p.z > blend_high:
        upper_after = max(upper_after, sum(weights[n] for n in limb))
    if any(abs(weights.get(n,0)-before.get(n,0)) > 1e-7 for n in weights):
        changed += 1
    weights = dict(sorted(weights.items(), key=lambda kv: kv[1], reverse=True)[:4])
    total = sum(weights.values())
    for group in mesh.vertex_groups:
        if group.name in before:
            group.remove([v.index])
    for name, weight in weights.items():
        if weight > 1e-7:
            mesh.vertex_groups[name].add([v.index], weight/total, 'REPLACE')
Path(editable).parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(editable).resolve()))
bpy.ops.export_scene.gltf(filepath=str(Path(output).resolve()), export_format='GLB', use_selection=False, export_yup=True, export_apply=False, export_skins=True)
print('PAW_WEIGHTS ' + json.dumps(dict(changed=changed, vertices=len(world), upper_before=upper_before, upper_after=upper_after)))
