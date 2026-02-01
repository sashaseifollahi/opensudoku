import { createClient, Client } from '@libsql/client';
import { randomBytes } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Database Client Setup - Supports both Turso (production) and local SQLite
// ============================================================================

let db: Client;

// Check if we're using Turso (production) or local SQLite (development)
const isTurso = !!process.env.TURSO_DATABASE_URL;

if (isTurso) {
  // Turso (production)
  db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
} else {
  // Local SQLite for development
  // Use absolute path and ensure directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'sudoku-arena.db');
  db = createClient({
    url: `file:${dbPath}`,
  });
}

// Initialize schema
const schemaSQL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  elo_rating INTEGER DEFAULT 1500,
  peak_elo INTEGER DEFAULT 1500,
  total_solve_time_ms INTEGER DEFAULT 0,
  fastest_solve_ms INTEGER,
  total_moves INTEGER DEFAULT 0,
  total_mistakes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  difficulty TEXT NOT NULL,
  puzzle TEXT NOT NULL,
  solution TEXT NOT NULL,
  player1_id TEXT REFERENCES agents(id),
  player2_id TEXT REFERENCES agents(id),
  state TEXT DEFAULT 'waiting',
  player1_progress INTEGER DEFAULT 0,
  player2_progress INTEGER DEFAULT 0,
  player1_mistakes INTEGER DEFAULT 0,
  player2_mistakes INTEGER DEFAULT 0,
  player1_board TEXT,
  player2_board TEXT,
  winner_id TEXT REFERENCES agents(id),
  player1_time_ms INTEGER,
  player2_time_ms INTEGER,
  player1_elo_change INTEGER,
  player2_elo_change INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS moves (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  value INTEGER NOT NULL,
  is_valid INTEGER NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_stats (
  id TEXT PRIMARY KEY DEFAULT 'global',
  total_agents INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  active_games INTEGER DEFAULT 0,
  games_last_24h INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO platform_stats (id) VALUES ('global');

CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_games_state ON games(state);
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
`;

// Initialize database schema
let dbInitialized = false;
async function initDb() {
  if (dbInitialized) return;
  try {
    // Split schema into individual statements and execute
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await db.execute(stmt);
    }
    dbInitialized = true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Ensure DB is initialized
initDb();

// ============================================================================
// Types
// ============================================================================

export interface Agent {
  id: string;
  apiKey: string;
  name: string;
  description: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  eloRating: number;
  peakElo: number;
  totalSolveTimeMs: number;
  fastestSolveMs: number | null;
  totalMoves: number;
  totalMistakes: number;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

export interface Game {
  id: string;
  difficulty: string;
  puzzle: string;
  solution: string;
  player1Id: string | null;
  player2Id: string | null;
  state: 'waiting' | 'countdown' | 'playing' | 'finished';
  player1Progress: number;
  player2Progress: number;
  player1Mistakes: number;
  player2Mistakes: number;
  player1Board: string | null;
  player2Board: string | null;
  winnerId: string | null;
  player1TimeMs: number | null;
  player2TimeMs: number | null;
  player1EloChange: number | null;
  player2EloChange: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Move {
  id: string;
  gameId: string;
  agentId: string;
  row: number;
  col: number;
  value: number;
  isValid: boolean;
  timestamp: string;
}

export interface PlatformStats {
  totalAgents: number;
  totalGames: number;
  activeGames: number;
  gamesLast24h: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  avgSolveMs: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateApiKey(): string {
  return 'sk_' + randomBytes(24).toString('hex');
}

function generateId(): string {
  return randomBytes(12).toString('hex');
}

function mapRowToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    apiKey: row.api_key as string,
    name: row.name as string,
    description: row.description as string | null,
    gamesPlayed: row.games_played as number,
    wins: row.wins as number,
    losses: row.losses as number,
    draws: row.draws as number,
    eloRating: row.elo_rating as number,
    peakElo: row.peak_elo as number,
    totalSolveTimeMs: row.total_solve_time_ms as number,
    fastestSolveMs: row.fastest_solve_ms as number | null,
    totalMoves: row.total_moves as number,
    totalMistakes: row.total_mistakes as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastActiveAt: row.last_active_at as string | null,
  };
}

function mapRowToGame(row: Record<string, unknown>): Game {
  return {
    id: row.id as string,
    difficulty: row.difficulty as string,
    puzzle: row.puzzle as string,
    solution: row.solution as string,
    player1Id: row.player1_id as string | null,
    player2Id: row.player2_id as string | null,
    state: row.state as Game['state'],
    player1Progress: row.player1_progress as number,
    player2Progress: row.player2_progress as number,
    player1Mistakes: row.player1_mistakes as number,
    player2Mistakes: row.player2_mistakes as number,
    player1Board: row.player1_board as string | null,
    player2Board: row.player2_board as string | null,
    winnerId: row.winner_id as string | null,
    player1TimeMs: row.player1_time_ms as number | null,
    player2TimeMs: row.player2_time_ms as number | null,
    player1EloChange: row.player1_elo_change as number | null,
    player2EloChange: row.player2_elo_change as number | null,
    createdAt: row.created_at as string,
    startedAt: row.started_at as string | null,
    finishedAt: row.finished_at as string | null,
  };
}

// ============================================================================
// Agent Operations
// ============================================================================

export async function createAgent(name: string, description?: string): Promise<Agent> {
  await initDb();
  const id = generateId();
  const apiKey = generateApiKey();

  await db.execute({
    sql: `INSERT INTO agents (id, api_key, name, description) VALUES (?, ?, ?, ?)`,
    args: [id, apiKey, name, description || null],
  });

  // Update platform stats
  await db.execute(`UPDATE platform_stats SET total_agents = total_agents + 1 WHERE id = 'global'`);

  return (await getAgentById(id))!;
}

export async function getAgentById(id: string): Promise<Agent | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM agents WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToAgent(result.rows[0] as Record<string, unknown>);
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM agents WHERE api_key = ?`,
    args: [apiKey],
  });

  if (result.rows.length === 0) return null;
  return mapRowToAgent(result.rows[0] as Record<string, unknown>);
}

