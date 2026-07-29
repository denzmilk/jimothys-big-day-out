import * as THREE from 'three';
import { CAMERA, COLORS, PLAYER_CONFIG, KEYBINDS, HIDE_SPOTS } from './Constants.js';
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
    this.jimothy = new JimothyController(this.scene, this.physics, this.input);
    this.trashCans = new TrashCans(this.scene, this.physics, this.jimothy);
    this.pursuers = new Pursuers(this.scene, this.jimothy);
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
    this.jimothy.update(delta, this.cameraSystem.yaw);
    this.physics.update(delta);
    this.jimothy.postUpdate(delta);
    this.trashCans.update(delta);
    this.pursuers.update(delta);
    this.score.update(delta);
    this.heat.update(delta);
    this.cameraSystem.update(delta);
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

  // --- Test hooks (Playwright live-iterate loop) ---

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
      rig: {
        loaded: this.jimothy.rig.loaded,
        pieces: this.jimothy.rig.pieces.length,
        placeholderHidden: this.jimothy.placeholderHidden,
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
