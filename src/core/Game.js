import * as THREE from 'three';
import {
  CAMERA, COLORS, PLAYER_CONFIG, KEYBINDS, HIDE_SPOTS, VOXEL, WORLD, FATNESS, STREAM, SEWER,
  MOVES,
} from './Constants.js';
import { gameState } from './GameState.js';
import { eventBus, Events } from './EventBus.js';
import { DevOverrides } from './DevOverrides.js';
import { InputSystem } from '../systems/InputSystem.js';
import { PhysicsSystem } from '../systems/PhysicsSystem.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { FlyCamera } from '../systems/FlyCamera.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { HeatSystem } from '../systems/HeatSystem.js';
import { JimothyController } from '../gameplay/JimothyController.js';
import { TrashCans } from '../gameplay/TrashCans.js';
import { Pursuers } from '../gameplay/Pursuers.js';
import { LevelBuilder } from '../level/LevelBuilder.js';
import { VoxelWorld } from '../level/VoxelWorld.js';
import { installCity } from '../level/VoxelCity.js';
import * as Layout from '../level/Layout.js';
import { Debris } from '../gameplay/Debris.js';
import { Pedestrians } from '../gameplay/Pedestrians.js';
import { Treasures } from '../gameplay/Treasures.js';
import { CrabPeople } from '../gameplay/CrabPeople.js';
import { HUD } from '../ui/HUD.js';
import { GameOverScreen } from '../ui/GameOverScreen.js';
import { DevTools } from '../ui/DevTools.js';

class Game {
  constructor() {
    // Plain performance.now() delta — a Timer abstraction returning 0 in one
    // browser is exactly the class of bug the diag strip exists to catch.
    this._lastTime = performance.now();
    this.lastDelta = 0;
    // Once a test calls advanceTime, wall-clock updates stop and simulated
    // time advances ONLY through advanceTime — otherwise real frames tick
    // combo timers etc. between test assertions and the specs go flaky.
    // Tests set __MANUAL_TIME__ pre-load so not even the boot window runs in
    // real time — variable-length live physics before the first advanceTime
    // made can-settling (and thus bonk chains) diverge under CI load.
    this.manualTime = !!window.__MANUAL_TIME__;
    this.init();
  }

