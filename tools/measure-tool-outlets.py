"""Read the retained Blender nozzle parts; leave their editable meshes intact."""
import bpy,json
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
parts={'power-washer':'spray nozzle','leaf-blower':'blower tube','vacuum':'floor head','fire-extinguisher':'horn'}
rows=[]
for id,name in parts.items():
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets/blender/tools'/f'{id}.blend'))
    obj=bpy.data.objects[name]
    local=Vector((0,min(v.co.y for v in obj.data.vertices),0)) if id=='vacuum' else Vector((0,0,max(v.co.z for v in obj.data.vertices)))
    p=obj.matrix_world@local
    axis=(obj.matrix_world.to_3x3()@Vector((0,-1,0) if id=='vacuum' else (0,0,1))).normalized()
    rows.append({'id':id,'part':name,'blender':list(p),'gltf':[p.x,p.z,-p.y],'axis':[axis.x,axis.z,-axis.y]})
out=root/'output/iterate/tool-outlets.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(rows,indent=2))
print('TOOL_OUTLETS',json.dumps(rows))
