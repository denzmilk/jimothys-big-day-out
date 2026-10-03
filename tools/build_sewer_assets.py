"""JIM-77 / M48. Original editable crab characters and sewer maintenance props.
Blender --background --python tools/build_sewer_assets.py
Coordinates below are game metres (Y up). Vertex colours keep articulated parts
at one draw each; claws and knees remain editable, named joint pivots.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/iterate/sewer-models';SRC=ROOT/'assets/blender/sewer'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
def xyz(p):return (p[0],-p[2],p[1])
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 global mat,parts
 mat=bpy.data.materials.new('painted_shell');mat.use_nodes=True
 bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.68
 attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';mat.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
 parts=[]
def tint(o,c):
 if o.type=='MESH':
  a=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER');rgb=tuple(linear((c>>b&255)/255) for b in [16,8,0])+(1,)
  for x in a.data:x.color=rgb
  o.data.materials.clear();o.data.materials.append(mat)
 parts.append(o);return o
def ell(p,s,c):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=xyz(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return tint(o,c)
def box(p,s,c,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('rounded edges','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
 return tint(o,c)
def beam(a,b,r,c,r2=None):
 a,b=Vector(xyz(a)),Vector(xyz(b));v=b-a;bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r if r2 is None else r2,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return tint(o,c)
def ring(p,r,w,c,axis='z'):
 for i in range(20):
  a=i*math.tau/20;b=(i+1)*math.tau/20
  def v(t):return (p[0]+math.cos(t)*r,p[1]+(math.sin(t)*r if axis=='z' else 0),p[2]+(0 if axis=='z' else math.sin(t)*r))
  beam(v(a),v(b),w,c)
def join(name,pivot=(0,0,0),parent=None):
 global parts
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=parts[0];o.name=name
 bpy.context.scene.cursor.location=xyz(pivot);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
 parts=[];return o
def marker(name,p,parent):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=xyz(p);o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted();return o
DARK=0x293941;CREAM=0xf2dab1;RUST=0xa85a35;METAL=0x657f7d;YELLOW=0xe8b636
for kind,shell,light in [('worker',0xb94126,0xdf7750),('scavenger',0x52715b,0x91a070),('elder',0x4d6f88,0x93adb8)]:
 reset()
 ell((0,.72,0),(.42,.36,.26),shell)
 for i in range(4):ell((0,.54+i*.13,.18),(.30-i*.015,.066,.105),light)
 for side in [-1,1]:
  for i in range(3):beam((side*.29,.63+i*.12,-.07),(side*(.45+i*.014),.69+i*.12,-.12),.06,shell,.005)
  beam((side*.18,.96,.09),(side*.23,1.21,.12),.047,shell,.036)
  ell((side*.23,1.23,.12),(.095,.09,.082),CREAM);ell((side*.23,1.238,.184),(.04,.052,.025),DARK)
  ell((side*.219,1.26,.208),(.012,.015,.01),0xffffff)
 # Raised rear shell seams read from the default following camera.
 for t in [-.2,0,.2]:beam((t,.48,-.17),(t,.92,-.21),.018,light)
 if kind=='worker':
  ell((0,1.04,-.035),(.28,.16,.24),YELLOW);ell((0,1.025,-.01),(.35,.024,.30),YELLOW)
  box((0,1.17,-.04),(.06,.035,.33),0xffd664)
  box((0,.76,.268),(.17,.14,.027),DARK);box((0,.76,.288),(.12,.07,.012),CREAM)
 elif kind=='scavenger':
  beam((-.23,1,.17),(.28,.44,.22),.037,0xa38555)
  box((.32,.53,.03),(.27,.30,.27),0x94764f);box((.34,.66,.08),(.27,.055,.30),0xc1a272)
  box((.34,.55,.226),(.035,.11,.015),YELLOW)
 else:
  for i in range(3):beam((-.2+i*.04,.80,-.255),(-.1+i*.04,.93,-.205),.012,CREAM)
  ell((-.13,.93,-.19),(.12,.055,.08),0xb1b3a0)
 root=join('carapace')
 for i in range(4):
  side=-1 if i<2 else 1;z=-.20 if i%2 else .20
  hip=(side*.29,.59,z);knee=(side*.56,.30,z*1.45);tip=(side*.70,.035,z*1.9)
  ell(hip,(.095,.09,.095),DARK);beam(hip,knee,.075,shell,.045);ell(knee,(.069,.06,.065),light)
  upper=join('leg_'+str(i),hip,root)
  beam(knee,tip,.058,shell,.018);ell((tip[0],.04,tip[2]),(.09,.035,.07),DARK)
  lower=join('knee_'+str(i),knee,upper);marker('foot_'+str(i),tip,lower)
 for side,label in [(-1,'L'),(1,'R')]:
  shoulder=(side*.34,.83,.02);wrist=(side*.60,.76,.25)
  ell(shoulder,(.10,.10,.10),DARK);beam(shoulder,wrist,.09,shell,.075);ell(wrist,(.13,.15,.13),light)
  # Curving palm and fixed finger, plus a separately hinged opposing finger.
  ell((side*.71,.83,.30),(.16,.22,.13),shell)
  beam((side*.72,.97,.30),(side*.62,1.11,.30),.075,shell,.026)
  beam((side*.62,1.11,.30),(side*.55,1.07,.30),.025,CREAM,.009)
  claw=join('claw_'+label,shoulder,root)
  pivot=(side*.67,.80,.33)
  beam(pivot,(side*.52,.88,.35),.08,light,.037);beam((side*.52,.88,.35),(side*.52,1.00,.33),.036,CREAM,.012)
  join('pincer_'+label,pivot,claw)
 bpy.ops.wm.save_as_mainfile(filepath=str(SRC/(kind+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(OUT/(kind+'.glb')),export_format='GLB',export_animations=False,export_yup=True)
for kind in ['pump','workbench','locker','lamp','pipe-rack']:
 reset()
 if kind=='pump':
  box((0,.10,0),(1.7,.2,1.2),DARK)
  for x in [-.47,.47]:
   ell((x,.62,0),(.33,.43,.38),0x4d7f70);beam((x,.65,-.50),(x,.65,.46),.20,METAL)
   beam((x,.65,-.50),(x,1.65,-.50),.17,0x4d7f70)
   ring((x,1.4,-.71),.22,.026,RUST);beam((x,1.4,-.74),(x,1.4,-.48),.045,METAL)
   ell((x,1.01,.26),(.12,.12,.035),CREAM);beam((x,1.01,.30),(x+.06,1.06,.30),.012,DARK)
 elif kind=='workbench':
  box((0,.85,0),(1.65,.13,.75),0x937048)
  for x in [-.65,.65]:
   for z in [-.24,.24]:box((x,.43,z),(.10,.85,.10),METAL)
  box((-.4,1,.05),(.45,.20,.33),RUST);beam((.3,.93,.1),(.61,.93,.18),.033,METAL);ring((.55,.95,-.15),.10,.025,RUST)
 elif kind=='locker':
  box((0,.84,0),(.75,1.68,.57),0x51766d);box((0,.85,.303),(.66,1.53,.025),0x769288)
  for i in range(4):box((0,1.34-i*.08,.32),(.37,.025,.02),DARK,0)
  box((.24,.83,.34),(.035,.18,.035),CREAM)
 elif kind=='lamp':
  box((0,.09,0),(.44,.18,.44),DARK);beam((0,.17,0),(0,1.9,0),.048,METAL)
  box((0,2.04,0),(.42,.27,.3),DARK);box((0,2.04,.17),(.33,.18,.025),0xffdfa0)
  for x in [-.13,0,.13]:beam((x,1.92,.19),(x,2.17,.19),.012,DARK)
 elif kind=='pipe-rack':
  for x in [-.7,.7]:box((x,.6,0),(.10,1.2,.65),DARK)
  for y in [.45,.9,1.3]:
   beam((-.88,y,0),(.88,y,0),.14,METAL);ring((.52,y,0),.18,.025,RUST,axis='y')
 join(kind)
 bpy.ops.wm.save_as_mainfile(filepath=str(SRC/(kind+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(OUT/(kind+'.glb')),export_format='GLB',export_animations=False,export_yup=True)
print('SEWER_ASSETS_COMPLETE',OUT)
