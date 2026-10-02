"""Kenney CC0 Food Kit -> labelled metre-scale foods; background Blender recipe.
Source meshes remain in assets/sources/food. Blender coordinates use Z up.
"""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/sources/food';OUT=ROOT/'public/assets/models/food';BLEND=ROOT/'assets/blender/food'
for p in [SRC,OUT,BLEND]:p.mkdir(parents=True,exist_ok=True)
RECIPES=[
 ('pizza-slice','PIZZA SLICE','scrap','pizza',.32,'slice'),
 ('old-banana','OLD BANANA','scrap','banana',.28,''),
 ('cold-fries','COLD FRIES','scrap','fries',.26,''),
 ('mystery-meat','MYSTERY MEAT','scrap','meat-cooked',.30,''),
 ('chicken-bone','CHICKEN BONE','scrap','turkey',.27,'bone'),
 ('burrito','SUSPICIOUS BURRITO','scrap','loaf',.34,'wrap'),
 ('wet-bread','WET BREAD','scrap','bread',.25,''),
 ('half-hot-dog','HALF A HOT DOG','scrap','hot-dog',.26,'half'),
 ('expired-yogurt','EXPIRED YOGURT','scrap','ice-cream-cup',.21,'yogurt'),
 ('fancy-garbage','FANCY GARBAGE','scrap','sushi-salmon',.24,''),
 ('whole-pizza','WHOLE PIZZA','feast','pizza',.68,''),
 ('turkey-leg','TURKEY LEG','feast','turkey',.43,'leg'),
 ('lasagna','ENTIRE LASAGNA','feast','bread',.62,'lasagna'),
 ('birthday-cake','BIRTHDAY CAKE','feast','cake-birthday',.52,''),
 ('family-roast','FAMILY ROAST','feast','turkey',.70,''),
 ('meatloaf','ABANDONED MEATLOAF','feast','loaf',.62,'meatloaf'),
]

def import_model(name,select=None):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(SRC/(name+'.glb')))
 meshes=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
 bpy.context.view_layer.update()
 worlds=[(o,o.matrix_world.copy()) for o in meshes]
 for o,m in worlds:o.parent=None;o.matrix_world=m
 if select:
  chosen=[o for o in meshes if select(o)]
  for o in meshes:
   if o not in chosen:bpy.data.objects.remove(o,do_unlink=True)
  meshes=chosen
 for o in meshes:
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
 return meshes

def colorize(meshes,override=None):
 for o in meshes:
  uv=o.data.uv_layers.active;colors=o.data.color_attributes.new(name='FoodColor',type='FLOAT_COLOR',domain='CORNER')
  cache={}
  for face in o.data.polygons:
   mat=o.data.materials[face.material_index];tex=next((n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None) if mat.use_nodes else None
   bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if mat.use_nodes else None
   for i in face.loop_indices:
    col=tuple(bsdf.inputs['Base Color'].default_value) if bsdf else tuple(mat.diffuse_color)
    if tex and uv:
     im=tex.image
     if im.name not in cache:cache[im.name]=list(im.pixels)
     u,v=uv.data[i].uv;px=min(im.size[0]-1,max(0,int(u*im.size[0])));py=min(im.size[1]-1,max(0,int(v*im.size[1])));idx=(py*im.size[0]+px)*4;col=cache[im.name][idx:idx+4];col=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in col[:3]]+[col[3]]
    colors.data[i].color=override(col,o.data.vertices[o.data.loops[i].vertex_index].co) if override else col
  o.data.materials.clear()

def normalize(meshes,span):
 pts=[v.co for o in meshes for v in o.data.vertices];lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)));sc=span/max(hi-lo);cen=(hi+lo)/2;cen.z=lo.z
 for o in meshes:
  for v in o.data.vertices:v.co=(v.co-cen)*sc

def slab(name,dimensions,offset,color):
 objs=import_model(name);normalize(objs,1);pts=[v.co for o in objs for v in o.data.vertices];size=Vector(tuple(max(v[i] for v in pts)-min(v[i] for v in pts) for i in range(3)))
 for o in objs:
  for v in o.data.vertices:v.co=Vector(tuple(v.co[i]*dimensions[i]/max(.001,size[i])+offset[i] for i in range(3)))

 if name=='bread':
  for o in objs:
   for v in o.data.vertices:
    for i in [0,1]:
     q=(v.co[i]-offset[i])/(dimensions[i]/2);v.co[i]=offset[i]+math.copysign(abs(q)**.2,q)*dimensions[i]/2
 colorize(objs,lambda c,p:(*color,1));return objs

