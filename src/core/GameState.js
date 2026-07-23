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
      stunned: false,
      inTree: false,
      hidden: false,
    };
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
