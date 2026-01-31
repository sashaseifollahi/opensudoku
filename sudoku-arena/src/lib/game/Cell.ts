import { CellNote } from './CellNote';

/**
 * Represents a single sudoku cell.
 * Ported from OpenSudoku (GPL v3) by Roman Masek
 */
export interface CellData {
  value: number;
  note: CellNote;
  editable: boolean;
  valid: boolean;
  row: number;
  col: number;
}

export class Cell {
  private _value: number;
  private _note: CellNote;
  private _editable: boolean;
  private _valid: boolean;
  private _row: number;
  private _col: number;
  private _onChange?: () => void;

  constructor(value = 0, row = -1, col = -1) {
    if (value < 0 || value > 9) {
      throw new Error('Value must be between 0-9');
    }
    this._value = value;
    this._note = CellNote.EMPTY;
    this._editable = true;
    this._valid = true;
    this._row = row;
    this._col = col;
  }

  get value(): number {
    return this._value;
  }

  set value(v: number) {
    if (v < 0 || v > 9) {
      throw new Error('Value must be between 0-9');
    }
    this._value = v;
    this._onChange?.();
  }

  get note(): CellNote {
    return this._note;
  }

  set note(n: CellNote) {
    this._note = n;
    this._onChange?.();
  }

  get editable(): boolean {
    return this._editable;
  }

  set editable(e: boolean) {
    this._editable = e;
    this._onChange?.();
  }

  get valid(): boolean {
    return this._valid;
  }

  set valid(v: boolean) {
    this._valid = v;
    this._onChange?.();
  }

  get row(): number {
    return this._row;
  }

  get col(): number {
    return this._col;
  }

  get sectorIndex(): number {
    return Math.floor(this._row / 3) * 3 + Math.floor(this._col / 3);
  }

  isEmpty(): boolean {
    return this._value === 0;
  }

  setOnChange(callback: () => void): void {
    this._onChange = callback;
  }

  static deserialize(data: string): Cell {
    const parts = data.split('|');
    if (parts.length < 3) {
      throw new Error('Invalid cell data');
    }
    const cell = new Cell(parseInt(parts[0], 10));
    cell._note = CellNote.deserialize(parts[1]);
    cell._editable = parts[2] === '1';
    return cell;
  }

  serialize(): string {
    return `${this._value}|${this._note.serialize()}|${this._editable ? '1' : '0'}`;
  }

  toData(): CellData {
    return {
      value: this._value,
      note: this._note,
      editable: this._editable,
      valid: this._valid,
      row: this._row,
      col: this._col,
    };
  }

  clone(): Cell {
    const cell = new Cell(this._value, this._row, this._col);
    cell._note = this._note;
    cell._editable = this._editable;
    cell._valid = this._valid;
    return cell;
  }
}
