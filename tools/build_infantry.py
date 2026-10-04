"""M61: separate MPFB uniform, fitted helmet and retained CC0 long firearm."""
from pathlib import Path
import bpy, math, json
import numpy as np
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models/people/response';SOURCE=ROOT/'assets/blender/people/infantry'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/people/worker-game.blend'))
bpy.context.preferences.filepaths.save_version=0
# Only the work clothing receives the olive treatment. Skin, eyes, hair,
# boots, weights and NLA clips retain their existing authored data.
for mat in bpy.data.materials:
 if 'male_worksuit01' not in mat.name:continue
 for node in mat.node_tree.nodes:
  if node.type!='TEX_IMAGE' or not node.image or 'diffuse' not in node.image.name:continue
  img=node.image.copy();img.name='infantry_uniform_diffuse';pixels=np.empty(len(img.pixels),dtype=np.float32);img.pixels.foreach_get(pixels);pixels=pixels.reshape(-1,4);luma=pixels[:,:3]@np.array([.2126,.7152,.0722]);pixels[:,:3]=luma[:,None]*np.array([.62,.76,.36]);img.pixels.foreach_set(pixels.ravel());img.pack();node.image=img
for ob in bpy.context.scene.objects:ob.name=ob.name.replace('worker','infantry')
for image in bpy.data.images:
 if image.source=='FILE':image.pack()
bpy.context.scene.frame_set(1);bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'infantry.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'infantry.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_morph=False,export_apply=False,export_animation_mode='NLA_TRACKS')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/sources/infantry/blaster-e.glb'));bpy.context.view_layer.update()
transforms=[(o,o.matrix_world.copy()) for o in bpy.context.scene.objects if o.type=='MESH']
points=[world@Vector(v) for ob,world in transforms for v in ob.bound_box];lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)]);scale=.82/max(hi-lo)
for ob,world in transforms:ob.parent=None;ob.matrix_world=Matrix.Translation((-(lo.x+hi.x)*scale/2,.30,0))@Matrix.Scale(scale,4)@world
for image in bpy.data.images:
 if image.source=='FILE':image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'rifle.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'infantry-rifle.glb'),export_format='GLB')
print('RIFLE_BOUNDS',list(lo*scale),list(hi*scale),flush=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
olive=bpy.data.materials.new('Helmet olive');olive.use_nodes=True;olive.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.14,.19,.065,1);olive.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
vertices=[(0,0,.104)];faces=[];segments=24;rings=8
for ring in range(1,rings+1):
 a=ring/rings*math.pi/2
 for segment in range(segments):
  t=segment/segments*math.tau;vertices.append((.143*math.sin(a)*math.cos(t),.151*math.sin(a)*math.sin(t),.104*math.cos(a)))
for i in range(segments):faces.append((0,1+i,1+(i+1)%segments))
for r in range(rings-1):
 for i in range(segments):
  a=1+r*segments+i;b=1+r*segments+(i+1)%segments;faces.append((a,a+segments,b+segments,b))
mesh=bpy.data.meshes.new('Helmet shell');mesh.from_pydata(vertices,[],faces);mesh.materials.append(olive);ob=bpy.data.objects.new('infantry-helmet-shell',mesh);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True)
for p in mesh.polygons:p.use_smooth=True
mod=ob.modifiers.new('Helmet rim thickness','SOLIDIFY');mod.thickness=.009;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'helmet.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'infantry-helmet.glb'),export_format='GLB')
