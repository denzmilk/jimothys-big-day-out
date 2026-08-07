import * as THREE from 'three';
import { TREASURE, VOXEL, STREAM } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Treasure you can't do anything with (milestone 18).
//
// > "treasure that you can't do anything with" — Chris. The joke IS the
// > uselessness.
//
// They score nothing, weigh nothing, buy nothing and do nothing. **Do not let
// anyone gameplay-ify them later** — the moment they buy something they stop
// being funny. Where they pay off is the photo book (JIM-31): a game-over
// spread of everything you dug up on your big day out is worth more than points
// would be. And they give digging a reason without giving it a reward, which is
// a nicer economy than it sounds.
//
// Placement is a pure function of WHERE, exactly like the containers: a find's
// existence and identity are properties of its coordinates, so it is the same
// find however the player arrives at it, and none of it has to be stored.
//
// They are only FOUND once the voxel they are buried in has become air — dug
// out, or already hollow because they were lying in a sewer. That is what makes
// them treasure rather than pickups.
export class Treasures {
  constructor(scene, jimothy, voxels) {
    this.scene = scene;
    this.jimothy = jimothy;
    this.voxels = voxels;
    this.live = new Map(); // id -> { mesh, x, y, z, name }
    this.geo = new THREE.IcosahedronGeometry(TREASURE.RADIUS, 0);
    this.mat = new THREE.MeshStandardMaterial({
      color: TREASURE.COLOR, roughness: 0.35, metalness: 0.55,
      emissive: TREASURE.COLOR, emissiveIntensity: 0.35,
    });
    this.elapsed = 0;
    // Ids already in the book, so a find is never streamed back in behind you.
    this.collected = new Set();
  }

  /** Every find whose burial spot falls in the box. Hashed per cell, so this is
   *  a lookup rather than a list to maintain. */
  _in(minX, minZ, maxX, maxZ) {
    const out = [];
    const STEP = TREASURE.SPACING;
    for (let x = Math.floor(minX / STEP) * STEP; x <= maxX; x += STEP) {
      for (let z = Math.floor(minZ / STEP) * STEP; z <= maxZ; z += STEP) {
        const h = hash(x, z);
        if ((h % 1000) / 1000 > TREASURE.SHARE) continue;
        const surface = this.voxels.terrainHeightAt(x, z);
        if (surface < TREASURE.MIN_GROUND) continue; // not at sea, not on a beach
        // Buried between the topsoil and the sewers. Anything on the sewer line
        // ends up lying ON the tunnel floor, which is where you stumble over
        // one rather than dig it up.
        const depth = TREASURE.MIN_DEPTH
          + (((h >>> 10) & 1023) / 1024) * (TREASURE.MAX_DEPTH - TREASURE.MIN_DEPTH);
        out.push({
          id: `t${Math.round(x)},${Math.round(z)}`,
          x, z, y: surface - depth,
          name: TREASURE.NAMES[h % TREASURE.NAMES.length],
        });
      }
    }
    return out;
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    this.elapsed += delta;
    const jp = this.jimothy.group.position;
    const R = STREAM.LOAD_RADIUS * VOXEL.CHUNK_XZ * VOXEL.SIZE;

    // Stream the ones near him, skipping anything already in the book.
    const wanted = new Set();
    for (const t of this._in(jp.x - R, jp.z - R, jp.x + R, jp.z + R)) {
      if (this.collected.has(t.id)) continue;
      wanted.add(t.id);
      if (this.live.has(t.id)) continue;
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.position.set(t.x, t.y, t.z);
      // Hidden until the rock around it is gone: a find glinting through solid
      // ground would be a waypoint, and these are supposed to be a surprise.
      mesh.visible = false;
      this.scene.add(mesh);
      this.live.set(t.id, { ...t, mesh });
    }
    for (const [id, t] of [...this.live]) {
      if (wanted.has(id)) continue;
      this.scene.remove(t.mesh);
      this.live.delete(id);
    }

    for (const [id, t] of [...this.live]) {
      const exposed = !this.voxels.solidAtWorld(t.x, t.y, t.z);
      t.mesh.visible = exposed;
      if (!exposed) continue;
      t.mesh.rotation.y += delta * 1.4;
      t.mesh.position.y = t.y + Math.sin(this.elapsed * 1.8) * 0.06;
      const d = Math.hypot(jp.x - t.x, jp.y - t.y, jp.z - t.z);
      if (d > TREASURE.REACH) continue;
      // Found. No score, no fat, no heat — see the note at the top of this file.
      this.collected.add(id);
      gameState.player.finds.push(t.name);
      eventBus.emit(Events.TREASURE_FOUND, { name: t.name, x: t.x, z: t.z });
      this.scene.remove(t.mesh);
      this.live.delete(id);
    }
  }

  reset() {
    for (const t of this.live.values()) this.scene.remove(t.mesh);
    this.live.clear();
    this.collected.clear();
  }

  snapshot() {
    return {
      // What is currently dug out and glinting, and what is in the book.
      exposed: [...this.live.values()].filter((t) => t.mesh.visible).length,
      found: gameState.player.finds.length,
    };
  }
}

function hash(x, z) {
  let h = (Math.imul(Math.round(x), 2654435761) ^ Math.imul(Math.round(z), 340573321)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}
