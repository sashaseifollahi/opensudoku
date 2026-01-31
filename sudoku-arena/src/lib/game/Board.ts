import { Cell } from './Cell';
import { CellNote } from './CellNote';

export const BOARD_SIZE = 9;

export type BoardChangeListener = () => void;

/**
 * 9x9 Sudoku board - collection of cells.
 * Ported from OpenSudoku (GPL v3) by Roman Masek
 */
export class Board {
  private cells: Cell[][];
  private listeners: BoardChangeListener[] = [];
  private changeEnabled = true;

  private constructor(cells: Cell[][]) {
    this.cells = cells;
    this.initCells();
  }

  static createEmpty(): Board {
    const cells: Cell[][] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      cells[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        cells[r][c] = new Cell(0, r, c);
      }
    }
    return new Board(cells);
  }

  static fromString(data: string): Board {
    const cells: Cell[][] = [];
    let pos = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      cells[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        let value = 0;
        while (pos < data.length) {
          const char = data[pos++];
          if (char >= '0' && char <= '9') {
            value = parseInt(char, 10);
            break;
          }
        }
        const cell = new Cell(value, r, c);
        cell.editable = value === 0;
        cells[r][c] = cell;
      }
    }

    return new Board(cells);
  }

  static deserialize(data: string): Board {
    const lines = data.split('\n');
    if (lines.length === 0) {
      throw new Error('Cannot deserialize board: data corrupted');
    }

    if (lines[0] === 'version: 1') {
      const parts = lines[1].split('|').filter(p => p.length > 0);
      const cells: Cell[][] = [];
      let idx = 0;

      for (let r = 0; r < BOARD_SIZE; r++) {
        cells[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (idx + 2 < parts.length) {
            const cell = new Cell(parseInt(parts[idx], 10), r, c);
            cell.note = CellNote.deserialize(parts[idx + 1]);
            cell.editable = parts[idx + 2] === '1';
            cells[r][c] = cell;
            idx += 3;
          } else {
            cells[r][c] = new Cell(0, r, c);
          }
        }
      }
      return new Board(cells);
    }

    return Board.fromString(data);
  }

  private initCells(): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        this.cells[r][c].setOnChange(() => this.onChange());
      }
    }
  }

  getCell(row: number, col: number): Cell {
    return this.cells[row][col];
  }

  getCells(): Cell[][] {
    return this.cells;
  }

  isEmpty(): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.cells[r][c].value !== 0) {
          return false;
        }
      }
    }
    return true;
  }

  getRow(row: number): Cell[] {
    return this.cells[row];
  }

  getColumn(col: number): Cell[] {
    return this.cells.map(row => row[col]);
  }

  getSector(sectorIndex: number): Cell[] {
    const startRow = Math.floor(sectorIndex / 3) * 3;
    const startCol = (sectorIndex % 3) * 3;
    const sector: Cell[] = [];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        sector.push(this.cells[startRow + r][startCol + c]);
      }
    }
    return sector;
  }

  getSectorForCell(row: number, col: number): Cell[] {
    const sectorIndex = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    return this.getSector(sectorIndex);
  }

  validate(): boolean {
    let valid = true;
    this.changeEnabled = false;

    // Reset all cells to valid
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        this.cells[r][c].valid = true;
      }
    }

    // Validate rows
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!this.validateGroup(this.getRow(r))) {
        valid = false;
      }
    }

    // Validate columns
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!this.validateGroup(this.getColumn(c))) {
        valid = false;
      }
    }

    // Validate sectors
    for (let s = 0; s < BOARD_SIZE; s++) {
      if (!this.validateGroup(this.getSector(s))) {
        valid = false;
      }
    }

    this.changeEnabled = true;
    this.onChange();

    return valid;
  }

  private validateGroup(cells: Cell[]): boolean {
    let valid = true;
    const seen = new Map<number, Cell>();

    for (const cell of cells) {
      const value = cell.value;
      if (value === 0) continue;

      const existing = seen.get(value);
      if (existing) {
        cell.valid = false;
        existing.valid = false;
        valid = false;
      } else {
        seen.set(value, cell);
      }
    }

    return valid;
  }

  isCompleted(): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = this.cells[r][c];
        if (cell.value === 0 || !cell.valid) {
          return false;
        }
      }
    }
    return true;
  }

  getFilledCount(): number {
    let count = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.cells[r][c].value !== 0) {
          count++;
        }
      }
    }
    return count;
  }

  getProgress(): number {
    return this.getFilledCount() / 81;
  }

  markFilledAsNotEditable(): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = this.cells[r][c];
        cell.editable = cell.value === 0;
      }
    }
  }

  getCandidates(row: number, col: number): number[] {
    const used = new Set<number>();

    // Check row
    for (const cell of this.getRow(row)) {
      if (cell.value !== 0) used.add(cell.value);
    }

    // Check column
    for (const cell of this.getColumn(col)) {
      if (cell.value !== 0) used.add(cell.value);
    }

    // Check sector
    for (const cell of this.getSectorForCell(row, col)) {
      if (cell.value !== 0) used.add(cell.value);
    }

    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !used.has(n));
  }

  fillAllNotes(): void {
    this.changeEnabled = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = this.cells[r][c];
        if (cell.value === 0 && cell.editable) {
          cell.note = new CellNote(this.getCandidates(r, c));
        }
      }
    }
    this.changeEnabled = true;
    this.onChange();
  }

  clearAllNotes(): void {
    this.changeEnabled = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        this.cells[r][c].note = CellNote.EMPTY;
      }
    }
    this.changeEnabled = true;
    this.onChange();
  }

  serialize(): string {
    let data = 'version: 1\n';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        data += this.cells[r][c].serialize() + '|';
      }
    }
    return data;
  }

  toString(): string {
    let result = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        result += this.cells[r][c].value;
      }
    }
    return result;
  }

  toDisplayString(): string {
    let result = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (r % 3 === 0 && r > 0) {
        result += '------+-------+------\n';
      }
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (c % 3 === 0 && c > 0) {
          result += ' | ';
        } else if (c > 0) {
          result += ' ';
        }
        const val = this.cells[r][c].value;
        result += val === 0 ? '.' : val;
      }
      result += '\n';
    }
    return result;
  }

  clone(): Board {
    const cells: Cell[][] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      cells[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        cells[r][c] = this.cells[r][c].clone();
      }
    }
    return new Board(cells);
  }

  addChangeListener(listener: BoardChangeListener): void {
    this.listeners.push(listener);
  }

  removeChangeListener(listener: BoardChangeListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) {
      this.listeners.splice(idx, 1);
    }
  }

  private onChange(): void {
    if (this.changeEnabled) {
      for (const listener of this.listeners) {
        listener();
      }
    }
  }
}
