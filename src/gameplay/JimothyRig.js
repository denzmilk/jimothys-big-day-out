import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_PATHS, RIG } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';

// Runtime model splitter: loads the single full-Jimothy Meshy GLB and cuts it
// into head/body/tail by bucketing triangles against two z-planes (Meshy free
// can't generate pieces, and we refuse to depend on Blender). Jagged cut
// edges hide inside piece overlap — slop-approved. Pieces are re-centered to
// their centroids so the slots they land in pivot naturally.
export class JimothyRig {
  constructor(slots) {
    this.slots = slots; // { body, head, tail } groups owned by the controller
    this.loaded = false;
    this.pieces = [];
    this._resplitTimer = null;

    new GLTFLoader().loadAsync(ASSET_PATHS.JIMOTHY_MODEL).then((gltf) => {
      this.gltf = gltf;
      this._split();
      this.loaded = true;
    }).catch((e) => console.error('JimothyRig load failed:', e));

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group }) => {
      if (group !== 'RIG' || !this.gltf) return;
      clearTimeout(this._resplitTimer);
      // Debounced: an 800k-tri re-bucket per slider tick would chug.
      this._resplitTimer = setTimeout(() => this._split(), 200);
    });
  }

  _split() {
    const meshes = [];
    this.gltf.scene.updateMatrixWorld(true);
    this.gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });

    const box = new THREE.Box3().setFromObject(this.gltf.scene);
    const len = box.max.z - box.min.z;
    const s = RIG.TARGET_LENGTH / len;
    const yOff = -box.min.y * s;
    const zMin = box.min.z * s;
    const zMax = box.max.z * s;
    const zLen = zMax - zMin;
    const noseAtMax = RIG.NOSE_POSITIVE_Z >= 0.5;
    const neckZ = noseAtMax ? zMax - RIG.NECK_FRAC * zLen : zMin + RIG.NECK_FRAC * zLen;
    const tailZ = noseAtMax ? zMin + RIG.TAIL_FRAC * zLen : zMax - RIG.TAIL_FRAC * zLen;

    // position/normal/uv triples bucketed per piece, non-indexed.
    const buckets = { head: [], body: [], tail: [] };
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    for (const mesh of meshes) {
      const geo = mesh.geometry;
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const uv = geo.attributes.uv;
      const idx = geo.index;
      const triCount = (idx ? idx.count : pos.count) / 3;
      nm.getNormalMatrix(mesh.matrixWorld);
      const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
      for (let t = 0; t < triCount; t++) {
        const ids = [vi(t, 0), vi(t, 1), vi(t, 2)];
        let cz = 0;
        const verts = ids.map((i) => {
          v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          const out = [v.x * s, v.y * s + yOff, v.z * s];
          cz += out[2] / 3;
          return out;
        });
        const side = noseAtMax
          ? (cz > neckZ ? 'head' : cz < tailZ ? 'tail' : 'body')
          : (cz < neckZ ? 'head' : cz > tailZ ? 'tail' : 'body');
        const b = buckets[side];
        for (let k = 0; k < 3; k++) {
          const i = ids[k];
          n.fromBufferAttribute(norm, i).applyMatrix3(nm);
          b.push(
            verts[k][0], verts[k][1], verts[k][2],
            n.x, n.y, n.z,
            uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0,
          );
        }
      }
    }

    const material = meshes[0].material;
    for (const piece of this.pieces) {
      piece.parent.remove(piece);
      piece.geometry.dispose(); // material/texture shared with the gltf — keep
    }
    this.pieces = [];

    for (const [name, data] of Object.entries(buckets)) {
      if (!data.length) continue;
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(data);
      geo.setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(arr, 8), 3, 0));
      geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(arr, 8), 3, 3));
      geo.setAttribute('uv', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(arr, 8), 2, 6));
      geo.computeBoundingSphere();
      const centroid = geo.boundingSphere.center.clone();
      geo.translate(-centroid.x, -centroid.y, -centroid.z);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      const slot = this.slots[name];
      // Body stays slot-relative at its centroid; head/tail slots MOVE to
      // their centroids so bob/wiggle pivot around the piece itself.
      if (name === 'body') {
        mesh.position.copy(centroid);
      } else {
        slot.userData.base.copy(centroid);
      }
      slot.add(mesh);
      this.pieces.push(mesh);
    }
    eventBus.emit(Events.RIG_LOADED, { pieces: this.pieces.length });
  }
}
