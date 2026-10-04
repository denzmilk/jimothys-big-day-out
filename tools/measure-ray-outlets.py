"""Read original Blender emitters without replacing the retained tool assets."""
import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];rows=[]
for tool,name in [('air-horn','mouth'),('disco-ray','mirror ball'),('sick-ray','dark bore')]:
 bpy.ops.wm.open_mainfile(filepath=str(root/'assets/blender/tools'/f'{tool}.blend'))
 obj=bpy.data.objects[name]
 if tool=='disco-ray':
  verts=[obj.matrix_world@v.co for v in obj.data.vertices];front=min(v.y for v in verts);p=Vector((obj.location.x,front,obj.location.z));axis=Vector((0,-1,0))
 else:
  p=obj.matrix_world@Vector((0,0,max(v.co.z for v in obj.data.vertices)));axis=(obj.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
 rows.append({'id':tool,'part':name,'outlet':[p.x,p.z,-p.y],'axis':[axis.x,axis.z,-axis.y]})
out=root/'output/iterate/ray-outlets.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(rows,indent=2));print('RAY_OUTLETS',json.dumps(rows))
