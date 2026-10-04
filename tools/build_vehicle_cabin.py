"""Editable cabin inserts for the existing Kenney CC0 cars; no car replacement."""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models/vehicles'; SRC=ROOT/'assets/blender/vehicles'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
def mat(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 node=m.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=(*color,1);node.inputs['Roughness'].default_value=.7;node.inputs['Metallic'].default_value=metal
 return m
cloth=mat('Charcoal upholstery',(.06,.085,.095));trim=mat('Seat piping',(.24,.29,.30));rubber=mat('Wheel rubber',(.018,.024,.027));metal=mat('Brushed hub',(.45,.50,.52),.7)
def box(name,at,size,material,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 m=o.modifiers.new('Rounded padding','BEVEL');m.width=bevel;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
for x in [-.26,.26]:
 box('Seat cushion',(x,.09,-.40),(.44,.49,.13),cloth)
 box('Seat back',(x,.30,-.13),(.44,.12,.48),cloth)
 box('Headrest',(x,.30,.18),(.28,.12,.15),trim)
 for sx in [-1,1]:box('Seat bolster',(x+sx*.18,.07,-.31),(.07,.41,.11),trim,.02)
wheel=[]
bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=.19,minor_radius=.021,location=(.26,-.39,.19),rotation=(math.radians(65),0,0));o=bpy.context.object;o.data.materials.append(rubber);wheel.append(o)
for a in [0,2*math.pi/3,4*math.pi/3]:
 o=box('Spoke',(.26+math.sin(a)*.08,-.39+math.cos(a)*.08*math.cos(math.radians(65)),.19+math.cos(a)*.08*math.sin(math.radians(65))),(.028,.024,.19),metal,.008);o.rotation_euler=(math.pi/2-math.radians(65),0,-a);wheel.append(o)
wheel.append(box('Hub',(.26,-.39,.19),(.09,.06,.09),rubber,.02))
bpy.ops.object.select_all(action='DESELECT')
for o in wheel:o.select_set(True)
bpy.context.view_layer.objects.active=wheel[0];bpy.ops.object.join();bpy.context.object.name='steering-wheel'
bpy.context.scene.cursor.location=(.26,-.39,.19);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'cabin.blend'),compress=True)
# Keep the editable material slots in Blender, but use two vertex-colour draws
# per cabin in the street: the seats and independently turning steering wheel.
steering=bpy.context.object
bpy.ops.object.select_all(action='DESELECT')
for o in list(bpy.context.scene.objects):
 if o!=steering:o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.object.join();bpy.context.object.name='seats'
for root in [bpy.context.object,steering]:
 colors=root.data.color_attributes.new(name='CabinColor',type='FLOAT_COLOR',domain='CORNER')
 for face in root.data.polygons:
  color=tuple(root.data.materials[face.material_index].diffuse_color)
  for i in face.loop_indices:colors.data[i].color=color
  face.material_index=0
 root.data.materials.clear();palette=mat('Cabin palette',(1,1,1));attr=palette.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='CabinColor'
 palette.node_tree.links.new(attr.outputs['Color'],palette.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);root.data.materials.append(palette)
bpy.ops.export_scene.gltf(filepath=str(OUT/'cabin.glb'),export_format='GLB',export_animations=False)
print('VEHICLE_CABIN_READY')
