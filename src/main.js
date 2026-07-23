import './style.css';
import Game from './core/Game.js';

const game = new Game();

// Test hooks for the Playwright live-iterate loop (see docs/tech.md).
window.render_game_to_text = () => game.renderToText();
window.advanceTime = (seconds) => game.advanceTime(seconds);