export async function incrementAgentStats(
  id: string,
  increments: {
    gamesPlayed?: number;
    wins?: number;
    losses?: number;
    eloChange?: number;
    solveTimeMs?: number;
    moves?: number;
    mistakes?: number;
  }
): Promise<void> {
  await initDb();
  const agent = await getAgentById(id);
  if (!agent) return;

  const newElo = agent.eloRating + (increments.eloChange ?? 0);
  const newPeakElo = Math.max(agent.peakElo, newElo);
  const newFastest = increments.solveTimeMs && (!agent.fastestSolveMs || increments.solveTimeMs < agent.fastestSolveMs)
    ? increments.solveTimeMs
    : agent.fastestSolveMs;

  await db.execute({
    sql: `
      UPDATE agents SET
        games_played = games_played + ?,
        wins = wins + ?,
        losses = losses + ?,
        elo_rating = ?,
        peak_elo = ?,
        total_solve_time_ms = total_solve_time_ms + ?,
        fastest_solve_ms = ?,
        total_moves = total_moves + ?,
        total_mistakes = total_mistakes + ?,
        updated_at = datetime('now'),
        last_active_at = datetime('now')
      WHERE id = ?
    `,
    args: [
      increments.gamesPlayed ?? 0,
      increments.wins ?? 0,
      increments.losses ?? 0,
      newElo,
      newPeakElo,
      increments.solveTimeMs ?? 0,
      newFastest,
      increments.moves ?? 0,
      increments.mistakes ?? 0,
      id,
    ],
  });
}

// ============================================================================
// Game Operations
// ============================================================================

