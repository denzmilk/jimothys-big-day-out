import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TRASH_CAN as TC, SNACKS, FOODS, PLAYER_CONFIG, COLORS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { DevOverrides } from '../core/DevOverrides.js';

// Cans are dynamic boxes (visual stays a cylinder): boxes tumble comically and
// are cheaper/stabler in cannon-es than convex cylinders. Snacks are
// non-physics pickups — distance checks beat rigid bodies for food scattered
// on the ground, and keep the spill ring deterministic for tests.
export class TrashCans {
  constructor(scene, physics, jimothy) {
    this.scene = scene;
    this.physics = physics;
    this.jimothy = jimothy;
    this.elapsed = 0;
    this._up = new CANNON.Vec3();

    this.snackGeo = new THREE.SphereGeometry(FOODS.SCRAP.RADIUS, 10, 8);
    this.snackMat = new THREE.MeshStandardMaterial({ color: COLORS.SNACK });
    // Feast = golden puck (a whole pizza in spirit).
    this.feastGeo = new THREE.CylinderGeometry(FOODS.FEAST.RADIUS, FOODS.FEAST.RADIUS, 0.12, 12);
    this.feastMat = new THREE.MeshStandardMaterial({ color: COLORS.FEAST });
    this.canGeo = new THREE.CylinderGeometry(TC.RADIUS + 0.02, TC.RADIUS - 0.03, TC.HEIGHT, 12);
    this.canMat = new THREE.MeshStandardMaterial({ color: COLORS.PLACEHOLDER_TRASH_CAN });

    this.cans = [];
    this.snacks = [];
    for (const [x, z] of DevOverrides.getCanLayout() ?? TC.POSITIONS) this.addCan(x, z);

    // DevTools level tools — panel emits, we own the entities.
    eventBus.on(Events.DEV_SPAWN_CAN, () => {
      const jp = this.jimothy.body.position;
      const yaw = this.jimothy.yaw;
      this.addCan(jp.x + Math.sin(yaw) * 2.5, jp.z + Math.cos(yaw) * 2.5);
      this._emitLayout();
    });
    eventBus.on(Events.DEV_REMOVE_CAN, () => {
      this.removeNearest();
      this._emitLayout();
    });
    eventBus.on(Events.DEV_RESET_CANS, () => {
      this.resetCans(TC.POSITIONS); // dev reset = back to shipped defaults
      this._emitLayout(null);
    });
    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'TRASH_CAN' && key === 'MASS') {
        for (const can of this.cans) {
          can.body.mass = TC.MASS;
          can.body.updateMassProperties();
        }
      }
    });
  }

  addCan(x, z) {
    const mesh = new THREE.Mesh(this.canGeo, this.canMat);
    this.scene.add(mesh);
    const body = new CANNON.Body({
      mass: TC.MASS,
      shape: new CANNON.Box(new CANNON.Vec3(TC.RADIUS, TC.HEIGHT / 2, TC.RADIUS)),
      position: new CANNON.Vec3(x, TC.HEIGHT / 2, z),
      linearDamping: 0.25,
      angularDamping: 0.25,
    });
    body.sleepSpeedLimit = 0.3;
    body.sleepTimeLimit = 0.6;
    this.physics.add(body, mesh);
    const can = { mesh, body, tipped: false, bonkCooldown: 0 };
    this.cans.push(can);
    return can;
  }

  removeCan(can) {
    this.physics.remove(can.body, can.mesh);
    this.scene.remove(can.mesh); // geometry/material shared — no dispose
    this.cans.splice(this.cans.indexOf(can), 1);
  }

  removeNearest() {
    const jp = this.jimothy.body.position;
    let best = null;
    let bd = Infinity;
    for (const can of this.cans) {
      const d = Math.hypot(can.body.position.x - jp.x, can.body.position.z - jp.z);
      if (d < bd) { bd = d; best = can; }
    }
    if (best) this.removeCan(best);
  }

  // Default layout honours a dev-tools layout override; the dev "reset"
  // button passes TC.POSITIONS explicitly to get back to shipped defaults.
  resetCans(layout = DevOverrides.getCanLayout() ?? TC.POSITIONS) {
    while (this.cans.length) this.removeCan(this.cans[0]);
    for (const [x, z] of layout) this.addCan(x, z);
  }

  clearSnacks() {
    for (const s of this.snacks) this.scene.remove(s.mesh);
    this.snacks = [];
  }

  reset() {
    this.resetCans();
    this.clearSnacks();
  }

  layout() {
    return this.cans.map((c) => [
      +c.body.position.x.toFixed(1),
      +c.body.position.z.toFixed(1),
    ]);
  }

  _emitLayout(layout = this.layout()) {
    eventBus.emit(Events.DEV_CANS_CHANGED, { layout });
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    this.elapsed += delta;
    const jp = this.jimothy.body.position;
    const jspeed = this.jimothy.speed;

    for (const can of this.cans) {
      if (can.bonkCooldown > 0) can.bonkCooldown -= delta;
      if (can.tipped) continue;
      const cp = can.body.position;
      const d = Math.hypot(cp.x - jp.x, cp.z - jp.z);
      if (
        can.bonkCooldown <= 0 &&
        jspeed > PLAYER_CONFIG.BONK_MIN_SPEED &&
        d < TC.RADIUS + PLAYER_CONFIG.RADIUS + 0.25
      ) {
        const nx = (cp.x - jp.x) / (d || 1);
        const nz = (cp.z - jp.z) / (d || 1);
        can.body.wakeUp();
        // Impulse lands above the centre of mass so the can topples instead of sliding.
        can.body.applyImpulse(
          new CANNON.Vec3(nx * TC.BONK_IMPULSE, TC.BONK_LIFT, nz * TC.BONK_IMPULSE),
          new CANNON.Vec3(cp.x, cp.y + TC.HEIGHT * 0.4, cp.z),
        );
        can.bonkCooldown = TC.BONK_COOLDOWN_SECONDS;
      }
      can.body.quaternion.vmult(CANNON.Vec3.UNIT_Y, this._up);
      if (this._up.y < TC.TIP_UP_DOT) {
        can.tipped = true;
        this.spillFrom(can);
        eventBus.emit(Events.CAN_TIPPED, { x: cp.x, z: cp.z });
      }
    }

    for (let i = this.snacks.length - 1; i >= 0; i--) {
      const s = this.snacks[i];
      s.mesh.position.y = 0.18 + Math.sin(this.elapsed * SNACKS.BOB_HZ + s.phase) * 0.05;
      const d = Math.hypot(s.mesh.position.x - jp.x, s.mesh.position.z - jp.z);
      if (s.type === 'feast') {
        // Feasts are a commitment: stand within reach, nearly still, and chomp
        // through the channel. Wander off (or get stunned into a stagger) and
        // the progress is gone.
        const eating =
          d < FOODS.FEAST.REACH &&
          this.jimothy.speed < FOODS.FEAST.EAT_MAX_SPEED &&
          !gameState.player.stunned;
        if (eating) {
          if (s.progress === 0) eventBus.emit(Events.PLAYER_EATING, {});
          s.progress += delta;
          s.mesh.rotation.y += delta * 6; // spinning pizza = being devoured
          if (s.progress >= FOODS.FEAST.CHANNEL_SECONDS) {
            this.scene.remove(s.mesh);
            this.snacks.splice(i, 1);
            const name = FOODS.FEAST.NAMES[Math.floor(Math.random() * FOODS.FEAST.NAMES.length)];
            eventBus.emit(Events.PLAYER_PICKUP, {
              name, points: FOODS.FEAST.POINTS, fat: FOODS.FEAST.FAT,
            });
          }
        } else if (s.progress > 0) {
          s.progress = 0;
        }
      } else if (d < PLAYER_CONFIG.PICKUP_RADIUS) {
        // Geometry/material are shared across all snacks — remove, don't dispose.
        this.scene.remove(s.mesh);
        this.snacks.splice(i, 1);
        const name = SNACKS.NAMES[Math.floor(Math.random() * SNACKS.NAMES.length)];
        eventBus.emit(Events.PLAYER_PICKUP, {
          name, points: FOODS.SCRAP.POINTS, fat: FOODS.SCRAP.FAT,
        });
      }
    }
  }

  spillFrom(can) {
    const cp = can.body.position;
    for (let k = 0; k < SNACKS.SCRAPS_PER_CAN; k++) {
      const a = (k / SNACKS.SCRAPS_PER_CAN) * Math.PI * 2;
      const mesh = new THREE.Mesh(this.snackGeo, this.snackMat);
      mesh.position.set(
        cp.x + Math.cos(a) * SNACKS.SCATTER_RADIUS,
        0.18,
        cp.z + Math.sin(a) * SNACKS.SCATTER_RADIUS,
      );
      this.scene.add(mesh);
      this.snacks.push({ mesh, phase: k, type: 'scrap' });
    }
    for (let k = 0; k < SNACKS.FEASTS_PER_CAN; k++) {
      const mesh = new THREE.Mesh(this.feastGeo, this.feastMat);
      mesh.position.set(
        cp.x + SNACKS.FEAST_OFFSET[0] * (k + 1),
        0.18,
        cp.z + SNACKS.FEAST_OFFSET[1] * (k + 1),
      );
      this.scene.add(mesh);
      this.snacks.push({ mesh, phase: k, type: 'feast', progress: 0 });
    }
  }
}
