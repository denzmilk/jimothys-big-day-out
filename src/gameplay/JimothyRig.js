import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_PATHS, RIG, PLAYER_CONFIG } from '../core/Constants.js';
import {TriangleIndex} from '../core/TriangleIndex.js';

import { eventBus, Events } from '../core/EventBus.js';

// Loads Jimothy. Two paths, selected by RIG.SKINNED:
//
//   skinned — ONE continuous mesh on a 12-joint armature (ADR-0004,
//             tools/rig_jimothy.py). Animation poses BONES, and the surface
//             stretches across each joint instead of tearing at it. This is
//             what ships.
//   split   — seven rigid solids pre-cut into head / body / tail / four legs
//             (tools/prep_jimothy.py), parented into the group slots. Kept as
//             a one-line fallback until the skinned rig is playtested. The cut
//             used to happen at runtime by bucketing 800k triangles in the
//             browser; moving it to build time made the model 9× smaller and
//             the load instant.
const LEG_NAMES = ['leg_FL', 'leg_FR', 'leg_RL', 'leg_RR'];

// The parts worth reporting a position for: everything an animation moves.
const TRACKED_PARTS = ['head', 'tail', 'neck', ...LEG_NAMES,
  ...LEG_NAMES.map((n) => n.replace('leg_', 'shin_'))];

export class JimothyRig {
  constructor(slots) {
    this.slots = slots; // { body, head, tail }
    this.loaded = false;
    this.pieces = [];
    this.legs = {};     // name -> { mesh, hipOffset, length }
    this.bodyPiece = null; // the mesh the belly-attachment check measures against

    this.bones = {};      // name -> Bone, when skinned
    this.rest = {};       // name -> bind quaternion, never mutated
    this.restPos = {};    // name -> bind position, never mutated
    this.skinned = null;  // the SkinnedMesh, when skinned
    // name -> { centroid, box } of the vertices this bone owns, in the mesh's
    // REST space. Skinning is affine per bone, so a rest centroid transformed
    // by that bone's skin matrix is its exact posed position — no per-vertex
    // work at query time.
    this.restParts = {};
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._m = new THREE.Matrix4();

    const path = RIG.SKINNED ? ASSET_PATHS.JIMOTHY_SKINNED : ASSET_PATHS.JIMOTHY_MODEL;
    new GLTFLoader().loadAsync(path).then((gltf) => {
      if (RIG.SKINNED) this._mountSkinned(gltf);
      else this._mount(gltf);
      this.loaded = true;
      eventBus.emit(Events.RIG_LOADED, { pieces: this.pieces.length });
    }).catch((e) => console.error('JimothyRig load failed:', e));
  }

  /** Start from the bind orientation before applying animation in the bone's
   *  own frame. Foot IK adds its rotations after this reset. */
  pose(name, x = 0, y = 0, z = 0) {
    const b = this.bones[name];
    if (!b) return;
    this._e.set(x, y, z);
    b.quaternion.copy(this.rest[name]).multiply(this._q.setFromEuler(this._e));
  }

  /** The matrix that takes a rest-space point to world under the current pose,
   *  for a point wholly owned by `name`. This is three.js's own skinning
   *  composition (bindMatrixInverse · boneWorld · boneInverse · bindMatrix),
   *  which is what the vertex shader applies — so anything measured through it
   *  is measured on the surface the player actually sees, not on a slot that
   *  drives nothing here. */
  _skinMatrix(name) {
    const b = this.bones[name];
    const i = this.skinned.skeleton.bones.indexOf(b);
    return this._m
      .multiplyMatrices(b.matrixWorld, this.skinned.skeleton.boneInverses[i])
      .multiply(this.skinned.bindMatrix)
      .premultiply(this.skinned.bindMatrixInverse)
      .premultiply(this.skinned.matrixWorld);
  }

