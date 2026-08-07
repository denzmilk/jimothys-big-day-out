import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_PATHS, RIG } from '../core/Constants.js';

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

  /** Pose a bone by a delta from its bind orientation, in the bone's own
   *  frame. The ONLY sanctioned way to move a bone here — see `rest`. */
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

  bellyBox(out = new THREE.Box3()) {
    return this.partBox('body', out);
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

  /** Let a leg splay outward with the belly without sliding forward or sinking.
   *
   *  Scaling `body` multiplies every direct child's local position by the same
   *  factor, in the BODY BONE's own frame. Measured from the four hips' bind
   *  positions, that frame is:
   *
   *    x  lateral   — flips sign between the L and R legs
   *    y  spine     — differs between the front and rear pairs, and is the
   *                   only non-zero component on `neck` and `head`
   *    z  drop      — spine down to the hip; identical on all four legs
   *
   *  Only x should ride out: a fat Jimothy standing wider is the bow-legged
   *  waddle. Letting y ride sent his front feet 1.25 out past a nose at 1.04,
   *  and letting z ride put them 0.2 UNDER the road at the current fatness
   *  ceiling — both measured. Undo those two, keep the splay.
   *
   *  `tail` needs none of this: its bind position is exactly [0,0,0], the body
   *  bone's own origin, so the belly grows forward and outward around it while
   *  the tail stays on the rump where it belongs. */
  splayLeg(name, belly) {
    const b = this.bones[name];
    const r = this.restPos[name];
    if (b && r) b.position.set(r.x, r.y / belly, r.z / belly);
  }

  /** Uniform-ish scale on a bone, from its bind scale. Used for fatness: the
   *  mesh is continuous, so scaling the body bone carries head, tail and legs
   *  with it — which is why the split path's anchoring code is deleted, not
   *  ported (JIM-15 cannot recur here). */
  scaleBone(name, x, y, z) {
    const b = this.bones[name];
    if (b) b.scale.set(x, y, z);
  }

  /** Skinned path (ADR-0004): the model arrives as one SkinnedMesh plus an
   *  armature, and must be mounted WHOLE — reparenting the mesh away from its
   *  skeleton root breaks the bind. The game then poses bones by name where it
   *  used to rotate slots. */
  _mountSkinned(gltf) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    // Same normalization the split path uses: scale to nose-to-tail length
    // and sit him on the ground.
    const box = new THREE.Box3().setFromObject(root);
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
    this.bodyPiece = this.skinned;
    this._indexRestParts();
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
