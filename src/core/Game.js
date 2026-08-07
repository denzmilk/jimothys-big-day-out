import * as THREE from 'three';
import {
  CAMERA, COLORS, PLAYER_CONFIG, KEYBINDS, HIDE_SPOTS, VOXEL, WORLD, FATNESS,
} from './Constants.js';
import { gameState } from './GameState.js';
import { eventBus, Events } from './EventBus.js';
import { DevOverrides } from './DevOverrides.js';
import { InputSystem } from '../systems/InputSystem.js';
import { PhysicsSystem } from '../systems/PhysicsSystem.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { HeatSystem } from '../systems/HeatSystem.js';
import { JimothyController } from '../gameplay/JimothyController.js';
import { TrashCans } from '../gameplay/TrashCans.js';
import { Pursuers } from '../gameplay/Pursuers.js';
import { LevelBuilder } from '../level/LevelBuilder.js';
import { VoxelWorld } from '../level/VoxelWorld.js';
import { installCity } from '../level/VoxelCity.js';
import { Debris } from '../gameplay/Debris.js';
import { Pedestrians } from '../gameplay/Pedestrians.js';
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

    this.setupRenderer();
    this.setupScene();
    this.setupCamera();

    this.input = new InputSystem(this.renderer.domElement);
    this.physics = new PhysicsSystem();
    this.level = new LevelBuilder(this.scene);
    this.voxels = new VoxelWorld(this.scene);
    installCity(this.voxels);
    this.debris = new Debris(this.scene, this.physics);
    this.jimothy = new JimothyController(this.scene, this.physics, this.input, this.voxels);
    // Moves land their damage ahead of him (headbutt/roll), never underfoot.
    // The offset is the blast radius itself plus the move's own reach, so a
    // wrecking-ball Jimothy carves the wall in front rather than the floor
    // beneath (playtest 2026-07-23: "he gets stuck in a hole").
    // The move hands over its own config, so its demolition policy travels
    // with it instead of being re-derived here from positional arguments.
    this.jimothy.onImpact = (x, y, z, dirX, dirZ, cfg, reach) => {
      const opts = { fatShare: cfg.FAT_BLAST_SHARE, digsTerrain: cfg.DIGS_TERRAIN };
      const r = this.blastRadius(opts.fatShare) * cfg.RADIUS_SCALE;
      const dist = r * 0.95 + reach;
      // Aimed at chest height so ground craters stay shallow and walkable.
      this.blastAt(
        { x: x + dirX * dist, y: y + 0.35, z: z + dirZ * dist }, cfg.RADIUS_SCALE, opts,
      );
    };
    this.trashCans = new TrashCans(this.scene, this.physics, this.jimothy);
    this.pursuers = new Pursuers(this.scene, this.jimothy);
    this.pedestrians = new Pedestrians(this.scene, this.jimothy, this.voxels);
    this.score = new ScoreSystem();
    this.heat = new HeatSystem();
    this.cameraSystem = new CameraSystem(this.camera, this.jimothy, this.input);
    this.hud = new HUD();
    this.gameOverScreen = new GameOverScreen();
    this.devTools = new DevTools(this.input);

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'CAMERA' && key === 'FOV') {
        this.camera.fov = CAMERA.FOV;
        this.camera.updateProjectionMatrix();
      }
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
    this.scene.fog = new THREE.Fog(COLORS.FOG, 40, 200);

    this.scene.add(new THREE.AmbientLight(COLORS.AMBIENT, 0.6));
    const sun = new THREE.DirectionalLight(COLORS.SUN, 2.2);
    sun.position.set(-30, 18, 25); // low in the sky: golden hour
    this.scene.add(sun);
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
    this.input.update();
    // Before he moves, not after: the ground he is about to walk onto has to
    // exist by the time the controller queries it. The queries generate on
    // demand anyway, but arriving first is what keeps that a safety net rather
    // than the hot path.
    const jp = this.jimothy.group.position;
    this.voxels.streamAround(jp.x, jp.z);
    this.voxels.remeshDirty();
    this.jimothy.update(delta, this.cameraSystem.yaw);
    this.physics.update(delta);
    this.jimothy.postUpdate(delta);
    this.trashCans.update(delta);
    this.pursuers.update(delta);
    this.pedestrians.update(delta);
    this.score.update(delta);
    this.heat.update(delta);
    this.debris.update(delta);
    if (!this.freeCamera) this.cameraSystem.update(delta);
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
      `cam:${this.cameraSystem.mode}${gp ? ' 🎮drift:' + gp.axes.slice(0, 2).join(',') : ''}`;
    // Pointer events arriving without a single key event ever = the host is
    // eating the keyboard. Tell the player instead of feeling broken.
    this.hintEl.classList.toggle(
      'hidden',
      this.input.everKeydown || !this.input.everPointer,
    );
  }

  // Blow a hole in the world: clear voxels, re-mesh only the chunks that
  // changed, and throw the removed cells as pooled debris.
  /** Damage the world at an exact world position. Callers aim it themselves —
   *  this used to add its own vertical offset, which stacked with the move's
   *  aim and lifted the sphere clear of the ground it was meant to hit. */
  blastAt(pos, radiusScale = 1, { fatShare = 1, digsTerrain = true } = {}) {
    const removed = this.voxels.damageSphere(
      pos.x, pos.y, pos.z, this.blastRadius(fatShare) * radiusScale,
      digsTerrain ? -Infinity : 0,
    );
    if (!removed.length) return 0;
    this.voxels.remeshDirty();
    this.debris.spawnBurst(removed);
    eventBus.emit(Events.WORLD_DEMOLISHED, { voxels: removed.length });
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
   *  time the layout changes. Probes above grade so it can only ever find
   *  structure, never terrain. */
  findWallTarget(probeY = 1.0, standoff = 2.6) {
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let r = 4; r < WORLD.BOUNDS; r += 2) {
      for (let a = 0; a < 32; a++) {
        const th = (a / 32) * Math.PI * 2;
        const wx = Math.cos(th) * r;
        const wz = Math.sin(th) * r;
        if (!this.voxels.solidAtWorld(wx, probeY, wz)) continue;
        for (const [dx, dz] of DIRS) {
          const sx = wx - dx * standoff;
          const sz = wz - dz * standoff;
          if (this.voxels.solidAtWorld(sx, probeY, sz)) continue;
          // Forward is (sin yaw, cos yaw), so this yaw points at the wall.
          return { x: sx, z: sz, yaw: Math.atan2(dx, dz) };
        }
      }
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
      cameraMode: this.cameraSystem.mode,
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
