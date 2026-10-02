import bpy,math,json,os
from mathutils import Vector,Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE=ROOT+'/assets/sources/military'
OUT=ROOT+'/public/assets/models/military'
os.makedirs(OUT,exist_ok=True)
os.makedirs(ROOT+'/assets/blender/military',exist_ok=True)
manifest=[]
for name in ['tank','jet']:
 if name=='tank':bpy.ops.wm.open_mainfile(filepath=SOURCE+'/Tank.blend')
 else:
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=SOURCE+'/Jet.glb')
 bpy.context.scene.frame_set(0);deps=bpy.context.evaluated_depsgraph_get()
 originals=[o for o in bpy.context.scene.objects if o.type=='MESH']
 # Source tank points along -X; glTF delivery points +Z via Blender -Y.
 rotation=Matrix.Rotation(math.pi/2 if name=='tank' else 0,4,'Z')
 records=[]
 for o in originals:
  mesh=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps)
  mesh.transform(rotation@o.matrix_world)
  records.append((o,mesh))
 bounds=[v.co for _,m in records for v in m.vertices];lo=Vector([min(v[i]for v in bounds)for i in range(3)]);hi=Vector([max(v[i]for v in bounds)for i in range(3)])
 length=7.2 if name=='tank' else 13.;scale=length/(hi.y-lo.y);centre=(hi+lo)/2;centre.z=lo.z
 sections={}
 for o,m in records:
  for f in m.polygons:
   # Preserve every original face while separating breakable assemblies.
   if name=='tank':section='track-left' if '.L' in o.name else 'track-right' if '.R' in o.name else 'barrel' if 'Gun' in o.name else 'turret' if f.center.z>3.25 else 'hull'
   else:
    c=f.center;section='wing-left' if c.x<-1.5 else 'wing-right' if c.x>1.5 else 'tail' if c.y>2 else 'fuselage'
   data=sections.setdefault(section,{'verts':[],'faces':[],'colors':[]});start=len(data['verts']);data['verts'] += [tuple((m.vertices[i].co-centre)*scale)for i in f.vertices];data['faces'].append(tuple(range(start,start+len(f.vertices))))
   mat=m.materials[f.material_index];color=tuple(mat.diffuse_color)
   if mat.use_nodes:
    bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if bsdf:color=tuple(bsdf.inputs['Base Color'].default_value)
   data['colors'] += [color]*len(f.vertices)
  bpy.data.meshes.remove(m)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 material=bpy.data.materials.new('Source-colours');material.use_nodes=True;nodes=material.node_tree.nodes;bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.72;vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color';material.node_tree.links.new(vertex.outputs['Color'],bsdf.inputs['Base Color'])
 for section,data in sections.items():
  mesh=bpy.data.meshes.new(section);mesh.from_pydata(data['verts'],[],data['faces']);mesh.update();attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  for i,loop in enumerate(mesh.loops):attr.data[i].color=data['colors'][loop.vertex_index]
  mesh.materials.append(material);o=bpy.data.objects.new(section,mesh);bpy.context.collection.objects.link(o)
 bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/blender/military/'+name+'.blend')
 path=OUT+'/'+name+'.glb';bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
 manifest.append({'id':name,'length':length,'parts':list(sections),'bytes':os.path.getsize(path),'triangles':sum(sum(len(f)-2 for f in s['faces'])for s in sections.values()),'forward':'+Z','ground':'minimum Y = 0'})
open(OUT+'/manifest.json','w').write(json.dumps(manifest,indent=2)+'\n')
