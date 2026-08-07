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
window.faceJimothy = (yaw) => { game.jimothy.yaw = yaw; game.jimothy.postUpdate(0); };
// "Did that move dig the road?" can't be answered by voxel counts, which
// can't tell a wall from a pavement. Grade is y = 0, so a negative reading
// here IS a hole in the terrain.
window.groundHeightAtWorld = (x, z) => game.voxels.groundHeightAt(x, z, 3);
window.findWallTarget = () => game.findWallTarget();
// Raw voxel probe. "Is this building whole?" cannot be answered by counts —
// a sliced house and an intact one have the same chunk count (milestone 12).
window.voxelSolidAt = (x, y, z) => game.voxels.solidAtWorld(x, y, z);
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
// Free-look hook for capturing overviews without the follow cam fighting it.
window.debugCamera = (x, y, z, lx = 0, ly = 0, lz = 0) => {
  game.freeCamera = true;
  game.camera.position.set(x, y, z);
  game.camera.lookAt(lx, ly, lz);
  game.renderer.render(game.scene, game.camera);
};
