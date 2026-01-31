import { Game, GameState, Move } from './Game';
import { PuzzleGenerator, Difficulty } from './PuzzleGenerator';

export interface Player {
  id: string;
  name: string;
  type: 'human' | 'agent';
  connected: boolean;
}

export interface PlayerState {
  player: Player;
  game: Game;
  progress: number;
  correctCells: number;
  mistakes: number;
  lastMoveAt?: number;
}

export type RaceState = 'waiting' | 'countdown' | 'playing' | 'finished';

export interface RaceResult {
  winner: Player | null;
  playerResults: {
    player: Player;
    timeMs: number;
    progress: number;
    mistakes: number;
    completed: boolean;
    rank: number;
  }[];
  finishedAt: number;
}

export type RaceEvent =
  | { type: 'player_joined'; player: Player }
  | { type: 'player_left'; playerId: string }
  | { type: 'countdown'; secondsLeft: number }
  | { type: 'race_started'; puzzle: string; startedAt: number }
  | { type: 'player_move'; playerId: string; move: Move; progress: number }
  | { type: 'player_completed'; playerId: string; timeMs: number }
  | { type: 'race_finished'; result: RaceResult };

export type RaceEventListener = (event: RaceEvent) => void;

export interface RaceConfig {
  maxPlayers: number;
  difficulty: Difficulty;
  countdownSeconds: number;
  timeLimitMs?: number;
}

const DEFAULT_CONFIG: RaceConfig = {
  maxPlayers: 2,
  difficulty: 'medium',
  countdownSeconds: 3,
  timeLimitMs: undefined,
};

/**
 * Manages a multiplayer race game session.
 */
export class RaceGame {
  private id: string;
  private config: RaceConfig;
  private state: RaceState;
  private puzzle: string;
  private solution: string;
  private players: Map<string, PlayerState>;
  private listeners: RaceEventListener[] = [];
  private startedAt?: number;
  private finishedAt?: number;
  private result?: RaceResult;
  private countdownTimer?: ReturnType<typeof setTimeout>;
  private timeLimitTimer?: ReturnType<typeof setTimeout>;

  constructor(id: string, config: Partial<RaceConfig> = {}) {
    this.id = id;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = 'waiting';
    this.players = new Map();

    // Generate puzzle
    const generated = PuzzleGenerator.generate(this.config.difficulty);
    this.puzzle = generated.puzzle;
    this.solution = generated.solution;
  }

  getId(): string {
    return this.id;
  }

  getState(): RaceState {
    return this.state;
  }

  getPuzzle(): string {
    return this.puzzle;
  }

  getSolution(): string {
    return this.solution;
  }

  getPlayers(): Player[] {
    return Array.from(this.players.values()).map(ps => ps.player);
  }

  getPlayerState(playerId: string): PlayerState | undefined {
    return this.players.get(playerId);
  }

  getAllPlayerStates(): PlayerState[] {
    return Array.from(this.players.values());
  }

  isFull(): boolean {
    return this.players.size >= this.config.maxPlayers;
  }

  joinPlayer(player: Player): boolean {
    if (this.state !== 'waiting') {
      return false;
    }

    if (this.players.has(player.id)) {
      return false;
    }

    if (this.isFull()) {
      return false;
    }

    const game = new Game(`${this.id}-${player.id}`, this.puzzle);
    const playerState: PlayerState = {
      player,
      game,
      progress: 0,
      correctCells: 0,
      mistakes: 0,
    };

    this.players.set(player.id, playerState);
    this.emit({ type: 'player_joined', player });

    // Auto-start countdown when full
    if (this.isFull()) {
      this.startCountdown();
    }

    return true;
  }

  leavePlayer(playerId: string): boolean {
    if (!this.players.has(playerId)) {
      return false;
    }

    this.players.delete(playerId);
    this.emit({ type: 'player_left', playerId });

    // Cancel countdown if not enough players
    if (this.state === 'countdown' && this.players.size < 2) {
      this.cancelCountdown();
    }

    return true;
  }

  startCountdown(): void {
    if (this.state !== 'waiting') return;
    if (this.players.size < 2) return;

    this.state = 'countdown';
    let secondsLeft = this.config.countdownSeconds;

    const tick = () => {
      this.emit({ type: 'countdown', secondsLeft });

      if (secondsLeft <= 0) {
        this.startRace();
      } else {
        secondsLeft--;
        this.countdownTimer = setTimeout(tick, 1000);
      }
    };

    tick();
  }

