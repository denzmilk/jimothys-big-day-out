import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_PATHS, RIG } from '../core/Constants.js';

import { eventBus, Events } from '../core/EventBus.js';

// Loads the Blender-prepped Jimothy: one GLB whose objects are already split
// into head / body / tail / four legs (see tools/prep_jimothy.py). The split
// used to happen at runtime by bucketing 800k triangles in the browser; doing
// it at build time made the model 9× smaller and the load instant.
const LEG_NAMES = ['leg_FL', 'leg_FR', 'leg_RL', 'leg_RR'];

export class JimothyRig {
  constructor(slots) {
    this.slots = slots; // { body, head, tail }
    this.loaded = false;
    this.pieces = [];
    this.legs = {};     // name -> { mesh, hipOffset, length }
    this.bodyPiece = null; // the mesh the belly-attachment check measures against

    this.bones = {};      // name -> Bone, when skinned
    this.skinned = null;  // the SkinnedMesh, when skinned

    const path = RIG.SKINNED ? ASSET_PATHS.JIMOTHY_SKINNED : ASSET_PATHS.JIMOTHY_MODEL;
    new GLTFLoader().loadAsync(path).then((gltf) => {
      if (RIG.SKINNED) this._mountSkinned(gltf);
      else this._mount(gltf);
      this.loaded = true;
      eventBus.emit(Events.RIG_LOADED, { pieces: this.pieces.length });
    }).catch((e) => console.error('JimothyRig load failed:', e));
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
      if (o.isBone) this.bones[o.name] = o;
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