export async function createGame(difficulty: string, puzzle: string, solution: string, player1Id?: string): Promise<Game> {
  await initDb();
  const id = generateId();

  await db.execute({
    sql: `INSERT INTO games (id, difficulty, puzzle, solution, player1_id, player1_board) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, difficulty, puzzle, solution, player1Id || null, puzzle],
  });

  return (await getGameById(id))!;
}

export async function getGameById(id: string): Promise<Game | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM games WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToGame(result.rows[0] as Record<string, unknown>);
}

export async function getWaitingGames(difficulty?: string): Promise<Game[]> {
  await initDb();
  let sql = `SELECT * FROM games WHERE state = 'waiting'`;
  const args: (string | number)[] = [];

  if (difficulty) {
    sql += ` AND difficulty = ?`;
    args.push(difficulty);
  }

  sql += ` ORDER BY created_at ASC LIMIT 20`;

  const result = await db.execute({ sql, args });
  return result.rows.map(row => mapRowToGame(row as Record<string, unknown>));
}

export async function getActiveGames(): Promise<Game[]> {
  await initDb();
  const result = await db.execute(`
    SELECT * FROM games
    WHERE state IN ('countdown', 'playing')
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return result.rows.map(row => mapRowToGame(row as Record<string, unknown>));
}

export async function getRecentGames(limit: number = 20): Promise<Game[]> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM games ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(row => mapRowToGame(row as Record<string, unknown>));
}

export async function joinGame(gameId: string, playerId: string): Promise<Game | null> {
  await initDb();
  const game = await getGameById(gameId);
  if (!game || game.state !== 'waiting') return null;
  if (game.player1Id === playerId) return null; // Can't join own game

  await db.execute({
    sql: `
      UPDATE games SET
        player2_id = ?,
        player2_board = puzzle,
        state = 'countdown',
        started_at = datetime('now')
      WHERE id = ? AND state = 'waiting'
    `,
    args: [playerId, gameId],
  });

  return getGameById(gameId);
}

export async function updateGameState(gameId: string, state: Game['state']): Promise<void> {
  await initDb();
  await db.execute({
    sql: `UPDATE games SET state = ? WHERE id = ?`,
    args: [state, gameId],
  });
}

export async function updatePlayerProgress(
  gameId: string,
  playerId: string,
  progress: number,
  mistakes: number,
  board: string
): Promise<void> {
  await initDb();
  const game = await getGameById(gameId);
  if (!game) return;

  if (game.player1Id === playerId) {
    await db.execute({
      sql: `UPDATE games SET player1_progress = ?, player1_mistakes = ?, player1_board = ? WHERE id = ?`,
      args: [progress, mistakes, board, gameId],
    });
  } else if (game.player2Id === playerId) {
    await db.execute({
      sql: `UPDATE games SET player2_progress = ?, player2_mistakes = ?, player2_board = ? WHERE id = ?`,
      args: [progress, mistakes, board, gameId],
    });
  }
}

export async function finishGame(
  gameId: string,
  winnerId: string | null,
  player1TimeMs: number,
  player2TimeMs: number,
  player1EloChange: number,
  player2EloChange: number
): Promise<void> {
  await initDb();
  await db.execute({
    sql: `
      UPDATE games SET
        state = 'finished',
        winner_id = ?,
        player1_time_ms = ?,
        player2_time_ms = ?,
        player1_elo_change = ?,
        player2_elo_change = ?,
        finished_at = datetime('now')
      WHERE id = ?
    `,
    args: [winnerId, player1TimeMs, player2TimeMs, player1EloChange, player2EloChange, gameId],
  });

  // Update platform stats
  await db.execute(`UPDATE platform_stats SET total_games = total_games + 1 WHERE id = 'global'`);
}

// ============================================================================
// Move Operations
// ============================================================================

export async function recordMove(
  gameId: string,
  agentId: string,
  row: number,
  col: number,
  value: number,
  isValid: boolean
): Promise<void> {
  await initDb();
  const id = generateId();
  await db.execute({
    sql: `INSERT INTO moves (id, game_id, agent_id, row, col, value, is_valid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, gameId, agentId, row, col, value, isValid ? 1 : 0],
  });
}

export async function getGameMoves(gameId: string): Promise<Move[]> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM moves WHERE game_id = ? ORDER BY timestamp ASC`,
    args: [gameId],
  });

  return result.rows.map(row => ({
    id: row.id as string,
    gameId: row.game_id as string,
    agentId: row.agent_id as string,
    row: row.row as number,
    col: row.col as number,
    value: row.value as number,
    isValid: (row.is_valid as number) === 1,
    timestamp: row.timestamp as string,
  }));
}

// ============================================================================
// Leaderboard Operations
// ============================================================================

export async function getLeaderboard(limit: number = 50, difficulty?: string): Promise<LeaderboardEntry[]> {
  await initDb();
  const result = await db.execute({
    sql: `
      SELECT
        id, name, elo_rating, games_played, wins, losses,
        CASE WHEN games_played > 0 THEN CAST(wins AS FLOAT) / games_played * 100 ELSE 0 END as win_rate,
        CASE WHEN games_played > 0 THEN total_solve_time_ms / games_played ELSE NULL END as avg_solve_ms
      FROM agents
      WHERE games_played > 0
      ORDER BY elo_rating DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return result.rows.map((row, index) => ({
    rank: index + 1,
    id: row.id as string,
    name: row.name as string,
    eloRating: row.elo_rating as number,
    gamesPlayed: row.games_played as number,
    wins: row.wins as number,
    losses: row.losses as number,
    winRate: Math.round((row.win_rate as number) * 10) / 10,
    avgSolveMs: row.avg_solve_ms ? Math.round(row.avg_solve_ms as number) : null,
  }));
}

// ============================================================================
// Platform Stats
// ============================================================================

export async function getPlatformStats(): Promise<PlatformStats> {
  await initDb();

  // Update active games count
  const activeResult = await db.execute(`
    SELECT COUNT(*) as count FROM games WHERE state IN ('waiting', 'countdown', 'playing')
  `);
  const activeCount = (activeResult.rows[0]?.count as number) || 0;

  // Count games in last 24 hours
  const last24hResult = await db.execute(`
    SELECT COUNT(*) as count FROM games WHERE created_at > datetime('now', '-24 hours')
  `);
  const last24hCount = (last24hResult.rows[0]?.count as number) || 0;

  await db.execute({
    sql: `
      UPDATE platform_stats SET
        active_games = ?,
        games_last_24h = ?,
        updated_at = datetime('now')
      WHERE id = 'global'
    `,
    args: [activeCount, last24hCount],
  });

  const result = await db.execute(`SELECT * FROM platform_stats WHERE id = 'global'`);
  const row = result.rows[0];

  return {
    totalAgents: (row?.total_agents as number) || 0,
    totalGames: (row?.total_games as number) || 0,
    activeGames: (row?.active_games as number) || 0,
    gamesLast24h: (row?.games_last_24h as number) || 0,
  };
}

// ============================================================================
// ELO Calculation
// ============================================================================

const K_FACTOR = 32; // Standard K-factor for ELO

export function calculateEloChange(
  winnerElo: number,
  loserElo: number
): { winnerChange: number; loserChange: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerChange = Math.round(K_FACTOR * (1 - expectedWinner));
  const loserChange = Math.round(K_FACTOR * (0 - expectedLoser));

  return { winnerChange, loserChange };
}

// ============================================================================
// Cleanup
// ============================================================================

export async function cleanupOldGames(maxAgeMinutes: number = 60): Promise<number> {
  await initDb();
  const result = await db.execute({
    sql: `
      DELETE FROM games
      WHERE state = 'waiting'
      AND created_at < datetime('now', '-' || ? || ' minutes')
    `,
    args: [maxAgeMinutes],
  });

  return result.rowsAffected;
}

// Export the database client for direct queries if needed
export { db };
