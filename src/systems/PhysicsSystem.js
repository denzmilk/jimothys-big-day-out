import * as CANNON from 'cannon-es';
import { WORLD } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';

// Owns the cannon-es world (ADR-0002). Fixed-step accumulator keeps
// advanceTime(1/60 steps) exactly one world.step per update — deterministic
// for the test harness regardless of render frame rate.
export class PhysicsSystem {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -WORLD.GRAVITY, 0) });
    this.world.allowSleep = true;
    this.fixedStep = 1 / 60;
    this.accumulator = 0;
    this.pairs = [];
    this.wallBodies = [];

    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);

    this.buildWalls();

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'WORLD' && key === 'GRAVITY') this.world.gravity.y = -WORLD.GRAVITY;
      if (group === 'WORLD' && key === 'BOUNDS') this.buildWalls();
    });
  }

  // Perimeter walls just outside WORLD.BOUNDS so bonked cans stay on the
  // block. Rebuilt live when the DevTools bounds slider moves.
  buildWalls() {
    for (const wall of this.wallBodies) this.world.removeBody(wall);
    this.wallBodies = [];
    const B = WORLD.BOUNDS;
    const t = 1;
    const h = 2;
    for (const [x, z, sx, sz] of [
      [0, -B - t, B + t * 2, t], [0, B + t, B + t * 2, t],
      [-B - t, 0, t, B + t * 2], [B + t, 0, t, B + t * 2],
    ]) {
      const wall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(sx, h, sz)),
        position: new CANNON.Vec3(x, h, z),
      });
      this.world.addBody(wall);
      this.wallBodies.push(wall);
    }
  }

  add(body, mesh = null) {
    this.world.addBody(body);
    if (mesh) this.pairs.push({ body, mesh });
  }

  remove(body, mesh = null) {
    this.world.removeBody(body);
    if (mesh) {
      const i = this.pairs.findIndex((p) => p.body === body);
      if (i !== -1) this.pairs.splice(i, 1);
    }
  }

  update(delta) {
    this.accumulator += delta;
    while (this.accumulator >= this.fixedStep - 1e-9) {
      this.world.step(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
    for (const { body, mesh } of this.pairs) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }
}
