import * as THREE from 'three';
import {
  PAPARAZZI, ANIMAL_CONTROL, PURSUER_SPAWN_POINTS, COLORS, WORLD,
} from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Paparazzi (tier 1+) chase for photos and flash-stun at tier 2+; the animal
// controller (tier 3+) carries the net — the run's only ending. No physics
// bodies: pursuers steer meshes directly and everything is distance checks,
// which keeps them deterministic under advanceTime and immune to sleep bugs.
export class Pursuers {
  constructor(scene, jimothy, voxels = null) {
    this.scene = scene;
    this.jimothy = jimothy;
    // Only used to stand them on the ground for now. Milestone 19 wants it for
    // line of sight (a DDA march through the same grid).
    this.voxels = voxels;
    this.paparazzi = [];
    this.animalControl = null;
    this.spawnIndex = 0;
    // Shared across the whole pack so a crowd can't chain-stun the player.
    this.globalFlashCooldown = 0;

    this.bodyGeo = new THREE.CylinderGeometry(0.28, 0.32, 1.2, 10);
    this.headGeo = new THREE.SphereGeometry(0.22, 12, 10);
    this.netGeo = new THREE.TorusGeometry(0.45, 0.05, 6, 12);
    this.papMat = new THREE.MeshStandardMaterial({ color: COLORS.PAPARAZZO });
    this.acMat = new THREE.MeshStandardMaterial({ color: COLORS.ANIMAL_CONTROL });
    this.netMat = new THREE.MeshStandardMaterial({ color: COLORS.NET });
  }

  /** Where a new pursuer appears: on a ring around JIMOTHY, not at a fixed
   *  point on the map.
   *
   *  These used to be absolute coordinates at ±25, which worked only because
   *  the whole world was 500 units across and the player was never far from
   *  the middle of it. On the streamed 2000-unit map (milestone 12) a pursuer
   *  spawning at the origin had to jog up to 1400 units at 5 u/s to reach a
   *  player who had wandered — nearly five minutes — so heat escalated and
   *  nothing ever arrived. Four heat specs caught it, including
   *  `animal control nets jimothy`: the run had no lose condition at all
   *  away from spawn.
   *
   *  A ring keeps the pressure identical wherever he is, which is the point of
   *  a wanted system, and it means map size can grow without touching this
   *  again. The offsets are still fixed and cycled rather than random, so the
   *  approach stays deterministic under advanceTime. */
  _spawnPoint() {
    const p = PURSUER_SPAWN_POINTS[this.spawnIndex % PURSUER_SPAWN_POINTS.length];
    this.spawnIndex += 1;
    const jp = this.jimothy.group.position;
    const B = WORLD.BOUNDS;
    return [
      THREE.MathUtils.clamp(jp.x + p[0], -B, B),
      THREE.MathUtils.clamp(jp.z + p[1], -B, B),
    ];
  }