  private cancelCountdown(): void {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = undefined;
    }
    this.state = 'waiting';
  }

  private startRace(): void {
    this.state = 'playing';
    this.startedAt = Date.now();

    // Start all player games
    for (const playerState of this.players.values()) {
      playerState.game.start();
    }

    this.emit({
      type: 'race_started',
      puzzle: this.puzzle,
      startedAt: this.startedAt,
    });

    // Set time limit if configured
    if (this.config.timeLimitMs) {
      this.timeLimitTimer = setTimeout(() => {
        this.finishRace();
      }, this.config.timeLimitMs);
    }
  }

  makeMove(playerId: string, row: number, col: number, value: number): boolean {
    if (this.state !== 'playing') {
      return false;
    }

    const playerState = this.players.get(playerId);
    if (!playerState) {
      return false;
    }

    const game = playerState.game;
    if (game.getState() === GameState.COMPLETED) {
      return false;
    }

    // Check if move is correct against solution
    const solutionValue = parseInt(this.solution[row * 9 + col], 10);
    const isCorrect = value === solutionValue || value === 0;

    if (!isCorrect && value !== 0) {
      playerState.mistakes++;
    }

    const success = game.setCellValue(row, col, value);
    if (!success) {
      return false;
    }

    // Update progress
    playerState.progress = game.getProgress();
    playerState.lastMoveAt = Date.now();

    // Count correct cells
    playerState.correctCells = this.countCorrectCells(playerState);

    const move: Move = {
      row,
      col,
      value,
      previousValue: 0,
      timestamp: Date.now(),
    };

    this.emit({
      type: 'player_move',
      playerId,
      move,
      progress: playerState.progress,
    });

    // Check completion
    if (this.isPlayerComplete(playerState)) {
      this.emit({
        type: 'player_completed',
        playerId,
        timeMs: game.getTimeMs(),
      });

      // Check if race is over
      if (this.checkRaceComplete()) {
        this.finishRace();
      }
    }

    return true;
  }

  private countCorrectCells(playerState: PlayerState): number {
    const board = playerState.game.getBoard();
    let correct = 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellValue = board.getCell(r, c).value;
        const solutionValue = parseInt(this.solution[r * 9 + c], 10);
        if (cellValue === solutionValue) {
          correct++;
        }
      }
    }

    return correct;
  }

  private isPlayerComplete(playerState: PlayerState): boolean {
    return playerState.correctCells === 81;
  }

  private checkRaceComplete(): boolean {
    // Race ends when any player completes
    for (const playerState of this.players.values()) {
      if (this.isPlayerComplete(playerState)) {
        return true;
      }
    }
    return false;
  }

  private finishRace(): void {
    if (this.state === 'finished') return;

    this.state = 'finished';
    this.finishedAt = Date.now();

    if (this.timeLimitTimer) {
      clearTimeout(this.timeLimitTimer);
    }

    // Pause all games
    for (const playerState of this.players.values()) {
      playerState.game.pause();
    }

    // Calculate results
    const playerResults = Array.from(this.players.values())
      .map(ps => ({
        player: ps.player,
        timeMs: ps.game.getTimeMs(),
        progress: ps.correctCells / 81,
        mistakes: ps.mistakes,
        completed: this.isPlayerComplete(ps),
        rank: 0,
      }))
      .sort((a, b) => {
        // Completed players first
        if (a.completed !== b.completed) {
          return a.completed ? -1 : 1;
        }
        // Among completed, faster wins
        if (a.completed && b.completed) {
          return a.timeMs - b.timeMs;
        }
        // Among incomplete, higher progress wins
        return b.progress - a.progress;
      });

    // Assign ranks
    playerResults.forEach((pr, idx) => {
      pr.rank = idx + 1;
    });

    const winner = playerResults[0]?.completed ? playerResults[0].player : null;

    this.result = {
      winner,
      playerResults,
      finishedAt: this.finishedAt,
    };

    this.emit({ type: 'race_finished', result: this.result });
  }

  getResult(): RaceResult | undefined {
    return this.result;
  }

  forceFinish(): void {
    this.finishRace();
  }

  addEventListener(listener: RaceEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: RaceEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) {
      this.listeners.splice(idx, 1);
    }
  }

  private emit(event: RaceEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  toJSON() {
    return {
      id: this.id,
      state: this.state,
      config: this.config,
      puzzle: this.state === 'waiting' ? undefined : this.puzzle,
      players: Array.from(this.players.values()).map(ps => ({
        player: ps.player,
        progress: ps.progress,
        correctCells: ps.correctCells,
        mistakes: ps.mistakes,
      })),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      result: this.result,
    };
  }
}
