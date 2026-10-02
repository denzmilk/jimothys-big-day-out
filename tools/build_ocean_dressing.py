"""Editable seabed plants, creatures, artifacts and the exact voxel ruin layouts."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/assets/models/ocean';EDIT=ROOT/'assets/blender/ocean'
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);return m
def begin():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 return [material('deep kelp',(.08,.26,.13)),material('tips',(.26,.46,.14)),material('ochre',(.66,.32,.13)),material('shell',(.39,.18,.1)),material('stone',(.5,.53,.43))]
def mesh(name,verts,faces,mat):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.materials.append(mat);o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return o
def sphere(at,scale,mat,name='shell'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,location=at);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);return o
def cube(at,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.scale=size;o.data.materials.append(mat);return o
def save(name):
 bpy.ops.wm.save_as_mainfile(filepath=str(EDIT/f'{name}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False)
if '--ruins-only' not in sys.argv:
 for name in ['kelp','seagrass']:
  mats=begin();count=5 if name=='kelp' else 9
  for i in range(count):
   a=i*2.399;length=2.1+i*.18 if name=='kelp' else .5+i*.04;width=.11 if name=='kelp' else .035;verts=[];faces=[]
   for j in range(9):
    t=j/8;bend=math.sin(t*2.7+i)*t*.3;cx=math.cos(a)*t*.4+bend;cy=math.sin(a)*t*.4
    verts.extend([(cx-width*(1-t*.8),cy,length*t),(cx+width*(1-t*.8),cy,length*t)])
    if j:faces.append((j*2-2,j*2-1,j*2+1,j*2))
   mesh('frond',verts,faces,mats[i%2])
  save(name)
 m=begin();sphere((0,0,.12),(.3,.23,.13),m[2])
 for side in [-1,1]:
  for i in range(4):
   angle=(i-1.5)*.38;end=(side*(.48+abs(i-1.5)*.025),angle,.025);o=cube(((end[0]+side*.2)/2,(end[1]+angle*.4)/2,.075),(.34,.045,.055),m[3]);o.rotation_euler.z=side*angle
  sphere((side*.32,-.3,.16),(.13,.16,.09),m[2],'claw')
  sphere((side*.11,-.14,.27),(.035,.035,.035),m[3],'eye')
 save('crab')
 m=begin();verts=[(0,0,.08)];faces=[]
 for i in range(10):
  a=i*math.pi/5;r=.38 if i%2==0 else .14;verts.append((math.sin(a)*r,math.cos(a)*r,.015))
 for i in range(10):faces.append((0,i+1,(i+1)%10+1))
 mesh('five arms',verts,faces,m[2]);save('starfish')
 for name in ['urn','barrel']:
  m=begin();verts=[];faces=[];profile=[(.17,0),(.32,.16),(.34,.5),(.19,.7),(.17,.83)] if name=='urn' else [(.27,0),(.34,.18),(.36,.4),(.34,.62),(.27,.8)]
  for r,z in profile:
   for i in range(12):a=i*math.pi/6;verts.append((math.cos(a)*r,math.sin(a)*r,z))
  for j in range(len(profile)-1):
   for i in range(12):faces.append((j*12+i,j*12+(i+1)%12,(j+1)*12+(i+1)%12,(j+1)*12+i))
  mesh(name,verts,faces,m[2 if name=='urn' else 3]);save(name)
for family,pieces in json.loads((EDIT/'ruin-layouts.json').read_text()).items():
 mats=begin()
 for p in pieces:
  if p['shape']=='column':bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.5,depth=1)
  else:bpy.ops.mesh.primitive_cube_add(size=1)
  o=bpy.context.object;o.name='stone-'+str(p['index']);o.location=(p['x'],-p['z'],p['y']);o.scale=(p['sx'],p['sz'],p['sy']);o.rotation_euler=(0,-p['roll'],p.get('yaw',0));o.data.materials.append(mats[4])
 bpy.ops.wm.save_as_mainfile(filepath=str(EDIT/f'ruin-{family}.blend'))
