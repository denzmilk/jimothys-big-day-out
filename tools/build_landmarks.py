"""M45: editable landmark geometry and matching compact destructible voxel runs.
Run with Blender --background --python tools/build_landmarks.py.
The same primitives feed the GLB and voxel bake; no collision-only proxy boxes.
"""
import bpy, math, json, struct, re
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/assets/models/landmarks'; SRC=ROOT/'assets/blender/landmarks'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
S=.22
palette={int(i):int(c,16) for i,c in re.findall(r"(\d+): \{ name: '[^']+', color: 0x([0-9a-f]+)", (ROOT/'src/core/Constants.js').read_text())}
palette.update({26:0xd65340,27:0xe5bb44,28:0x965377,29:0x49918b,30:0x85533d,31:0x343b42,32:0xece9d9})
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
M={}
for i,c in palette.items():
 m=bpy.data.materials.new(f'voxel_{i}');m.diffuse_color=(*(linear(int(c>>b&255)/255) for b in [16,8,0]),1);M[i]=m
parts=[];shapes=[]
def xyz(p):return (p[0],-p[2],p[1])
def keep(o,name,m,shape):
 o.name=name;o.data.materials.append(M[m]);parts.append(o);shape['m']=m;shapes.append(shape);return o
def box(name,p,s,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return keep(o,name,m,dict(k='box',p=p,s=s))
def ell(name,p,r,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=xyz(p));o=bpy.context.object;o.scale=(r[0],r[2],r[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return keep(o,name,m,dict(k='ell',p=p,r=r))
def beam(name,a,b,r,m,r2=None):
 av,bv=Vector(xyz(a)),Vector(xyz(b));d=bv-av;bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(av+bv)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return keep(o,name,m,dict(k='beam',a=a,b=b,r=r,r2=r if r2 is None else r2))
def panel(name,corners,m):
 p=np.array(corners);n=np.cross(p[1]-p[0],p[3]-p[0]);n=n/np.linalg.norm(n);vertices=[xyz(v) for v in np.concatenate([p-n*.18,p+n*.18])];faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return keep(o,name,m,dict(k='panel',corners=corners,n=n.tolist(),th=.18))
def ring(name,p,r,wire,m,axis='y',steps=24):
 pts=[]
 for i in range(steps+1):
  a=i*math.tau/steps;pts.append([p[0]+math.cos(a)*r,p[1]+(math.sin(a)*r if axis=='z' else 0),p[2]+(0 if axis=='z' else math.sin(a)*r)])
 for a,b in zip(pts,pts[1:]):beam(name,a,b,wire,m)
def hall(name,p,w,h,d,m=3,roof=19,storeys=1):
 x,y,z=p;th=.44;box(name+' floor',(x,y+.22,z),(w,.44,d),22);box(name+' roof',(x,y+h,z),(w+.4,.44,d+.4),roof)
 for level in range(storeys):
  yy=y+level*h/storeys;hh=h/storeys
  for front in [-1,1]:
   for i in range(math.ceil(w/3)):
    px=x-w/2+(i+.5)*w/math.ceil(w/3);span=w/math.ceil(w/3)
    if level==0 and abs(px-x)<1.6 and front==-1:
     box('door lintel',(px,yy+hh-.5,z+front*d/2),(span,1,th),m);continue
    box('window sill',(px,yy+.5,z+front*d/2),(span,1,th),m)
    box('window',(px,yy+hh/2,z+front*d/2),(max(.6,span-.5),max(.4,hh-2),th),4)
    box('window mullion',(px-span/2,yy+hh/2,z+front*d/2),(.44,hh,th),13)
    box('lintel',(px,yy+hh-.4,z+front*d/2),(span,.8,th),m)
  for side in [-1,1]:box('end wall',(x+side*w/2,yy+hh/2,z),(th,hh,d),m)
def canopy(p,w,d,m=26):
 x,y,z=p;box('awning',(x,y,z),(w,.44,d),m)
 for dx in [-w/2,w/2]:
  for dz in [-d/2,d/2]:box('awning post',(x+dx,y/2,z+dz),(.44,y,.44),13)
def stall(x,z,m=26):
 box('stall counter',(x,1,z),(3,1.3,1.7),17);canopy((x,3,z),3.5,2.2,m)
 for i in range(4):ell('produce',(x-1+i*.65,1.8,z),(.35,.3,.35),27 if i%2 else 26)
def build(id):
 if id=='space-noodle':
  for a in [0,math.tau/3,math.tau*2/3]:beam('swept tower leg',(math.cos(a)*6,0,math.sin(a)*6),(math.cos(a+0.25)*2,37,math.sin(a+0.25)*2),.7,13)
  beam('lift shaft',(0,0,0),(0,41,0),.8,31);beam('saucer underside',(0,35,0),(0,38,0),2,13,9);beam('observation windows',(0,38,0),(0,40.5,0),8,4,6.8);beam('saucer roof',(0,40.5,0),(0,43.5,0),9,13,2);beam('spire',(0,43.5,0),(0,52,0),.35,31,.1);ring('deck railing',(0,38,0),8.8,.25,27)
  for a in range(12):th=a*math.tau/12;beam('window mullion',(math.cos(th)*8,38,math.sin(th)*8),(math.cos(th)*6.8,40.5,math.sin(th)*6.8),.18,13)
  stall(-5,-6,27)
 elif id=='picky-place':
  hall('market hall',(0,0,0),26,7,12,14,26,2)
  for x in [-9,-3,3,9]:stall(x,-9,26 if x<0 else 29)
  beam('fish sign pole',(-6,7,0),(-6,10,0),.25,31);beam('fish sign pole',(6,7,0),(6,10,0),.25,31);ell('giant salmon',(0,11,0),(5.5,1.4,.8),29);beam('fish tail',(5,11,0),(7,13,0),.4,29,1.5)
 elif id=='frumont-troll':
  for x in [-11,11]:box('bridge pier',(x,5,3),(2,10,5),6)
  box('bridge deck',(0,11,3),(26,1.3,8),6)
  for z in [-1,7]:box('bridge parapet',(0,12.1,z),(26,1,.5),13)
  ell('crouched back',(0,4,1),(6,4,4),10);ell('troll head',(0,6,-2),(3.3,3.3,3),6);ell('long nose',(-.5,5.5,-5),(1,1.7,1.1),10)
  for x in [-4.8,4.8]:beam('arm',(x,5,0),(x*1.4,1,-5),1.4,6);ell('hand',(x*1.4,1,-5),(2,1,1.7),6)
  for x in [-1.4,1.4]:ell('eye socket',(x,7,-4.6),(.75,.65,.35),31);ell('eye glint',(x,7,-4.9),(.23,.23,.12),13)
  box('trapped car chassis',(5,1,-5),(3.2,1.2,1.7),15);box('car cabin',(5,1.8,-5),(1.7,.9,1.6),4)
 elif id=='gas-guzzlers':
  for x,z,r,h in [(-7,0,3,13),(1,2,3.5,17),(8,-2,1.8,24)]:
   beam('rusted tank',(x,1,z),(x,h,z),r,30);ell('tank cap',(x,h,z),(r,.7,r),30);ring('tank catwalk',(x,h-2,z),r+.5,.25,31)
   for a in range(4):th=a*math.tau/4;beam('tank foot',(x+math.cos(th)*r,0,z+math.sin(th)*r),(x+math.cos(th)*r,2,z+math.sin(th)*r),.35,31)
   for y in range(1,h,1):box('ladder rung',(x+r+.4,y,z),(.6,.22,1),13)
  for a,b in [((-7,10,0),(1,10,2)),((1,15,2),(8,15,-2)),((-7,7,0),(-7,7,-7))]:beam('cross pipe',a,b,.6,30)
  stall(-3,-7,27)
 elif id=='bandit-locks':
  for x in [-7,7]:box('lock wall',(x,1.6,0),(3,3.2,26),6)
  for z in [-9,8]:
   for x in [-3.1,3.1]:box('lock gate',(x,-.8,z),(6.2,10.4,.65),31)
   box('gate walkway',(0,4.5,z),(15,.4,1.4),27)
  for z in range(-10,13,4):
   for x in [-7,7]:box('bollard',(x,3.7,z),(.6,1,.6),31)
  hall('lock keepers office',(11,0,5),5,7,7,13,29,2)
 elif id=='ferry-fiasco':
  box('pier',(0,.5,0),(28,1,24),17);hall('terminal',(7,1,4),10,7,12,14,29,2)
  for x in [-12,-4,4,12]:
   for z in [-11,11]:beam('pier pile',(x,-2,z),(x,1,z),.55,17)
  ell('ferry hull',(-6,2,0),(4,2,10),29);box('car deck',(-6,3,0),(7.3,.5,18),13);hall('ferry cabin',(-6,3.4,1),6,4,13,13,29,2);box('bridge',(-6,8,-2),(4,1.7,4),4);beam('funnel',(-6,7,4),(-6,10,4),.8,31);box('loading ramp',(-6,1.1,-11),(5,.4,4),6)
 elif id=='mono-rail-yard':
  for x in [-12,-2,9]:box('monorail pier',(x,4,2),(1.5,8,1.5),6)
  box('elevated beam',(0,8.4,2),(30,1,1.3),13);canopy((4,11,-4),13,7,15);hall('station entrance',(8,0,-5),6,5,6,15,19)
  for x in [-9,-2,5]:
   box('train body',(x,10.2,2),(6.4,2.3,2.8),29 if x<0 else 26);box('train glazing',(x,10.5,.5),(5.5,1,.33),4)
   box('train roof',(x,11.5,2),(6.5,.3,3),13)
 elif id=='rainforest-bubbles':
  for x,z,r in [(-7,2,6),(4,3,7),(0,-6,4.5)]:
   # Latitude bands build a real thin glass shell, leaving ground access.
   rings=[]
   for i in range(7):
    a=i*math.pi/12;y=math.sin(a)*r;rr=math.cos(a)*r;rings.append((y,rr));ring('glass latitude',(x,y,z),rr,.22,13,steps=12)
   for n in range(12):
    a=n*math.tau/12
    for (y0,r0),(y1,r1) in zip(rings,rings[1:]):
     aa=(x+math.cos(a)*r0,y0,z+math.sin(a)*r0);bb=(x+math.cos(a)*r1,y1,z+math.sin(a)*r1);beam('glass rib',aa,bb,.15,13)
     # Glass panes are facets, with a doorway omitted on the southern meridian.
     if y0<2.2 and abs(math.sin(a)+1)<.12:continue
     a2=(n+1)*math.tau/12;corners=[aa,(x+math.cos(a2)*r0,y0,z+math.sin(a2)*r0),(x+math.cos(a2)*r1,y1,z+math.sin(a2)*r1),bb]
     panel('glass facet',corners,4)
   beam('palm trunk',(x,0,z),(x,r*.72,z),.3,17)
   for n in range(6):a=n*math.tau/6;beam('palm frond',(x,r*.72,z),(x+math.cos(a)*r*.48,r*.6,z+math.sin(a)*r*.48),.55,5,.15)
 elif id=='smiff-tower':
  hall('historic office tower',(0,0,0),11,33,11,3,13,10)
  for y,w,h in [(33,9,4),(37,7,3),(40,5,2)]:hall('stepped crown',(0,y,0),w,h,w,13,13)
  beam('pyramid roof',(0,42,0),(0,49,0),4,13,0);beam('flagpole',(0,49,0),(0,52,0),.16,31)
 elif id=='great-squeal':
  ring('wheel rim',(0,15,0),12,.45,13,axis='z',steps=32)
  for a in range(12):
   th=a*math.tau/12;x=math.cos(th)*12;y=15+math.sin(th)*12;beam('spoke',(0,15,0),(x,y,0),.22,13);beam('gondola hanger',(x,y,0),(x,y-1,0),.25,31);box('gondola',(x,y-2,0),(2,2,2),[26,27,29,28][a%4]);box('gondola window',(x,y-1.7,-1.05),(1.5,.9,.3),4)
  for z in [-3,3]:
   for x in [-6,6]:beam('wheel support',(x,0,z),(0,15,0),.65,13)
  hall('ticket booth',(8,0,-6),4,3.3,4,15,19)
 elif id=='museum-of-loud':
  for x,z,w,h,d,m in [(-8,1,9,10,13,28),(1,3,10,14,11,29),(8,-2,7,8,11,26),(-2,-6,9,6,7,15)]:
   hall('music hall',(x,0,z),w,h*.65,d,m,m);ell('folded metal roof',(x,h*.7,z),(w*.64,h*.5,d*.58),m)
  beam('giant guitar neck',(-9,0,-8),(-9,9,-8),.45,27);ell('guitar body',(-9,2,-8),(1.7,2,.6),26);ell('guitar sound hole',(-9,2,-8.6),(.6,.6,.22),31)
 elif id=='hat-stomps':
  ell('cowboy brim',(-4,7,1),(8,.7,5),12);ell('hat crown',(-4,8.7,1),(4,2.2,3),12);ring('hat band',(-4,7.7,1),3.4,.38,26)
  for x in [-9,1]:beam('shelter column',(x,0,1),(x,7,1),.4,17)
  for x,z,m in [(5,-5,30),(10,3,29)]:
   box('boot heel',(x,.6,z+1.5),(3,1.2,2.5),31);ell('boot toe',(x,1.7,z-1.1),(2,1.7,3.7),m);beam('boot shaft',(x,1.5,z+1),(x,7,z+1),1.7,m,1.9);ring('boot cuff',(x,7,z+1),1.9,.25,27)
   for y in [3,4.5,6]:beam('boot stitch',(x-1.4,y,z-.25),(x+1.4,y+.5,z-.25),.15,27)
 elif id=='volunteer-waterworks':
  for n in range(20):a=n*math.tau/20;aa=(math.cos(a)*5,0,math.sin(a)*5);bb=(aa[0],20,aa[2]);beam('brick tower wall',aa,bb,.9,3)
  ring('tower cornice',(0,20,0),5.5,.5,13);beam('observation roof',(0,22.5,0),(0,26,0),6,29,.5)
  for n in range(12):a=n*math.tau/12;beam('observation pillar',(math.cos(a)*5,20,math.sin(a)*5),(math.cos(a)*5,23,math.sin(a)*5),.25,13)
  # A real doorway, applied to the voxel/mesh assemblies as three jamb pieces.
  box('entry canopy',(0,3.2,-6),(3.5,.4,3),13)
 elif id=='discovery-light':
  for n in range(12):a=n*math.tau/12;beam('lighthouse wall',(math.cos(a)*2,0,math.sin(a)*2),(math.cos(a)*1.6,11,math.sin(a)*1.6),.6,13)
  ring('lantern balcony',(0,11,0),2.7,.35,31);beam('lantern glass',(0,11,0),(0,13.5,0),1.8,4);beam('lantern roof',(0,13.5,0),(0,15.5,0),2.6,26,0);ell('beacon',(0,12.2,0),(.6,.7,.6),27);hall('keepers cottage',(6,0,4),7,4,7,13,26)
 elif id=='big-pinch-diner':
  hall('seafood diner',(0,0,0),16,4,11,29,13);canopy((0,3,-7),16,3,26)
  for i in range(6):ell('lobster segment',(0,6.5,-3+i*1.6),(2.4-i*.13,1.7,1.2),26)
  ell('lobster head',(0,7,-5),(2.2,1.8,2),26)
  for x in [-1,1]:
   ell('lobster eye',(x,8,-6.2),(.4,.45,.4),31);beam('antenna',(x,8,-5.8),(x*3,11,-9),.16,26)
   beam('claw arm',(x*1.8,6,-4),(x*4,6,-7),.7,26);ell('great claw',(x*5,6,-8),(1.3,1,1.5),26)
   for edge,out,tip in [(4.4,4,4.9),(5.6,6,5.1)]:
    beam('open claw finger',(x*edge,6,-8.8),(x*out,6,-10.8),.45,26,.3);beam('pincer tip',(x*out,6,-10.8),(x*tip,6,-11.1),.3,26,.15)
   for i in range(4):beam('leg',(x*2,6,-1+i*1.5),(x*4,4.2,-2+i*1.5),.3,26)
  ell('tail fan',(0,5.8,6.7),(3,.7,1.5),26)
 elif id=='banana-snacks':
  # Bent core and three distinct peel ribbons keep the banana legible in voxel form.
  points=[(-5,4,0),(-3,5,0),(0,8,0),(2,12,0),(2,16,0)]
  for a,b in zip(points,points[1:]):beam('banana flesh',a,b,2,12,1.8)
  for a,b in zip([(2,16,0),(2,17,0)],[(2,17,0),(1.4,17.7,0)]):beam('banana stem',a,b,.5,30)
  for n in range(3):
   a=n*math.tau/3;coords=[(1.8,12,0),(1.8+math.cos(a)*4,11,math.sin(a)*4),(1.8+math.cos(a)*6,7,math.sin(a)*6),(1.8+math.cos(a)*5.5,3,math.sin(a)*5.5)]
   for aa,bb in zip(coords,coords[1:]):beam('peeled yellow ribbon',aa,bb,.85,27)
  for x in [-5,0,5]:stall(x,-5,27 if x else 29)

def bake(shapes):
 # Sparse union; each part touches only its own bounding volume. Runs remove
 # the need to repeat volumetric intersection work on the browser main thread.
 vox={}
 for s in shapes:
  if s['k']=='box':lo=np.array(s['p'])-np.array(s['s'])/2;hi=np.array(s['p'])+np.array(s['s'])/2
  elif s['k']=='ell':lo=np.array(s['p'])-np.array(s['r']);hi=np.array(s['p'])+np.array(s['r'])
  elif s['k']=='panel':lo=np.min(s['corners'],axis=0)-s['th'];hi=np.max(s['corners'],axis=0)+s['th']
  else:lo=np.minimum(s['a'],s['b'])-max(s['r'],s['r2']);hi=np.maximum(s['a'],s['b'])+max(s['r'],s['r2'])
  low=np.floor(lo/S).astype(int);high=np.ceil(hi/S).astype(int)
  # Sampling cells, rather than mesh vertices, preserves connections across
  # thin windows, spokes and railings in the destructible representation.
  xs=np.arange(low[0],high[0]);ys=np.arange(low[1] if id=='bandit-locks' else max(0,low[1]),high[1]);zs=np.arange(low[2],high[2])
  if not len(xs)*len(ys)*len(zs):continue
  xx,yy,zz=np.meshgrid(xs,ys,zs,indexing='ij');q=np.stack([xx,yy,zz],axis=-1);pts=(q+.5)*S
  if s['k']=='box':inside=np.all(np.abs(pts-np.array(s['p']))<=np.array(s['s'])/2,axis=-1)
  elif s['k']=='ell':inside=np.sum(((pts-np.array(s['p']))/np.array(s['r']))**2,axis=-1)<=1
  elif s['k']=='panel':
   c=np.array(s['corners']);n=np.array(s['n']);inside=np.abs(np.sum((pts-c[0])*n,axis=-1))<=s['th']
   for a,b in zip(c,np.roll(c,-1,axis=0)):inside &= np.sum(np.cross(b-a,pts-a)*n,axis=-1)>=-.08
  else:
   a=np.array(s['a']);d=np.array(s['b'])-a;length=np.dot(d,d);t=np.sum((pts-a)*d,axis=-1)/length;r=s['r']+(s['r2']-s['r'])*t;inside=(t>=0)&(t<=1)&(np.sum((pts-a-t[...,None]*d)**2,axis=-1)<=r*r)
  for x,y,z in q[inside]:vox[(int(x),int(z),int(y))]=s['m']
 runs=[];ordered=sorted(vox)
 for key in ordered:
  x,z,y=key;m=vox[key]
  if runs and runs[-1][0]==x and runs[-1][1]==z and runs[-1][3]+1==y and runs[-1][4]==m:runs[-1][3]=y
  else:runs.append([x,z,y,y,m])
 return runs,len(vox)
ids=['space-noodle','picky-place','frumont-troll','gas-guzzlers','bandit-locks','ferry-fiasco','mono-rail-yard','rainforest-bubbles','smiff-tower','great-squeal','museum-of-loud','hat-stomps','volunteer-waterworks','discovery-light','big-pinch-diner','banana-snacks']
manifest=[];binary=bytearray()
for id in ids:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);parts=[];shapes=[];build(id)
 # Sources preserve separately named, individually editable authored parts.
 bpy.ops.wm.save_as_mainfile(filepath=str(SRC/f'{id}.blend'))
 (SRC/f'{id}.json').write_text(json.dumps(shapes,separators=(',',':')))
 runs,count=bake(shapes);offset=len(binary)//2
 for run in runs:binary.extend(struct.pack('<5h',*run))
 bounds=[[min(r[0] for r in runs)*S,min(r[2] for r in runs)*S,min(r[1] for r in runs)*S],[(max(r[0] for r in runs)+1)*S,(max(r[3] for r in runs)+1)*S,(max(r[1] for r in runs)+1)*S]]
 # Far models are one mesh and one material; glass becomes actual shattering
 # voxel panes on approach, so no permanent glass overlay survives demolition.
 for o in parts:
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);attr=o.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER');c=o.data.materials[0].diffuse_color
  for item in attr.data:item.color=c
  o.select_set(False)
 bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=id
 mat=bpy.data.materials.new('Landmark vertex palette');mat.use_nodes=True;nodes=mat.node_tree.nodes;v=nodes.new('ShaderNodeVertexColor');v.layer_name='Col';mat.node_tree.links.new(v.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85;o.data.materials.clear();o.data.materials.append(mat)
 for poly in o.data.polygons:poly.material_index=0
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{id}.glb'),export_format='GLB',export_apply=True,export_yup=True,export_vertex_color='ACTIVE',export_normals=True)
 manifest.append(dict(id=id,bounds=bounds,offset=offset,runs=len(runs),voxels=count,parts=len(shapes),vertices=len(o.data.vertices)))
 print('LANDMARK_EXPORTED',id,len(runs),count,flush=True)
(OUT/'voxels.bin').write_bytes(binary);(SRC/'manifest.json').write_text(json.dumps(manifest,indent=2));(ROOT/'src/level/landmarkManifest.json').write_text(json.dumps(manifest,separators=(',',':')))
print('LANDMARKS_EXPORTED',len(manifest),'voxel bytes',len(binary),flush=True)
