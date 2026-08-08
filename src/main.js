import './style.css';
import Game from './core/Game.js';
import { gameState } from './core/GameState.js';

const game = new Game();

// Test hooks for the Playwright live-iterate loop (see docs/tech.md).
window.render_game_to_text = () => game.renderToText();
window.advanceTime = (seconds) => game.advanceTime(seconds);
window.blastAtJimothy = () => game.blastAt(game.jimothy.group.position);
window.blastAtWorld = (x, y, z) => game.blastAt({ x, y, z });
window.teleportJimothy = (x, z) => game.teleportJimothy(x, z);
window.restartGame = () => game.restart();
// Fatness scales body size, blast power and every anchor offset, so specs need
// to reach the extremes without eating 80 snacks to get there.
window.setFatness = (fat) => { gameState.player.fatness = fat; };
// Heading matters for the move specs: bugs that hide when he faces world +z
// (the spawn heading) are exactly the ones that shipped.
//
// Turns the CAMERA with him (milestone 21). Since JIM-38 the aim's yaw comes
// from the camera, not from his body, so a hook that turned only the body left
// him facing a wall and swinging somewhere else — which is not a state a player
// can reach, because the follow camera trails whatever he walks into. Snapped
// rather than lerped, for the same reason teleportJimothy snaps it.
window.faceJimothy = (yaw) => {
  game.jimothy.yaw = yaw;
  game.jimothy.aimYaw = yaw;
  game.cameraSystem.yaw = yaw;
  game.cameraSystem.snapToTarget();
  game.jimothy.postUpdate(0);
};
// "Did that move dig the road?" can't be answered by voxel counts, which can't
// tell a wall from a pavement. Compare against terrainSurfaceAt: the scan
// starts above THIS column's own surface, because the literal 3 that used to be
// here meant "a bit above grade" and grade stopped being a constant when the
// island got hills (milestone 17).
window.groundHeightAtWorld = (x, z) =>
  game.voxels.groundHeightAt(x, z, game.voxels.terrainHeightAt(x, z) + 3);
// The undug ground, so a spec can say "this is lower than it should be" instead
// of "this is below zero".
window.terrainSurfaceAt = (x, z) => game.voxels.terrainHeightAt(x, z);
// Which MATERIAL, not just solid/air: "a tunnel goes somewhere" is a claim
// about the strata changing on the way down, and a boolean can't carry it.
window.materialAtWorld = (x, y, z) =>
  game.voxels.get(...game.voxels.worldToVoxel(x, y, z));
// Real stored voxels, counted rather than estimated. The whole implicit-ground
// design is a claim about this number NOT moving with TERRAIN.DEPTH, so it has
// to be measurable from outside. Deliberately a separate hook: walking 2.4 MB
// of chunk data does not belong in the per-call state snapshot.
window.storedVoxelCount = () => {
  let n = 0;
  for (const chunk of game.voxels.chunks.values()) {
    for (let i = 0; i < chunk.data.length; i++) if (chunk.data[i]) n++;
  }
  return n;
};
window.findWallTarget = () => game.findWallTarget();
// Raw voxel probe. "Is this building whole?" cannot be answered by counts —
// a sliced house and an intact one have the same chunk count (milestone 12).
window.voxelSolidAt = (x, y, z) => game.voxels.solidAtWorld(x, y, z);
// "Has the world been built here?" — distinct from "is there a voxel here",
// which reads the same (false) for empty sky and for ungenerated void.
window.isLoadedAtWorld = (x, z) => game.voxels.isLoadedAtWorld(x, z);
// Drop him from a height so specs can exercise landing, which is where the
// ground resolution actually goes wrong (JIM-19).
window.dropJimothy = (x, z, height) => {
  game.teleportJimothy(x, z);
  game.jimothy.body.position.y = height;
  game.jimothy.vy = 0;
  game.jimothy.grounded = false;
  game.jimothy._prevFeetY = undefined;
};
// Escape hatch for one-off investigations. Renders must be read back inside
// the same evaluate() call that triggers them — the WebGL buffer clears
// between calls, which is why screenshots of this game come out black.
window.__game = game;
// --- Milestone 19: the awareness model, from outside ---
// A pursuer at an EXACT spot. The heat-driven spawn ring cannot put one on the
// far side of a known wall, which is precisely what the vision specs need.
window.spawnPursuerAt = (type, x, z) => game.pursuers.spawnAt(type, x, z);
// Line of sight on its own, so "can he see through a building" is a question
// about geometry rather than about a pursuer that might also be out of range or
// facing the wrong way.
window.voxelLineOfSight = (ax, ay, az, bx, by, bz) =>
  game.voxels.hasLineOfSight(ax, ay, az, bx, by, bz);
// Sight range for a type at a tier, so "escalation buys better eyes" is
// measurable without staging five separate chases.
window.pursuerSightRange = (type, tier) => game.pursuers.sightRange(type, tier);

// --- Milestone 20: aiming ---
// Point him down by `radians`. The aim IS the camera pitch, which the mouse
// drives while the pointer is locked — and pointer lock is not reliably
// available headless, so the specs set the same value the mouse would.
window.aimJimothy = (down) => { game.cameraSystem.pitch = down; };
// …and the other axis (milestone 21 / JIM-38), which milestone 20 never wired.
// Forces the pointer-lock flag as well, because aiming only happens while
// locked and follow mode overwrites the yaw from the camera's own trailing
// position every frame — so without the lock a spec's yaw would survive
// exactly until the next tick. `jimothy.aimYaw` is set directly too, so a
// spec may read the reticle without first stepping the sim.
window.lookJimothy = (yaw) => {
  game.input.forcePointerLock = true;
  game.cameraSystem.mode = 'orbit';
  game.cameraSystem.yaw = yaw;
  game.jimothy.aimYaw = yaw;
  game.updateReticle();
};

// --- Milestone 18: the underground ---
// Every stairwell on the island. "Enterable from street level" is a claim about
// these coordinates, so the specs need them rather than a search of the map.
window.sewerEntrances = () => game.sewerEntrances();
// Can he WALK from here to daylight? A breadth-first search over standable
// voxels — air with headroom, something solid underfoot, and a step to the next
// one he could actually climb. Run in the page in one call, because doing it
// through a few thousand round-trips would take longer than the spec.
//
// This is the AC "no dead space you cannot get out of", and it is the reason it
// is a property rather than an eyeball: a tunnel that looks fine from the
// street can still be sealed 200 m along it.
window.sewerEscapeRoute = (x, z, budget = 20000) => game.sewerEscapeRoute(x, z, budget);

// Free-look hook for capturing overviews without the follow cam fighting it.
window.debugCamera = (x, y, z, lx = 0, ly = 0, lz = 0) => {
  game.freeCamera = true;
  game.camera.position.set(x, y, z);
  game.camera.lookAt(lx, ly, lz);
  game.renderer.render(game.scene, game.camera);
};
