"""Render the authored pedestrian set without touching the interactive Blender scene."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
for i,name in enumerate(['commuter','neighbour','runner','worker','retiree','shopper']):
    path=ROOT/'assets/blender/people'/f'{name}-game.blend'
    with bpy.data.libraries.load(str(path),link=False) as (source,target): target.objects=source.objects
    for ob in target.objects:
        scene.collection.objects.link(ob)
        if ob.type=='ARMATURE':
            ob.location.x=i*1.35
            for track in ob.animation_data.nla_tracks: track.mute=track.name!='Idle'
scene.frame_set(1)
bpy.ops.mesh.primitive_plane_add(size=200)
mat=bpy.data.materials.new('Preview ground');mat.diffuse_color=(.12,.16,.19,1);bpy.context.object.data.materials.append(mat)
for loc,power,size in [((3,-5,7),1600,7),((-3,-1,4),800,5),((6,3,5),1500,5)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((3,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(7,-14,4));cam=bpy.context.object;cam.rotation_euler=(Vector((3.4,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=8.8;scene.camera=cam
scene.world=bpy.data.worlds.new('Preview world');scene.world.color=(.22,.22,.22)
try: scene.render.engine='CYCLES'
except TypeError: pass
scene.cycles.samples=24;scene.render.resolution_x=1400;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT/'output/iterate/mpfb-lineup.png');bpy.ops.render.render(write_still=True)
