import * as THREE from 'three';
import { WORLD, COLORS, HIDE_SPOTS, VOXEL } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';

// Static block dressing: ground + perimeter curbs matching the physics walls
// in PhysicsSystem, plus hide-spot bushes. Houses and trees arrive in later
// milestones.
export class LevelBuilder {
  constructor(scene) {
    this.scene = scene;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.BLOCK_SIZE, WORLD.BLOCK_SIZE),
      new THREE.MeshStandardMaterial({ color: COLORS.GROUND }),
    );
    ground.rotation.x = -Math.PI / 2;
    // Sits below the voxel ground slab as bedrock/horizon fill — the walkable
    // surface is voxels now (ADR-0003), so craters expose this rather than
    // z-fighting with it.
    ground.position.y = -(VOXEL.GROUND_LAYERS + 2) * VOXEL.SIZE;
    scene.add(ground);

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
      bush.position.set(x, HIDE_SPOTS.RADIUS * 0.45, z);
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
