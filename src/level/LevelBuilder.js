import * as THREE from 'three';
import { WORLD, COLORS, HIDE_SPOTS, TERRAIN, HORIZON } from '../core/Constants.js';
import * as Terrain from './Terrain.js';
import * as Masterplan from './CityPlanner.js';
import { eventBus, Events } from '../core/EventBus.js';

// Static block dressing: the sea, hide-spot bushes, and the perimeter curbs
// matching the physics walls in PhysicsSystem.
export class LevelBuilder {
  constructor(scene, voxels = null) {
    this.scene = scene;
    this.voxels = voxels;
    // The sea, at y = 0. One flat plane and one draw call — milestone 17 owns
    // the SHAPE of the coast, milestone 14 owns the surface (waves, and the
    // fairy godmother who bubbles you ashore). Until then this is what makes
    // walking off the edge read as water rather than as falling off the world.
    // It replaces the old green horizon plane, which was a flat world's answer
    // to "what is under the voxels" and is now just the seabed.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.BOUNDS * 4, WORLD.BOUNDS * 4),
      new THREE.MeshStandardMaterial({
        color: COLORS.SEA,
        transparent: true,
        opacity: 0.72,
        roughness: 0.25,
        metalness: 0.1,
      }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = TERRAIN.SEA_LEVEL;
    // Rendered after the terrain so the shallows show through it rather than
    // being z-sorted away.
    sea.renderOrder = 1;
    scene.add(sea);

    this.buildHorizon();

    // Bushes mark the hide spots; translucent so Jimothy reads through them.
    const bushGeo = new THREE.SphereGeometry(HIDE_SPOTS.RADIUS, 12, 8);
    const bushMat = new THREE.MeshStandardMaterial({
      color: COLORS.BUSH,
      transparent: true,
      opacity: 0.75,
    });
    for (const [x, z] of HIDE_SPOTS.POSITIONS) {
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.scale.y = 0.7;
      // On the hillside it stands on, not at a height that used to mean grade.
      const ground = voxels ? voxels.terrainHeightAt(x, z) : 0;
      bush.position.set(x, ground + HIDE_SPOTS.RADIUS * 0.45, z);
      scene.add(bush);
    }

    this.wallMat = new THREE.MeshStandardMaterial({ color: COLORS.WALL });
    this.walls = [];
    this.buildWalls();

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'WORLD' && key === 'BOUNDS') this.buildWalls();
    });
  }

  /** The whole island, once, at low resolution.
   *
   *  Built from the SAME baked height field the voxels are generated from, so
   *  it cannot disagree with them about where a hill is — it is the same
   *  function sampled coarsely. Sits `HORIZON.DROP` below the true surface, so
   *  the real voxel ground always wins the depth test where it exists and this
   *  is only ever seen past the streaming boundary.
   *
   *  One draw call for 2 km of island. Adding one more ring of voxel columns to
   *  see 35 m further costs far more than this does to see all of it (JIM-34). */
  buildHorizon() {
    const B = Terrain.BOUNDS;
    const step = HORIZON.STEP;
    const n = Math.floor((B * 2) / step) + 1;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const c = new THREE.Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -B + i * step;
        const z = -B + j * step;
        const h = Terrain.surfaceHeight(x, z);
        const k = (j * n + i) * 3;
        pos[k] = x;
        pos[k + 1] = h - HORIZON.DROP;
        pos[k + 2] = z;
        // Roads read from the air — it is most of what makes a district legible
        // from up there — and the shoreline needs to be sand rather than a hard
        // green-to-blue edge.
        if (h < TERRAIN.SEA_LEVEL) c.setHex(HORIZON.DEEP);
        else if (h < TERRAIN.SEA_LEVEL + 1.6) c.setHex(HORIZON.SAND);
        else c.setHex(Masterplan.isRoad(x, z) ? HORIZON.ROAD : HORIZON.LAND);
        // A touch of height shading, so hills have relief at a distance the
        // directional sun cannot give a mesh this coarse.
        const lift = 1 + Math.max(0, h) * 0.004;
        col[k] = Math.min(1, c.r * lift);
        col[k + 1] = Math.min(1, c.g * lift);
        col[k + 2] = Math.min(1, c.b * lift);
      }
    }
    const index = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        index.push(a, a + n, a + n + 1, a, a + n + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    this.horizon = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    );
    this.horizon.renderOrder = -1;
    this.scene.add(this.horizon);
  }

  buildWalls() {
    for (const wall of this.walls) {
      this.scene.remove(wall);
      wall.geometry.dispose();
    }
    this.walls = [];
    const B = WORLD.BOUNDS;
    const t = 1;
    for (const [x, z, sx, sz] of [
      [0, -B - t, B + t * 2, t], [0, B + t, B + t * 2, t],
      [-B - t, 0, t, B + t * 2], [B + t, 0, t, B + t * 2],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx * 2, 1.2, sz * 2), this.wallMat);
      wall.position.set(x, 0.6, z);
      this.scene.add(wall);
      this.walls.push(wall);
    }
  }
}
