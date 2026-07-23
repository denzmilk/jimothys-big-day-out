import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PLAYER_CONFIG as P, WORLD, COLORS } from '../core/Constants.js';
import { dampAngle } from '../core/MathUtils.js';

// Kinematic under player control (ADR-0002): cannon integrates position from
// the velocity we set, which is what lets him shove dynamic cans around.
// Kinematic bodies ignore static geometry, so ground/bounds are clamped by
// hand in postUpdate.
export class JimothyController {
  constructor(scene, physics, input) {
    this.input = input;
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.PLACEHOLDER_JIMOTHY });
    this.bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), mat);
    this.bodyMesh.scale.set(1.0, 0.8, 0.9);
    this.bodyMesh.position.y = 0.5;
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), mat);
    this.headMesh.position.set(0, 0.35, 0.45);
    this.group.add(this.bodyMesh, this.headMesh);
    scene.add(this.group);

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
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  update(delta, cameraYaw) {
    this.elapsed += delta;
    const speed = this.input.scurry ? P.SCURRY_SPEED : P.SPEED;
    const dvMax = P.ACCEL * delta;
    // Camera-relative input: W is always "away from the camera". Screen
    // forward is (sin ψ, cos ψ), screen right is (-cos ψ, sin ψ), where ψ is
    // the follow/orbit camera yaw fed in by the orchestrator.
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const wx = this.input.moveX * -cos + -this.input.moveZ * sin;
    const wz = this.input.moveX * sin + -this.input.moveZ * cos;
    this.vel.x += THREE.MathUtils.clamp(wx * speed - this.vel.x, -dvMax, dvMax);
    this.vel.z += THREE.MathUtils.clamp(wz * speed - this.vel.z, -dvMax, dvMax);

    if (this.input.consumeHop() && this.grounded) {
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

    const moving = this.speed > 0.3;
    if (moving) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), P.TURN_SPEED, delta);
    }
    this.group.rotation.y = this.yaw;

    // Waddle: bob + roll scale with speed, tiny at idle so he never sits dead still.
    const speedNorm = 0.3 + 0.7 * Math.min(1, this.speed / P.SPEED);
    this.bodyMesh.position.y =
      0.5 + Math.abs(Math.sin(this.elapsed * P.WADDLE_BOB_HZ)) * P.WADDLE_BOB_AMPLITUDE * speedNorm;
    this.bodyMesh.rotation.z = Math.sin(this.elapsed * P.WADDLE_BOB_HZ) * 0.08 * speedNorm;
  }
}
