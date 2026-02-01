import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Database path
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'sudoku-arena.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}

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
// Agent Operations
// ============================================================================

function generateApiKey(): string {
  return 'sk_' + randomBytes(24).toString('hex');
}

function generateId(): string {
  return randomBytes(12).toString('hex');
}

export function createAgent(name: string, description?: string): Agent {
  const id = generateId();
  const apiKey = generateApiKey();

  const stmt = db.prepare(`
    INSERT INTO agents (id, api_key, name, description)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, apiKey, name, description || null);

  // Update platform stats
  db.prepare(`UPDATE platform_stats SET total_agents = total_agents + 1 WHERE id = 'global'`).run();

  return getAgentById(id)!;
}

export function getAgentById(id: string): Agent | null {
  const row = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as any;
  return row ? mapRowToAgent(row) : null;
}

export function getAgentByApiKey(apiKey: string): Agent | null {
  const row = db.prepare(`SELECT * FROM agents WHERE api_key = ?`).get(apiKey) as any;
  return row ? mapRowToAgent(row) : null;
}

export function updateAgentStats(
  id: string,
  updates: {
    gamesPlayed?: number;
    wins?: number;
    losses?: number;
    eloRating?: number;
    totalSolveTimeMs?: number;
    fastestSolveMs?: number;
    totalMoves?: number;
    totalMistakes?: number;
  }
): void {
  const agent = getAgentById(id);
  if (!agent) return;

  const newElo = updates.eloRating ?? agent.eloRating;
  const newPeakElo = Math.max(agent.peakElo, newElo);

  db.prepare(`
    UPDATE agents SET
      games_played = COALESCE(?, games_played),
      wins = COALESCE(?, wins),
      losses = COALESCE(?, losses),
      elo_rating = COALESCE(?, elo_rating),
      peak_elo = ?,
      total_solve_time_ms = COALESCE(?, total_solve_time_ms),
      fastest_solve_ms = CASE
        WHEN ? IS NOT NULL AND (fastest_solve_ms IS NULL OR ? < fastest_solve_ms)
        THEN ?
        ELSE fastest_solve_ms
      END,
      total_moves = COALESCE(?, total_moves),
      total_mistakes = COALESCE(?, total_mistakes),
      updated_at = datetime('now'),
      last_active_at = datetime('now')
    WHERE id = ?
  `).run(
    updates.gamesPlayed ?? null,
    updates.wins ?? null,
    updates.losses ?? null,
    updates.eloRating ?? null,
    newPeakElo,
    updates.totalSolveTimeMs ?? null,
    updates.fastestSolveMs ?? null,
    updates.fastestSolveMs ?? null,
    updates.fastestSolveMs ?? null,
    updates.totalMoves ?? null,
    updates.totalMistakes ?? null,
    id
  );
}

export function incrementAgentStats(
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
): void {
  const agent = getAgentById(id);
  if (!agent) return;

  const newElo = agent.eloRating + (increments.eloChange ?? 0);
  const newPeakElo = Math.max(agent.peakElo, newElo);
  const newFastest = increments.solveTimeMs && (!agent.fastestSolveMs || increments.solveTimeMs < agent.fastestSolveMs)
    ? increments.solveTimeMs
    : agent.fastestSolveMs;

  db.prepare(`
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
  `).run(
    increments.gamesPlayed ?? 0,
    increments.wins ?? 0,
    increments.losses ?? 0,
    newElo,
    newPeakElo,
    increments.solveTimeMs ?? 0,
    newFastest,
    increments.moves ?? 0,
    increments.mistakes ?? 0,
    id
  );
}

function mapRowToAgent(row: any): Agent {
  return {
    id: row.id,
    apiKey: row.api_key,
    name: row.name,
    description: row.description,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    eloRating: row.elo_rating,
    peakElo: row.peak_elo,
    totalSolveTimeMs: row.total_solve_time_ms,
    fastestSolveMs: row.fastest_solve_ms,
    totalMoves: row.total_moves,
    totalMistakes: row.total_mistakes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
  };
}

// ============================================================================
// Game Operations
// ============================================================================

export function createGame(difficulty: string, puzzle: string, solution: string, player1Id?: string): Game {
  const id = generateId();

  db.prepare(`
    INSERT INTO games (id, difficulty, puzzle, solution, player1_id, player1_board)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, difficulty, puzzle, solution, player1Id || null, puzzle);

  return getGameById(id)!;
}

export function getGameById(id: string): Game | null {
  const row = db.prepare(`SELECT * FROM games WHERE id = ?`).get(id) as any;
  return row ? mapRowToGame(row) : null;
}

export function getWaitingGames(difficulty?: string): Game[] {
  let query = `SELECT * FROM games WHERE state = 'waiting'`;
  const params: any[] = [];

  if (difficulty) {
    query += ` AND difficulty = ?`;
    params.push(difficulty);
  }

  query += ` ORDER BY created_at ASC LIMIT 20`;

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(mapRowToGame);
}

export function getActiveGames(): Game[] {
  const rows = db.prepare(`
    SELECT * FROM games
    WHERE state IN ('countdown', 'playing')
    ORDER BY created_at DESC
    LIMIT 50
  `).all() as any[];
  return rows.map(mapRowToGame);
}

