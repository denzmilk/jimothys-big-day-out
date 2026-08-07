import * as THREE from 'three';
import { WORLD, COLORS, HIDE_SPOTS, TERRAIN } from '../core/Constants.js';
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