  /** World centroid of the flesh a bone owns — the skinned analogue of "where
   *  is the head piece", which is what the attachment specs measure. */
  partCentroid(name, out = new THREE.Vector3()) {
    const rest = this.restParts[name];
    if (!rest) return out.set(0, 0, 0);
    return out.copy(rest.centroid).applyMatrix4(this._skinMatrix(name));
  }

  /** World box of the flesh a bone owns, under the current pose.
   *  `Box3.setFromObject` is no use on a SkinnedMesh — it reads the geometry's
   *  REST bounds, so it reports the same box however fat he is, and it covers
   *  the whole animal rather than the one part being asked about. */
  partBox(name, out = new THREE.Box3()) {
    const rest = this.restParts[name];
    if (!rest) return out.makeEmpty();
    return out.copy(rest.box).applyMatrix4(this._skinMatrix(name));
  }

  bellyLocalBox(space,out=new THREE.Box3()) {
    if(this.grownBox){
      const transform=new THREE.Matrix4().copy(space.matrixWorld).invert().multiply(this.root.matrixWorld);
      return out.copy(this.grownBox).applyMatrix4(transform);
    }
    const rest=this.restParts.body;if(!rest)return out.makeEmpty();
    const transform=new THREE.Matrix4().copy(space.matrixWorld).invert().multiply(this._skinMatrix('body'));
    return out.copy(rest.box).applyMatrix4(transform);
  }

  bellyBox(out=new THREE.Box3()) {
    return this.grownBox?out.copy(this.grownBox).applyMatrix4(this.root.matrixWorld):this.partBox('body',out);
  }

  // The Blender growth key expands along a spherical field, with a shared
  // direction over each extremity. Rebinding at each size keeps animation
  // pivots on the new surface without shearing bent limbs.
  grow(width,round) {
    // Anatomy grows more slowly than girth, preserving the original raccoon
    // surface and readable features instead of hiding it under a sphere.
    this.anatomyScale=1+(width-1)*RIG.ANATOMY_GROWTH;
    this.root.scale.setScalar(this.baseScale*this.anatomyScale);
    if(width===this.growthWidth)return;
    this.growthWidth=width;
    const mesh=this.skinned,a=mesh.geometry.attributes,positions=a.position,amount=(width-this.anatomyScale)/this.anatomyScale;
    const bodyIndex=mesh.skeleton.bones.indexOf(this.bones.body);
    for(let v=0;v<positions.count;v++){
      const indices=[],weights=[];let transferred=0;
      for(let k=0;k<4;k++){
        const offset=v*4+k,index=this.baseSkinIndex[offset],original=this.baseSkinWeight[offset];
        const keep=1-THREE.MathUtils.smoothstep(this.socketDistance[offset]*amount,RIG.SOCKET_BLEND_IN,RIG.SOCKET_BLEND_OUT);
        indices.push(index);weights.push(original*keep);transferred+=original*(1-keep);
      }
      if(transferred>0){
        let slot=indices.indexOf(bodyIndex);
        if(slot<0){slot=weights.indexOf(Math.min(...weights));transferred+=weights[slot];weights[slot]=0;indices[slot]=bodyIndex;}
        weights[slot]+=transferred;
      }
      for(let k=0;k<4;k++){a.skinIndex.setComponent(v,k,indices[k]);a.skinWeight.setComponent(v,k,weights[k]);}
    }
    a.skinIndex.needsUpdate=true;a.skinWeight.needsUpdate=true;
    for(let i=0;i<positions.array.length;i++)positions.array[i]=this.growthBase[i]+this.growthDelta[i]*amount;
    positions.needsUpdate=true;mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    this.surfaceIndex.refit();
    const posed={};
    for(const [name,bone] of Object.entries(this.bones)){
      posed[name]=bone.quaternion.clone();bone.quaternion.copy(this.rest[name]);bone.position.copy(this.restPos[name]);
      if(this.growthAnchors[name])bone.position.addScaledVector(this.growthAnchors[name],amount);
    }
    this.root.parent.updateMatrixWorld(true);mesh.bind(mesh.skeleton);
    this._indexRestParts();
    const box=new THREE.Box3(),point=new THREE.Vector3();
    for(const v of this.torsoVertices)box.expandByPoint(point.fromBufferAttribute(a.position,v));
    const toRoot=new THREE.Matrix4().copy(this.root.matrixWorld).invert().multiply(mesh.matrixWorld);
    if(amount===0)a.normal.array.set(this.growthNormals);else mesh.geometry.computeVertexNormals();
    a.normal.needsUpdate=true;
    this.grownBox=box.applyMatrix4(toRoot);
    for(const [name,bone]of Object.entries(this.bones))bone.quaternion.copy(posed[name]);
  }

