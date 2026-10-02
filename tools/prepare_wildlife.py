"""Run with Blender --background --python tools/prepare_wildlife.py -- <project-root>."""
import bpy,sys
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]);source=root/'assets/wildlife'
for name in ['Cat','Dog','Eagle']:
 bpy.ops.wm.open_mainfile(filepath=str(source/f'{name}.blend'))
 for mat in bpy.data.materials:
  color=tuple(mat.diffuse_color)
  if mat.node_tree:
   diffuse=next((n for n in mat.node_tree.nodes if n.type=='BSDF_DIFFUSE'),None)
   if diffuse:color=tuple(diffuse.inputs['Color'].default_value)
  mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear()
  shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Base Color'].default_value=color;shader.inputs['Roughness'].default_value=.85
  output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
 bpy.context.scene.frame_set(1)
 bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/wildlife'/f'{name.lower()}.glb'),export_format='GLB',export_animation_mode='ACTIONS',export_animations=True,export_force_sampling=True)
 print('EXPORTED',name)
