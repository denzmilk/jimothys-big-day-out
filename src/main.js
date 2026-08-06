import './style.css';
import Game from './core/Game.js';

const game = new Game();

// Test hooks for the Playwright live-iterate loop (see docs/tech.md).
window.render_game_to_text = () => game.renderToText();
window.advanceTime = (seconds) => game.advanceTime(seconds);
window.blastAtJimothy = () => game.blastAt(game.jimothy.group.position);
window.blastAtWorld = (x, y, z) => game.blastAt({ x, y, z });
window.teleportJimothy = (x, z) => game.teleportJimothy(x, z);
window.restartGame = () => game.restart();
// Free-look hook for capturing overviews without the follow cam fighting it.
window.debugCamera = (x, y, z, lx = 0, ly = 0, lz = 0) => {
  game.freeCamera = true;
  game.camera.position.set(x, y, z);
  game.camera.lookAt(lx, ly, lz);
  game.renderer.render(game.scene, game.camera);
};
