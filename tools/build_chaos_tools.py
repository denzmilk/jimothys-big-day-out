"""Editable 24-tool set based on assets/references/tools/arsenal-reference.png.
Blender 5.2 background recipe. Original design; authored meshes, no downloaded assets.
Z up; muzzle points along -Y, exported as +Z in glTF. Metres.
"""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models/tools';SOURCE=ROOT/'assets/blender/tools'
OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
IDS=['power-washer','bubble-gun','leaf-blower','vacuum','food-magnet','fire-extinguisher','paint-sprayer','confetti-cannon','air-horn','disco-ray','sick-ray','stink-sprayer','spring-glove','suction-grappler','plunger-launcher','tow-reel','foam-cannon','trampoline-popper','rocket-skates','pogo-stick','umbrella-glider','bubble-shield','jackhammer','firework-launcher']
PAL={'yellow':(1,.59,.025,1),'blue':(.035,.27,.65,1),'teal':(.015,.65,.66,1),'orange':(1,.23,.035,1),'red':(.7,.025,.025,1),'black':(.025,.035,.044,1),'steel':(.48,.56,.61,1),'white':(.83,.84,.75,1),'purple':(.4,.045,.75,1),'green':(.29,.75,.02,1),'olive':(.22,.28,.08,1),'wood':(.4,.2,.07,1),'pink':(1,.055,.45,1)}
M={}
for n,c in PAL.items():
 m=bpy.data.materials.new(n);m.diffuse_color=c;m.use_nodes=True;node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs['Base Color'].default_value=c;node.inputs['Roughness'].default_value=.55;M[n]=m
parts=[]
def finish(o,name,mat):
 o.name=name;o.data.materials.append(M[mat]);parts.append(o);return o
def box(name,p,s,mat,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Rounded edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,mat)
def ball(name,p,s,mat,segments=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=8,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat)
def tube(name,a,b,r,mat,r2=None):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,mat)
def path(name,coords,r,mat):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=r;curve.bevel_resolution=1
 spl=curve.splines.new('POLY');spl.points.add(len(coords)-1)
 for p,co in zip(spl.points,coords):p.co=(*co,1)
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,name,mat)
def ring(name,p,r,wire,mat,axis='y',portion=math.tau,start=0):
 pts=[]
 for i in range(33):
  a=start+portion*i/32;u=r*math.cos(a);v=r*math.sin(a);pts.append((p[0]+u,p[1]+(v if axis=='z' else 0),p[2]+(0 if axis=='z' else v)))
 return path(name,pts,wire,mat)
def grip():
 o=box('rubber pistol grip',(0,.03,.1),(.12,.16,.26),'black');o.rotation_euler.x=-.22
 for z in [.01,.06,.11]:box('grip rib',(0,-.055,z),(.125,.025,.02),'steel',.008)
 ring('trigger guard',(0,-.11,.13),.09,.012,'steel',axis='y')
def barrel(mat='steel',length=.5,r=.09):
 tube('barrel',(0,.05,.32),(0,-length,.32),r,mat);tube('dark bore',(0,-length-.007,.32),(0,-length-.013,.32),r*.72,'black');grip()
def tank(mat='red',x=0,y=.05,h=.65):
 tube('pressure vessel',(x,y,.06),(x,y,h),.14,mat);ball('tank shoulder',(x,y,h),(.14,.14,.09),mat);tube('brass valve',(x,y,h),(x,y,h+.09),.04,'yellow');box('tank foot',(x,y,.045),(.3,.3,.075),'black');box('label',(x,y-.14,h*.55),(.17,.018,.2),'white',.004)
def hose(x=0):path('rubber hose',[(x,0,.72),(x+.25,0,.82),(x+.35,-.2,.65),(x+.34,-.35,.23),(x+.18,-.5,.2)],.025,'black')
def spring(a,b,r=.09):
 a=Vector(a);b=Vector(b);d=b-a;direction=d.normalized();u=direction.cross(Vector((1,0,0))).normalized();v=direction.cross(u)
 path('steel spring',[tuple(a+d*i/120+(u*math.cos(i/120*math.tau*9)+v*math.sin(i/120*math.tau*9))*r) for i in range(121)],.016,'steel')
