"""Author a spherical growth direction on the original continuous Jimothy mesh.

Blender --background --python-exit-code 1 --python tools/build_jimothy_growth.py
The basis and skin weights stay intact; GiantGrowth stores one unit of growth.
"""
import bpy, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/jimothy/jimothy-footing.blend'))
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.vertex_groups.get('body'))
world=[mesh.matrix_world@v.co for v in mesh.data.vertices]
lo=Vector(tuple(min(p[i] for p in world) for i in range(3)));hi=Vector(tuple(max(p[i] for p in world) for i in range(3)))
scale=1.7/max(hi-lo);radius=.55/scale
names={g.index:g.name for g in mesh.vertex_groups}
core=[p for v,p in zip(mesh.data.vertices,world) if sum(g.weight for g in v.groups if names[g.group] in ['body','neck'])>=.8]
a=Vector(tuple(min(p[i] for p in core) for i in range(3)));b=Vector(tuple(max(p[i] for p in core) for i in range(3)));center=(a+b)/2;extent=(b-a)/2
anchors={'head':Vector((0,-1,.08)).normalized(),'tail':Vector((0,1,.15)).normalized()}
for label,x,y in [('FL',-.1,-.1),('FR',.1,-.1),('RL',-.1,.1),('RR',.1,.1)]:
 anchors['leg_'+label]=anchors['shin_'+label]=Vector((x,y,-1)).normalized()
if mesh.data.shape_keys: mesh.shape_key_clear()
mesh.shape_key_add(name='Basis');key=mesh.shape_key_add(name='GiantGrowth')
linear=mesh.matrix_world.inverted().to_3x3()
for v,p,k in zip(mesh.data.vertices,world,key.data):
 radial=Vector(tuple((p[i]-center[i])/max(extent[i],1e-6) for i in range(3))).normalized()
 weights={names[g.group]:g.weight for g in v.groups};part_weights={n:w for n,w in weights.items() if n in anchors}
 # Most of a face/paw must translate rigidly. The anatomical socket band is
 # the only place the direction blends into the expanding torso.
 if part_weights:
  part=max(part_weights,key=part_weights.get);w=max(0,min(1,(part_weights[part]-.65)/.25));w=w*w*(3-2*w)
  direction=radial.lerp(anchors[part],w).normalized()
 else:direction=radial
 k.co=v.co+linear@(direction*radius)
mesh['growth_recipe']='build_jimothy_growth.py: spherical torso, rigid extremity directions'
mesh['growth_radius']=radius
# A smooth coat fills the concave angular fans around tiny sockets at giant
# scale. Its lean basis is hidden inside the original torso. Runtime joins it
# into the same skinned draw, retaining the original animated detail above it.
bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=40,radius=radius*.0001,location=center)
coat=bpy.context.object;coat.name='GiantCoat'
for face in coat.data.polygons:face.use_smooth=True
coat.shape_key_add(name='Basis');growth=coat.shape_key_add(name='GiantGrowth')
for v,k in zip(coat.data.vertices,growth.data):k.co=v.co+v.co.normalized()*radius
coat['growth_coat']=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/jimothy/jimothy-growth.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/models/jimothy-skinned.glb'),export_format='GLB',export_yup=True,export_apply=False,export_skins=True,export_morph=True,export_morph_normal=False,export_extras=True)
print('GIANT_GROWTH '+json.dumps(dict(vertices=len(world),radius=radius,core=len(core))))
