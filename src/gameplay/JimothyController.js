import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  PLAYER_CONFIG as P, WORLD, COLORS, HIDE_SPOTS, FATNESS, FOODS, MOVES, VOXEL,
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
  constructor(scene, physics, input, voxels = null) {
    this.input = input;
    this.voxels = voxels;
    this.group = new THREE.Group();
    // Yaw must be applied BEFORE pitch, or `rotation.x` tumbles about the
    // world axis instead of his own left-right axis — which turned the roll
    // into a barrel roll at every heading except the two where the world
    // happened to agree with him (playtest 2026-08-06). Default 'XYZ' applies
    // x in the parent frame; 'YXZ' applies it in the yawed frame.
    this.group.rotation.order = 'YXZ';
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.PLACEHOLDER_JIMOTHY,
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
    // Whichever mesh is actually the belly right now — the placeholder before
    // the rig loads, the model's body piece after. Everything else anchors to
    // its surface, so it must never be measured off the hidden one.
    this.bodyRender = this.bodyMesh;
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
      this.bodyRender = this.rig.bodyPiece || this.bodyMesh;
      // Swap the fallback tubes for the model's own legs — running both is
      // what gave him eight legs in playtest.
      this.legs.useRealLegs(this.rig.legs);
      // Every piece's material, not just the first — the GLB happens to share
      // one today, but a re-export that splits them would silently leave most
      // of him refusing to fade.
      for (const p of this.rig.pieces) {
        if (p.material && !this.materials.includes(p.material)) this.materials.push(p.material);
      }
      // Force the fade state to re-apply: the model loads asynchronously, so
      // if he happened to be in a bush when it arrived the new materials would
      // have missed the transition and stayed opaque until he left and
      // re-entered.
      this._faded = null;
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
    // Move state: { kind: 'headbutt'|'roll', t, fired } — see MOVES.
    this.move = null;
    this.moveCooldown = 0;
    // Scratch for the tumble-pivot compensation in postUpdate; allocating
    // these per frame would churn the GC on the hot path.
    this._pivot = new THREE.Vector3();
    this._pivotRotated = new THREE.Vector3();
    this.onImpact = null; // set by Game: (x, y, z, radiusScale) => void

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
    // Stale sweep origin would have the ground scan start from wherever he
    // died, which after a fall is metres below the respawn point.
    this._prevFeetY = undefined;
    this.stunTimer = 0;
    this.jiggleAmp = 0;
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, this.yaw, 0);
    this.legs.reset();
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  /** Introspection for the specs (milestone 08). Two defects that were
   *  previously only visible by eye become numbers here:
   *
   *  `up`    — the visual group's world up axis. A forward tumble keeps it in
   *            the plane of his heading; tumbling about the world axis instead
   *            throws it onto his right vector.
   *  `parts` — each anchor's radial position in the BODY's own ellipsoid
   *            frame, where q ≤ 1 means "touching or inside the belly". If
   *            anchoring is right, q barely moves as he fattens. */
  inspect() {
    this.group.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion);
    const box = new THREE.Box3().setFromObject(this.bodyRender);
    const c = box.getCenter(new THREE.Vector3());
    const h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const q = (p) => Math.hypot(
      (p.x - c.x) / Math.max(1e-4, h.x),
      (p.y - c.y) / Math.max(1e-4, h.y),
      (p.z - c.z) / Math.max(1e-4, h.z),
    );
    const tmp = new THREE.Vector3();
    const parts = {
      head: q(this.headSlot.getWorldPosition(tmp.clone())),
      tail: q(this.tailSlot.getWorldPosition(tmp.clone())),
      hips: this.legs.hipAnchors().map(q),
    };
    // World height of the belly's centre. Tumbling about his feet drags this
    // down to grade at 90°; tumbling about his middle holds it steady.
    return { up, parts, bodyY: c.y, bodyBottom: box.min.y };
  }

  // Voxel structure has no physics bodies (ADR-0003) — he's kinematic, so we
  // resolve against the grid directly. Per-axis so sliding along a wall works
  // instead of sticking, and only at body height so he steps over kerbs.
  _resolveVoxels(p) {
    if (!this.voxels) return;
    const r = P.RADIUS * 0.8;
    const probeY = p.y;
    for (const [axis, prev] of [['x', this._prevX], ['z', this._prevZ]]) {
      const off = (s) => ({
        x: p.x + (axis === 'x' ? s : 0),
        z: p.z + (axis === 'z' ? s : 0),
      });
      const a = off(r);
      const bq = off(-r);
      const hit = this.voxels.solidAtWorld(a.x, probeY, a.z)
        || this.voxels.solidAtWorld(bq.x, probeY, bq.z);
      if (!hit || prev === undefined) continue;

      // Auto-step: if the obstruction is a ledge he could stand on — a crater
      // wall, a rubble pile, a kerb — climb it instead of stopping dead.
      // Without this, any hole he digs becomes a trap he can't leave.
      //
      // Only while GROUNDED. Stepping up is a walking affordance; running it
      // mid-air let him climb the outside of a building as he fell past it —
      // blocked probe, clear space above, lift, fall, repeat — hovering beside
      // the wall forever, never grounded, unable to hop (playtest 2026-08-06:
      // "falling through the floor"). Airborne, a wall should just stop him.
      let climbed = false;
      for (let lift = VOXEL.SIZE; this.grounded && lift <= P.CLIMB_HEIGHT; lift += VOXEL.SIZE) {
        const y = probeY + lift;
        const blocked = this.voxels.solidAtWorld(a.x, y, a.z)
          || this.voxels.solidAtWorld(bq.x, y, bq.z);
        // A ledge is only climbable if something would hold him up there.
        // Testing "is it clear?" alone let him climb the *air beside* a wall:
        // the side probe stayed blocked, the space above was empty, so he was
        // lifted every frame while nothing supported him — a levitation loop
        // that left him permanently not-grounded (playtest 2026-08-06).
        const supported = this.voxels.solidAtWorld(a.x, y - VOXEL.SIZE, a.z)
          || this.voxels.solidAtWorld(bq.x, y - VOXEL.SIZE, bq.z);
        if (!blocked && supported) {
          p.y = y;
          if (this.vy < 0) this.vy = 0;
          this.grounded = true;
          climbed = true;
          break;
        }
      }
      if (!climbed) {
        p[axis] = prev;
        this.vel[axis] = 0;
      }
    }
    this._prevX = p.x;
    this._prevZ = p.z;
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
    // Airborne steering is throttled — committing to a hop should mean
    // committing to where it lands.
    const authority = this.grounded ? dvMax : dvMax * P.AIR_CONTROL;
    this.vel.x += THREE.MathUtils.clamp(wx * speed - this.vel.x, -authority, authority);
    this.vel.z += THREE.MathUtils.clamp(wz * speed - this.vel.z, -authority, authority);

    if (this.input.consumeHop() && this.grounded && controllable) {
      this.vy = P.HOP_FORCE;
      this.grounded = false;
    }
    if (!this.grounded) this.vy -= P.HOP_GRAVITY * delta;

    this._updateMoves(delta, controllable);

    this.body.velocity.set(this.vel.x, this.vy, this.vel.z);
  }

  /** Headbutt and roll. Both drive Jimothy forward and land their damage
   *  AHEAD of him, so he never digs the hole he's standing in. */
  _updateMoves(delta, controllable) {
    if (this.moveCooldown > 0) this.moveCooldown -= delta;

    if (controllable && !this.move && this.moveCooldown <= 0) {
      if (this.input.consumeHeadbutt()) this.move = { kind: 'headbutt', t: 0, fired: false };
      else if (this.input.consumeRoll()) this.move = { kind: 'roll', t: 0, ticks: 0 };
    }
    // Queued presses are deliberately NOT drained while busy — a press during
    // a cooldown fires the moment it lifts, which feels responsive instead of
    // eating the input.
    if (!this.move) return;

    const m = this.move;
    m.t += delta;
    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);

    if (m.kind === 'headbutt') {
      const H = MOVES.HEADBUTT;
      const total = H.WINDUP + H.LUNGE + H.RECOVER;
      if (m.t < H.WINDUP) {
        // Rear back: a beat of anticipation sells the hit.
        this.vel.x = -fwdX * 1.5;
        this.vel.z = -fwdZ * 1.5;
      } else if (m.t < H.WINDUP + H.LUNGE) {
        this.vel.x = fwdX * H.LUNGE_SPEED;
        this.vel.z = fwdZ * H.LUNGE_SPEED;
        if (!m.fired) {
          m.fired = true;
          const p = this.body.position;
          // Game offsets the impact by its own blast radius so the sphere
          // lands clear of his feet — otherwise a fat Jimothy digs the pit
          // he's standing in and drops into it.
          this.onImpact?.(p.x, p.y, p.z, fwdX, fwdZ, H, H.REACH);
          this.jiggleAmp += 0.25;
        }
      } else {
        this.vel.x *= 0.6;
        this.vel.z *= 0.6;
      }
      if (m.t >= total) { this.move = null; this.moveCooldown = H.COOLDOWN; }
    } else {
      const R = MOVES.ROLL;
      this.vel.x = fwdX * R.SPEED;
      this.vel.z = fwdZ * R.SPEED;
      // Carve along the path rather than one sphere at the end.
      const wantTicks = Math.floor((m.t / R.DURATION) * R.TICKS);
      while (m.ticks < wantTicks && m.ticks < R.TICKS) {
        m.ticks++;
        const p = this.body.position;
        this.onImpact?.(p.x, p.y, p.z, fwdX, fwdZ, R, P.RADIUS);
      }
      if (m.t >= R.DURATION) { this.move = null; this.moveCooldown = R.COOLDOWN; }
    }
  }

  postUpdate(delta) {
    const p = this.body.position;
    p.x = THREE.MathUtils.clamp(p.x, -WORLD.BOUNDS, WORLD.BOUNDS);
    p.z = THREE.MathUtils.clamp(p.z, -WORLD.BOUNDS, WORLD.BOUNDS);
    this._resolveVoxels(p);
    // Ground height comes from the voxel slab, so blasted craters are real
    // terrain he can drop into and climb out of. Scanned from his own feet so
    // nearby rooftops can't yank him upward.
    //
    // SWEPT, not instantaneous: the scan starts from wherever his feet were
    // last frame, so a surface he crossed *between* frames still catches him.
    // Scanning only from the current position means one long frame — the
    // update loop allows up to 0.1 s — can step straight past thin geometry
    // and drop him out of the world.
    const feetY = p.y - P.RADIUS;
    const scanFrom = Math.max(feetY, this._prevFeetY ?? feetY);
    const floorY = this.voxels ? this.voxels.groundHeightAt(p.x, p.z, scanFrom) : 0;
    const standY = floorY + P.RADIUS;
    // Only land when descending — rising through a lip shouldn't snap him to it.
    if (p.y <= standY && this.vy <= 0) {
      p.y = standY;
      this.vy = 0;
      this.grounded = true;
    } else if (p.y > standY + P.GROUND_STICK) {
      this.grounded = false;
    } else {
      // Within sticking distance of a surface: hold him there rather than
      // letting gravity accumulate. Without this he can sit in a limit cycle
      // against a wall or roof edge — auto-climb lifts him, the ground check
      // un-grounds him, gravity pulls him back — never landing, never able to
      // hop, and carrying a big negative velocity into the next gap he meets
      // (playtest 2026-08-06: "falling through the floor").
      this.grounded = true;
      if (this.vy < 0) this.vy = 0;
    }
    // Last line of defence: whatever happened above, he is never below the
    // surface of his own column. Cheap, and it makes falling out of the world
    // impossible rather than merely unlikely.
    if (p.y < standY) {
      p.y = standY;
      if (this.vy < 0) this.vy = 0;
    }
    this._prevFeetY = p.y - P.RADIUS;
    // group.position is set once at the END of this method, after the tumble
    // pivot is known — setting it here too would just be overwritten.

    // In a bush = hidden: heat drains, pursuers lose him. Fade him so the
    // player can read the state at a glance. Fat trade-off #2: the wider he
    // is, the deeper into the bush he must squeeze — past a point the blob
    // simply doesn't fit and bushes stop working entirely.
    const fat = gameState.player.fatness / (gameState.player.fatness + FATNESS.SOFTCAP);
    const width = 1 + fat * FATNESS.MAX_WIDTH_GAIN;
    const hideRadius = Math.max(0, HIDE_SPOTS.RADIUS - (width - 1) * FATNESS.HIDE_SQUEEZE);
    // Anti-stuck: if he's ended up buried inside solid voxels (blasted a
    // crater and slid in, or terrain changed around him), lift him to the
    // nearest free surface rather than trapping him in the geometry.
    if (this.voxels && this.voxels.solidAtWorld(p.x, p.y, p.z)) {
      p.y = this.voxels.groundHeightAt(p.x, p.z, p.y + 6) + P.RADIUS;
      this.vy = Math.max(0, this.vy);
    }

    let hidden = false;
    for (const [hx, hz] of HIDE_SPOTS.POSITIONS) {
      if (Math.hypot(p.x - hx, p.z - hz) < hideRadius) { hidden = true; break; }
    }
    gameState.player.hidden = hidden;
    // Transparency is a STATE, not a permanent property. Leaving `transparent`
    // on parks every piece in the sorted transparent queue for the whole run
    // to buy nothing, and invites the pieces to mis-sort against each other.
    // Flipping it costs a shader recompile, so only do it on the transition.
    if (hidden !== this._faded) {
      this._faded = hidden;
      for (const m of this.materials) {
        m.transparent = hidden;
        m.opacity = hidden ? 0.5 : 1;
        m.needsUpdate = true;
      }
    }

    // Facing is locked during a move so a headbutt or roll commits to the
    // direction it started in.
    const moving = this.speed > 0.3;
    if (moving && !this.move) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), P.TURN_SPEED, delta);
    }
    this.group.rotation.y = this.yaw;

    // Roll tumble is applied together with the headbutt pitch below — both
    // drive group.rotation.x, so assigning here would just be overwritten.
    //
    // Eased, not linear: he leans in, tips past the balance point, then drops.
    // Ease-in-out quad spends time at both ends and whips through the middle,
    // which is what turns a spin into a flop. A constant rate looked like a
    // wheel (playtest 2026-08-06).
    let rollWobble = 0;
    if (this.move?.kind === 'roll') {
      const R = MOVES.ROLL;
      const p = Math.min(1, this.move.t / R.DURATION);
      const eased = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      this.rollSpin = eased * Math.PI * 2 * R.SPINS;
      // Fades in and out so he doesn't snap upright on landing.
      rollWobble = Math.sin(p * Math.PI * 2 * R.WOBBLE_HZ) * R.WOBBLE * Math.sin(p * Math.PI);
      // Gather up before the tumble, sprawl out after it. Trapezoid rather
      // than a bell so he holds the balled-up pose through the flop itself.
      this.rollTuck = Math.min(
        1,
        Math.min(p / R.TUCK_IN, (1 - p) / R.TUCK_OUT),
      );
    } else {
      this.rollSpin = 0;
      this.rollTuck = 0;
    }
    this.group.rotation.z = rollWobble;
    const tuck = Math.max(0, this.rollTuck || 0);

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

    // Fatness pushes the extremities OUT along with the belly. Without this
    // the body balloons straight through a head and legs pinned at their slim
    // positions (playtest 2026-07-23: "his head/limbs don't really move with
    // it, it just gets larger"). Anchors ride the body's surface; the pieces
    // themselves stay their own size — tiny head on a huge body is the meme.
    const fatWidth = 1 + fat * FATNESS.MAX_WIDTH_GAIN;
    const fatHeight = 1 + fat * FATNESS.MAX_HEIGHT_GAIN;
    // Headbutt: the head rears back then punches forward, and the whole body
    // tips into it. Cheap, readable, and appropriately silly.
    let headThrust = 0;
    let bodyPitch = 0;
    if (this.move?.kind === 'headbutt') {
      const H = MOVES.HEADBUTT;
      const t = this.move.t;
      const lerp = (a, b, k) => a + (b - a) * k;
      if (t < H.WINDUP) {
        const k = t / H.WINDUP;
        headThrust = H.THRUST_BACK * k;
        bodyPitch = H.PITCH_BACK * k;
      } else if (t < H.WINDUP + H.LUNGE) {
        const k = (t - H.WINDUP) / H.LUNGE;
        headThrust = lerp(H.THRUST_BACK, H.THRUST_FWD, k);
        bodyPitch = lerp(H.PITCH_BACK, H.PITCH_FWD, k);
      } else {
        const k = Math.max(0, 1 - (t - H.WINDUP - H.LUNGE) / H.RECOVER);
        headThrust = H.THRUST_FWD * k;
        bodyPitch = H.PITCH_FWD * k;
      }
    }
    // Anchors must scale about the SAME pivot the belly does, which is the
    // body slot's own origin — children of a scaled group grow about their
    // parent's origin, not about the world's. Scaling the raw bases instead
    // (`base * fatWidth`) pivots them about Jimothy's feet, so belly and
    // anchors diverged and his head, tail and legs drifted off a ballooning
    // body (playtest 2026-08-06). Anchoring here makes contact exact at every
    // size by construction rather than by a tuned fudge factor.
    const anchor = (base, out) => out.set(
      bodyBase.x + (base.x - bodyBase.x) * fatWidth,
      bodyBase.y + (base.y - bodyBase.y) * fatHeight,
      bodyBase.z + (base.z - bodyBase.z) * fatWidth,
    );
    const headBase = this.headSlot.userData.base;
    anchor(headBase, this.headSlot.position);
    this.headSlot.position.y +=
      Math.abs(Math.sin(this.elapsed * P.WADDLE_BOB_HZ + 0.9)) * P.WADDLE_BOB_AMPLITUDE * 0.7 * speedNorm;
    this.headSlot.position.z += headThrust;
    // Chin tucks to chest through the roll, on top of any headbutt pitch.
    this.headSlot.rotation.x =
      -bodyPitch * MOVES.HEADBUTT.HEAD_PITCH_GAIN + tuck * MOVES.ROLL.TUCK_HEAD;
    // Single owner of the body's pitch: headbutt lean + roll tumble.
    this.group.rotation.x = bodyPitch * 0.5 + this.rollSpin;
    anchor(this.tailSlot.userData.base, this.tailSlot.position);
    this.tailSlot.rotation.y = Math.sin(this.elapsed * 10) * 0.35 * speedNorm * (1 - tuck);
    this.tailSlot.rotation.x = tuck * MOVES.ROLL.TUCK_TAIL; // curls in for the roll
    // Hips splay outward too, so a fat Jimothy waddles bow-legged.
    this.legs.applyFatness(fatWidth, fatHeight, bodyBase);
    this.legs.setTuck(tuck);

    // Fatness: asymptotic wide-load growth on the body slot only (tiny head
    // on an enormous body IS the meme), plus the bite-kicked jiggle spring
    // and a continuous jelly wobble while waddling.
    this.jiggleAmp = Math.max(0, this.jiggleAmp - this.jiggleAmp * FATNESS.JIGGLE_DAMPING * delta);
    const jelly = fat * FATNESS.JELLY * Math.min(1, this.speed / P.SPEED);
    const wobble = Math.sin(this.elapsed * FATNESS.JIGGLE_HZ * Math.PI * 2) * (this.jiggleAmp + jelly);
    const height = 1 + fat * FATNESS.MAX_HEIGHT_GAIN;
    this.widthScale = width;
    // Balling up for the roll: wider and shorter, so the silhouette actually
    // changes rather than the same shape spinning.
    const squash = tuck * MOVES.ROLL.TUCK_SQUASH;
    this.bodySlot.scale.set(
      width * (1 + wobble) * (1 + squash),
      height * (1 - wobble * 0.6) * (1 - squash),
      width * (1 - wobble * 0.3) * (1 + squash),
    );

    // Tumble about his MIDDLE, not his toes. The group's origin sits at ground
    // level (its position is his feet), so pitching it swept his whole body
    // through the floor in an arc — a 90° roll put his belly at grade
    // (playtest 2026-08-06: "the rotate is at his toes instead of central").
    //
    // Rather than restructure the hierarchy, offset the group by (c - R·c),
    // which turns rotation-about-the-origin into rotation-about-c exactly.
    // c is kept purely vertical so that yaw — which leaves (0, h, 0) fixed —
    // contributes nothing, and ordinary turning is untouched.
    this._pivot.set(0, this.bodySlot.position.y + this.bodyRender.position.y * this.bodySlot.scale.y, 0);
    this._pivotRotated.copy(this._pivot).applyEuler(this.group.rotation);
    this.group.position.set(
      p.x - this._pivotRotated.x,
      (p.y - P.RADIUS) + this._pivot.y - this._pivotRotated.y,
      p.z - this._pivotRotated.z,
    );

    this.legs.update(delta);
  }
}
