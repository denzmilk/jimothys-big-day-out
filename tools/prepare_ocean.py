"""Blender delivery recipe. Originals and CC0 licences remain beside the source files."""
import bpy,math,json,sys,argparse
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/sources/ocean';EDIT=ROOT/'assets/blender/ocean';OUT=ROOT/'public/assets/models/ocean'
for path in [SOURCE,EDIT,OUT]:path.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='+');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
manifest=json.loads((OUT/'manifest.json').read_text()) if args.only else []
def repair_swim_loop():
 # The supplied small-fish tails finish short of their opening pose. Matching
 # the authored endpoints and cyclic handles removes the visible loop snap.
 for action in bpy.data.actions:
  for layer in action.layers:
   for strip in layer.strips:
    for slot in action.slots:
     bag=strip.channelbag(slot)
     if not bag:continue
     for curve in bag.fcurves:
      keys=curve.keyframe_points
      if len(keys)<2:continue
      keys[-1].co.y=keys[0].co.y
      for key in [keys[0],keys[-1]]:key.handle_left_type=key.handle_right_type='AUTO'
      if not any(m.type=='CYCLES' for m in curve.modifiers):curve.modifiers.new('CYCLES')
      curve.update()
def materials():
 for mat in bpy.data.materials:
  color=tuple(mat.diffuse_color)
  if mat.node_tree:
   diffuse=next((n for n in mat.node_tree.nodes if n.type=='BSDF_DIFFUSE'),None)
   if diffuse:color=tuple(diffuse.inputs['Color'].default_value)
  mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Base Color'].default_value=color;shader.inputs['Roughness'].default_value=.85;output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
def pack_colors():
 for obj in bpy.context.scene.objects:
  if obj.type!='MESH':continue
  mesh=obj.data;attr=mesh.color_attributes.get('Color') or mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  for face in mesh.polygons:
   mat=mesh.materials[face.material_index];bsdf=mat.node_tree.nodes.get('Principled BSDF');color=bsdf.inputs['Base Color'].default_value
   for i in face.loop_indices:attr.data[i].color=color
  mat=bpy.data.materials.new(obj.name+'-colours');mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.85;vertex=mat.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color';mat.node_tree.links.new(vertex.outputs['Color'],bsdf.inputs['Base Color']);mesh.materials.clear();mesh.materials.append(mat)
  for face in mesh.polygons:face.material_index=0
def save(name,animated=False):
 bpy.ops.wm.save_as_mainfile(filepath=str(EDIT/f'{name}.blend'))
 path=OUT/f'{name}.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_animations=animated,export_animation_mode='ACTIONS',export_force_sampling=True)
 item={'id':name,'bytes':path.stat().st_size,'animated':animated,'forward':'+Z','source':'Quaternius CC0'}
 index=next((i for i,m in enumerate(manifest) if m['id']==name),None)
 if index is None:manifest.append(item)
 else:manifest[index]=item
for source,name,length in [('Fish1','fish-silver',.7),('Fish2','fish-blue',.9),('Fish3','fish-striped',.5),('Manta ray','manta',4),('Whale','whale',7)]:
 if args.only and name not in args.only:continue
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE/f'{source}.blend'));bpy.context.scene.frame_set(1);materials()
 if name.startswith('fish-'):repair_swim_loop()
 for obj in list(bpy.context.scene.objects):
  if obj.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(obj,do_unlink=True)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];bounds=[o.matrix_world@Vector(v)for o in meshes for v in o.bound_box];lo=Vector([min(v[i]for v in bounds)for i in range(3)]);hi=Vector([max(v[i]for v in bounds)for i in range(3)]);scale=length/(hi.y-lo.y)
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
 for o in list(bpy.context.scene.objects):
  if o!=root and o.parent is None:o.parent=root
 root.scale=(scale,)*3;root.location=-(lo+hi)*.5*scale
 pack_colors();save(name,True)
for source,name,length in [('Boat','wreck-rowboat',4),('BoatWSail','wreck-sloop',7),('Viking boat','wreck-longboat',15)]:
 if args.only and name not in args.only:continue
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE/f'{source}.blend'));bpy.context.scene.frame_set(1);materials()
 originals=[o for o in bpy.context.scene.objects if o.type=='MESH'];bounds=[o.matrix_world@Vector(v)for o in originals for v in o.bound_box];lo=Vector([min(v[i]for v in bounds)for i in range(3)]);hi=Vector([max(v[i]for v in bounds)for i in range(3)]);scale=length/(hi.y-lo.y);centre=(lo+hi)*.5;centre.z=lo.z
 records={}
 for o in originals:
  mesh=o.data.copy();mesh.transform(o.matrix_world)
  for f in mesh.polygons:
   c=f.center;section='sail' if 'sail' in o.name.lower() else 'bow' if c.y<lo.y+(hi.y-lo.y)*.28 else 'stern' if c.y>lo.y+(hi.y-lo.y)*.72 else 'port' if c.x<centre.x else 'starboard'
   d=records.setdefault(section,{'v':[],'f':[],'m':[],'materials':[]});start=len(d['v']);d['v'] += [tuple((mesh.vertices[i].co-centre)*scale)for i in f.vertices];d['f'].append(tuple(range(start,len(d['v']))));mat=mesh.materials[f.material_index]
   if mat not in d['materials']:d['materials'].append(mat)
   d['m'].append(d['materials'].index(mat))
  bpy.data.meshes.remove(mesh)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for section,d in records.items():
  mesh=bpy.data.meshes.new(section);mesh.from_pydata(d['v'],[],d['f']);mesh.update()
  for mat in d['materials']:mesh.materials.append(mat)
  for f,index in zip(mesh.polygons,d['m']):f.material_index=index
  o=bpy.data.objects.new(section,mesh);bpy.context.collection.objects.link(o)
 save(name)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
