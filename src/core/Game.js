import * as THREE from 'three';
import { CAMERA, COLORS, PLAYER_CONFIG, WORLD } from './Constants.js';
import { gameState } from './GameState.js';

class Game {
  constructor() {
    this.timer = new THREE.Timer();
    this.elapsed = 0;
    this.init();
  }

  init() {
    this.setupRenderer();
    this.setupScene();
    this.setupCamera();
    this.setupPlaceholders();
    this.setupEventListeners();
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
    this.camera.position.set(0, CAMERA.FOLLOW_HEIGHT, CAMERA.FOLLOW_DISTANCE);
  }

  // Placeholder smoke-test scene: ground, a stand-in Jimothy, one trash can.
  // Replaced during development milestones by LevelBuilder + real entities.
  setupPlaceholders() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.BLOCK_SIZE, WORLD.BLOCK_SIZE),
      new THREE.MeshStandardMaterial({ color: COLORS.GROUND }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Short-spine placeholder: a squashed sphere is already 80% of the meme.
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 24, 18),
      new THREE.MeshStandardMaterial({ color: COLORS.PLACEHOLDER_JIMOTHY }),
    );
    body.scale.set(1.0, 0.8, 0.9);
    body.position.y = 0.5;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 14),
      new THREE.MeshStandardMaterial({ color: COLORS.PLACEHOLDER_JIMOTHY }),
    );
    head.position.set(0, 0.35, 0.45);
    this.jimothy = new THREE.Group();
    this.jimothy.add(body, head);
    this.scene.add(this.jimothy);

    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.35, 1.0, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.PLACEHOLDER_TRASH_CAN }),
    );
    can.position.set(2.5, 0.5, -1);
    this.scene.add(can);

    this.camera.lookAt(this.jimothy.position);
  }

  setupEventListeners() {
    // Systems subscribe via EventBus in development milestones.
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update(delta) {
    this.elapsed += delta;
    // Idle waddle-bob so the smoke test proves the loop is alive.
    this.jimothy.position.y =
      Math.abs(Math.sin(this.elapsed * PLAYER_CONFIG.WADDLE_BOB_HZ)) *
      PLAYER_CONFIG.WADDLE_BOB_AMPLITUDE;
    this.jimothy.rotation.z =
      Math.sin(this.elapsed * PLAYER_CONFIG.WADDLE_BOB_HZ) * 0.06;
  }

  animate() {
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  // --- Test hooks (Playwright live-iterate loop) ---

  renderToText() {
    return JSON.stringify({
      score: gameState.player.score,
      combo: gameState.player.combo,
      heat: gameState.heat,
      game: gameState.game,
      jimothy: {
        x: +this.jimothy.position.x.toFixed(2),
        y: +this.jimothy.position.y.toFixed(2),
        z: +this.jimothy.position.z.toFixed(2),
      },
    });
  }

  advanceTime(seconds) {
    // Deterministic fixed steps so tests don't depend on wall-clock time.
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) this.update(step);
    this.renderer.render(this.scene, this.camera);
  }
}

export default Game;
