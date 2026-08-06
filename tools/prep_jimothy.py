# Build-time asset prep for Jimothy (milestone 06 revision).
#
# Takes the raw Meshy export and produces the game-ready GLB: decimated,
# texture-downscaled, and pre-split into named parts (head/body/tail/4 legs)
# so the browser just parents named objects instead of bucketing 800k
# triangles at load. Run via:
#   blender --background --python tools/prep_jimothy.py -- <src.glb> <out.glb> [previewdir]
import bpy, bmesh, sys, json, math, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
PREVIEW = argv[2] if len(argv) > 2 else None

TARGET_TRIS = 40_000
TEXTURE_SIZE = 1024
# Merge radius for the pre-decimate weld (JIM-10). The model is ~1 unit long,
# so this only ever fuses vertices that glTF duplicated at a UV/normal seam,
# never two genuinely distinct features.
WELD_DISTANCE = 1e-5
# Cut planes as fractions of the model's own bounding box.
NECK_FRAC = 0.26   # from the nose end
TAIL_FRAC = 0.16   # from the tail end
LEG_TOP_FRAC = 0.42  # legs = everything below this fraction of height

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = obj

# --- weld BEFORE decimating (JIM-10) ---
# glTF stores a vertex per face-corner wherever UVs or normals split, so the
# importer hands us 623k vertices for a surface that only has ~400k. Blender
# treats those duplicates as genuinely disconnected, and Decimate then
# collapses a mesh it believes is in pieces: the 2026-08-06 measurement went
# from 0 non-manifold edges to 48,237, and the shipped model ended up ~64%
# boundary edges — holes everywhere, which DoubleSide rendered as Jimothy's
# own dark interior showing through.
#
# Merging by distance first restores the real topology so Decimate collapses
# across the whole surface. It also merges the duplicate UV corners at seams,
# which can smear the texture very slightly there — a far better trade than a
# raccoon full of holes.
bm = bmesh.new()
bm.from_mesh(obj.data)
before_verts = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD_DISTANCE)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(obj.data)
bm.free()
obj.data.update()
print(f'PREPWELD verts {before_verts} -> {len(obj.data.vertices)}')

# --- decimate: 800k tris is desktop-GPU-fine but a 40 MB download ---
obj.data.calc_loop_triangles()
tris = len(obj.data.loop_triangles)
if tris > TARGET_TRIS:
    mod = obj.modifiers.new('dec', 'DECIMATE')
    mod.ratio = TARGET_TRIS / tris
    bpy.ops.object.modifier_apply(modifier=mod.name)

# --- textures: three 2048² maps dominate the file size ---
for im in bpy.data.images:
    if im.size[0] > TEXTURE_SIZE:
        im.scale(TEXTURE_SIZE, TEXTURE_SIZE)

# Blender is Z-up; the glTF importer maps glTF +Z to Blender -Y. Verified by
# colour-split render: Jimothy's nose sits at MINUS Y here (= glTF +Z, which
# is what RIG.NOSE_POSITIVE_Z=1 means in the game). Z is height.
bb = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
ys = [p.y for p in bb]; zs = [p.z for p in bb]
y_min, y_max = min(ys), max(ys)
z_min, z_max = min(zs), max(zs)
y_len = y_max - y_min
neck_y = y_min + NECK_FRAC * y_len   # nose side
tail_y = y_max - TAIL_FRAC * y_len   # rump side
leg_z = z_min + LEG_TOP_FRAC * (z_max - z_min)


y_mid = (y_min + y_max) / 2


def part_of(co):
    """Assign a face centroid to a named part. Legs win over the head/tail
    planes: the front legs hang forward of the neck cut, so testing height
    first is what keeps them out of the head bucket."""
    if co.z < leg_z:
        lr = 'L' if co.x < 0 else 'R'
        fb = 'F' if co.y < y_mid else 'R'  # front = toward the nose (-Y)
        return f'leg_{fb}{lr}'
    if co.y < neck_y:
        return 'head'
    if co.y > tail_y:
        return 'tail'
    return 'body'


# Bucket faces by centroid, then build one mesh per part. Splitting here
# (build time) rather than in the browser keeps load instant.
me = obj.data
bm = bmesh.new()
bm.from_mesh(me)
bm.faces.ensure_lookup_table()
uv_layer = bm.loops.layers.uv.active

