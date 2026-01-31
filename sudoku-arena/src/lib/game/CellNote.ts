/**
 * Note/candidates attached to a cell. Immutable by design.
 * Ported from OpenSudoku (GPL v3) by Roman Masek
 */
export class CellNote {
  private readonly notedNumbers: ReadonlySet<number>;

  static readonly EMPTY = new CellNote();

  constructor(numbers?: Iterable<number>) {
    this.notedNumbers = new Set(numbers ?? []);
  }

  static fromArray(numbers: number[]): CellNote {
    return new CellNote(numbers.filter(n => n >= 1 && n <= 9));
  }

  static deserialize(data: string): CellNote {
    if (!data || data === '-') {
      return CellNote.EMPTY;
    }
    const numbers = data
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= 9);
    return new CellNote(numbers);
  }

  serialize(): string {
    if (this.notedNumbers.size === 0) {
      return '-';
    }
    return Array.from(this.notedNumbers).join(',');
  }

  getNumbers(): ReadonlySet<number> {
    return this.notedNumbers;
  }

  hasNumber(num: number): boolean {
    return this.notedNumbers.has(num);
  }

  toggleNumber(num: number): CellNote {
    if (num < 1 || num > 9) {
      throw new Error('Number must be between 1-9');
    }
    const numbers = new Set(this.notedNumbers);
    if (numbers.has(num)) {
      numbers.delete(num);
    } else {
      numbers.add(num);
    }
    return new CellNote(numbers);
  }

  addNumber(num: number): CellNote {
    if (num < 1 || num > 9) {
      throw new Error('Number must be between 1-9');
    }
    const numbers = new Set(this.notedNumbers);
    numbers.add(num);
    return new CellNote(numbers);
  }

  removeNumber(num: number): CellNote {
    if (num < 1 || num > 9) {
      throw new Error('Number must be between 1-9');
    }
    const numbers = new Set(this.notedNumbers);
    numbers.delete(num);
    return new CellNote(numbers);
  }

  clear(): CellNote {
    return CellNote.EMPTY;
  }

  isEmpty(): boolean {
    return this.notedNumbers.size === 0;
  }

  toArray(): number[] {
    return Array.from(this.notedNumbers).sort((a, b) => a - b);
  }
}