def build(id):
 if id=='power-washer':
  tank('yellow',.15,.1);hose(.15);tube('steel lance',(-.13,.1,.48),(-.13,-.85,.2),.025,'steel');tube('spray nozzle',(-.13,-.85,.2),(-.13,-.94,.17),.04,'yellow',.025);box('trigger housing',(-.13,-.1,.42),(.13,.22,.14),'black');path('carry handle',[(0,.14,.7),(0,.14,.86),(.3,.14,.86),(.3,.14,.7)],.025,'black')
 elif id=='bubble-gun':
  barrel('teal',.3,.14);ring('bubble mouth',(0,-.35,.32),.16,.027,'yellow')
  for i in range(6):a=i*math.tau/6;ring('bubble loop',(.105*math.cos(a),-.38,.32+.105*math.sin(a)),.043,.009,'yellow')
  tank('white',0,.1,.22);tube('soap neck',(0,.1,.43),(0,.1,.53),.055,'steel');box('soap cap',(0,.1,.53),(.18,.18,.07),'pink')
 elif id=='leaf-blower':
  ball('fan housing',(0,.08,.3),(.21,.24,.24),'orange');tube('fan cover',(-.22,.08,.3),(-.24,.08,.3),.17,'black');ring('air intake',(-.245,.08,.3),.16,.015,'steel',axis='y');tube('blower tube',(0,-.06,.28),(0,-.85,.23),.1,'black',.065);path('handle',[(-.12,.06,.47),(-.12,.06,.66),(.12,.06,.66),(.12,.06,.47)],.027,'black')
 elif id=='vacuum':
  box('canister',(0,.1,.24),(.4,.44,.45),'blue',.08);hose();tube('suction pipe',(.2,-.3,.2),(.2,-.8,.1),.055,'steel');box('floor head',(.2,-.82,.065),(.45,.15,.1),'black');path('carry handle',[(-.12,.1,.47),(-.12,.1,.58),(.12,.1,.58),(.12,.1,.47)],.025,'black')
  for x in [-.23,.23]:tube('wheel',(x-.03,.23,.1),(x+.03,.23,.1),.11,'black')
 elif id=='food-magnet':
  ring('horseshoe',(0,-.1,.4),.24,.085,'red',portion=math.pi,start=0);box('left magnet leg',(-.24,-.1,.25),(.17,.17,.3),'red');box('right magnet leg',(.24,-.1,.25),(.17,.17,.3),'red')
  for x in [-.24,.24]:box('silver pole',(x,-.1,.075),(.17,.17,.1),'steel')
  box('handle',(0,.09,.44),(.15,.3,.14),'black')
 elif id=='fire-extinguisher':
  tank();hose();tube('horn',(.18,-.5,.2),(.18,-.63,.14),.025,'black',.09);box('lever',(0,.0,.77),(.12,.28,.025),'red',.009);tube('gauge',(0,-.07,.7),(0,-.1,.7),.065,'white')
 elif id=='paint-sprayer':
  barrel('steel',.3,.065);tube('paint pot',(0,-.02,.38),(0,-.02,.66),.12,'white',.15);tube('lid',(0,-.02,.65),(0,-.02,.68),.155,'blue')
  for x in [-.08,0,.08]:box('paint drip',(x,-.16,.55),(.022,.01,.12),'pink',.006)
 elif id=='confetti-cannon':
  barrel('red',.35,.12);tube('flared muzzle',(0,-.35,.32),(0,-.64,.32),.12,'yellow',.23);tube('dark trumpet',(0,-.647,.32),(0,-.655,.32),.20,'black');tank('teal',0,.1,.22)
  for i in range(10):a=i*math.tau/10;box('confetti cartridge',(.075*math.cos(a),.1+.075*math.sin(a),.15),(.025,.025,.08),['yellow','pink','blue'][i%3],.004)
 elif id=='air-horn':
  tank('white',0,.06,.4);tube('horn stem',(0,.05,.53),(0,-.2,.53),.055,'red');tube('trumpet',(0,-.2,.53),(0,-.5,.53),.055,'red',.19);tube('mouth',(0,-.5,.53),(0,-.51,.53),.16,'black')
 elif id=='disco-ray':
  barrel('purple',.28,.13);ball('mirror ball',(0,-.35,.32),(.21,.21,.21),'steel',12)
  for i in range(12):a=i*math.tau/12;box('colour facet',(.19*math.cos(a),-.36,.32+.19*math.sin(a)),(.04,.07,.04),['teal','pink','blue'][i%3],.005)
 elif id=='sick-ray':
  barrel('green',.38,.07);tube('flask',(0,.06,.35),(.12,.06,.7),.12,'green',.095);tube('flask neck',(.12,.06,.7),(.15,.06,.79),.05,'steel');ring('coil',(0,-.25,.32),.105,.022,'green')
 elif id=='stink-sprayer':
  tank('olive',0,.04,.47);path('perfume hose',[(0,.04,.55),(.2,.04,.6),(.3,-.1,.43)],.016,'wood');ball('squeeze bulb',(.3,-.1,.34),(.07,.07,.13),'black');tube('spritz nozzle',(0,.04,.57),(0,-.2,.57),.035,'yellow')
 elif id=='spring-glove':
  barrel('black',.16,.09);spring((0,-.12,.32),(0,-.5,.32));ball('boxing glove',(0,-.66,.32),(.19,.22,.19),'red');ball('thumb',(.16,-.58,.26),(.08,.13,.09),'red');tube('cuff',(0,-.48,.32),(0,-.55,.32),.135,'white')
 elif id in ['suction-grappler','plunger-launcher']:
  barrel('wood' if id=='plunger-launcher' else 'steel',.55,.045);tube('rubber cup',(0,-.53,.32),(0,-.72,.32),.025,'red',.2);tube('cup interior',(0,-.722,.32),(0,-.726,.32),.165,'black')
  if id=='suction-grappler':spring((0,.16,.32),(0,-.05,.32),.14)
 elif id=='tow-reel':
  box('frame',(0,.05,.08),(.55,.4,.1),'steel');tube('spool',(-.2,.05,.33),(.2,.05,.33),.2,'wood')
  for x in [-.23,.23]:tube('spool cheek',(x-.02,.05,.33),(x+.02,.05,.33),.24,'yellow')
  path('tow cable',[(.05,-.1,.3),(.05,-.32,.3),(.05,-.5,.13)],.022,'wood');ring('hook',(.05,-.5,.08),.1,.025,'steel',portion=math.pi*1.5)
 elif id=='foam-cannon':
  barrel('steel',.4,.065);tank('white',-.13,.08,.24);tank('white',.13,.08,.24);tube('foam nozzle',(0,-.38,.32),(0,-.54,.32),.06,'black',.1)
 elif id=='trampoline-popper':
  tube('folded spring bed',(0,0,.07),(0,0,.12),.37,'black');ring('trampoline rim',(0,0,.12),.39,.035,'red',axis='z')
  for i in range(8):a=i*math.tau/8;tube('frame leg',(.32*math.cos(a),.32*math.sin(a),.09),(.4*math.cos(a),.4*math.sin(a),0),.025,'steel')
 elif id=='rocket-skates':
  for x in [-.19,.19]:
   box('boot sole',(x,-.1,.1),(.27,.48,.12),'black');ball('boot toe',(x,-.2,.21),(.13,.22,.12),'orange');box('ankle cuff',(x,.06,.29),(.26,.24,.35),'orange',.05);ring('cuff trim',(x,.06,.47),.12,.022,'black',axis='z');tube('rocket nozzle',(x,.19,.12),(x,.34,.12),.065,'steel',.09)
   for y in [-.22,.12]:tube('wheels',(x-.17,y,.045),(x+.17,y,.045),.055,'black')
 elif id=='pogo-stick':
  tube('pogo shaft',(0,0,.1),(0,0,1),.035,'yellow');spring((0,0,.12),(0,0,.5),.065);tube('handlebar',(-.25,0,.96),(.25,0,.96),.03,'black');box('foot pegs',(0,0,.46),(.42,.12,.04),'black');ball('rubber foot',(0,0,.04),(.075,.075,.06),'black')
 elif id=='umbrella-glider':
  tube('umbrella shaft',(0,0,.05),(0,0,.75),.018,'steel');ring('hook handle',(0,0,.1),.08,.025,'black',portion=math.pi*1.5)
  verts=[(0,0,.85)]+[(.5*math.cos(i*math.tau/12),.5*math.sin(i*math.tau/12),.65) for i in range(12)];faces=[(0,i+1,(i+1)%12+1) for i in range(12)];mesh=bpy.data.meshes.new('canopy');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('patched canopy',mesh);bpy.context.collection.objects.link(o);finish(o,'patched canopy','red')
  for i in range(12):path('umbrella rib',[(0,0,.84),verts[i+1]],.009,'steel')
 elif id=='bubble-shield':
  barrel('blue',.17,.14);ring('projector ring',(0,-.24,.32),.28,.04,'teal');ring('carry handle',(0,.15,.46),.13,.025,'blue');ball('lens',(0,-.25,.32),(.22,.07,.22),'blue')
 elif id=='jackhammer':
  box('hammer motor',(0,0,.57),(.27,.23,.38),'yellow',.045);tube('drill chuck',(0,0,.3),(0,0,.38),.07,'black');tube('chisel',(0,0,0),(0,0,.32),.007,'steel',.035);tube('T handles',(-.28,0,.73),(.28,0,.73),.035,'black');box('motor vent',(0,-.12,.62),(.15,.025,.12),'black',.005)
 elif id=='firework-launcher':
  barrel('red',.53,.1);tube('rocket nose',(0,-.53,.32),(0,-.77,.32),.14,'red',0)
  for y in [0,-.2,-.4]:ring('gold band',(0,y,.32),.105,.02,'yellow')
  for x in [-.11,.11]:o=box('tail fin',(x,.12,.32),(.035,.25,.23),'red',.008);o.rotation_euler.y=x*2
 # Small fasteners and a rating plate unify the set without changing silhouettes.
 if id not in ['trampoline-popper','umbrella-glider','pogo-stick','plunger-launcher','rocket-skates']:
  for x in [-.05,.05]:ball('rivet',(x,.11,.32),(.012,.012,.012),'steel',8)

manifest=[]
for id in IDS:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);parts=[];build(id);bpy.context.view_layer.update()
 bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(id+'.blend')))
 # Export one vertex-colour mesh; preserve all editable pieces in the .blend.
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 colors=o.data.color_attributes.new(name='ToolColor',type='FLOAT_COLOR',domain='CORNER');rng=random.Random(id)
 for poly in o.data.polygons:
  c=o.data.materials[poly.material_index].diffuse_color;wear=rng.uniform(.88,1.04)
  for i in poly.loop_indices:colors.data[i].color=(*[min(1,v*wear) for v in c[:3]],1)
 mat=bpy.data.materials.new('Tool vertex palette');mat.use_nodes=True;bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');vertex=mat.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='ToolColor';mat.node_tree.links.new(vertex.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.6
 o.data.materials.clear();o.data.materials.append(mat)
 for p in o.data.polygons:p.material_index=0
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_animations=False)
 manifest.append({'id':id,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'source':f'assets/blender/tools/{id}.blend','model':f'assets/models/tools/{id}.glb'})
(SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('TOOLS_EXPORTED',len(manifest))