buckets = {}
for f in bm.faces:
    buckets.setdefault(part_of(f.calc_center_median()), []).append(f)

report = {}
new_objects = []
for name, faces in buckets.items():
    nbm = bmesh.new()
    nuv = nbm.loops.layers.uv.new('UVMap') if uv_layer else None
    vmap = {}
    for f in faces:
        verts = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = nbm.verts.new(v.co)
            verts.append(vmap[v])
        try:
            nf = nbm.faces.new(verts)
        except ValueError:
            continue  # duplicate face after decimation; skip
        if nuv:
            for loop, src_loop in zip(nf.loops, f.loops):
                loop[nuv].uv = src_loop[uv_layer].uv
    # Cap the cut (JIM-10). Slicing the model into parts necessarily opens a
    # hole in each piece where its neighbour used to be — the neck socket, the
    # leg sockets, the stump of the tail. DoubleSide renders straight through
    # those into the interior, and any animation that moves a piece drags the
    # hole into view (the headbutt did exactly that). Filling the boundary
    # loops makes each piece a closed solid, so pieces can move freely.
    bmesh.ops.holes_fill(nbm, edges=[e for e in nbm.edges if e.is_boundary])
    bmesh.ops.recalc_face_normals(nbm, faces=nbm.faces)
    nbm.normal_update()
    nme = bpy.data.meshes.new(name)
    nbm.to_mesh(nme)
    nbm.free()
    for mat in me.materials:
        nme.materials.append(mat)
    nobj = bpy.data.objects.new(name, nme)
    # Centre each piece's geometry on its own origin and carry where it
    # belongs in the object TRANSFORM. The game then rotates a piece about
    # itself (head bob, tail wiggle, leg swing) while it still reassembles in
    # the right place. Skipping this is what made the tail float off behind
    # him in the 2026-07-23 playtest.
    centroid = sum((v.co for v in nme.vertices), mathutils.Vector()) / max(1, len(nme.vertices))
    for v in nme.vertices:
        v.co -= centroid
    nobj.location = centroid
    bpy.context.scene.collection.objects.link(nobj)
    new_objects.append(nobj)
    nme.calc_loop_triangles()
    report[name] = len(nme.loop_triangles)

bpy.data.objects.remove(obj, do_unlink=True)

if PREVIEW:
    # Flat colour per part so the cuts can be eyeballed before shipping.
    palette = {
        'head': (1, 0.3, 0.3, 1), 'body': (0.35, 0.6, 1, 1), 'tail': (1, 0.85, 0.2, 1),
        'leg_FL': (0.3, 1, 0.4, 1), 'leg_FR': (0.1, 0.7, 0.2, 1),
        'leg_RL': (0.8, 0.4, 1, 1), 'leg_RR': (0.5, 0.2, 0.8, 1),
    }
    for o in new_objects:
        m = bpy.data.materials.new(o.name)
        m.diffuse_color = palette.get(o.name, (1, 1, 1, 1))
        o.data.materials.clear()
        o.data.materials.append(m)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x = scene.render.resolution_y = 640
    allbb = [o.matrix_world @ mathutils.Vector(c) for o in new_objects for c in o.bound_box]
    center = sum(allbb, mathutils.Vector()) / len(allbb)
    size = max(max(p[i] for p in allbb) - min(p[i] for p in allbb) for i in range(3))
    cam_data = bpy.data.cameras.new('c'); cam_data.type = 'ORTHO'
    cam_data.ortho_scale = size * 1.3
    cam = bpy.data.objects.new('c', cam_data)
    scene.collection.objects.link(cam); scene.camera = cam
    for nm, d in {'side': (1, 0, 0), 'front': (0, -1, 0)}.items():
        dv = mathutils.Vector(d).normalized()
        cam.location = center + dv * size * 3
        cam.rotation_mode = 'QUATERNION'
        cam.rotation_quaternion = (-dv).to_track_quat('-Z', 'Y')
        scene.render.filepath = f'{PREVIEW}/parts_{nm}.png'
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format='GLB', use_selection=False,
        export_yup=True, export_apply=True,
    )

print('PREPJSON' + json.dumps({
    'source_tris': tris,
    'parts': report,
    'total_tris': sum(report.values()),
    'neck_y': round(neck_y, 3), 'tail_y': round(tail_y, 3), 'leg_z': round(leg_z, 3),
}) + 'ENDJSON')