  _makePerson(mat, withNet) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeo, mat);
    body.position.y = 0.6;
    const head = new THREE.Mesh(this.headGeo, mat);
    head.position.y = 1.4;
    group.add(body, head);
    if (withNet) {
      const net = new THREE.Mesh(this.netGeo, this.netMat);
      net.position.set(0, 1.0, 0.55);
      group.add(net);
    }
    const [x, z] = this._spawnPoint();
    group.position.set(x, this._groundY(x, z), z);
    this.scene.add(group);
    return group;
  }

  /** The ground under a pursuer. They used to be pinned to y = 0, which was
   *  fine on a flat world and leaves them buried in a hillside or hovering over
   *  a valley on the island (milestone 17). */
  _groundY(x, z) {
    if (!this.voxels) return 0;
    const surface = this.voxels.terrainHeightAt(x, z);
    return this.voxels.groundHeightAt(x, z, surface + 1);
  }

  _steer(group, delta, speed) {
    const jp = this.jimothy.group.position;
    const dx = jp.x - group.position.x;
    const dz = jp.z - group.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-3) {
      group.rotation.y = Math.atan2(dx, dz);
      const step = Math.min(speed * delta, d);
      group.position.x += (dx / d) * step;
      group.position.z += (dz / d) * step;
      const B = WORLD.BOUNDS;
      group.position.x = THREE.MathUtils.clamp(group.position.x, -B, B);
      group.position.z = THREE.MathUtils.clamp(group.position.z, -B, B);
    }
    group.position.y = this._groundY(group.position.x, group.position.z);
    return d;
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    const tier = gameState.heat.tier;
    const hidden = gameState.player.hidden;

    // Head-count follows the tier; spawn/despawn to match.
    const targetPaparazzi =
      tier >= 2 ? PAPARAZZI.COUNT_TIER2 : tier >= 1 ? PAPARAZZI.COUNT_TIER1 : 0;
    while (this.paparazzi.length < targetPaparazzi) {
      this.paparazzi.push({
        group: this._makePerson(this.papMat, false),
        // Stagger first flashes so a tier-2 mob doesn't stun-lock in unison.
        flashCooldown: 1 + this.paparazzi.length * 0.7,
      });
    }
    while (this.paparazzi.length > targetPaparazzi) {
      this.scene.remove(this.paparazzi.pop().group);
    }
    if (tier >= ANIMAL_CONTROL.MIN_TIER && !this.animalControl) {
      this.animalControl = { group: this._makePerson(this.acMat, true) };
    }
    if (tier < ANIMAL_CONTROL.MIN_TIER && this.animalControl) {
      this.scene.remove(this.animalControl.group);
      this.animalControl = null;
    }

    // Hidden Jimothy is lost to them: everyone holds position, nobody
    // flashes, the net can't land — hiding must be a real pressure valve.
    const jp = this.jimothy.group.position;
    this.globalFlashCooldown -= delta;
    for (const pap of this.paparazzi) {
      pap.flashCooldown -= delta;
      if (hidden) continue;
      const dist = Math.hypot(jp.x - pap.group.position.x, jp.z - pap.group.position.z);
      // Photographers stop at photo range and loiter rather than dogpiling.
      const d = dist > PAPARAZZI.FLASH_RANGE * 0.8
        ? this._steer(pap.group, delta, PAPARAZZI.SPEED)
        : this._steer(pap.group, delta, 0);
      if (
        tier >= PAPARAZZI.MIN_TIER_FLASH &&
        d <= PAPARAZZI.FLASH_RANGE &&
        pap.flashCooldown <= 0 &&
        this.globalFlashCooldown <= 0
      ) {
        pap.flashCooldown = PAPARAZZI.FLASH_COOLDOWN;
        this.globalFlashCooldown = PAPARAZZI.GLOBAL_FLASH_COOLDOWN;
        eventBus.emit(Events.PLAYER_STUNNED, { seconds: PAPARAZZI.STUN_SECONDS });
      }
    }

    if (this.animalControl && !hidden) {
      const d = this._steer(this.animalControl.group, delta, ANIMAL_CONTROL.SPEED);
      if (d <= ANIMAL_CONTROL.NET_RANGE) {
        eventBus.emit(Events.PLAYER_NETTED);
      }
    }
  }

  reset() {
    for (const pap of this.paparazzi) this.scene.remove(pap.group);
    this.paparazzi = [];
    if (this.animalControl) {
      this.scene.remove(this.animalControl.group);
      this.animalControl = null;
    }
    this.spawnIndex = 0;
  }

  snapshot() {
    const out = this.paparazzi.map((p) => ({
      type: 'paparazzo',
      x: +p.group.position.x.toFixed(1),
      z: +p.group.position.z.toFixed(1),
    }));
    if (this.animalControl) {
      out.push({
        type: 'animal-control',
        x: +this.animalControl.group.position.x.toFixed(1),
        z: +this.animalControl.group.position.z.toFixed(1),
      });
    }
    return out;
  }
}
