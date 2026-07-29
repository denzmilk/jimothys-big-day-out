import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  PLAYER_CONFIG as P, WORLD, COLORS, HIDE_SPOTS, FATNESS, FOODS,
} from '../core/Constants.js';
import { dampAngle } from '../core/MathUtils.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { JimothyRig } from './JimothyRig.js';
import { JimothyLegs } from './JimothyLegs.js';

// Kinematic under player control (ADR-0002): cannon integrates position from
// the velocity we set, which is what lets him shove dynamic cans around.
// Kinematic bodies ignore static geometry, so ground/bounds are clamped by
// hand in postUpdate.
//
// Visuals live in three SLOTS (body/head/tail) so the runtime-split Meshy rig
// drops into the same animation the placeholder primitives use. Legs are
// procedural stretchy tubes (JimothyLegs).
export class JimothyController {
  constructor(scene, physics, input) {
    this.input = input;
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.PLACEHOLDER_JIMOTHY,
      transparent: true,
    });
    this.materials = [mat]; // everything that fades when hidden

    const mkSlot = (base) => {
      const slot = new THREE.Group();
      slot.userData.base = new THREE.Vector3(...base);
      slot.position.copy(slot.userData.base);
      this.group.add(slot);
      return slot;
    };
    this.bodySlot = mkSlot([0, 0, 0]);
    this.headSlot = mkSlot([0, 0.35, 0.45]);
    this.tailSlot = mkSlot([0, 0.4, -0.5]);

    this.bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), mat);
    this.bodyMesh.scale.set(1.0, 0.8, 0.9);
    this.bodyMesh.position.y = 0.5;
    this.bodySlot.add(this.bodyMesh);
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), mat);
    this.headSlot.add(this.headMesh);
    scene.add(this.group);

    this.placeholderHidden = false;
    // Gameplay specs skip the 40 MB / 800k-tri rig — software-rendering it in
    // headless workers slows every advanceTime render to a crawl. Only
    // rig.spec boots with the model.
    this.rig = window.__SKIP_RIG__
      ? { loaded: false, pieces: [] }
      : new JimothyRig({ body: this.bodySlot, head: this.headSlot, tail: this.tailSlot });
    eventBus.on(Events.RIG_LOADED, () => {
      this.bodyMesh.visible = false;
      this.headMesh.visible = false;
      this.placeholderHidden = true;
      const rigMat = this.rig.pieces[0]?.material;
      if (rigMat && !this.materials.includes(rigMat)) {
        rigMat.transparent = true;
        this.materials.push(rigMat);
      }
    });
    this.legs = new JimothyLegs(scene, this);

    this.body = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Sphere(P.RADIUS),
      position: new CANNON.Vec3(0, P.RADIUS, 0),
    });
    // cannon-es puts idle bodies to sleep after ~1s and a sleeping kinematic
    // body ignores velocity forever — the "moved once, then never again" bug.
    // The player must never sleep; cans still may (perf).
    this.body.allowSleep = false;
    physics.add(this.body);

    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.grounded = true;
    // Face -z (away from the boot camera) so the follow cam starts where the
    // placeholder scene's did.
    this.yaw = Math.PI;
    this.group.rotation.y = this.yaw;
    this.elapsed = 0;
    this.stunTimer = 0;
    // Damped jiggle spring: every bite kicks it, big bites kick it harder.
    this.jiggleAmp = 0;
    this.widthScale = 1;

    eventBus.on(Events.PLAYER_STUNNED, ({ seconds }) => {
      if (!gameState.game.isPlaying) return;
      this.stunTimer = seconds;
      gameState.player.stunned = true;
    });
    eventBus.on(Events.PLAYER_PICKUP, ({ fat }) => {
      this.jiggleAmp += fat >= FOODS.FEAST.FAT ? FATNESS.KICK_FEAST : FATNESS.KICK_SCRAP;
    });
  }

  reset() {
    this.body.position.set(0, P.RADIUS, 0);
    this.body.velocity.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
    this.yaw = Math.PI;
    this.stunTimer = 0;
    this.jiggleAmp = 0;
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, this.yaw, 0);
    this.legs.reset();
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  update(delta, cameraYaw) {
    this.elapsed += delta;
    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      if (this.stunTimer <= 0) gameState.player.stunned = false;
    }
    // Stunned or run-over: input dies, momentum bleeds out.
    const controllable = gameState.game.isPlaying && !gameState.player.stunned;
    // Fat trade-off #1: the blob waddles slower (same asymptotic factor as
    // the body visuals, so what you see is what you pay).
    const f = gameState.player.fatness / (gameState.player.fatness + FATNESS.SOFTCAP);
    const speed =
      (this.input.scurry ? P.SCURRY_SPEED : P.SPEED) * (1 - f * FATNESS.SPEED_PENALTY_MAX);
    const dvMax = P.ACCEL * delta;
    // Camera-relative input: W is always "away from the camera". Screen
    // forward is (sin ψ, cos ψ), screen right is (-cos ψ, sin ψ), where ψ is
    // the follow/orbit camera yaw fed in by the orchestrator.
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const wx = controllable ? this.input.moveX * -cos + -this.input.moveZ * sin : 0;
    const wz = controllable ? this.input.moveX * sin + -this.input.moveZ * cos : 0;
    this.vel.x += THREE.MathUtils.clamp(wx * speed - this.vel.x, -dvMax, dvMax);
    this.vel.z += THREE.MathUtils.clamp(wz * speed - this.vel.z, -dvMax, dvMax);

    if (this.input.consumeHop() && this.grounded && controllable) {
      this.vy = P.HOP_FORCE;
      this.grounded = false;
    }
    if (!this.grounded) this.vy -= P.HOP_GRAVITY * delta;

    this.body.velocity.set(this.vel.x, this.vy, this.vel.z);
  }

  postUpdate(delta) {
    const p = this.body.position;
    p.x = THREE.MathUtils.clamp(p.x, -WORLD.BOUNDS, WORLD.BOUNDS);
    p.z = THREE.MathUtils.clamp(p.z, -WORLD.BOUNDS, WORLD.BOUNDS);
    if (p.y <= P.RADIUS) {
      p.y = P.RADIUS;
      if (this.vy < 0) this.vy = 0;
      this.grounded = true;
    }
    this.group.position.set(p.x, p.y - P.RADIUS, p.z);

    // In a bush = hidden: heat drains, pursuers lose him. Fade him so the
    // player can read the state at a glance. Fat trade-off #2: the wider he
    // is, the deeper into the bush he must squeeze — past a point the blob
    // simply doesn't fit and bushes stop working entirely.
    const fat = gameState.player.fatness / (gameState.player.fatness + FATNESS.SOFTCAP);
    const width = 1 + fat * FATNESS.MAX_WIDTH_GAIN;
    const hideRadius = Math.max(0, HIDE_SPOTS.RADIUS - (width - 1) * FATNESS.HIDE_SQUEEZE);
    let hidden = false;
    for (const [hx, hz] of HIDE_SPOTS.POSITIONS) {
      if (Math.hypot(p.x - hx, p.z - hz) < hideRadius) { hidden = true; break; }
    }
    gameState.player.hidden = hidden;
    for (const m of this.materials) m.opacity = hidden ? 0.5 : 1;

    const moving = this.speed > 0.3;
    if (moving) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), P.TURN_SPEED, delta);
    }
    this.group.rotation.y = this.yaw;

    // Waddle: bob + roll on the body slot, scaled by speed; a stun overrides
    // with a full-body comedy wobble. Head bobs off-phase; tail wiggles.
    const speedNorm = 0.3 + 0.7 * Math.min(1, this.speed / P.SPEED);
    const bodyBase = this.bodySlot.userData.base;
    this.bodySlot.position.set(
      bodyBase.x,
      bodyBase.y + Math.abs(Math.sin(this.elapsed * P.WADDLE_BOB_HZ)) * P.WADDLE_BOB_AMPLITUDE * speedNorm,
      bodyBase.z,
    );
    this.bodySlot.rotation.z = gameState.player.stunned
      ? Math.sin(this.elapsed * 24) * 0.3
      : Math.sin(this.elapsed * P.WADDLE_BOB_HZ) * 0.08 * speedNorm;

    const headBase = this.headSlot.userData.base;
    this.headSlot.position.set(
      headBase.x,
      headBase.y + Math.abs(Math.sin(this.elapsed * P.WADDLE_BOB_HZ + 0.9)) * P.WADDLE_BOB_AMPLITUDE * 0.7 * speedNorm,
      headBase.z,
    );
    this.tailSlot.rotation.y = Math.sin(this.elapsed * 10) * 0.35 * speedNorm;

    // Fatness: asymptotic wide-load growth on the body slot only (tiny head
    // on an enormous body IS the meme), plus the bite-kicked jiggle spring
    // and a continuous jelly wobble while waddling.
    this.jiggleAmp = Math.max(0, this.jiggleAmp - this.jiggleAmp * FATNESS.JIGGLE_DAMPING * delta);
    const jelly = fat * FATNESS.JELLY * Math.min(1, this.speed / P.SPEED);
    const wobble = Math.sin(this.elapsed * FATNESS.JIGGLE_HZ * Math.PI * 2) * (this.jiggleAmp + jelly);
    const height = 1 + fat * FATNESS.MAX_HEIGHT_GAIN;
    this.widthScale = width;
    this.bodySlot.scale.set(
      width * (1 + wobble),
      height * (1 - wobble * 0.6),
      width * (1 - wobble * 0.3),
    );

    this.legs.update(delta);
  }
}
