"""Small original activity props; isolated Blender background authoring."""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models/people/activities'
SRC=ROOT/'assets/blender/people/activities'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0

def mat(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=.5;n.inputs['Metallic'].default_value=metal
 return m
black=mat('Rubber case',(.025,.038,.05));screen=mat('Blue glass',(.12,.55,.69),.2);paper=mat('Paper cup',(.93,.88,.74));lid=mat('Cream lid',(.96,.96,.9));sleeve=mat('Recycled sleeve',(.49,.27,.11));badge=mat('Raccoon cafe',(.11,.24,.22))
def box(name,loc,size,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  m=o.modifiers.new('Soft edges','BEVEL');m.width=bevel;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name)
 return o

def cylinder(name,radius,depth,z,material,top=None):
 bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=radius,radius2=top if top is not None else radius,depth=depth,location=(0,0,z));o=bpy.context.object;o.name=name;o.data.materials.append(material);return o

def save(name):
 objects=list(bpy.context.scene.objects);bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();root=bpy.context.object;root.name=name
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.wm.save_as_mainfile(filepath=str(SRC/(name+'.blend')),compress=True)
 # Preserve editable material slots in the source, but ship one palette draw.
 colors=root.data.color_attributes.new(name='ActivityColor',type='FLOAT_COLOR',domain='CORNER')
 for face in root.data.polygons:
  color=tuple(root.data.materials[face.material_index].diffuse_color)
  for i in face.loop_indices:colors.data[i].color=color
  face.material_index=0
 root.data.materials.clear();palette=mat('Activity palette',(1,1,1));attr=palette.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='ActivityColor'
 bsdf=next(n for n in palette.node_tree.nodes if n.type=='BSDF_PRINCIPLED');palette.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color']);root.data.materials.append(palette)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False)
 bpy.ops.object.delete(use_global=False)
box('Phone case',(0,0,0),(.082,.012,.16),black,.007)
box('Screen',(0,-.007,.004),(.071,.003,.138),screen,.003)
for i in range(3):box('Chat bubble',(0,-.009,.035-i*.025),(.041,.001,.008),lid,.001)
box('Camera',(0,-.009,.067),(.015,.003,.006),black,.002)
save('phone')
cylinder('Cup',.032,.13,0,paper,.047)
cylinder('Sleeve',.039,.054,-.011,sleeve,.044)
cylinder('Lid',.05,.014,.07,lid)
cylinder('Lid crown',.045,.01,.082,lid)
box('Sip opening',(0,-.031,.089),(.019,.009,.004),black,.002)
box('Cafe badge',(0,-.043,-.009),(.032,.005,.028),badge,.003)
save('coffee')
print('ACTIVITY_PROPS_READY')
