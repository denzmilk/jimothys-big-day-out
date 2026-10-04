"""Import Kenney CC0 Car Kit sources; separate glazing and export at metre scale."""
import bpy, json, math, os
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/vehicles/kenney-source'; OUT=ROOT/'public/assets/models/vehicles'
NAMES=['sedan','hatchback-sports','suv','van','taxi','delivery','police']
manifest=[dict(id=name,author='Kenney',license='CC0 1.0',source='https://kenney.nl/assets/car-kit') for name in NAMES]
for index,name in enumerate(NAMES):
 if os.environ.get('VEHICLES_ONLY') and name not in os.environ['VEHICLES_ONLY'].split(','):continue
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
 bpy.ops.import_scene.gltf(filepath=str(SOURCE/(name+'.glb')))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 # Library vehicles share units. Scale consistently to a 4.1 m sedan;
 # deliveries retain their larger authored proportions.
 # The SUV spare is a child of its body. Flatten the authored world transforms
 # before scaling, otherwise that tyre inherits the metre conversion twice (JIM-57).
 bpy.context.view_layer.update()
 transforms=[(o,o.matrix_world.copy()) for o in meshes]
 for o,world in transforms:
  o.parent=None;o.matrix_world=Matrix.Scale(1.6,4)@world
 bpy.context.view_layer.update()
 points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 minz=min(p.z for p in points)
 for o in meshes:
  o.location.z-=minz
  o.matrix_world=Matrix.Rotation(math.pi,4,'Z')@o.matrix_world
 glass=bpy.data.materials.new('Window glass');glass.use_nodes=True
 bsdf=glass.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.72,.85,.86,1);bsdf.inputs['Roughness'].default_value=.08;bsdf.inputs['Transmission Weight'].default_value=.88;bsdf.inputs['IOR'].default_value=1.46
 for ob in meshes:
  if 'body' not in ob.name:continue
  ob.data.materials.append(glass);idx=len(ob.data.materials)-1;uv=ob.data.uv_layers.active.data
  for face in ob.data.polygons:
   u=sum(uv[i].uv.x for i in face.loop_indices)/len(face.loop_indices);v=sum(uv[i].uv.y for i in face.loop_indices)/len(face.loop_indices)
   # Kenney's pale blue glass swatch occupies the first palette column
   # in the bottom row. Other pale swatches are lamps, tyres and paint.
   if u<.125 and v<.25:face.material_index=idx
 for o in meshes:
  if 'wheel'  in o.name:o['section']=index%4+2
  else:o['section']=0
 for img in bpy.data.images:
  if img.source=='FILE':img.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/vehicles'/(name+'.blend')),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_extras=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