export function getRecentGames(limit: number = 20): Game[] {
  const rows = db.prepare(`
    SELECT * FROM games
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as any[];
  return rows.map(mapRowToGame);
}

export function joinGame(gameId: string, playerId: string): Game | null {
  const game = getGameById(gameId);
  if (!game || game.state !== 'waiting') return null;
  if (game.player1Id === playerId) return null; // Can't join own game

  db.prepare(`
    UPDATE games SET
      player2_id = ?,
      player2_board = puzzle,
      state = 'countdown',
      started_at = datetime('now')
    WHERE id = ? AND state = 'waiting'
  `).run(playerId, gameId);

  return getGameById(gameId);
}

export function updateGameState(gameId: string, state: Game['state']): void {
  db.prepare(`UPDATE games SET state = ? WHERE id = ?`).run(state, gameId);
}

export function updatePlayerProgress(
  gameId: string,
  playerId: string,
  progress: number,
  mistakes: number,
  board: string
): void {
  const game = getGameById(gameId);
  if (!game) return;

  if (game.player1Id === playerId) {
    db.prepare(`
      UPDATE games SET player1_progress = ?, player1_mistakes = ?, player1_board = ?
      WHERE id = ?
    `).run(progress, mistakes, board, gameId);
  } else if (game.player2Id === playerId) {
    db.prepare(`
      UPDATE games SET player2_progress = ?, player2_mistakes = ?, player2_board = ?
      WHERE id = ?
    `).run(progress, mistakes, board, gameId);
  }
}

export function finishGame(
  gameId: string,
  winnerId: string | null,
  player1TimeMs: number,
  player2TimeMs: number,
  player1EloChange: number,
  player2EloChange: number
): void {
  db.prepare(`
    UPDATE games SET
      state = 'finished',
      winner_id = ?,
      player1_time_ms = ?,
      player2_time_ms = ?,
      player1_elo_change = ?,
      player2_elo_change = ?,
      finished_at = datetime('now')
    WHERE id = ?
  `).run(winnerId, player1TimeMs, player2TimeMs, player1EloChange, player2EloChange, gameId);

  // Update platform stats
  db.prepare(`UPDATE platform_stats SET total_games = total_games + 1 WHERE id = 'global'`).run();
}

function mapRowToGame(row: any): Game {
  return {
    id: row.id,
    difficulty: row.difficulty,
    puzzle: row.puzzle,
    solution: row.solution,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    state: row.state,
    player1Progress: row.player1_progress,
    player2Progress: row.player2_progress,
    player1Mistakes: row.player1_mistakes,
    player2Mistakes: row.player2_mistakes,
    player1Board: row.player1_board,
    player2Board: row.player2_board,
    winnerId: row.winner_id,
    player1TimeMs: row.player1_time_ms,
    player2TimeMs: row.player2_time_ms,
    player1EloChange: row.player1_elo_change,
    player2EloChange: row.player2_elo_change,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

// ============================================================================
// Move Operations
// ============================================================================

export function recordMove(
  gameId: string,
  agentId: string,
  row: number,
  col: number,
  value: number,
  isValid: boolean
): void {
  const id = generateId();
  db.prepare(`
    INSERT INTO moves (id, game_id, agent_id, row, col, value, is_valid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, gameId, agentId, row, col, value, isValid ? 1 : 0);
}

export function getGameMoves(gameId: string): Move[] {
  const rows = db.prepare(`
    SELECT * FROM moves WHERE game_id = ? ORDER BY timestamp ASC
  `).all(gameId) as any[];

  return rows.map(row => ({
    id: row.id,
    gameId: row.game_id,
    agentId: row.agent_id,
    row: row.row,
    col: row.col,
    value: row.value,
    isValid: row.is_valid === 1,
    timestamp: row.timestamp,
  }));
}

// ============================================================================
// Leaderboard Operations
// ============================================================================

export function getLeaderboard(limit: number = 50, difficulty?: string): LeaderboardEntry[] {
  // For now, we'll get all agents sorted by ELO
  // In future, we could filter by difficulty-specific stats
  const rows = db.prepare(`
    SELECT
      id, name, elo_rating, games_played, wins, losses,
      CASE WHEN games_played > 0 THEN CAST(wins AS FLOAT) / games_played * 100 ELSE 0 END as win_rate,
      CASE WHEN games_played > 0 THEN total_solve_time_ms / games_played ELSE NULL END as avg_solve_ms
    FROM agents
    WHERE games_played > 0
    ORDER BY elo_rating DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    name: row.name,
    eloRating: row.elo_rating,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    winRate: Math.round(row.win_rate * 10) / 10,
    avgSolveMs: row.avg_solve_ms ? Math.round(row.avg_solve_ms) : null,
  }));
}

// ============================================================================
// Platform Stats
// ============================================================================

export function getPlatformStats(): PlatformStats {
  // Update active games count
  const activeCount = db.prepare(`
    SELECT COUNT(*) as count FROM games WHERE state IN ('waiting', 'countdown', 'playing')
  `).get() as any;

  // Count games in last 24 hours
  const last24h = db.prepare(`
    SELECT COUNT(*) as count FROM games WHERE created_at > datetime('now', '-24 hours')
  `).get() as any;

  db.prepare(`
    UPDATE platform_stats SET
      active_games = ?,
      games_last_24h = ?,
      updated_at = datetime('now')
    WHERE id = 'global'
  `).run(activeCount.count, last24h.count);

  const row = db.prepare(`SELECT * FROM platform_stats WHERE id = 'global'`).get() as any;

  return {
    totalAgents: row.total_agents,
    totalGames: row.total_games,
    activeGames: row.active_games,
    gamesLast24h: row.games_last_24h,
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

export function cleanupOldGames(maxAgeMinutes: number = 60): number {
  const result = db.prepare(`
    DELETE FROM games
    WHERE state = 'waiting'
    AND created_at < datetime('now', '-' || ? || ' minutes')
  `).run(maxAgeMinutes);

  return result.changes;
}

// Export the database instance for direct queries if needed
export { db };
