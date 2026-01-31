import { Board, BOARD_SIZE } from './Board';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

const CLUES_BY_DIFFICULTY: Record<Difficulty, [number, number]> = {
  easy: [36, 45],
  medium: [27, 35],
  hard: [22, 26],
  expert: [17, 21],
};

/**
 * Generates sudoku puzzles with solutions.
 */
export class PuzzleGenerator {
  /**
   * Generate a new puzzle with the given difficulty.
   */
  static generate(difficulty: Difficulty = 'medium'): { puzzle: string; solution: string } {
    const solution = this.generateSolution();
    const [minClues, maxClues] = CLUES_BY_DIFFICULTY[difficulty];
    const targetClues = minClues + Math.floor(Math.random() * (maxClues - minClues + 1));
    const puzzle = this.createPuzzle(solution, targetClues);

    return { puzzle, solution };
  }

  /**
   * Generate a complete valid sudoku solution.
   */
  private static generateSolution(): string {
    const board = Array(9).fill(null).map(() => Array(9).fill(0));

    // Fill diagonal 3x3 boxes first (they're independent)
    for (let box = 0; box < 3; box++) {
      this.fillBox(board, box * 3, box * 3);
    }

    // Solve the rest
    this.solve(board);

    return board.map(row => row.join('')).join('');
  }

  private static fillBox(board: number[][], startRow: number, startCol: number): void {
    const nums = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[startRow + r][startCol + c] = nums[idx++];
      }
    }
  }

  private static solve(board: number[][]): boolean {
    const empty = this.findEmpty(board);
    if (!empty) return true;

    const [row, col] = empty;
    const nums = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (const num of nums) {
      if (this.isValidPlacement(board, row, col, num)) {
        board[row][col] = num;
        if (this.solve(board)) return true;
        board[row][col] = 0;
      }
    }

    return false;
  }

  private static findEmpty(board: number[][]): [number, number] | null {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  private static isValidPlacement(board: number[][], row: number, col: number, num: number): boolean {
    // Check row
    for (let c = 0; c < 9; c++) {
      if (board[row][c] === num) return false;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
      if (board[r][col] === num) return false;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[boxRow + r][boxCol + c] === num) return false;
      }
    }

    return true;
  }

  /**
   * Create a puzzle from a solution by removing numbers.
   */
  private static createPuzzle(solution: string, targetClues: number): string {
    const board = solution.split('').map(c => parseInt(c, 10));
    const positions = this.shuffle(Array.from({ length: 81 }, (_, i) => i));
    let clues = 81;

    for (const pos of positions) {
      if (clues <= targetClues) break;

      const backup = board[pos];
      board[pos] = 0;

      // Check if puzzle still has unique solution
      if (this.hasUniqueSolution(board)) {
        clues--;
      } else {
        board[pos] = backup;
      }
    }

    return board.map(n => n.toString()).join('');
  }

  /**
   * Check if a puzzle has exactly one solution.
   */
  private static hasUniqueSolution(puzzle: number[]): boolean {
    const board = [...puzzle];
    let solutions = 0;

    const solve = (): boolean => {
      const empty = board.findIndex(n => n === 0);
      if (empty === -1) {
        solutions++;
        return solutions > 1; // Stop if we found more than one solution
      }

      const row = Math.floor(empty / 9);
      const col = empty % 9;

      for (let num = 1; num <= 9; num++) {
        if (this.isValidAt(board, row, col, num)) {
          board[empty] = num;
          if (solve()) return true;
          board[empty] = 0;
        }
      }

      return false;
    };

    solve();
    return solutions === 1;
  }

  private static isValidAt(board: number[], row: number, col: number, num: number): boolean {
    // Check row
    for (let c = 0; c < 9; c++) {
      if (board[row * 9 + c] === num) return false;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
      if (board[r * 9 + col] === num) return false;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[(boxRow + r) * 9 + (boxCol + c)] === num) return false;
      }
    }

    return true;
  }

  private static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Solve a puzzle and return the solution.
   */
  static solvePuzzle(puzzle: string): string | null {
    const board = puzzle.split('').map(c => parseInt(c, 10));

    const solve = (): boolean => {
      const empty = board.findIndex(n => n === 0);
      if (empty === -1) return true;

      const row = Math.floor(empty / 9);
      const col = empty % 9;

      for (let num = 1; num <= 9; num++) {
        if (this.isValidAt(board, row, col, num)) {
          board[empty] = num;
          if (solve()) return true;
          board[empty] = 0;
        }
      }

      return false;
    };

    if (solve()) {
      return board.join('');
    }
    return null;
  }
}

// Pre-made puzzles for quick starts
export const SAMPLE_PUZZLES: Record<Difficulty, string[]> = {
  easy: [
    '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
  ],
  medium: [
    '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
    '030000080009000500007509200700105008020090030900402001004207100002000800070000090',
  ],
  hard: [
    '000700000100000000000430200000000006000509000000000418000081000002000050040000300',
    '020000000000600003074000008000003002080040010600500000300000570500009000000000040',
  ],
  expert: [
    '000000000000003085001020000000507000004000100090000000500000073002010000000040009',
    '100007090030020008009600500005300900010080002600004000300000010040000007007000300',
  ],
};
