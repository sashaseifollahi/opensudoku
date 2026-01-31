import { Board } from './Board';
import { Cell } from './Cell';
import { CellNote } from './CellNote';

export enum GameState {
  NOT_STARTED = 'not_started',
  PLAYING = 'playing',
  COMPLETED = 'completed',
}

export interface Move {
  row: number;
  col: number;
  value: number;
  previousValue: number;
  timestamp: number;
}

export interface GameData {
  id: string;
  state: GameState;
  board: string;
  initialBoard: string;
  timeMs: number;
  moves: Move[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export type GameEventListener = (event: GameEvent) => void;

export type GameEvent =
  | { type: 'move'; move: Move }
  | { type: 'state_change'; state: GameState }
  | { type: 'completed'; timeMs: number }
  | { type: 'validated'; valid: boolean };

/**
 * Manages a sudoku game session.
 * Ported from OpenSudoku (GPL v3) by Roman Masek
 */
export class Game {
  private id: string;
  private board: Board;
  private initialBoard: Board;
  private state: GameState;
  private timeMs: number;
  private moves: Move[];
  private createdAt: number;
  private startedAt?: number;
  private completedAt?: number;
  private activeFromTime?: number;
  private listeners: GameEventListener[] = [];

  constructor(id: string, puzzle: string | Board) {
    this.id = id;
    this.board = typeof puzzle === 'string' ? Board.fromString(puzzle) : puzzle;
    this.board.markFilledAsNotEditable();
    this.initialBoard = this.board.clone();
    this.state = GameState.NOT_STARTED;
    this.timeMs = 0;
    this.moves = [];
    this.createdAt = Date.now();
  }

  getId(): string {
    return this.id;
  }

  getBoard(): Board {
    return this.board;
  }

  getInitialBoard(): Board {
    return this.initialBoard;
  }

  getState(): GameState {
    return this.state;
  }

  getTimeMs(): number {
    if (this.activeFromTime !== undefined) {
      return this.timeMs + (Date.now() - this.activeFromTime);
    }
    return this.timeMs;
  }

  getMoves(): Move[] {
    return [...this.moves];
  }

  getProgress(): number {
    return this.board.getProgress();
  }

  start(): void {
    if (this.state !== GameState.NOT_STARTED) {
      return;
    }
    this.state = GameState.PLAYING;
    this.startedAt = Date.now();
    this.activeFromTime = Date.now();
    this.emit({ type: 'state_change', state: this.state });
  }

  pause(): void {
    if (this.activeFromTime !== undefined) {
      this.timeMs += Date.now() - this.activeFromTime;
      this.activeFromTime = undefined;
    }
  }

  resume(): void {
    if (this.state === GameState.PLAYING && this.activeFromTime === undefined) {
      this.activeFromTime = Date.now();
    }
  }

  setCellValue(row: number, col: number, value: number): boolean {
    const cell = this.board.getCell(row, col);

    if (!cell.editable) {
      return false;
    }

    if (value < 0 || value > 9) {
      return false;
    }

    // Auto-start on first move
    if (this.state === GameState.NOT_STARTED) {
      this.start();
    }

    const previousValue = cell.value;
    cell.value = value;

    const move: Move = {
      row,
      col,
      value,
      previousValue,
      timestamp: Date.now(),
    };
    this.moves.push(move);
    this.emit({ type: 'move', move });

    // Validate and check completion
    const valid = this.board.validate();
    this.emit({ type: 'validated', valid });

    if (this.board.isCompleted()) {
      this.complete();
    }

    return true;
  }

  setCellNote(row: number, col: number, note: CellNote): boolean {
    const cell = this.board.getCell(row, col);

    if (!cell.editable) {
      return false;
    }

    cell.note = note;
    return true;
  }

  toggleCellNote(row: number, col: number, num: number): boolean {
    const cell = this.board.getCell(row, col);

    if (!cell.editable) {
      return false;
    }

    cell.note = cell.note.toggleNumber(num);
    return true;
  }

  private complete(): void {
    this.pause();
    this.state = GameState.COMPLETED;
    this.completedAt = Date.now();
    this.emit({ type: 'state_change', state: this.state });
    this.emit({ type: 'completed', timeMs: this.timeMs });
  }

  undo(): boolean {
    if (this.moves.length === 0) {
      return false;
    }

    const lastMove = this.moves.pop()!;
    const cell = this.board.getCell(lastMove.row, lastMove.col);
    cell.value = lastMove.previousValue;
    this.board.validate();

    return true;
  }

  reset(): void {
    this.board = this.initialBoard.clone();
    this.board.markFilledAsNotEditable();
    this.state = GameState.NOT_STARTED;
    this.timeMs = 0;
    this.moves = [];
    this.startedAt = undefined;
    this.completedAt = undefined;
    this.activeFromTime = undefined;
    this.emit({ type: 'state_change', state: this.state });
  }

  fillAllNotes(): void {
    this.board.fillAllNotes();
  }

  clearAllNotes(): void {
    this.board.clearAllNotes();
  }

  getCandidates(row: number, col: number): number[] {
    return this.board.getCandidates(row, col);
  }

  isValidMove(row: number, col: number, value: number): boolean {
    if (value === 0) return true;
    const candidates = this.board.getCandidates(row, col);
    return candidates.includes(value);
  }

  addEventListener(listener: GameEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: GameEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) {
      this.listeners.splice(idx, 1);
    }
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  toData(): GameData {
    return {
      id: this.id,
      state: this.state,
      board: this.board.serialize(),
      initialBoard: this.initialBoard.toString(),
      timeMs: this.getTimeMs(),
      moves: [...this.moves],
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }

  static fromData(data: GameData): Game {
    const game = new Game(data.id, data.initialBoard);
    game.board = Board.deserialize(data.board);
    game.state = data.state;
    game.timeMs = data.timeMs;
    game.moves = [...data.moves];
    game.createdAt = data.createdAt;
    game.startedAt = data.startedAt;
    game.completedAt = data.completedAt;
    return game;
  }
}
