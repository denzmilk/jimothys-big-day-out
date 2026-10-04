from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
for name,path in [('car','assets/blender/vehicles/police.blend'),('gun','assets/blender/people/response/police-gun.blend'),('cap','assets/blender/people/response/police-cap.blend')]:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/path));scene=bpy.context.scene
 meshes=[o for o in scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box];low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)));centre=(low+high)/2;size=max(high-low)
 bpy.ops.object.camera_add(location=centre+Vector((1,-1.5,.85))*size);camera=bpy.context.object;camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=size*1.35;scene.camera=camera
 bpy.ops.object.light_add(type='AREA',location=centre+Vector((1,-1,2))*size);light=bpy.context.object;light.data.energy=400*size*size;light.data.shape='DISK';light.data.size=size*2;light.rotation_euler=(centre-light.location).to_track_quat('-Z','Y').to_euler()
 scene.world=bpy.data.worlds.new('Preview sky');scene.world.color=(.3,.3,.3);scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=800;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/f'output/iterate/police-{name}-blender.png');bpy.ops.render.render(write_still=True)
