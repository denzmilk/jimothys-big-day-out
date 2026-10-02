"""Pack existing MPFB GLBs into one skinned draw each, preserving their rig.
Run with Python + numpy + Pillow after build_pedestrians.py. Editable Blender
sources remain authoritative; this only changes the delivery representation.
"""
from pathlib import Path
import json, struct, io, math, shutil, argparse
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
DTYPES={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
GUTTER=4

def load(path):
 d=Path(path).read_bytes();n=struct.unpack_from('<I',d,12)[0];return json.loads(d[20:20+n]),bytearray(d[28+n:])
def array(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dtype=np.dtype(DTYPES[a['componentType']]);width=WIDTH[a['type']];start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.ndarray((a['count'],width),dtype=dtype,buffer=b,offset=start,strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize)).copy()
def pack(path,backup=None):
 j,b=load(path)
 if j.get('extras',{}).get('jimothyPacked'):return
 if backup:Path(backup).mkdir(parents=True,exist_ok=True);shutil.copy2(path,Path(backup)/path.name)
 def add_bytes(data):
  b.extend(b'\0'*((-len(b))%4));i=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(data)});b.extend(data);return i
 def accessor(data,typ,component=5126):
  data=np.array(data,dtype=DTYPES[component]);a={'bufferView':add_bytes(data.tobytes()),'componentType':component,'count':len(data),'type':typ}
  if typ=='VEC3':a.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())
  j['accessors'].append(a);return len(j['accessors'])-1
 def image(texture):
  source=j['images'][j['textures'][texture]['source']];v=j['bufferViews'][source['bufferView']];return Image.open(io.BytesIO(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGBA')
 # One tile per distinct image/factor; skin, lips, ears and nails share a tile.
 bases={};normals={('neutral',):Image.new('RGBA',(1,1),(128,128,255,255))};mat_tiles={}
 for i,m in enumerate(j['materials']):
  p=m.get('pbrMetallicRoughness',{});factor=p.get('baseColorFactor',[1,1,1,1]);t=p.get('baseColorTexture');key=(j['textures'][t['index']]['source'] if t else None,*factor)
  if key not in bases:
   im=image(t['index']) if t else Image.new('RGBA',(1,1),(255,255,255,255))
   if factor!=[1,1,1,1]:
    pixels=np.array(im).astype(float)/255;rgb=pixels[:,:,:3];linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)*factor[:3];pixels[:,:,:3]=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055);pixels[:,:,3]*=factor[3];im=Image.fromarray(np.clip(np.rint(pixels*255),0,255).astype('u1'))
   bases[key]=im
  n=m.get('normalTexture');nk=(j['textures'][n['index']]['source'],n.get('scale',1)) if n else ('neutral',)
  if n and nk not in normals:
   im=image(n['index']);assert n.get('scale',1)==1,'normal strength must be baked before packing';normals[nk]=im
  mat_tiles[i]=(key,nk)
 def atlas(images):
  # A shelf pack preserves every source pixel, including small accessories.
  width=2**math.ceil(math.log2(max(max(im.width+GUTTER*2 for im in images.values()),math.sqrt(sum((im.width+GUTTER*2)*(im.height+GUTTER*2)for im in images.values())))))
  placements={};x=y=row=0
  for key,im in sorted(images.items(),key=lambda kv:-kv[1].height):
   w,h=im.size
   if x+w+GUTTER*2>width:x=0;y+=row;row=0
   placements[key]=(x+GUTTER,y+GUTTER,w,h);x+=w+GUTTER*2;row=max(row,h+GUTTER*2)
  out=Image.new('RGBA',(width,y+row));W,H=out.size
  for key,(x,y,w,h)in placements.items():
   im=images[key];padded=Image.fromarray(np.pad(np.asarray(im),((GUTTER,GUTTER),(GUTTER,GUTTER),(0,0)),mode='wrap'));out.paste(padded,(x-GUTTER,y-GUTTER))
  encoded=io.BytesIO();out.save(encoded,format='PNG',optimize=True)
  return {'bufferView':add_bytes(encoded.getvalue()),'mimeType':'image/png'},placements,(W,H)
 base_image,base_tiles,base_size=atlas(bases);normal_image,normal_tiles,normal_size=atlas(normals)
 values={};indices=[];offset=0;skin=None;nodes=[];triangles=0
 def remap(uv,tile,size):
  x,y,w,h=tile;u=uv.copy();assert np.min(u)>=-min(GUTTER/w,GUTTER/h) and np.max(u)<=1+min(GUTTER/w,GUTTER/h),'UV repeats exceed the periodic gutter';u[:,0]=(x+u[:,0]*w)/size[0];u[:,1]=(y+u[:,1]*h)/size[1];return u
 for node in j['nodes']:
  if 'mesh' not in node:continue
  assert not any(k in node for k in ['matrix','translation','rotation','scale']),'non-identity mesh node needs skin-space conversion'
  assert skin is None or skin==node['skin'];skin=node['skin'];nodes.append(node)
  for p in j['meshes'][node['mesh']]['primitives']:
   assert not p.get('targets');assert p.get('mode',4)==4
   a={k:array(j,b,v)for k,v in p['attributes'].items()};assert all(k in a for k in ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])
   m=p['material'];bk,nk=mat_tiles[m];uv=a['TEXCOORD_0'];a['TEXCOORD_0']=remap(uv,base_tiles[bk],base_size)
   a['TEXCOORD_1']=remap(uv if nk!=('neutral',) else np.full_like(uv,.5),normal_tiles[nk],normal_size)
   a.pop('TANGENT',None)
   for k,v in a.items():values.setdefault(k,[]).append(v)
   count=len(a['POSITION']);ix=array(j,b,p['indices']).reshape(-1) if 'indices'in p else np.arange(count);indices.extend((ix+offset).tolist());triangles+=len(ix)//3;offset+=count
 attributes={k:accessor(np.concatenate(v),f'VEC{v[0].shape[1]}',5123 if k.startswith('JOINTS')else 5126)for k,v in values.items()}
 new_indices=accessor(np.array(indices).reshape(-1,1),'SCALAR',5125)
 for n in nodes:n.pop('mesh');n.pop('skin')
 nodes[0].update(mesh=0,skin=skin)
 j['meshes']=[{'name':path.stem+'-packed','primitives':[{'attributes':attributes,'indices':new_indices,'material':0}]}]
 j['images']=[base_image,normal_image];j['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}];j['textures']=[{'source':0,'sampler':0},{'source':1,'sampler':0}]
 j['materials']=[{'name':path.stem+'-atlas','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.7},'normalTexture':{'index':1,'texCoord':1},'doubleSided':True,'alphaMode':'MASK','alphaCutoff':.5}]
 # Remove unused source streams/images so transport size does not double.
 used=set(attributes.values())|{new_indices}
 for anim in j.get('animations',[]):
  for s in anim['samplers']:used.update([s['input'],s['output']])
 for s in j.get('skins',[]):used.add(s['inverseBindMatrices'])
 ids={old:new for new,old in enumerate(sorted(used))};j['accessors']=[a for i,a in enumerate(j['accessors'])if i in used]
 for k,v in attributes.items():attributes[k]=ids[v]
 j['meshes'][0]['primitives'][0]['indices']=ids[new_indices]
 for anim in j.get('animations',[]):
  for s in anim['samplers']:s['input']=ids[s['input']];s['output']=ids[s['output']]
 for s in j.get('skins',[]):s['inverseBindMatrices']=ids[s['inverseBindMatrices']]
 refs=[]
 def collect(v):
  if isinstance(v,dict):
   if 'bufferView'in v:refs.append(v)
   for value in v.values():collect(value)
  elif isinstance(v,list):
   for value in v:collect(value)
 collect(j['accessors']);collect(j['images']);views={};binary=bytearray();new_views=[]
 for ref in refs:
  old=ref['bufferView']
  if old not in views:
   v=dict(j['bufferViews'][old]);start=v.get('byteOffset',0);data=b[start:start+v['byteLength']];binary.extend(b'\0'*((-len(binary))%4));v.update(buffer=0,byteOffset=len(binary));views[old]=len(new_views);new_views.append(v);binary.extend(data)
  ref['bufferView']=views[old]
 j['bufferViews']=new_views;j['buffers']=[{'byteLength':len(binary)}];j.setdefault('extras',{})['jimothyPacked']={'triangles':triangles,'draws':1,'source':'MPFB Blender sources; tools/pack_pedestrians.py'}
 encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);binary+=b'\0'*((-len(binary))%4)
 out=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary;path.write_bytes(out)
 print(json.dumps({'model':path.stem,'triangles':triangles,'bytes':len(out),'atlas':base_size,'normalAtlas':normal_size}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('paths',nargs='*',type=Path);parser.add_argument('--backup',type=Path);args=parser.parse_args()
 for path in args.paths or sorted((ROOT/'public/assets/models/people').glob('*.glb')):pack(path,args.backup)
