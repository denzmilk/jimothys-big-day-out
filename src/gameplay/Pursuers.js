import * as THREE from 'three';
import {
  PAPARAZZI, ANIMAL_CONTROL, PURSUER_SPAWN_POINTS, COLORS, WORLD,
  VISION, HEARING, SEARCH, PATROL, PLAYER_CONFIG,
} from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// How far ahead the obstacle probe looks. A body length, not one frame's step:
// probing 8 cm ahead means they only notice a wall once they are already flat
// against it, at which point nothing but a full 90° turn gets them off it.
const LOOKAHEAD = 0.7;
// Turn magnitudes tried, in order, once the direct path is blocked — all on the
// side the pursuer has committed to.
const TURNS = [0.5, 1.0, 1.57, 2.1, 2.6];
// How long they get to make progress, how far counts as progress, and how long
// the escape detour outranks whatever the state machine wants. A free pursuer
// covers 6 m in 1.2 s, so 1.5 m is unambiguously "going nowhere".
const STUCK_SECONDS = 1.2;
const STUCK_DISTANCE = 1.5;
const DETOUR_SECONDS = 2.5;

// Paparazzi (tier 1+) chase for photos and flash-stun at tier 2+; the animal
// controller (tier 3+) carries the net — the run's only ending. No physics
// bodies: pursuers steer meshes directly and everything is distance checks,
// which keeps them deterministic under advanceTime and immune to sleep bugs.
//
// MILESTONE 19 gave them a brain. Before it, `_steer` was handed `jp` — Jimothy,
// always — so a paparazzo on the far side of the island knew exactly where he
// was at all times and walked through buildings to reach him. Hiding in a bush
// drained heat without breaking their knowledge of him, because the bush worked
// on the heat number rather than on the pursuer.
//
// The steering was never the bug. It still walks straight at a target; what
// changed is that the target is owned by a state machine:
//
//   patrol      walk a beat near an anchor. They used to stand and stare.
//   suspicious  heard something, or were briefed at spawn. Go and look.
//   chase       has line of sight. This is the old behaviour, and it is correct
//               HERE and nowhere else.
//   search      lost sight. Go to the last known position, then cast around it.
//   (give up)   nothing found after SEARCH.DURATION → back to patrol.
//
// Vision is a cone plus a DDA march through the voxel grid
// (VoxelWorld.hasLineOfSight), so buildings, fresh rubble and — once milestone
// 18 lands — tunnel walls all block sight for free. Hearing is the other half:
// destruction is loud, which is what makes the demolition tool a decision.
export class Pursuers {
  constructor(scene, jimothy, voxels = null) {
    this.scene = scene;
    this.jimothy = jimothy;
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

    // Destruction is loud, and a tipped bin is loud enough to look at. Both
    // carry a POSITION, which is the whole point — they pull pursuers toward
    // the noise rather than toward the raccoon.
    eventBus.on(Events.WORLD_DEMOLISHED, ({ x, z, voxels: n = 0 }) => {
      if (x === undefined) return;
      this.hearNoise(x, z, Math.min(
        HEARING.DEMOLITION_MAX,
        HEARING.DEMOLITION_BASE + n * HEARING.DEMOLITION_PER_VOXEL,
      ));
    });
    eventBus.on(Events.CAN_TIPPED, ({ x, z }) => this.hearNoise(x, z, HEARING.CAN_TIPPED));
  }

