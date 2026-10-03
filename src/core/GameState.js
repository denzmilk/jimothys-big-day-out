import {TOOLS} from './Constants.js';
class GameState {
  constructor() {
    this.reset();
    this.bestScore = Number(localStorage.getItem('jimothy-best-score')) || 0;
  }

  reset() {
    this.player = {
      score: 0,
      combo: 1,
      snacksEaten: 0,
      fatness: 0,
      stunned: false,
      swimming: false,
      diving: false,
      inTree: false,
      hidden: false,
      // Everything he dug up on his big day out (milestone 18). Deliberately
      // NOT a currency and not a score — the joke is that it buys nothing. It
      // exists so the game-over photo book (JIM-31) has something to print.
      finds: [],
    };
    this.tools={equipped:null,energy:TOOLS.ENERGY_START,shield:0};
    this.world = { disabledHideSpots: new Set() };
    this.capture = { progress: 0, holding: false, phase: 'idle' };
    this.arrival = {phase:'done',time:0,ground:0,impacts:0,pitch:0,tuck:0};
    this.heat = {
      points: 0,
      tier: 0,
    };
    this.game = {
      started: false,
      paused: false,
      isPlaying: false,
      netted: false,
    };
  }

  saveBestScore() {
    if (this.player.score > this.bestScore) {
      this.bestScore = this.player.score;
      localStorage.setItem('jimothy-best-score', String(this.bestScore));
    }
  }
}

export const gameState = new GameState();
