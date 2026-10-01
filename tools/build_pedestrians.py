"""MPFB pedestrian authoring. Run with Blender 5.2 --background --python.
Requires the CC0 MakeHuman system assets extracted to MPFB_ASSETS (see README).
Creates editable source rigs and GLBs; no paid or external generation service.
"""
import bpy, os, json, math
from pathlib import Path
from mathutils import Vector, Quaternion
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(os.environ.get('MPFB_ASSETS', '/tmp/jimothy-mpfb-assets'))
OUT = ROOT / 'public/assets/models/people'
SOURCE = ROOT / 'assets/blender/people'
OUT.mkdir(parents=True, exist_ok=True); SOURCE.mkdir(parents=True, exist_ok=True)
# Physiques, age, face shape, outfit and hair all vary, rather than recolouring one mesh.
PEOPLE = [
 ('commuter', 1.0,.5,.45,.4,.6,'young_asian_male','male_casualsuit01','short02','shoes01'),
 ('neighbour', 0.0,.65,.3,.65,.4,'middleage_african_female','female_elegantsuit01','afro01','shoes02'),
 ('runner', 0.0,.4,.75,.3,.7,'young_caucasian_female','female_sportsuit01','ponytail01','shoes03'),
 ('worker', 1.0,.65,.7,.8,.7,'middleage_african_male','male_worksuit01','short01','shoes04'),
 ('retiree', 1.0,.9,.25,.55,.4,'old_caucasian_male','male_elegantsuit01','short04','shoes01'),
 ('shopper', 0.0,.5,.4,.4,.55,'young_asian_female','female_casualsuit02','bob02','shoes02'),
]
if os.environ.get('MPFB_ONE'): PEOPLE=PEOPLE[:1]
if os.environ.get('MPFB_ONLY'): PEOPLE=[p for p in PEOPLE if p[0] in os.environ['MPFB_ONLY'].split(',')]
bpy.context.preferences.filepaths.save_version=0
manifest=[]
for name,gender,age,muscle,weight,height,skin,outfit,hair,shoes in PEOPLE:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    macro=TargetService.get_default_macro_info_dict()
    macro.update(gender=gender,age=age,muscle=muscle,weight=weight,height=height)
    ethnicity=skin.split('_')[1]
    macro['race']={k:float(k==ethnicity) for k in macro['race']}
    body=HumanService.create_human(scale=.1,macro_detail_dict=macro)
    body.name=name+'_body'
    rig=HumanService.add_builtin_rig(body,'game_engine')
    rig.name=name+'_rig'
    HumanService.set_character_skin(str(ASSETS/'skins'/skin/(skin+'.mhmat')),body,skin_type='MAKESKIN')
    for folder,item,kind in [('clothes',outfit,'Clothes'),('clothes',shoes,'Clothes'),('hair',hair,'Hair'),('eyes','low-poly','Eyes')]:
        HumanService.add_mhclo_asset(str(ASSETS/folder/item/(item+'.mhclo')),body,asset_type=kind,subdiv_levels=0,material_type='MAKESKIN')
    # Packed, bounded textures keep the editable project portable after the
    # downloaded source pack is removed from the temporary directory.
    for img in bpy.data.images:
        if img.size[0]>512 or img.size[1]>512:
            ratio=512/max(img.size);img.scale(max(1,round(img.size[0]*ratio)),max(1,round(img.size[1]*ratio)))
        if img.source=='FILE': img.pack()
    # Save the parametric MPFB project before baking shape keys and masks.
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'-editable.blend')),compress=True)
    for ob in list(bpy.context.scene.objects):
        if ob.type!='MESH': continue
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
        if ob.data.shape_keys: bpy.ops.object.shape_key_remove(all=True,apply_mix=True)
        for mod in list(ob.modifiers):
            if mod.type=='MASK': bpy.ops.object.modifier_apply(modifier=mod.name)
            elif mod.type=='SUBSURF': ob.modifiers.remove(mod)
        triangles=sum(len(f.vertices)-2 for f in ob.data.polygons)
        if triangles>4500:
            dec=ob.modifiers.new('Street detail budget','DECIMATE');dec.ratio=4500/triangles
            # Keep deform weights while baking the static simplification.
            bpy.ops.object.modifier_move_up(modifier=dec.name)
            bpy.ops.object.modifier_apply(modifier=dec.name)
        for poly in ob.data.polygons: poly.use_smooth=True
    # Bound texture memory before embedding. Shared source images remain on disk.
    for img in bpy.data.images:
        if img.size[0]>512 or img.size[1]>512:
            ratio=512/max(img.size);img.scale(max(1,round(img.size[0]*ratio)),max(1,round(img.size[1]*ratio)))
        if img.source=='FILE': img.pack()
    def local_rotation(bone,world_rotation):
        basis=bone.bone.matrix_local.to_quaternion()
        return basis.inverted() @ world_rotation @ basis
    arm_rest={}
    for side in ['l','r']:
        bone=rig.pose.bones['upperarm_'+side]
        direction=bone.bone.tail_local-bone.bone.head_local
        arm_rest[side]=direction.normalized().rotation_difference(Vector((0,0,-1)))
    bpy.context.scene.render.fps=24
    for action_name,amplitude in [('Idle',0.0),('Walk',.42),('Run',.72)]:
        action=bpy.data.actions.new(action_name)
        rig.animation_data_create();rig.animation_data.action=action
        for frame in range(1,26,3):
            phase=(frame-1)/24*math.tau
            for bone in rig.pose.bones:
                bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion()
            for side,sign in [('l',1),('r',-1)]:
                swing=math.sin(phase)*amplitude*sign
                for bn,angle in [('thigh_'+side,swing),('calf_'+side,max(0,-swing)*1.3),('foot_'+side,-max(0,-swing)*.45)]:
                    bone=rig.pose.bones[bn];bone.rotation_quaternion=local_rotation(bone,Quaternion((1,0,0),angle))
                bone=rig.pose.bones['upperarm_'+side]
                bone.rotation_quaternion=local_rotation(bone,Quaternion((1,0,0),-swing*.8)@arm_rest[side])
                bone=rig.pose.bones['lowerarm_'+side];bone.rotation_quaternion=local_rotation(bone,Quaternion((1,0,0),-.2-abs(swing)*.25))
            for bone in rig.pose.bones: bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
        track=rig.animation_data.nla_tracks.new();track.name=action_name
        strip=track.strips.new(action_name,1,action);strip.action_frame_end=25
        rig.animation_data.action=None
        track.mute=True
    for track in rig.animation_data.nla_tracks: track.mute=False
    bpy.context.scene.frame_set(1)
    bpy.ops.object.select_all(action='SELECT')
    export=bpy.ops.export_scene.gltf.get_rna_type().properties
    opts=dict(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_morph=False,export_apply=False)
    if 'export_animation_mode' in export:
        modes=[x.identifier for x in export['export_animation_mode'].enum_items]
        opts['export_animation_mode']='NLA_TRACKS' if 'NLA_TRACKS' in modes else modes[0]
    bpy.ops.export_scene.gltf(**opts)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'-game.blend')),compress=True)
    entry=dict(id=name,source='MPFB 2.0.17 / MakeHuman CC0 system assets',outfit=outfit,hair=hair,skin=skin,triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'),bytes=(OUT/(name+'.glb')).stat().st_size)
    manifest.append(entry); print('PEDESTRIAN_RESULT',json.dumps(entry),flush=True)
if os.environ.get('MPFB_ONLY') and (OUT/'manifest.json').exists():
    prior=json.loads((OUT/'manifest.json').read_text()); replacement={p['id']:p for p in manifest}
    manifest=[replacement.get(p['id'],p) for p in prior]
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