manifest=[]
for id,label,tier,source,size,edit in RECIPES:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
 select=(lambda o:o.name=='slice1') if edit=='slice' else (lambda o:o.name=='leg') if edit in ['bone','leg'] else None
 objs=import_model(source,select)
 if edit=='half':
  pts=[v.co for o in objs for v in o.data.vertices];axis=max(range(2),key=lambda i:max(v[i] for v in pts)-min(v[i] for v in pts));plane=Vector((0,0,0));plane[axis]=(max(v[axis] for v in pts)+min(v[axis] for v in pts))/2;normal=Vector((0,0,0));normal[axis]=1
  for o in objs:
   bm=bmesh.new();bm.from_mesh(o.data);res=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=plane,plane_no=normal,clear_outer=True);edges=[e for e in res['geom_cut'] if isinstance(e,bmesh.types.BMEdge)];bmesh.ops.holes_fill(bm,edges=edges,sides=0);bm.to_mesh(o.data);bm.free()
 if edit in ['wrap','meatloaf']:
  # A loaf source is upright in the pack; rolls lie along their longest axis.
  for o in objs:
   for v in o.data.vertices:v.co=Vector((v.co.x,v.co.z,-v.co.y))
 colorize(objs,(lambda c,p:(.50,.32,.12,1)) if edit=='wrap' else (lambda c,p:(.13,.035,.012,1)) if edit=='meatloaf' else None)
 if edit in ['bone','wrap']:
  for o in objs:bpy.data.objects.remove(o,do_unlink=True)
  objs=[]
  # These two leftovers need closed cut surfaces absent from the source kit.
  if edit=='bone':
   bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.035,depth=.25,rotation=(math.pi/2,0,0));objs.append(bpy.context.object)
   for y in [-.13,.13]:
    for x in [-.022,.022]:
     bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.047,location=(x,y,0));objs.append(bpy.context.object)
  else:
   bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1);ob=bpy.context.object;ob.scale=(.068,.16,.061);objs.append(ob)
   for y in [-.07,.06]:
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=.06,minor_radius=.004,location=(0,y,0),rotation=(math.pi/2,0,0));objs.append(bpy.context.object)
  for o in objs:
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
   m=bpy.data.materials.new('Cut surface');m.use_nodes=True;next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value=(.74,.68,.51,1) if edit=='bone' else (.52,.31,.11,1);o.data.materials.append(m)
  colorize(objs)
 normalize(objs,size)
 if edit=='yogurt':objs+=slab('pudding',(.15,.15,.055),(0,0,.13),(.91,.88,.72))
 if edit=='lasagna':
  for o in objs:bpy.data.objects.remove(o,do_unlink=True)
  objs=slab('plate-rectangle',(.68,.49,.055),(0,0,0),(.42,.44,.46))
  for k in range(3):
   objs+=slab('bread',(.56,.37,.033),(0,0,.045+k*.06),(.68,.48,.18))
   objs+=slab('bread',(.52,.35,.025),(0,0,.075+k*.06),(.55,.10,.028))
  objs+=slab('bread',(.56,.37,.035),(0,0,.225),(.65,.34,.06))
 if edit=='meatloaf':objs+=slab('plate-rectangle',(.73,.40,.045),(0,0,-.035),(.8,.78,.72))
 normalize(objs,size)
 mat=bpy.data.materials.new('Food vertex palette');mat.use_nodes=True;bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Roughness'].default_value=.74
 attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='FoodColor';mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.data.materials.append(mat);o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=id;ob['foodId']=id;ob['label']=label
 bpy.ops.wm.save_as_mainfile(filepath=str(BLEND/(id+'.blend')),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',export_extras=True)
 manifest.append(dict(id=id,name=label,type=tier,size=size,source=source,edit=edit,author='Kenney',license='CC0-1.0',url='https://kenney.nl/assets/food-kit'))
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