  _prepareGrowth() {
    const mesh=this.skinned;
    this.root.parent.updateMatrixWorld(true);
    const geometry=mesh.geometry,index=mesh.morphTargetDictionary.GiantGrowth;
    this.growthBase=geometry.attributes.position.array.slice();this.growthNormals=geometry.attributes.normal.array.slice();
    this.growthDelta=geometry.morphAttributes.position[index].array.slice();
    // Positions are baked only when food changes size. This lets normals,
    // collision queries and the rendered skin agree on exactly one shape.
    geometry.morphAttributes={};mesh.morphTargetInfluences=[];
    this.root.parent.updateMatrixWorld(true);
    this.bindBellyLocal=this.bellyLocalBox(this.root.parent).getCenter(new THREE.Vector3());
    this.surfaceMesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    this.surfaceIndex=new TriangleIndex(geometry,RIG.CONTACT_LEAF);
    this.surfaceMesh.matrixAutoUpdate=false;this.surfaceRay=new THREE.Raycaster();
    this._contactVertex=new THREE.Vector3();this._contactInverse=new THREE.Matrix4();
    this.growthAnchors={};
    for(const [name,direction] of Object.entries(RIG.GROWTH_ANCHORS)){
      const parent=this.bones[name].parent;
      const transform=new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(this.root.parent.matrixWorld));
      this.growthAnchors[name]=new THREE.Vector3(...direction).normalize().multiplyScalar(PLAYER_CONFIG.RADIUS).applyMatrix3(transform);
    }
    const a=geometry.attributes;
    this.baseSkinIndex=a.skinIndex.array.slice();this.baseSkinWeight=a.skinWeight.array.slice();this.socketDistance=new Float32Array(a.position.count*4);
    const toMesh=new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert().multiply(this.root.parent.matrixWorld));
    const anchorDelta=mesh.skeleton.bones.map(b=>{
      const name=b.name.startsWith('shin_')?b.name.replace('shin_','leg_'):b.name,dir=RIG.GROWTH_ANCHORS[name];
      return dir?new THREE.Vector3(...dir).normalize().multiplyScalar(PLAYER_CONFIG.RADIUS).applyMatrix3(toMesh):null;
    });
    const growthDirection=new THREE.Vector3(),meshScale=mesh.getWorldScale(new THREE.Vector3()).x;
    for(let v=0;v<a.position.count;v++)for(let k=0;k<4;k++){
      const anchor=anchorDelta[this.baseSkinIndex[v*4+k]];
      if(anchor)this.socketDistance[v*4+k]=growthDirection.fromArray(this.growthDelta,v*3).distanceTo(anchor)*meshScale;
    }
    const torso=new Set(['body','neck'].map(n=>mesh.skeleton.bones.indexOf(this.bones[n])));this.torsoVertices=[];
    for(let v=0;v<a.position.count;v++){
      let weight=0;for(let k=0;k<4;k++)if(torso.has(a.skinIndex.getComponent(v,k)))weight+=a.skinWeight.getComponent(v,k);
      if(weight>=RIG.TORSO_WEIGHT)this.torsoVertices.push(v);
    }
  }

  surfaceContact(direction,center,radii){
    const surface=this.surfaceMesh;
    surface.matrixWorld.copy(this.root.parent.matrixWorld).invert().multiply(this.skinned.matrixWorld);
    const shell=direction.clone().multiply(radii),origin=center.clone().addScaledVector(shell,2);
    this.surfaceRay.set(origin,shell.clone().normalize().negate());
    const inverse=new THREE.Matrix4().copy(surface.matrixWorld).invert();
    const hit=this.surfaceIndex.intersect(this.surfaceRay.ray.clone().applyMatrix4(inverse));
    if(!hit)return null;
    const ids=hit.ids,positions=this.skinned.geometry.attributes.position;
    const point=hit.point;
    const weights=THREE.Triangle.getBarycoord(point,...ids.map(i=>new THREE.Vector3().fromBufferAttribute(positions,i)),new THREE.Vector3());
    return {ids,weights:weights.toArray()};
  }

  contactPosition(contact,out){
    // Three sampled skin vertices follow the original belly and its animation;
    // a cached spherical radius left attachments behind when the skin jiggled.
    out.set(0,0,0);
    for(let i=0;i<3;i++)out.addScaledVector(this.skinned.getVertexPosition(contact.ids[i],this._contactVertex),contact.weights[i]);
    return out.applyMatrix4(this.skinned.matrixWorld).applyMatrix4(this._contactInverse.copy(this.root.parent.matrixWorld).invert());
  }

  /** Where each animated part's flesh sits, in the frame of `origin` — pass
   *  Jimothy's group and the walking and turning drop out, so anything left
   *  moving is the animation itself. That is the only way to see a bone pose
   *  from outside: the skinned path has no per-piece object to read a
   *  transform off, which is exactly what made it untestable (milestone 10).
   *
   *  Deliberately NOT a seam check. An earlier pass here measured the gap
   *  between adjacent parts, which looked like one — but triangles straddle
   *  the boundary between two bones, so a joint that STRETCHES separates those
   *  two vertex sets exactly as a torn one would. Measured 0.077 world units
   *  at the hip of a fat mid-roll Jimothy whose mesh was provably intact. Seam
   *  judgement stays with the playtest, where the milestone put it. */
  partOffsets(origin) {
    const out = {};
    const v = new THREE.Vector3();
    // Self-contained rather than relying on the caller having refreshed first:
    // this is read from render_game_to_text, whose field order should not be
    // load-bearing.
    origin.updateMatrixWorld(true);
    for (const name of TRACKED_PARTS) {
      if (!this.restParts[name]) continue;
      origin.worldToLocal(this.partCentroid(name, v));
      out[name] = { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) };
    }
    return out;
  }

  /** Every bone's WORLD scale, which is what decides rendered size — the thing
   *  Chris's "fatness grows the belly only" decision is actually about. Local
   *  scale would hide the bug it exists to catch: the inverse correction on a
   *  direct child cancels in world space, and a child corrected twice reads 1
   *  locally while rendering half-sized. */
  boneScales() {
    const out = {};
    const v = new THREE.Vector3();
    for (const [name, b] of Object.entries(this.bones)) {
      out[name] = +b.getWorldScale(v).x.toFixed(3);
    }
    return out;
  }

  _mountSkinned(gltf) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    // Same normalization the split path uses: scale to nose-to-tail length
    // and sit him on the ground.
    // Morph envelopes include a grown shape even when its weight is zero.
    // Normalise the untouched basis, or adding growth shrinks lean Jimothy.
    const box=new THREE.Box3();
    root.traverse(o=>{if(o.isMesh)box.union(new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld));});
    const size = box.getSize(new THREE.Vector3());
    const scale = RIG.TARGET_LENGTH / Math.max(size.x, size.y, size.z);
    root.scale.setScalar(scale);
    root.position.y = -box.min.y * scale;

    root.traverse((o) => {
      if (o.isBone) {
        this.bones[o.name] = o;
        // The bind orientation lives in the bone's quaternion. Every pose must
        // be composed against this, never written over it — assigning
        // `bone.rotation.x` the way the old slot code did collapses the
        // skeleton (measured: head and tail rest pointing opposite ways both
        // read identically once zeroed). See milestone 10.
        this.rest[o.name] = o.quaternion.clone();
        this.restPos[o.name] = o.position.clone();
      }
      if (o.isSkinnedMesh) {
        this.skinned = o;
        this.pieces.push(o);
        // Skinned bounds are computed from the rest pose, so a posed bone can
        // carry geometry outside it and get wrongly culled.
        o.frustumCulled = false;
      }
    });

    // Sibling of the slots, like the split path's leg pivots — the slots
    // themselves are only scaffolding for the placeholder now.
    this.slots.body.parent.add(root);
    this.root = root;
    this.baseScale = scale;
    this.baseY = root.position.y;
    this.bodyPiece = this.skinned;
    this._indexRestParts();
    this._prepareGrowth();
  }

  /** Bucket every vertex under the bone that dominates it, and keep each
   *  bucket's rest centroid and bounds. This is the skinned replacement for
   *  "which piece is this triangle in" — the split model answered that with
   *  seven separate meshes, and the attachment specs measured those. One mesh
   *  cannot be measured that way, but its weights say the same thing. */
  _indexRestParts() {
    const { position, skinIndex, skinWeight } = this.skinned.geometry.attributes;
    const bones = this.skinned.skeleton.bones;
    const acc = new Map();
    const p = new THREE.Vector3();
    for (let v = 0; v < position.count; v++) {
      let best = 0;
      let bestW = -1;
      for (let k = 0; k < 4; k++) {
        const w = skinWeight.getComponent(v, k);
        if (w > bestW) { bestW = w; best = skinIndex.getComponent(v, k); }
      }
      const name = bones[best]?.name;
      if (!name) continue;
      let e = acc.get(name);
      if (!e) acc.set(name, e = { sum: new THREE.Vector3(), n: 0, box: new THREE.Box3() });
      p.fromBufferAttribute(position, v);
      e.sum.add(p);
      e.n++;
      e.box.expandByPoint(p);
    }
    for (const [name, e] of acc) {
      this.restParts[name] = { centroid: e.sum.divideScalar(e.n), box: e.box };
    }
  }

  _mount(gltf) {
    const parts = new Map();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => { if (o.isMesh) parts.set(o.name, o); });

    // Normalize: scale to target length and sit him on the ground.
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = RIG.TARGET_LENGTH / Math.max(size.x, size.y, size.z);
    const groundOffset = -box.min.y * scale;

    for (const [name, mesh] of parts) {
      // Each piece's geometry is centred on its own origin and its position
      // says where it belongs (tools/prep_jimothy.py), so reassembly is just
      // "scale the offset and keep it".
      const home = mesh.position.clone().multiplyScalar(scale);
      home.y += groundOffset;
      mesh.scale.setScalar(scale);
      mesh.position.set(0, 0, 0);
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;

      if (LEG_NAMES.includes(name)) {
        // Legs swing from the hip, so the pivot goes at the TOP of the piece
        // and the mesh hangs below it.
        const pivot = new THREE.Object3D();
        pivot.position.set(home.x, home.y + bb.max.y * scale, home.z);
        mesh.position.set(0, -bb.max.y * scale, 0);
        pivot.add(mesh);
        // Sibling of the slots so hips don't inflate when he gets fat.
        this.slots.body.parent.add(pivot);
        this.legs[name] = { pivot, mesh, length: (bb.max.y - bb.min.y) * scale };
      } else {
        // Head and tail get their slot moved to them, so bob/wiggle pivot
        // about the piece itself rather than about the body's origin.
        const slot = this.slots[name] || this.slots.body;
        slot.userData.base.copy(home);
        slot.position.copy(home);
        slot.add(mesh);
        if (slot === this.slots.body) this.bodyPiece = mesh;
      }
      this.pieces.push(mesh);
    }
  }
}
