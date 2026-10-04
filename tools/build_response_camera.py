"""Original low-cost photographer camera, metres, +Y-up/+Z lens in glTF."""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models/people/response';SRC=ROOT/'assets/blender/people/response'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0

def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.4
 return m
body=material('Rubber camera body',(.028,.039,.05));rim=material('Lens alloy',(.22,.27,.29));glass=material('Blue lens',(.025,.25,.32));light=material('Flash diffuser',(.98,.95,.74));red=material('Record marker',(.75,.08,.045))
def box(name,at,size,mat,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Rounded casing','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
box('Camera body',(0,0,0),(.28,.10,.17),body)
box('Right grip',(-.115,-.02,-.005),(.055,.14,.15),body)
box('Top flash',(0,0,.125),(.12,.085,.085),rim)
box('Flash panel',(0,-.046,.13),(.1,.008,.055),light,.002)
box('Rear screen',(.015,.053,-.005),(.15,.009,.1),glass,.002)
box('Shutter',(-.1,0,.095),(.036,.034,.022),rim,.004)
box('Record light',(.102,-.054,.04),(.016,.006,.016),red,.002)
for name,radius,depth,y,mat in [('Lens barrel',.075,.14,-.10,body),('Lens rim',.078,.024,-.176,rim),('Lens glass',.065,.007,-.191,glass)]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=radius,depth=depth,location=(.015,y,0),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=name;o.data.materials.append(mat)
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=bpy.context.scene.objects[0];bpy.ops.object.join();o=bpy.context.object;o.name='camera';bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'camera.blend'),compress=True)
colors=o.data.color_attributes.new(name='CameraColor',type='FLOAT_COLOR',domain='CORNER')
for p in o.data.polygons:
 c=tuple(o.data.materials[p.material_index].diffuse_color)
 for i in p.loop_indices:colors.data[i].color=c
 p.material_index=0
o.data.materials.clear();m=material('Camera palette',(1,1,1));a=m.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='CameraColor';m.node_tree.links.new(a.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);o.data.materials.append(m)
bpy.ops.export_scene.gltf(filepath=str(OUT/'camera.glb'),export_format='GLB',use_selection=True,export_animations=False)
print('RESPONSE_CAMERA_READY')
