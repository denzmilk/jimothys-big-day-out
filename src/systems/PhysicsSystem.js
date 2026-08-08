import * as CANNON from 'cannon-es';
import { WORLD, PHYSICS, VOXEL } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';

// Owns the cannon-es world (ADR-0002). Fixed-step accumulator keeps
// advanceTime(1/60 steps) exactly one world.step per update — deterministic
// for the test harness regardless of render frame rate.
//
// The world it steps contains almost no static geometry, and that is on
// purpose: the voxel city has NO colliders (ADR-0003). Dynamic bodies are
// clamped against the grid after each step instead — see `_groundBodies`, and
// JIM-42 for what happened during the eleven months nothing did that.
export class PhysicsSystem {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -WORLD.GRAVITY, 0) });
    this.world.allowSleep = true;
    this.fixedStep = 1 / 60;
    this.accumulator = 0;
    this.pairs = [];
    this.wallBodies = [];
    // Everything that has to be told where the ground is. Populated by `add`,
    // so anything given a mass gets this for free — including the vehicles and
    // props in the entity-registry backlog, which must not each re-derive it.
    this.dynamic = [];
    this.voxels = null;

    // Kept, but no longer load-bearing. It used to be the ONLY floor in the
    // game, which is JIM-42: it means y = 0, that meant "grade" on the flat 250
    // m block, and it has meant "the waterline" since the island (milestone
    // 17). It stays as a backstop because `TERRAIN.SEA_LEVEL` is 0, so it is
    // exactly the sea surface — anything that leaves the island rests on the
    // water instead of falling forever.
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

  /** The voxel world to clamp against. Injected rather than constructed here,
   *  because `VoxelWorld` is built after this and the dependency only points
   *  one way: physics asks the world where the ground is, and never writes. */
  attachWorld(voxels) {
    this.voxels = voxels;
  }

  /** Forget where a body was last step. Anything that TELEPORTS a body must
   *  call this, because the clamp reverts into that remembered position when a
   *  move ends inside solid — so a stale one does not just fail to help, it
   *  fires the body back to wherever it used to be.
   *
   *  The debris pool is the reason this exists: 150 bodies recycled by index,
   *  so slot 7's "previous position" is a spot on the other side of the map
   *  from the blast three seconds ago. Same discipline as `teleportJimothy`
   *  clearing `_prevX` / `_prevFeetY`. */
  resetSweep(body) {
    body._prevX = undefined;
    body._prevY = undefined;
    body._prevZ = undefined;
  }

  add(body, mesh = null) {
    this.world.addBody(body);
    if (mesh) this.pairs.push({ body, mesh });
    // DYNAMIC only. Jimothy is KINEMATIC and clamps himself against this same
    // grid, with an auto-step and a hop that a second clamp would fight — a
    // considerably worse bug than the one this fixes.
    if (body.type === CANNON.Body.DYNAMIC) this.dynamic.push(body);
  }

  remove(body, mesh = null) {
    this.world.removeBody(body);
    const d = this.dynamic.indexOf(body);
    if (d !== -1) this.dynamic.splice(d, 1);
    if (mesh) {
      const i = this.pairs.findIndex((p) => p.body === body);
      if (i !== -1) this.pairs.splice(i, 1);
    }
  }

  update(delta) {
    this.accumulator += delta;
    while (this.accumulator >= this.fixedStep - 1e-9) {
      this.world.step(this.fixedStep);
      // Inside the loop, not once per frame: a chunk at blast speed crosses a
      // 0.55 m voxel in about one step, so clamping per FRAME would let it
      // through the floor on any frame that ran two.
      this._groundBodies();
      this.accumulator -= this.fixedStep;
    }
    for (const { body, mesh } of this.pairs) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }

  /** Half-height and half-width of a body, cached on it. Everything dynamic in
   *  this game is a box or a sphere; anything else gets the sphere treatment,
   *  which is wrong but bounded rather than crashing. */
  _support(body) {
    if (!body._support) {
      const s = body.shapes[0];
      body._support = s?.halfExtents
        ? { y: s.halfExtents.y, r: Math.max(s.halfExtents.x, s.halfExtents.z) }
        : { y: s?.radius ?? VOXEL.SIZE / 2, r: s?.radius ?? VOXEL.SIZE / 2 };
    }
    return body._support;
  }

  /** Land every dynamic body on the voxel world, and stop it at walls.
   *
   *  This is the whole of JIM-42. The only floor in the game was a plane at
   *  y = 0, so with the island's ground at y ≈ 35–75 every can and every chunk
   *  of rubble fell through the terrain and slept at sea level: cans measured
   *  26–46 m under their own spawn point after four seconds, blast debris still
   *  falling past 9 m two seconds after a swing. Underground it is what made
   *  digging read as "blocks disappearing" — the rubble left through the floor
   *  the instant it appeared.
   *
   *  By grid lookup, not by colliders, for the reason in ADR-0003. */
  _groundBodies() {
    if (!this.voxels) return;
    for (const body of this.dynamic) {
      const p = body.position;
      const sup = this._support(body);
      const sleeping = body.sleepState === CANNON.Body.SLEEPING;

      const hadPrev = body._prevX !== undefined;
      const prevX = body._prevX;
      const prevY = body._prevY;
      const prevZ = body._prevZ;
      const park = () => { body._prevX = p.x; body._prevY = p.y; body._prevZ = p.z; };

      // Far above anything it could land on: it is still falling, and the scan
      // is O(height) — so this both skips pointless work and caps what a body
      // that has somehow got a long way up can cost. Generous on purpose; it is
      // a runaway guard, not a gameplay rule, and it must clear the tallest
      // tower downtown.
      if (p.y - this.voxels.terrainHeightAt(p.x, p.z) > PHYSICS.MAX_LAND_HEIGHT) {
        park();
        continue;
      }

      // --- walls, per axis ---
      // Same shape as JimothyController._clampAxis, minus the auto-step: he
      // climbs kerbs on purpose, and rubble that climbed things would crawl out
      // of the crater it was just blasted into. Per-axis first, because that is
      // what lets a chunk SLIDE along a wall instead of stopping dead on it.
      if (hadPrev) {
        for (const axis of ['x', 'z']) {
          const prev = axis === 'x' ? prevX : prevZ;
          const probe = (s) => this.voxels.solidAtWorld(
            p.x + (axis === 'x' ? s : 0), p.y, p.z + (axis === 'z' ? s : 0),
          );
          if (!probe(sup.r) && !probe(-sup.r)) continue;
          p[axis] = prev;
          body.velocity[axis] *= -PHYSICS.GROUND_RESTITUTION;
        }
      }

      // --- inside solid ---
      //
      // It never gets LIFTED out, and that is the whole point. `groundHeightAt`
      // returns the top of the first solid at or below where you ask — for a
      // buried body that is the top of the voxel it is sitting IN, so lifting it
      // there puts its centre in the next voxel up, which lifts it again. One
      // voxel per step, 33 m/s, forever. Measured while building this: the
      // parked debris pool had ratcheted **13 km** into the sky through bedrock,
      // and since the scan is O(height) each of those 144 bodies was then
      // walking 24,000 voxels per step — 157 ms per clamp, which turned a 5 s
      // test into a three-minute hang. A bounded lift is no better: any rule
      // that raises a buried body a fixed amount and re-tests next step is the
      // same ratchet, slower. (Same shape as the levitation loop in
      // JimothyController, playtest 2026-08-06 — a rule that moves a body toward
      // clear space must be able to REACH it in one move, or it is a ratchet.)
      //
      // So it goes BACK where it came from instead. The per-axis pass above
      // handles a wall taken square on; this catches the diagonal that slips
      // between two axis probes, which was leaving one chunk of every
      // underground blast set into the rock like a fossil.
      if (this.voxels.solidAtWorld(p.x, p.y, p.z)) {
        // Only if that is somewhere to go: a body that SPAWNED inside solid has
        // no clear previous position, and sending it to one it never occupied
        // is how you teleport rubble across a wall.
        if (hadPrev && !this.voxels.solidAtWorld(prevX, prevY, prevZ)) {
          p.set(prevX, prevY, prevZ);
        }
        // Stopped either way. Merely declining to steer it means "this one
        // accelerates through the planet unopposed" — which is how a single can
        // that spawned inside a kerb still reached the waterline 46 m down
        // while every other can rested correctly.
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        park();
        continue;
      }

      // Scanned from wherever it WAS if that is higher — the same swept trick
      // Jimothy's ground scan uses. Reading only the current position lets a
      // fast fall report the floor it has already passed through as being above
      // it, which is indistinguishable from having landed.
      const scanFrom = Math.max(hadPrev ? prevY : p.y, p.y);
      // stepUp 0: a body is not a walker and has no kerb allowance. The default
      // would quietly let rubble rest most of a voxel inside the floor.
      const rest = this.voxels.groundHeightAt(p.x, p.z, scanFrom, 0) + sup.y;

      if (sleeping) {
        // Never move a sleeping body — only notice that its floor has gone.
        // Also what keeps the debris pool's parked slots parked: they sleep at
        // y = -1000, where the scan reports a floor just beneath them.
        if (p.y - rest > PHYSICS.WAKE_GAP) body.wakeUp();
        continue;
      }

      // --- the ceiling ---
      // A tunnel has one, and the debris burst fires upward by design
      // (`DEBRIS.IMPULSE * 0.9` on y). With only a floor clamp a chunk sails
      // through a 2.9 m sewer roof into the rock above, where the buried rule
      // then freezes it — a piece of gravel embedded in the ceiling, which is
      // what one survivor of every underground blast was doing.
      const head = p.y + sup.y;
      if (body.velocity.y > 0 && this.voxels.solidAtWorld(p.x, head, p.z)) {
        const [, vy] = this.voxels.worldToVoxel(p.x, head, p.z);
        p.y = vy * VOXEL.SIZE - sup.y - 1e-3; // head just under the voxel it hit
        body.velocity.y *= -PHYSICS.GROUND_RESTITUTION;
      }

      // --- the floor ---
      if (p.y < rest) {
        p.y = rest;
        if (body.velocity.y < 0) {
          const bounce = -body.velocity.y * PHYSICS.GROUND_RESTITUTION;
          body.velocity.y = bounce < PHYSICS.SETTLE_SPEED ? 0 : bounce;
        }
        // Friction on CONTACT, not only while descending. A grid clamp has no
        // friction of its own, so this is the only thing bleeding the slide and
        // the spin — and gating it on "moving down" leaves a resting chunk with
        // whatever the solver hands it. The solver is still live down here:
        // debris boxes collide with EACH OTHER, so a pile in a crater pushes
        // itself apart against a position this clamp is pinning. Measured
        // before this: five chunks travelling 0.000 m with 0.7 m/s of velocity,
        // permanently awake because nothing ever damped it.
        body.velocity.x *= PHYSICS.GROUND_FRICTION;
        body.velocity.z *= PHYSICS.GROUND_FRICTION;
        body.angularVelocity.x *= PHYSICS.GROUND_FRICTION;
        body.angularVelocity.y *= PHYSICS.GROUND_FRICTION;
        body.angularVelocity.z *= PHYSICS.GROUND_FRICTION;
      }

      park();
    }
  }
}