  init() {
    // Overrides mutate the Constants objects, so they must land before any
    // system bakes a value at construction.
    DevOverrides.apply();
    // …and the coastline prunes them, for the same reason: a hide spot in the
    // sea is a floating bush, and the grid in Constants is deliberately a plain
    // density rule that knows nothing about the island (milestone 12's lesson —
    // a hardcoded ±220 grid is what left the pressure valve unreachable). In
    // place, like the keybind overrides, so every consumer sees one list.
    HIDE_SPOTS.POSITIONS.splice(
      0, HIDE_SPOTS.POSITIONS.length, ...Layout.hideSpots(HIDE_SPOTS.POSITIONS),
    );

    this.setupRenderer();
    this.setupScene();
    this.setupCamera();

    this.input = new InputSystem(this.renderer.domElement);
    this.physics = new PhysicsSystem();
    this.voxels = new VoxelWorld(this.scene);
    installCity(this.voxels);
    // After the world: the bushes and the sea have to sit on ground that
    // already knows how high it is.
    this.level = new LevelBuilder(this.scene, this.voxels);
    this.debris = new Debris(this.scene, this.physics);
    this.jimothy = new JimothyController(this.scene, this.physics, this.input, this.voxels);
    // Moves land their damage ahead of him (headbutt/roll), never underfoot.
    // The offset is the blast radius itself plus the move's own reach, so a
    // wrecking-ball Jimothy carves the wall in front rather than the floor
    // beneath (playtest 2026-07-23: "he gets stuck in a hole").
    // The move hands over its own config, so its demolition policy travels
    // with it instead of being re-derived here from positional arguments.
    this.jimothy.onImpact = (x, y, z, dir, cfg, reach, aim = 0) => {
      const digs = this.digsTerrain(cfg, aim);
      const at = this.impactPoint({ x, y, z }, dir, cfg, reach, {}, digs);
      this.blastAt(at, cfg.RADIUS_SCALE, { fatShare: cfg.FAT_BLAST_SHARE, digsTerrain: digs });
      this.onBlast?.(at);
    };
    this.trashCans = new TrashCans(this.scene, this.physics, this.jimothy, this.voxels);
    this.pursuers = new Pursuers(this.scene, this.jimothy, this.voxels);
    this.pedestrians = new Pedestrians(this.scene, this.jimothy, this.voxels);
    this.treasures = new Treasures(this.scene, this.jimothy, this.voxels);
    this.crabs = new CrabPeople(this.scene, this.jimothy, this.voxels);
    this.score = new ScoreSystem();
    this.heat = new HeatSystem();
    this.cameraSystem = new CameraSystem(this.camera, this.jimothy, this.input);
    this.flyCamera = new FlyCamera(this.camera, this.input);
    this.hud = new HUD();
    this.gameOverScreen = new GameOverScreen();
    this.devTools = new DevTools(this.input);

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'CAMERA' && key === 'FOV') {
        this.camera.fov = CAMERA.FOV;
        this.camera.updateProjectionMatrix();
      }
    });

    // Straight to the nearest stairwell (milestone 20). Inspecting the
    // underground should not require digging to it.
    eventBus.on(Events.DEV_GOTO_SEWER, () => {
      const jp = this.jimothy.group.position;
      const near = this.sewerEntrances().reduce(
        (a, c) => (Math.hypot(c.x - jp.x, c.z - jp.z) < Math.hypot(a.x - jp.x, a.z - jp.z) ? c : a),
      );
      this.teleportJimothy(near.x, near.z);
    });

    eventBus.on(Events.PLAYER_NETTED, () => {
      if (!gameState.game.isPlaying) return;
      gameState.game.netted = true;
      gameState.game.isPlaying = false;
      gameState.saveBestScore();
      eventBus.emit(Events.GAME_OVER, {
        score: gameState.player.score,
        best: gameState.bestScore,
      });
    });

    // GameOverScreen emits GAME_RESTART; the orchestrator performs the reset
    // FIRST (listeners registered before other systems see the event would
    // race), so restart order lives here, not in subscribers.
    eventBus.on(Events.GAME_RESTART, () => {
      gameState.reset();
      this.jimothy.reset();
      this.trashCans.reset();
      this.pursuers.reset();
      this.pedestrians.reset();
      this.treasures.reset();
      this.crabs.reset();
      this.debris.reset();
      this.voxels.clear();
      installCity(this.voxels);
      gameState.game.started = true;
      gameState.game.isPlaying = true;
    });

    gameState.game.started = true;
    gameState.game.isPlaying = true;

    this.frames = 0;
    this.diagEl = document.getElementById('diag');
    this.hintEl = document.getElementById('input-hint');
    this.diagTimer = 0;

    this.renderer.setAnimationLoop(() => this.animate());
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.SKY);
    // Pushed out to where the island actually ends. It used to be 40–200 m on a
    // world that only extends 106 m, so the ONLY thing it fogged was the part
    // you could see; the horizon mesh is what makes reaching further worth it.
    this.scene.fog = new THREE.Fog(COLORS.FOG, COLORS.FOG_NEAR, COLORS.FOG_FAR);

    this.ambient = new THREE.AmbientLight(COLORS.AMBIENT, 0.6);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(COLORS.SUN, 2.2);
    this.sun.position.set(-30, 18, 25); // low in the sky: golden hour
    this.scene.add(this.sun);

    // Underground (milestone 18). Golden hour is useless down a sewer, and the
    // milestone asks for lit enough to move through and dark enough to be
    // unpleasant — so the only light down there is the one he carries, and the
    // fog closes to a few metres. Nothing is added or removed at the boundary;
    // the same three lights are re-weighted, which keeps the transition free of
    // a shader recompile.
    this.lamp = new THREE.PointLight(SEWER.LIGHT_COLOR, 0, SEWER.LIGHT_RANGE, 1.4);
    this.scene.add(this.lamp);
    this.underground = false;

    // Where the headbutt will land (milestone 20). The backlog entry for the
    // aimable headbutt named this as a requirement rather than a nicety: you
    // cannot aim at what you cannot see. Colour carries the one thing the aim
    // alone does not tell you — whether this swing will dig.
    this.reticle = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.055, 6, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.RETICLE, transparent: true, opacity: 0.85 }),
    );
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
    this._aimDir = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
  }

  /** Cross between daylight and the sewer. Called on the transition only. */
  _setUnderground(on) {
    if (on === this.underground) return;
    this.underground = on;
    this.lamp.intensity = on ? SEWER.LIGHT_INTENSITY : 0;
    this.sun.intensity = on ? 0.05 : 2.2;
    this.ambient.intensity = on ? 0.12 : 0.6;
    this.scene.background.set(on ? SEWER.FOG_COLOR : COLORS.SKY);
    this.scene.fog.color.set(on ? SEWER.FOG_COLOR : COLORS.FOG);
    this.scene.fog.near = on ? SEWER.FOG_NEAR : COLORS.FOG_NEAR;
    this.scene.fog.far = on ? SEWER.FOG_FAR : COLORS.FOG_FAR;
    // Nothing to see out there when you are under it, and lighting a 2 km mesh
    // off a head torch just makes a grey plane.
    if (this.level?.horizon) this.level.horizon.visible = !on;
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      CAMERA.NEAR,
      CAMERA.FAR,
    );
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update(delta) {
    if (this.input.consumeFlyToggle()) {
      this.flyCamera.toggle();
      // Landing puts the follow camera back on him immediately. Controls are
      // camera-relative, so lerping in from wherever the flight ended means the
      // input frame is garbage until it arrives — the same reason
      // teleportJimothy snaps it.
      if (!this.flyCamera.active) this.cameraSystem.snapToTarget();
    }
    this.input.update();
    // Before he moves, not after: the ground he is about to walk onto has to
    // exist by the time the controller queries it. The queries generate on
    // demand anyway, but arriving first is what keeps that a safety net rather
    // than the hot path.
    //
    // Two centres while flying: the camera needs ground under it to be worth
    // looking at, and dropping HIS column to pay for that would put the raccoon
    // over a void the moment you land.
    const jp = this.jimothy.group.position;
    const cp = this.camera.position;
    this.voxels.streamAroundPoints(
      this.flyCamera.active
        ? [[jp.x, jp.z], [cp.x, cp.z, STREAM.FLY_LOAD_RADIUS]]
        : [[jp.x, jp.z]],
      this.flyCamera.active ? STREAM.FLY_COLUMNS_PER_FRAME : STREAM.COLUMNS_PER_FRAME,
    );
    this.voxels.remeshDirty();
    // Containers stay tied to HIM, never to the camera: streaming them around a
    // free-flying viewpoint would despawn and respawn the cans he is standing
    // next to, losing which ones he had already tipped.
    this.trashCans.streamAround(jp.x, jp.z);
    // Aiming IS looking (milestone 20): the aim is how far below horizontal the
    // camera is pointed, which the mouse already drives whenever the pointer is
    // locked. One frame stale, because the camera updates after him — which at
    // 60 Hz is nothing, and keeps the order of the loop unchanged.
    this.jimothy.update(delta, this.cameraSystem.yaw, this.cameraSystem.aimPitch);
    this.physics.update(delta);
    this.jimothy.postUpdate(delta);
    this.trashCans.update(delta);
    this.pursuers.update(delta);
    this.pedestrians.update(delta);
    this.score.update(delta);
    this.heat.update(delta);
    this.debris.update(delta);
    this.treasures.update(delta);
    this.crabs.update(delta);
    // Underground is a property of DEPTH BELOW THIS COLUMN, not of a y value —
    // grade stopped being a constant when the island got hills (milestone 17).
    this._setUnderground(this.voxels.terrainHeightAt(jp.x, jp.z) - jp.y > SEWER.BELOW);
    this.lamp.position.set(jp.x, jp.y + 1.6, jp.z);
    this.updateReticle();
    if (this.flyCamera.active) this.flyCamera.update(delta);
    else if (!this.freeCamera) this.cameraSystem.update(delta);
    this.devTools.update(delta);
  }

  animate() {
    const now = performance.now();
    const delta = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;
    this.lastDelta = delta;
    if (!this.manualTime) this.update(delta);
    this.frames += 1;
    this.updateDiag(delta);
    this.renderer.render(this.scene, this.camera);
  }

  // Always-visible readout of every input layer (frames → keys → move vector
  // → velocity → position) so a dead layer on any machine is one glance away.
  // Runs from animate, not update, so it reflects RAF liveness even when the
  // test harness has frozen sim time.
  updateDiag(delta) {
    this.diagTimer -= delta;
    if (this.diagTimer > 0) return;
    this.diagTimer = 0.15;
    const jp = this.jimothy.group.position;
    const gp = this.input.gamepadInfo;
    this.diagEl.textContent =
      `f:${this.frames} dt:${(this.lastDelta * 1000).toFixed(1)} ` +
      `in:${[...this.input.codes].join(',') || '—'} ` +
      `mv:${this.input.moveX.toFixed(1)},${this.input.moveZ.toFixed(1)} ` +
      `fw:${KEYBINDS.FORWARD.join('/')} ` +
      `spd:${PLAYER_CONFIG.SPEED} vel:${this.jimothy.speed.toFixed(1)} ` +
      `pos:${jp.x.toFixed(1)},${jp.z.toFixed(1)} ` +
      `cam:${this.flyCamera.active ? `fly×${this.flyCamera.multiplier}` : this.cameraSystem.mode}` +
      `${gp ? ' 🎮drift:' + gp.axes.slice(0, 2).join(',') : ''}`;
    // Pointer events arriving without a single key event ever = the host is
    // eating the keyboard. Tell the player instead of feeling broken.
    this.hintEl.classList.toggle(
      'hidden',
      this.input.everKeydown || !this.input.everPointer,
    );
  }

  /** Park the reticle on the predicted impact. Shown while the pointer is
   *  locked — that is when the player is aiming — and while a headbutt is in
   *  flight, so you can see it arrive where it was promised. */
  updateReticle() {
    const H = MOVES.HEADBUTT;
    const aim = this.jimothy.move?.aim ?? this.jimothy.aimPitch ?? 0;
    const digs = this.digsTerrain(H, aim);
    // While aiming (pointer locked), while a swing is in flight, and ALWAYS when
    // the aim would dig — that last one is the case where the player most needs
    // to know, and it is also the one where the camera is least informative.
    const aiming = this.input.pointerLocked || digs
      || this.jimothy.move?.kind === 'headbutt';
    this.reticle.visible = aiming && gameState.game.isPlaying && !this.flyCamera.active;
    if (!this.reticle.visible) return;
    const flat = Math.cos(aim);
    this._aimDir.set(
      Math.sin(this.jimothy.yaw) * flat, -Math.sin(aim), Math.cos(this.jimothy.yaw) * flat,
    );
    const p = this.jimothy.body.position;
    this.impactPoint(p, this._aimDir, H, H.REACH, this.reticle.position, digs);
    this.reticle.material.color.set(digs ? COLORS.RETICLE_DIG : COLORS.RETICLE);
  }

  /** Where a move's blast will land (milestone 20).
   *
   *  ONE function, used by the blast and by the reticle. A reticle that lies is
   *  worse than no reticle, and the way a reticle comes to lie is two copies of
   *  the same arithmetic drifting apart.
   *
   *  Offset ahead by the blast's own radius plus the move's reach, so a
   *  wrecking-ball Jimothy carves what he is pointing at rather than the floor
   *  beneath him (playtest 2026-07-23: "he gets stuck in a hole"). */
  impactPoint(from, dir, cfg, reach, out = {}, digging = false) {
    const r = this.blastRadius(cfg.FAT_BLAST_SHARE) * cfg.RADIUS_SCALE;
    // The radius-sized standoff exists to keep a fat Jimothy from cratering the
    // pit he is standing in and dropping into it (playtest 2026-07-23).
    //
    // A DIGGING swing wants exactly that, and the standoff actively prevents it:
    // at full fatness it is 4.8 m, which pushed the whole sphere below the
    // surface and left an intact 0.85 m lid over a cavern he could not reach.
    // Measured as 0 m of shaft for a swing that removed a thousand voxels.
    // Pointing down already carries the blast off his body, so reach alone is
    // the right standoff there.
    const dist = digging ? reach : r * 0.95 + reach;
    out.x = from.x + dir.x * dist;
    // Chest height, so a flat swing's crater stays shallow and walkable — and
    // the aim carries it down from there when he points at the ground.
    out.y = from.y + 0.35 + dir.y * dist;
    out.z = from.z + dir.z * dist;
    return out;
  }

  /** Is terrain a target for this swing? For an AIMABLE move, only when it is
   *  pointed deliberately downward — which is the whole of milestone 20. */
  digsTerrain(cfg, aim) {
    return cfg.AIMABLE ? aim >= cfg.DIG_ANGLE : cfg.DIGS_TERRAIN;
  }

  // Blow a hole in the world: clear voxels, re-mesh only the chunks that
  // changed, and throw the removed cells as pooled debris.
  /** Damage the world at an exact world position. Callers aim it themselves —
   *  this used to add its own vertical offset, which stacked with the move's
   *  aim and lifted the sphere clear of the ground it was meant to hit. */
  blastAt(pos, radiusScale = 1, { fatShare = 1, digsTerrain = true } = {}) {
    const removed = this.voxels.damageSphere(
      pos.x, pos.y, pos.z, this.blastRadius(fatShare) * radiusScale, { digsTerrain },
    );
    if (!removed.length) return 0;
    this.voxels.remeshDirty();
    this.debris.spawnBurst(removed);
    // WHERE, not just how much (milestone 19). Destruction is loud, and the
    // noise is what pulls pursuers — toward the wall he just came through
    // rather than toward him, which is what makes demolition a decision.
    eventBus.emit(Events.WORLD_DEMOLISHED, { voxels: removed.length, x: pos.x, z: pos.z });
    return removed.length;
  }

  // Fat Jimothy hits harder — same asymptotic curve as his body and speed
  // penalty, so what you see is what you wreck. `fatShare` is how much of that
  // bonus a given move inherits: the headbutt takes all of it, the roll only a
  // slice, which is what makes them different tools rather than two buttons
  // for the same wrecking ball (MOVES).
  blastRadius(fatShare = 1) {
    const f = gameState.player.fatness / (gameState.player.fatness + FATNESS.SOFTCAP);
    return VOXEL.BLAST_RADIUS + f * FATNESS.BLAST_PER_FAT * fatShare;
  }

  teleportJimothy(x, z) {
    this.jimothy.body.position.x = x;
    this.jimothy.body.position.z = z;
    // …and onto the ground THERE. Keeping his old y was invisible on a flat
    // world and is a 40 m fall on the island: teleporting from Compost Hill to
    // Trashattan left him in the air for two seconds, which any spec that warps
    // and immediately measures would read as a bug in whatever it was testing.
    this.voxels.streamAround(x, z);
    const surface = this.voxels.terrainHeightAt(x, z);
    this.jimothy.body.position.y =
      this.voxels.groundHeightAt(x, z, surface + 3) + this.jimothy.radius;
    this.jimothy.vy = 0;
    this.jimothy.vel.set(0, 0, 0);
    this.jimothy._prevX = undefined;
    this.jimothy._prevZ = undefined;
    this.jimothy._prevFeetY = undefined; // sweep origin from the old location
    this.jimothy.postUpdate(0); // settle onto the ground at the new spot
    // Snap the camera too. Controls are camera-relative, so leaving it to
    // lerp from across the city means the input frame is garbage until it
    // arrives — which sends anything steering by it (specs, and the player
    // after a respawn) off in random directions.
    this.cameraSystem.snapToTarget();
  }

  restart() {
    eventBus.emit(Events.GAME_RESTART);
  }

  // --- Test hooks (Playwright live-iterate loop) ---

  /** A standoff position facing a real wall, found by search rather than
   *  hardcoded: the city is procedural, so any fixed coordinate rots the first
   *  time the layout changes.
   *
   *  `probeY` is height ABOVE THIS COLUMN'S OWN GROUND, not an absolute y. Read
   *  as absolute it stopped meaning "just above the pavement" the moment the
   *  island got hills: at a literal y = 1.0 every point on a 40 m hill probes
   *  solid rock, so the search reported the first spot it tried as a wall and
   *  never found a standoff. */
  findWallTarget(probeY = 1.0, standoff = 2.6) {
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const solidAbove = (x, z) =>
      this.voxels.solidAtWorld(x, this.voxels.terrainHeightAt(x, z) + probeY, z);
    for (let r = 4; r < WORLD.BOUNDS; r += 2) {
      for (let a = 0; a < 32; a++) {
        const th = (a / 32) * Math.PI * 2;
        const wx = Math.cos(th) * r;
        const wz = Math.sin(th) * r;
        if (!solidAbove(wx, wz)) continue;
        for (const [dx, dz] of DIRS) {
          const sx = wx - dx * standoff;
          const sz = wz - dz * standoff;
          if (solidAbove(sx, sz)) continue;
          // Forward is (sin yaw, cos yaw), so this yaw points at the wall.
          return { x: sx, z: sz, yaw: Math.atan2(dx, dz) };
        }
      }
    }
    return null;
  }

  /** Every sewer stairwell on the island (milestone 18). */
  sewerEntrances() {
    return Layout.Masterplan.sewerNetwork().flatMap((c) => c.entrances);
  }

  /** Is there a walkable route from underground at (x, z) back to daylight?
   *
   *  A breadth-first search over STANDABLE voxels: air with headroom, something
   *  solid underfoot, and a step to the next one no taller than he can climb.
   *  It is the executable form of "tunnels are navigable — no dead space you
   *  cannot get out of", and it has to be a search rather than a look, because
   *  a tunnel that is obviously fine at the stairs can be sealed 200 m along.
   *
   *  Returns the surfacing point, or null. Bounded by `budget`, so a spec on a
   *  broken world fails instead of hanging. */
  sewerEscapeRoute(x, z, budget = 20000) {
    const s = VOXEL.SIZE;
    const headroom = Math.ceil(1.2 / s);
    const climb = Math.floor(PLAYER_CONFIG.CLIMB_HEIGHT / s);
    const start = this.standableUnder(x, z);
    if (!start) return null;
    const key = (v) => `${v[0]},${v[1]},${v[2]}`;
    const seen = new Set([key(start)]);
    const queue = [start];
    let visited = 0;
    while (queue.length && visited++ < budget) {
      const [vx, vy, vz] = queue.shift();
      // Daylight: open sky above this voxel means he has surfaced.
      if ((vy + 0.5) * s >= this.voxels.terrainHeightAt((vx + 0.5) * s, (vz + 0.5) * s) - 0.5) {
        return { x: (vx + 0.5) * s, y: vy * s, z: (vz + 0.5) * s, visited };
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        // Try every height he could step to, nearest first.
        for (let dy = -climb - 1; dy <= climb; dy++) {
          const n = [vx + dx, vy + dy, vz + dz];
          if (seen.has(key(n))) continue;
          if (!this.isStandable(n[0], n[1], n[2], headroom)) continue;
          seen.add(key(n));
          queue.push(n);
          break; // one landing per direction: the lowest reachable one
        }
      }
    }
    return null;
  }

  /** Air, with headroom, on top of something solid. */
  isStandable(vx, vy, vz, headroom) {
    if (this.voxels.get(vx, vy, vz) !== 0) return false;
    if (this.voxels.get(vx, vy - 1, vz) === 0) return false;
    for (let h = 1; h <= headroom; h++) if (this.voxels.get(vx, vy + h, vz) !== 0) return false;
    return true;
  }

  /** The lowest standable voxel below the surface at (x, z) — the tunnel floor,
   *  if there is one here. */
  standableUnder(x, z) {
    const s = VOXEL.SIZE;
    const headroom = Math.ceil(1.2 / s);
    const [vx, , vz] = this.voxels.worldToVoxel(x, 0, z);
    const top = Math.floor(this.voxels.terrainHeightAt(x, z) / s);
    for (let vy = top - Math.ceil(SEWER.BELOW / s); vy > top - 40; vy--) {
      if (this.isStandable(vx, vy, vz, headroom)) return [vx, vy, vz];
    }
    return null;
  }

  renderToText() {
    const jp = this.jimothy.group.position;
    const cp = this.camera.position;
    return JSON.stringify({
      score: gameState.player.score,
      combo: gameState.player.combo,
      snacksEaten: gameState.player.snacksEaten,
      fatness: gameState.player.fatness,
      bestScore: gameState.bestScore,
      hidden: gameState.player.hidden,
      stunned: gameState.player.stunned,
      heat: {
        points: +gameState.heat.points.toFixed(1),
        tier: gameState.heat.tier,
      },
      game: gameState.game,
      pursuers: this.pursuers.snapshot(),
      underground: {
        below: this.underground,
        depth: +(this.voxels.terrainHeightAt(jp.x, jp.z) - jp.y).toFixed(2),
        treasure: this.treasures.snapshot(),
        crabs: this.crabs.snapshot(),
        finds: gameState.player.finds,
      },
      hideSpots: HIDE_SPOTS.POSITIONS.map(([x, z]) => ({ x, z })),
      voxels: {
        ...this.voxels.stats(),
        debris: this.debris.liveCount,
        drawCalls: this.renderer.info.render.calls,
      },
      rig: {
        loaded: this.jimothy.rig.loaded,
        pieces: this.jimothy.rig.pieces.length,
        skinned: !!this.jimothy.rig.skinned,
        bones: Object.keys(this.jimothy.rig.bones || {}).length,
        // Fatness must grow the belly and NOTHING else (Chris 2026-08-07), so
        // every bone but `body` has to read 1 however much he has eaten.
        boneScales: this.jimothy.rig.skinned ? this.jimothy.rig.boneScales() : null,
        // Each animated part's position in Jimothy's own frame. Bones have no
        // per-piece object to read a transform off, so without this there is
        // no way to assert from outside that an animation moved anything.
        parts: this.jimothy.rig.skinned
          ? this.jimothy.rig.partOffsets(this.jimothy.group)
          : null,
        placeholderHidden: this.jimothy.placeholderHidden,
        // Read off the meshes themselves, not off any list the controller
        // keeps — "is he see-through?" has to be answered by what actually
        // renders (milestone 08).
        materials: [...new Set(this.jimothy.rig.pieces.map((p) => p.material))].map((m) => ({
          transparent: m.transparent,
          depthWrite: m.depthWrite,
          opacity: +m.opacity.toFixed(2),
        })),
      },
      feet: this.jimothy.legs.snapshot(),
      jimothy: {
        x: +jp.x.toFixed(2),
        y: +jp.y.toFixed(2),
        z: +jp.z.toFixed(2),
        yaw: +this.jimothy.yaw.toFixed(2),
        grounded: this.jimothy.grounded,
        speed: +this.jimothy.speed.toFixed(2),
        widthScale: +(this.jimothy.widthScale || 1).toFixed(3),
        move: this.jimothy.move?.kind ?? null,
        // Radians below horizontal, and whether a swing at that aim would dig.
        aim: +(this.jimothy.aimPitch || 0).toFixed(3),
        digs: this.digsTerrain(MOVES.HEADBUTT, this.jimothy.aimPitch || 0),
        moveCooldown: +this.jimothy.moveCooldown.toFixed(2),
        tuck: +(this.jimothy.rollTuck || 0).toFixed(3),
        ...(() => {
          const { up, parts, bodyY, bodyBottom } = this.jimothy.inspect();
          return {
            bodyY: +bodyY.toFixed(3),
            bodyBottom: +bodyBottom.toFixed(3),
            up: { x: +up.x.toFixed(3), y: +up.y.toFixed(3), z: +up.z.toFixed(3) },
            parts: {
              head: +parts.head.toFixed(3),
              tail: +parts.tail.toFixed(3),
              hips: parts.hips.map((q) => +q.toFixed(3)),
            },
          };
        })(),
      },
      camera: { x: +cp.x.toFixed(2), y: +cp.y.toFixed(2), z: +cp.z.toFixed(2) },
      cameraMode: this.flyCamera.active ? 'fly' : this.cameraSystem.mode,
      fly: this.flyCamera.snapshot(),
      cans: this.trashCans.cans.map((c) => ({
        x: +c.body.position.x.toFixed(1),
        z: +c.body.position.z.toFixed(1),
        tipped: c.tipped,
      })),
      snacks: this.trashCans.snacks.map((s) => ({
        x: +s.mesh.position.x.toFixed(1),
        z: +s.mesh.position.z.toFixed(1),
        type: s.type,
      })),
    });
  }

  advanceTime(seconds) {
    this.manualTime = true;
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) this.update(step);
    this.renderer.render(this.scene, this.camera);
  }
}

export default Game;
