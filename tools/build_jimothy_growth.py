"""Author a rounded growth direction on the original continuous Jimothy mesh.

Blender --background --python-exit-code 1 --python tools/build_jimothy_growth.py
The basis and skin weights stay intact; GiantGrowth stores one unit of growth.
"""
import bpy, json, subprocess
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
config=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {RIG,PLAYER_CONFIG} from './src/core/Constants.js'; console.log(JSON.stringify({RIG,PLAYER_CONFIG}))"],cwd=ROOT))
rig=config['RIG']
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/jimothy/jimothy-footing.blend'))
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.vertex_groups.get('body'))
world=[mesh.matrix_world@v.co for v in mesh.data.vertices]
lo=Vector(tuple(min(p[i] for p in world) for i in range(3)));hi=Vector(tuple(max(p[i] for p in world) for i in range(3)))
scale=rig['TARGET_LENGTH']/max(hi-lo);radius=config['PLAYER_CONFIG']['RADIUS']/scale
names={g.index:g.name for g in mesh.vertex_groups}
core=[p for v,p in zip(mesh.data.vertices,world) if sum(g.weight for g in v.groups if names[g.group] in ['body','neck'])>=rig['TORSO_WEIGHT']]
a=Vector(tuple(min(p[i] for p in core) for i in range(3)));b=Vector(tuple(max(p[i] for p in core) for i in range(3)));center=(a+b)/2;extent=(b-a)/2
anchors={name:Vector((d[0],-d[2],d[1])).normalized() for name,d in rig['GROWTH_ANCHORS'].items()}
anchors.update({name.replace('leg_','shin_'):d for name,d in list(anchors.items()) if name.startswith('leg_')})
if mesh.data.shape_keys: mesh.shape_key_clear()
mesh.shape_key_add(name='Basis');key=mesh.shape_key_add(name='GiantGrowth')
linear=mesh.matrix_world.inverted().to_3x3()
directions=[];locked=[]
for v,p,k in zip(mesh.data.vertices,world,key.data):
 radial=Vector(tuple((p[i]-center[i])/max(extent[i],1e-6) for i in range(3))).normalized()
 weights={names[g.group]:g.weight for g in v.groups};part_weights={}
 # JIM-69: both knee segments belong to ONE anatomical limb. Selecting the
 # largest individual bone made a 50/50 knee expand radially while its paw
 # translated rigidly, stretching long wedges into the underside at rest.
 for n,w in weights.items():
  if n in anchors:
   owner=n.replace('shin_','leg_');part_weights[owner]=part_weights.get(owner,0)+w
 # Most of a face/paw must translate rigidly. The anatomical socket band is
 # the only place the direction blends into the expanding torso.
 if part_weights:
  part=max(part_weights,key=part_weights.get);w=max(0,min(1,(part_weights[part]-rig['GROWTH_BLEND_IN'])/(rig['GROWTH_BLEND_OUT']-rig['GROWTH_BLEND_IN'])));w=w*w*(3-2*w)
  direction=radial.lerp(anchors[part],w).normalized()
 else:direction=radial;w=0
 directions.append(direction);locked.append(w>=1)
# Smooth the displacement field across the anatomical socket, not the source
# mesh. UV seams must share neighbours or they grow into visible creases.
# Rigid face/paw interiors stay fixed, preserving their local proportions.
canonical={};ids=[];groups=[];eps=rig['GROWTH_WELD_EPSILON']
for v in mesh.data.vertices:
 key_pos=tuple(round(c/eps) for c in v.co)
 if key_pos not in canonical:canonical[key_pos]=len(groups);groups.append([])
 i=canonical[key_pos];ids.append(i);groups[i].append(v.index)
adj=[set() for _ in groups]
for e in mesh.data.edges:
 a,b=(ids[i] for i in e.vertices)
 if a!=b:adj[a].add(b);adj[b].add(a)
field=[sum((directions[v] for v in group),Vector())/len(group) for group in groups]
fixed=[any(locked[v] for v in group) for group in groups]
for _ in range(rig['GROWTH_SMOOTH_STEPS']):
 field=[d if fixed[i] or not adj[i] else d.lerp(sum((field[n] for n in adj[i]),Vector())/len(adj[i]),rig['GROWTH_SMOOTH_BLEND']).normalized() for i,d in enumerate(field)]
for v,k in zip(mesh.data.vertices,key.data):k.co=v.co+linear@(field[ids[v.index]]*radius)
mesh['growth_recipe']='build_jimothy_growth.py: whole-limb directions, smooth socket displacement'
mesh['growth_radius']=radius
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/jimothy/jimothy-growth.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/models/jimothy-skinned.glb'),export_format='GLB',export_yup=True,export_apply=False,export_skins=True,export_morph=True,export_morph_normal=False,export_extras=True)
print('GIANT_GROWTH '+json.dumps(dict(vertices=len(world),radius=radius,core=len(core))))
