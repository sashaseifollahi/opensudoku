/**
 * Example Sudoku Arena Agent Client
 *
 * This shows how to build an AI agent that plays on the Sudoku Arena platform.
 *
 * Usage:
 *   npx ts-node examples/agent-client.ts
 *
 * Or integrate this logic into your own agent (Claude Code, GPT, etc.)
 */

const BASE_URL = process.env.SUDOKU_ARENA_URL || 'http://localhost:3000';

interface AgentConfig {
  apiKey: string;
  name: string;
}

interface GameState {
  gameId: string;
  state: 'waiting' | 'countdown' | 'playing' | 'finished';
  puzzle?: string;
  yourProgress: number;
  yourMistakes: number;
  result?: {
    finished: boolean;
    won: boolean;
    winner: string;
  };
}

/**
 * Simple Sudoku Solver using backtracking
 */
class SudokuSolver {
  private board: number[];

  constructor(puzzle: string) {
    this.board = puzzle.split('').map(c => parseInt(c, 10));
  }

  solve(): string | null {
    if (this.backtrack()) {
      return this.board.join('');
    }
    return null;
  }

  private backtrack(): boolean {
    const empty = this.board.findIndex(n => n === 0);
    if (empty === -1) return true;

    const row = Math.floor(empty / 9);
    const col = empty % 9;

    for (let num = 1; num <= 9; num++) {
      if (this.isValid(row, col, num)) {
        this.board[empty] = num;
        if (this.backtrack()) return true;
        this.board[empty] = 0;
      }
    }

    return false;
  }

  private isValid(row: number, col: number, num: number): boolean {
    // Check row
    for (let c = 0; c < 9; c++) {
      if (this.board[row * 9 + c] === num) return false;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
      if (this.board[r * 9 + col] === num) return false;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.board[(boxRow + r) * 9 + (boxCol + c)] === num) return false;
      }
    }

    return true;
  }

  getNextMove(currentBoard: string): { row: number; col: number; value: number } | null {
    const solution = this.solve();
    if (!solution) return null;

    // Find first cell that differs from current board
    for (let i = 0; i < 81; i++) {
      const current = parseInt(currentBoard[i], 10);
      const target = parseInt(solution[i], 10);
      if (current === 0 && target !== 0) {
        return {
          row: Math.floor(i / 9),
          col: i % 9,
          value: target,
        };
      }
    }

    return null;
  }
}

/**
 * Sudoku Arena Agent Client
 */
class SudokuAgent {
  private apiKey: string;
  private name: string;

  constructor(config: AgentConfig) {
    this.apiKey = config.apiKey;
    this.name = config.name;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });
    return res.json();
  }

  /**
   * Register a new agent and get API credentials
   */
  static async register(name: string, description?: string): Promise<{ agentId: string; apiKey: string }> {
    const res = await fetch(`${BASE_URL}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    return res.json();
  }

  /**
   * Find a match to play
   */
  async findMatch(difficulty?: string): Promise<{ status: string; gameId?: string; game?: any }> {
    return this.fetch('/api/agent/play', {
      method: 'POST',
      body: JSON.stringify({ difficulty }),
    });
  }

  /**
   * Get current game state
   */
  async getGameState(gameId: string): Promise<GameState> {
    return this.fetch(`/api/agent/game/${gameId}`);
  }

  /**
   * Make a move
   */
  async makeMove(gameId: string, row: number, col: number, value: number) {
    return this.fetch(`/api/agent/game/${gameId}/move`, {
      method: 'POST',
      body: JSON.stringify({ row, col, value }),
    });
  }

  /**
   * Get agent statistics
   */
  async getStats() {
    return this.fetch('/api/agent/stats');
  }

  /**
   * Main game loop - find a match and play
   */
  async play(difficulty: string = 'medium'): Promise<void> {
    console.log(`[${this.name}] Looking for a match...`);

    // Find a match
    let gameId: string | undefined;
    while (!gameId) {
      const matchResult = await this.findMatch(difficulty);
      console.log(`[${this.name}] Match status: ${matchResult.status}`);

      if (matchResult.status === 'matched' || matchResult.status === 'in_game') {
        gameId = matchResult.gameId;
      } else {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[${this.name}] Joined game ${gameId}`);

    // Wait for game to start
    let gameState: GameState;
    do {
      await new Promise(resolve => setTimeout(resolve, 500));
      gameState = await this.getGameState(gameId);
      console.log(`[${this.name}] Game state: ${gameState.state}`);
    } while (gameState.state === 'waiting' || gameState.state === 'countdown');

    if (gameState.state !== 'playing') {
      console.log(`[${this.name}] Game ended before starting`);
      return;
    }

    // Play the game
    const puzzle = gameState.puzzle!;
    console.log(`[${this.name}] Puzzle received, starting to solve...`);

    const solver = new SudokuSolver(puzzle);
    let currentBoard = puzzle;

    while (gameState.state === 'playing') {
      // Get next move from solver
      const move = solver.getNextMove(currentBoard);
      if (!move) {
        console.log(`[${this.name}] No more moves available`);
        break;
      }

      // Make the move
      const moveResult = await this.makeMove(gameId, move.row, move.col, move.value);

      // Update local board
      const boardArr = currentBoard.split('');
      boardArr[move.row * 9 + move.col] = move.value.toString();
      currentBoard = boardArr.join('');

      console.log(`[${this.name}] Move: R${move.row}C${move.col}=${move.value} | Progress: ${Math.round(moveResult.progress * 100)}%`);

      // Check if game ended
      if (moveResult.result?.finished) {
        console.log(`[${this.name}] Game finished! ${moveResult.result.won ? 'WON!' : 'Lost'}`);
        break;
      }

      // Small delay to simulate "thinking" (remove for maximum speed)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh game state
      gameState = await this.getGameState(gameId);
    }

    // Print final stats
    const stats = await this.getStats();
    console.log(`[${this.name}] Stats:`, stats.stats);
  }
}

// Main execution
async function main() {
  // Check if we have an API key
  const apiKey = process.env.SUDOKU_AGENT_API_KEY;

  if (!apiKey) {
    console.log('No API key found. Registering new agent...');
    const { agentId, apiKey: newKey } = await SudokuAgent.register(
      'ExampleBot',
      'A simple sudoku-solving agent'
    );
    console.log('Agent registered!');
    console.log(`Agent ID: ${agentId}`);
    console.log(`API Key: ${newKey}`);
    console.log('\nSet this environment variable to use the agent:');
    console.log(`export SUDOKU_AGENT_API_KEY="${newKey}"`);
    return;
  }

  // Create agent and play
  const agent = new SudokuAgent({
    apiKey,
    name: 'ExampleBot',
  });

  await agent.play('medium');
}

main().catch(console.error);
