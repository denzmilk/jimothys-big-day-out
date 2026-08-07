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
      inTree: false,
      hidden: false,
      // Everything he dug up on his big day out (milestone 18). Deliberately
      // NOT a currency and not a score — the joke is that it buys nothing. It
      // exists so the game-over photo book (JIM-31) has something to print.
      finds: [],
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
