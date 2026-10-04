"""M60: editable CC0 firearm import and original fitted police cap."""
from pathlib import Path
import bpy, math
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models/people/response';SOURCE=ROOT/'assets/blender/people/response'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/sources/police/blaster-a.glb'))
bpy.context.view_layer.update();transforms=[(o,o.matrix_world.copy()) for o in bpy.context.scene.objects if o.type=='MESH']
for ob,world in transforms:
 ob.parent=None;ob.matrix_world=Matrix.Scale(.55,4)@world
for img in bpy.data.images:
 if img.source=='FILE':img.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'police-gun.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'police-gun.glb'),export_format='GLB')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
navy=bpy.data.materials.new('Police navy');navy.diffuse_color=(.018,.034,.07,1)
gold=bpy.data.materials.new('Cap badge');gold.diffuse_color=(.9,.61,.12,1)
black=bpy.data.materials.new('Visor');black.diffuse_color=(.012,.015,.021,1)
for mat in (navy,gold,black):
 mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color
def uv(name,location,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,location=location);ob=bpy.context.object;ob.name=name;ob.scale=scale;ob.data.materials.append(mat);return ob
uv('cap-crown',(0,0,.015),(.116,.123,.07),navy)
uv('cap-visor',(0,-.09,-.024),(.124,.12,.014),black)
uv('cap-badge',(0,-.12,.018),(.022,.006,.027),gold)
for ob in bpy.context.scene.objects:
 if ob.type=='MESH':
  bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);ob.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'police-cap.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'police-cap.glb'),export_format='GLB')