  get all() {
    return this.animalControl ? [...this.paparazzi, this.animalControl] : this.paparazzi;
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

  _makePerson(type, x, z) {
    const withNet = type === 'animal-control';
    const group = new THREE.Group();
    const mat = withNet ? this.acMat : this.papMat;
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
    group.position.set(x, this._groundY(x, z), z);
    this.scene.add(group);

    const jp = this.jimothy.group.position;
    this._nextId = (this._nextId || 0) + 1;
    return {
      // Stable identity, because the snapshot's ORDER is not: a blast raises
      // heat, heat spawns paparazzi, and `pursuers[0]` silently becomes a
      // different person mid-spec.
      id: this._nextId,
      type,
      group,
      // SUSPICIOUS at spawn, briefed with where he was. They appear BECAUSE the
      // wanted level says someone reported him, so "dispatch told me roughly
      // where" is both the honest fiction and the thing that keeps the pursuit
      // from depending on a lucky sightline. Patrol at spawn would mean a
      // tier-3 animal controller wandering a street two blocks away while the
      // run had no lose condition.
      state: 'suspicious',
      lastKnown: { x: jp.x, z: jp.z },
      target: { x: jp.x, z: jp.z },
      sees: false,
      // Suspicion is on the same clock as a search, and it runs while they are
      // still WALKING to the lead. Without that, a lead they cannot reach —
      // across the canal, up a bluff, behind a building they keep sliding along
      // — is followed forever, and "giving up" only ever applied to the half of
      // the behaviour that had already arrived.
      searchTimer: SEARCH.DURATION,
      loiterTimer: 0,
      anchor: { x, z },
      wanderSeed: this.spawnIndex * 7919 + (type === 'animal-control' ? 13 : 0),
      wanderStep: 0,
      flashCooldown: 1 + this.paparazzi.length * 0.7,
    };
  }

  /** Add a pursuer at an exact spot. Test hook (`window.spawnPursuerAt`): the
   *  vision specs need a known geometry between a known pair of points, which
   *  the heat-driven spawn ring cannot give them.
   *
   *  PINNED, so the tier head-count leaves it alone. Without that it is deleted
   *  on the very next update — these specs run at heat tier 0, where nobody is
   *  chasing anybody. */
  spawnAt(type, x, z) {
    const p = this._makePerson(type, x, z);
    p.pinned = true;
    if (type === 'animal-control') {
      if (this.animalControl) this.scene.remove(this.animalControl.group);
      this.animalControl = p;
    } else {
      this.paparazzi.push(p);
    }
    // The ID, not an index into the snapshot: heat spawns and despawns people,
    // so an index picked now points at somebody else three seconds later.
    return p.id;
  }

  /** The ground under a pursuer. They used to be pinned to y = 0, which was
   *  fine on a flat world and leaves them buried in a hillside or hovering over
   *  a valley on the island (milestone 17). */
  _groundY(x, z) {
    if (!this.voxels) return 0;
    const surface = this.voxels.terrainHeightAt(x, z);
    return this.voxels.groundHeightAt(x, z, surface + 1);
  }

  /** How far this pursuer can see, before geometry and bushes. */
  sightRange(type, tier = gameState.heat.tier) {
    const scale = type === 'animal-control'
      ? ANIMAL_CONTROL.VISION_SCALE
      : PAPARAZZI.VISION_SCALE;
    return VISION.RANGE * scale * (1 + Math.max(0, tier - 1) * VISION.TIER_RANGE_GAIN);
  }

  /** Cone, then range, then geometry — cheapest test first, because the DDA
   *  march is the only expensive one. */
  _canSee(p) {
    const jp = this.jimothy.group.position;
    const pos = p.group.position;
    const dx = jp.x - pos.x;
    const dz = jp.z - pos.z;
    const d = Math.hypot(dx, dz);

    let range = this.sightRange(p.type);
    // The bush is a vision modifier, not a flag. Hiding works because they
    // cannot see you — which also means hiding in a bush somebody is already
    // standing beside does not work, and that is the right answer.
    if (gameState.player.hidden) range *= VISION.BUSH_RANGE_SCALE;
    if (d > range) return false;

    // Facing, except at arm's length: you cannot sneak up onto someone's toes.
    if (d > VISION.PERIPHERAL_RANGE) {
      const facing = p.group.rotation.y;
      let off = Math.atan2(dx, dz) - facing;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      if (Math.abs(off) > VISION.HALF_ANGLE) return false;
    }
    if (!this.voxels) return true;
    return this.voxels.hasLineOfSight(
      pos.x, pos.y + VISION.EYE_HEIGHT, pos.z,
      jp.x, jp.y + VISION.TARGET_HEIGHT, jp.z,
    );
  }

  /** Something loud happened at (x, z). Everyone in earshot who isn't already
   *  looking at him goes to investigate THE NOISE. */
  hearNoise(x, z, radius) {
    for (const p of this.all) {
      if (p.state === 'chase') continue;
      const d = Math.hypot(p.group.position.x - x, p.group.position.z - z);
      if (d > radius) continue;
      p.state = 'suspicious';
      p.lastKnown = { x, z };
      p.target = { x, z };
      p.searchTimer = this._searchDuration(p);
    }
  }

  /** Deterministic scatter around a point. Never Math.random: pursuer approach
   *  has to be reproducible under advanceTime, which is what lets a spec assert
   *  anything about a search at all. */
  _wanderAround(p, cx, cz, radius) {
    p.wanderStep += 1;
    let h = (Math.imul(p.wanderSeed, 374761393) ^ Math.imul(p.wanderStep, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16)) >>> 0;
    const th = ((h & 1023) / 1024) * Math.PI * 2;
    const r = radius * (0.35 + ((h >>> 10) & 1023) / 1024 * 0.65);
    const B = WORLD.BOUNDS;
    p.target = {
      x: THREE.MathUtils.clamp(cx + Math.cos(th) * r, -B, B),
      z: THREE.MathUtils.clamp(cz + Math.sin(th) * r, -B, B),
    };
  }

  _think(p, delta) {
    const jp = this.jimothy.group.position;
    p.sees = gameState.game.isPlaying && this._canSee(p);

    if (p.sees) {
      p.state = 'chase';
      p.lastKnown = { x: jp.x, z: jp.z };
      p.target = p.lastKnown;
      p.searchTimer = this._searchDuration(p);
      return;
    }

    const arrived = p.target
      && Math.hypot(p.group.position.x - p.target.x, p.group.position.z - p.target.z);

    switch (p.state) {
      case 'chase':
        // Just lost him. The last known position is where he WAS, and that is
        // what makes ducking round a corner work.
        p.state = 'search';
        p.searchTimer = this._searchDuration(p);
        p.target = { ...p.lastKnown };
        break;

      case 'suspicious':
        p.searchTimer -= delta;
        if (p.searchTimer <= 0) {
          this._giveUp(p);
        } else if (arrived !== null && arrived < SEARCH.ARRIVE_RADIUS) {
          // Arrived at the lead. Now cast around it, on a fresh clock — walking
          // there was investigating, not searching.
          p.state = 'search';
          p.searchTimer = this._searchDuration(p);
          this._wanderAround(p, p.lastKnown.x, p.lastKnown.z, SEARCH.WANDER_RADIUS);
        }
        break;

      case 'search':
        p.searchTimer -= delta;
        if (p.searchTimer <= 0) {
          this._giveUp(p);
        } else if (arrived !== null && arrived < SEARCH.ARRIVE_RADIUS) {
          this._wanderAround(p, p.lastKnown.x, p.lastKnown.z, SEARCH.WANDER_RADIUS);
        }
        break;

      default: // patrol
        if (p.loiterTimer > 0) {
          p.loiterTimer -= delta;
        } else if (arrived === null || arrived < PATROL.ARRIVE_RADIUS) {
          p.loiterTimer = PATROL.LOITER_SECONDS;
          this._wanderAround(p, p.anchor.x, p.anchor.z, PATROL.RADIUS);
        }
        break;
    }
  }

  /** Back to a beat, anchored where the trail went cold. */
  _giveUp(p) {
    p.state = 'patrol';
    p.anchor = { ...p.lastKnown };
    p.loiterTimer = 0;
    this._wanderAround(p, p.anchor.x, p.anchor.z, PATROL.RADIUS);
  }

  _searchDuration(p) {
    const scale = p.type === 'animal-control'
      ? ANIMAL_CONTROL.SEARCH_SCALE
      : PAPARAZZI.SEARCH_SCALE;
    return SEARCH.DURATION * scale;
  }

  /** Speed for the current state. Patrol is a walk; the rest is the type's own
   *  pace. */
  _speed(p) {
    const base = p.type === 'animal-control' ? ANIMAL_CONTROL.SPEED : PAPARAZZI.SPEED;
    if (p.state === 'patrol') return base * PATROL.SPEED_SCALE;
    // Photographers stop at photo range and loiter rather than dogpiling.
    if (p.type === 'paparazzo' && p.sees) {
      const jp = this.jimothy.group.position;
      const d = Math.hypot(jp.x - p.group.position.x, jp.z - p.group.position.z);
      if (d <= PAPARAZZI.FLASH_RANGE * 0.8) return 0;
    }
    return base;
  }

  /** Would a step to (x, z) walk into something? Not pathfinding — a step-up
   *  test and a chest-height probe, which is enough to stop them grinding into
   *  a wall forever while a state machine insists they are going somewhere. */
  _blocked(p, x, z) {
    if (!this.voxels) return false;
    const y = p.group.position.y;
    const ground = this.voxels.groundHeightAt(x, z, y + PLAYER_CONFIG.CLIMB_HEIGHT);
    if (ground - y > PLAYER_CONFIG.CLIMB_HEIGHT) return true;
    return this.voxels.solidAtWorld(x, ground + 1.0, z);
  }

  /** Which way round an obstacle leaves the pursuer nearer its target. Only a
   *  tie-breaker: it is consulted once, when the commitment is made. */
  _closerSide(pos, base, target) {
    const at = (sign) => {
      const a = base + 1.57 * sign;
      return Math.hypot(
        pos.x + Math.sin(a) * LOOKAHEAD * 3 - target.x,
        pos.z + Math.cos(a) * LOOKAHEAD * 3 - target.z,
      );
    };
    return at(-1) <= at(1) ? -1 : 1;
  }

  _steer(p, delta, speed) {
    const pos = p.group.position;
    if (p.detourTimer > 0) p.detourTimer -= delta;
    const target = (p.detourTimer > 0 ? p.detour : p.target) || { x: pos.x, z: pos.z };
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (speed > 0 && d > 1e-3) {
      const step = Math.min(speed * delta, d);
      const base = Math.atan2(dx, dz);
      const clear = (a) => !this._blocked(
        p, pos.x + Math.sin(a) * LOOKAHEAD, pos.z + Math.cos(a) * LOOKAHEAD,
      );
      // A wall-follower, not a pathfinder. Pathfinding is out of scope for this
      // milestone (and worth doing only once the states are right); what this
      // has to do is stop them grinding into a wall while a state machine
      // insists they are going somewhere, because a search that never leaves
      // the spot it started in does not read as a search.
      //
      // The rule is: go straight when you can, and when you can't, COMMIT to
      // turning one way until straight is clear again. The commitment is the
      // whole thing. Re-deriving the turn direction each frame gives a
      // four-frame limit cycle — step left, which unblocks the right and blocks
      // the left, step right, repeat — where it moves its full 8 cm every frame
      // and travels 5 cm a second. Traced: -9.81,34.09 → -9.86,34.03 →
      // -9.81,34.09 → …
      let angle = null;
      if (clear(base)) {
        angle = base;
        p.wallSide = 0;
      } else {
        if (!p.wallSide) {
          // Pick the way round: whichever flank is open, and if both are, the
          // one that leaves it nearer the target.
          const left = clear(base - 1.57);
          const right = clear(base + 1.57);
          if (left !== right) p.wallSide = left ? -1 : 1;
          else p.wallSide = this._closerSide(pos, base, target);
        }
        for (const mag of TURNS) {
          const a = base + mag * p.wallSide;
          if (clear(a)) { angle = a; break; }
        }
        // Everything on the committed side is a wall too: back out the way it
        // came. Without this an animal controller that walked into a doorway
        // stood in it for the rest of the run.
        if (angle === null && clear(base + Math.PI)) angle = base + Math.PI;
      }
      if (angle !== null) {
        pos.x = THREE.MathUtils.clamp(
          pos.x + Math.sin(angle) * step, -WORLD.BOUNDS, WORLD.BOUNDS,
        );
        pos.z = THREE.MathUtils.clamp(
          pos.z + Math.cos(angle) * step, -WORLD.BOUNDS, WORLD.BOUNDS,
        );
        p.group.rotation.y = angle;
      }
      // Wedged anyway. Measured as NET DISPLACEMENT over a window, not as "did
      // it move this frame" — the failure that actually happens is a four-frame
      // limit cycle: the wall is clear to the left, it steps left, that makes
      // the right clear and the left blocked, it steps back, forever. Every
      // frame it moves its full 8 cm, and every second it goes nowhere. (Traced
      // frame by frame: -9.81,34.09 → -9.86,34.03 → -9.81,34.09 → …)
      //
      // The escape is a detour, and the detour has to OUTRANK the state
      // machine's target for a moment — a chase rewrites that every frame and
      // would drive straight back into the wall.
      p.trailTimer = (p.trailTimer || 0) + delta;
      if (p.trailTimer >= STUCK_SECONDS) {
        const progress = p.trailX === undefined
          ? Infinity
          : Math.hypot(pos.x - p.trailX, pos.z - p.trailZ);
        if (progress < STUCK_DISTANCE) {
          // Following the wall the other way is the second thing to try, and a
          // detour somewhere else entirely is the third.
          p.wallSide = -(p.wallSide || 1);
          this._wanderAround(p, pos.x, pos.z, SEARCH.WANDER_RADIUS);
          p.detour = p.target;
          p.detourTimer = DETOUR_SECONDS;
        }
        p.trailTimer = 0;
        p.trailX = pos.x;
        p.trailZ = pos.z;
      }
    } else if (d > 1e-3) {
      // Standing still but still watching: facing has to follow the target, or
      // the vision cone points wherever they last happened to walk.
      p.group.rotation.y = Math.atan2(dx, dz);
    }
    pos.y = this._groundY(pos.x, pos.z);
    const jp = this.jimothy.group.position;
    return Math.hypot(jp.x - pos.x, jp.z - pos.z);
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    const tier = gameState.heat.tier;

    // Head-count follows the tier; spawn/despawn to match. Counted over the
    // ones the heat system OWNS — a spec-pinned pursuer is not part of the
    // wanted level and must not be culled by it.
    const targetPaparazzi =
      tier >= 2 ? PAPARAZZI.COUNT_TIER2 : tier >= 1 ? PAPARAZZI.COUNT_TIER1 : 0;
    const managed = () => this.paparazzi.filter((p) => !p.pinned);
    while (managed().length < targetPaparazzi) {
      const [x, z] = this._spawnPoint();
      this.paparazzi.push(this._makePerson('paparazzo', x, z));
    }
    while (managed().length > targetPaparazzi) {
      const i = this.paparazzi.map((p) => !p.pinned).lastIndexOf(true);
      this.scene.remove(this.paparazzi.splice(i, 1)[0].group);
    }
    if (tier >= ANIMAL_CONTROL.MIN_TIER && !this.animalControl) {
      const [x, z] = this._spawnPoint();
      this.animalControl = this._makePerson('animal-control', x, z);
    }
    if (tier < ANIMAL_CONTROL.MIN_TIER && this.animalControl && !this.animalControl.pinned) {
      this.scene.remove(this.animalControl.group);
      this.animalControl = null;
    }

    this.globalFlashCooldown -= delta;
    for (const p of this.paparazzi) {
      p.flashCooldown -= delta;
      this._think(p, delta);
      const d = this._steer(p, delta, this._speed(p));
      // A photograph needs a subject: no sightline, no flash. Hiding used to be
      // a flag that switched this off; it is now simply not being seen.
      if (
        p.sees &&
        tier >= PAPARAZZI.MIN_TIER_FLASH &&
        d <= PAPARAZZI.FLASH_RANGE &&
        p.flashCooldown <= 0 &&
        this.globalFlashCooldown <= 0
      ) {
        p.flashCooldown = PAPARAZZI.FLASH_COOLDOWN;
        this.globalFlashCooldown = PAPARAZZI.GLOBAL_FLASH_COOLDOWN;
        eventBus.emit(Events.PLAYER_STUNNED, { seconds: PAPARAZZI.STUN_SECONDS });
      }
    }

    if (this.animalControl) {
      const ac = this.animalControl;
      this._think(ac, delta);
      const d = this._steer(ac, delta, this._speed(ac));
      // You cannot net what you cannot see. At NET_RANGE the bush multiplier
      // still leaves him visible, so hiding under someone's nose does not save
      // him — which is the behaviour the flag was pretending to have.
      if (ac.sees && d <= ANIMAL_CONTROL.NET_RANGE) eventBus.emit(Events.PLAYER_NETTED);
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
    const round = (v) => +v.toFixed(1);
    return this.all.map((p) => ({
      id: p.id,
      type: p.type,
      x: round(p.group.position.x),
      z: round(p.group.position.z),
      // Milestone 19: without these, none of the awareness model is assertable
      // and the specs stay eyeball-only.
      state: p.state,
      sees: p.sees,
      lastKnown: p.lastKnown ? { x: round(p.lastKnown.x), z: round(p.lastKnown.z) } : null,
      target: p.target ? { x: round(p.target.x), z: round(p.target.z) } : null,
    }));
  }
}
