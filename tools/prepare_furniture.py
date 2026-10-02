"""Prepare selected CC0 Kenney furnishings, retaining separable source meshes."""
import bpy,json,os
from mathutils import Vector,Matrix
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'assets/sources/furniture';OUT=ROOT/'public/assets/models/furniture';BLEND=ROOT/'assets/blender/furniture'
OUT.mkdir(parents=True,exist_ok=True);BLEND.mkdir(parents=True,exist_ok=True)
manifest=[]
for path in sorted(SRC.glob('*.glb')):
 if os.environ.get('FURNITURE_ONLY') and path.stem not in os.environ['FURNITURE_ONLY'].split(','):continue
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;bpy.ops.import_scene.gltf(filepath=str(path));bpy.context.view_layer.update()
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];transforms=[(o,o.matrix_world.copy()) for o in meshes]
 for o,m in transforms:o.parent=None;o.matrix_world=Matrix.Scale(2,4)@m
 bpy.context.view_layer.update();points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(low+high)/2;center.z=low.z
 # A few bathroom assets use a different authored unit scale.
 factor=.82/(high.z-low.z) if path.stem=='toilet' else 1
 for o in meshes:o.location-=center;o.matrix_world=Matrix.Scale(factor,4)@o.matrix_world
 for image in bpy.data.images:
  if image.source=='FILE':image.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(BLEND/(path.stem+'.blend')),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/path.name),export_format='GLB')
 manifest.append(dict(id=path.stem,source='https://kenney.nl/assets/furniture-kit',license='CC0-1.0',size=list((high-low)*factor)))
if os.environ.get('FURNITURE_ONLY'):
 old=json.loads((OUT/'manifest.json').read_text());manifest=sorted([r for r in old if r['id'] not in {v['id'] for v in manifest}]+manifest,key=lambda r:r['id'])
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
