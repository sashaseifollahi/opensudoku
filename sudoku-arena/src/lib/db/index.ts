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
  -- Wager fields
  wager_amount_usdc REAL DEFAULT 0,
  is_ranked INTEGER DEFAULT 1,
  player1_wager_locked INTEGER DEFAULT 0,
  player2_wager_locked INTEGER DEFAULT 0,
  pot_amount_usdc REAL DEFAULT 0,
  house_rake_usdc REAL DEFAULT 0,
  winner_payout_usdc REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

-- Wallets for agent funds (USDC on Base)
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL REFERENCES agents(id),
  address TEXT,
  balance_usdc REAL DEFAULT 0,
  locked_usdc REAL DEFAULT 0,
  total_deposited_usdc REAL DEFAULT 0,
  total_withdrawn_usdc REAL DEFAULT 0,
  total_won_usdc REAL DEFAULT 0,
  total_lost_usdc REAL DEFAULT 0,
  total_rake_paid_usdc REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Transaction history for audit trail
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  game_id TEXT REFERENCES games(id),
  tx_type TEXT NOT NULL,
  amount_usdc REAL NOT NULL,
  balance_before_usdc REAL,
  balance_after_usdc REAL,
  external_tx_hash TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
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
  -- Wager stats
  total_wagered_usdc REAL DEFAULT 0,
  total_rake_collected_usdc REAL DEFAULT 0,
  total_payouts_usdc REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO platform_stats (id) VALUES ('global');

CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_games_state ON games(state);
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_wallets_agent ON wallets(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_agent ON transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_game ON transactions(game_id);
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
  // Wager fields
  wagerAmountUsdc: number;
  isRanked: boolean;
  player1WagerLocked: boolean;
  player2WagerLocked: boolean;
  potAmountUsdc: number;
  houseRakeUsdc: number;
  winnerPayoutUsdc: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Wallet {
  id: string;
  agentId: string;
  address: string | null;
  balanceUsdc: number;
  lockedUsdc: number;
  totalDepositedUsdc: number;
  totalWithdrawnUsdc: number;
  totalWonUsdc: number;
  totalLostUsdc: number;
  totalRakePaidUsdc: number;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'wager_lock'
  | 'wager_unlock'
  | 'win_payout'
  | 'loss_debit'
  | 'rake';

export interface Transaction {
  id: string;
  agentId: string;
  walletId: string;
  gameId: string | null;
  txType: TransactionType;
  amountUsdc: number;
  balanceBeforeUsdc: number;
  balanceAfterUsdc: number;
  externalTxHash: string | null;
  status: 'pending' | 'completed' | 'failed';
  description: string | null;
  createdAt: string;
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
    // Wager fields
    wagerAmountUsdc: (row.wager_amount_usdc as number) || 0,
    isRanked: (row.is_ranked as number) === 1,
    player1WagerLocked: (row.player1_wager_locked as number) === 1,
    player2WagerLocked: (row.player2_wager_locked as number) === 1,
    potAmountUsdc: (row.pot_amount_usdc as number) || 0,
    houseRakeUsdc: (row.house_rake_usdc as number) || 0,
    winnerPayoutUsdc: (row.winner_payout_usdc as number) || 0,
    createdAt: row.created_at as string,
    startedAt: row.started_at as string | null,
    finishedAt: row.finished_at as string | null,
  };
}

function mapRowToWallet(row: Record<string, unknown>): Wallet {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    address: row.address as string | null,
    balanceUsdc: (row.balance_usdc as number) || 0,
    lockedUsdc: (row.locked_usdc as number) || 0,
    totalDepositedUsdc: (row.total_deposited_usdc as number) || 0,
    totalWithdrawnUsdc: (row.total_withdrawn_usdc as number) || 0,
    totalWonUsdc: (row.total_won_usdc as number) || 0,
    totalLostUsdc: (row.total_lost_usdc as number) || 0,
    totalRakePaidUsdc: (row.total_rake_paid_usdc as number) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    walletId: row.wallet_id as string,
    gameId: row.game_id as string | null,
    txType: row.tx_type as TransactionType,
    amountUsdc: row.amount_usdc as number,
    balanceBeforeUsdc: row.balance_before_usdc as number,
    balanceAfterUsdc: row.balance_after_usdc as number,
    externalTxHash: row.external_tx_hash as string | null,
    status: row.status as Transaction['status'],
    description: row.description as string | null,
    createdAt: row.created_at as string,
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

  // Create wallet for the agent
  await createWallet(id);

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
// Wallet Operations
// ============================================================================

const HOUSE_RAKE_PERCENT = 5; // 5% rake on wagered games

export async function createWallet(agentId: string): Promise<Wallet> {
  await initDb();
  const id = generateId();

  await db.execute({
    sql: `INSERT INTO wallets (id, agent_id) VALUES (?, ?)`,
    args: [id, agentId],
  });

  return (await getWalletByAgentId(agentId))!;
}

export async function getWalletByAgentId(agentId: string): Promise<Wallet | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM wallets WHERE agent_id = ?`,
    args: [agentId],
  });

  if (result.rows.length === 0) return null;
  return mapRowToWallet(result.rows[0] as Record<string, unknown>);
}

export async function getWalletById(id: string): Promise<Wallet | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM wallets WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToWallet(result.rows[0] as Record<string, unknown>);
}

export async function depositToWallet(
  agentId: string,
  amountUsdc: number,
  externalTxHash?: string
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  await initDb();
  const wallet = await getWalletByAgentId(agentId);
  if (!wallet) throw new Error('Wallet not found');

  const newBalance = wallet.balanceUsdc + amountUsdc;
  const txId = generateId();

  // Update wallet balance
  await db.execute({
    sql: `
      UPDATE wallets SET
        balance_usdc = ?,
        total_deposited_usdc = total_deposited_usdc + ?,
        updated_at = datetime('now')
      WHERE agent_id = ?
    `,
    args: [newBalance, amountUsdc, agentId],
  });

  // Record transaction
  await db.execute({
    sql: `
      INSERT INTO transactions (id, agent_id, wallet_id, tx_type, amount_usdc, balance_before_usdc, balance_after_usdc, external_tx_hash, status, description)
      VALUES (?, ?, ?, 'deposit', ?, ?, ?, ?, 'completed', 'Deposit to wallet')
    `,
    args: [txId, agentId, wallet.id, amountUsdc, wallet.balanceUsdc, newBalance, externalTxHash || null],
  });

  const updatedWallet = (await getWalletByAgentId(agentId))!;
  const transaction = (await getTransactionById(txId))!;

  return { wallet: updatedWallet, transaction };
}

export async function withdrawFromWallet(
  agentId: string,
  amountUsdc: number
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  await initDb();
  const wallet = await getWalletByAgentId(agentId);
  if (!wallet) throw new Error('Wallet not found');

  const availableBalance = wallet.balanceUsdc - wallet.lockedUsdc;
  if (amountUsdc > availableBalance) {
    throw new Error(`Insufficient balance. Available: ${availableBalance} USDC`);
  }

  const newBalance = wallet.balanceUsdc - amountUsdc;
  const txId = generateId();

  // Update wallet balance
  await db.execute({
    sql: `
      UPDATE wallets SET
        balance_usdc = ?,
        total_withdrawn_usdc = total_withdrawn_usdc + ?,
        updated_at = datetime('now')
      WHERE agent_id = ?
    `,
    args: [newBalance, amountUsdc, agentId],
  });

  // Record transaction
  await db.execute({
    sql: `
      INSERT INTO transactions (id, agent_id, wallet_id, tx_type, amount_usdc, balance_before_usdc, balance_after_usdc, status, description)
      VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, 'pending', 'Withdrawal request')
    `,
    args: [txId, agentId, wallet.id, amountUsdc, wallet.balanceUsdc, newBalance],
  });

  const updatedWallet = (await getWalletByAgentId(agentId))!;
  const transaction = (await getTransactionById(txId))!;

  return { wallet: updatedWallet, transaction };
}

export async function lockWagerFunds(
  agentId: string,
  gameId: string,
  amountUsdc: number
): Promise<boolean> {
  await initDb();
  const wallet = await getWalletByAgentId(agentId);
  if (!wallet) return false;

  const availableBalance = wallet.balanceUsdc - wallet.lockedUsdc;
  if (amountUsdc > availableBalance) return false;

  const txId = generateId();

  // Lock funds in wallet
  await db.execute({
    sql: `
      UPDATE wallets SET
        locked_usdc = locked_usdc + ?,
        updated_at = datetime('now')
      WHERE agent_id = ?
    `,
    args: [amountUsdc, agentId],
  });

  // Record transaction
  await db.execute({
    sql: `
      INSERT INTO transactions (id, agent_id, wallet_id, game_id, tx_type, amount_usdc, balance_before_usdc, balance_after_usdc, status, description)
      VALUES (?, ?, ?, ?, 'wager_lock', ?, ?, ?, 'completed', 'Wager locked for game')
    `,
    args: [txId, agentId, wallet.id, gameId, amountUsdc, wallet.balanceUsdc, wallet.balanceUsdc],
  });

  return true;
}

export async function unlockWagerFunds(
  agentId: string,
  gameId: string,
  amountUsdc: number
): Promise<void> {
  await initDb();
  const wallet = await getWalletByAgentId(agentId);
  if (!wallet) return;

  const txId = generateId();

  // Unlock funds in wallet
  await db.execute({
    sql: `
      UPDATE wallets SET
        locked_usdc = MAX(0, locked_usdc - ?),
        updated_at = datetime('now')
      WHERE agent_id = ?
    `,
    args: [amountUsdc, agentId],
  });

  // Record transaction
  await db.execute({
    sql: `
      INSERT INTO transactions (id, agent_id, wallet_id, game_id, tx_type, amount_usdc, balance_before_usdc, balance_after_usdc, status, description)
      VALUES (?, ?, ?, ?, 'wager_unlock', ?, ?, ?, 'completed', 'Wager unlocked - game cancelled')
    `,
    args: [txId, agentId, wallet.id, gameId, amountUsdc, wallet.balanceUsdc, wallet.balanceUsdc],
  });
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM transactions WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToTransaction(result.rows[0] as Record<string, unknown>);
}

export async function getTransactionsByAgentId(agentId: string, limit: number = 50): Promise<Transaction[]> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM transactions WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [agentId, limit],
  });

  return result.rows.map(row => mapRowToTransaction(row as Record<string, unknown>));
}

// ============================================================================
// Wager Settlement
// ============================================================================

export async function settleWager(
  gameId: string,
  winnerId: string,
  loserId: string
): Promise<{ winnerPayout: number; houseRake: number }> {
  await initDb();
  const game = await getGameById(gameId);
  if (!game || game.wagerAmountUsdc <= 0) {
    return { winnerPayout: 0, houseRake: 0 };
  }

  const potAmount = game.wagerAmountUsdc * 2;
  const houseRake = potAmount * (HOUSE_RAKE_PERCENT / 100);
  const winnerPayout = potAmount - houseRake;

  const winnerWallet = await getWalletByAgentId(winnerId);
  const loserWallet = await getWalletByAgentId(loserId);

  if (!winnerWallet || !loserWallet) {
    throw new Error('Wallet not found for settlement');
  }

  // Deduct from loser (already locked, now remove from balance)
  await db.execute({
    sql: `
      UPDATE wallets SET
        balance_usdc = balance_usdc - ?,
        locked_usdc = MAX(0, locked_usdc - ?),
        total_lost_usdc = total_lost_usdc + ?,
        updated_at = datetime('now')
      WHERE agent_id = ?
    `,
    args: [game.wagerAmountUsdc, game.wagerAmountUsdc, game.wagerAmountUsdc, loserId],
  });

  // Credit winner (unlock their wager + add winnings)
  await db.execute({
    sql: `
      UPDATE wallets SET
        balance_usdc = balance_usdc + ?,
        locked_usdc = MAX(0, locked_usdc - ?),
        total_won_usdc = total_won_usdc + ?,
        total_rake_paid_usdc = total_rake_paid_usdc + ?,
        updated_at = datetime('now')
      WHERE agent_id = ?
    `,
    args: [winnerPayout - game.wagerAmountUsdc, game.wagerAmountUsdc, winnerPayout - game.wagerAmountUsdc, houseRake / 2, winnerId],
  });

  // Update loser's rake paid
  await db.execute({
    sql: `UPDATE wallets SET total_rake_paid_usdc = total_rake_paid_usdc + ? WHERE agent_id = ?`,
    args: [houseRake / 2, loserId],
  });

  // Record transactions
  const winnerTxId = generateId();
  const loserTxId = generateId();
  const rakeTxId = generateId();

  await db.execute({
    sql: `
      INSERT INTO transactions (id, agent_id, wallet_id, game_id, tx_type, amount_usdc, balance_before_usdc, balance_after_usdc, status, description)
      VALUES (?, ?, ?, ?, 'win_payout', ?, ?, ?, 'completed', 'Game won - payout received')
    `,
    args: [winnerTxId, winnerId, winnerWallet.id, gameId, winnerPayout, winnerWallet.balanceUsdc, winnerWallet.balanceUsdc + winnerPayout - game.wagerAmountUsdc],
  });

  await db.execute({
    sql: `
      INSERT INTO transactions (id, agent_id, wallet_id, game_id, tx_type, amount_usdc, balance_before_usdc, balance_after_usdc, status, description)
      VALUES (?, ?, ?, ?, 'loss_debit', ?, ?, ?, 'completed', 'Game lost - wager forfeited')
    `,
    args: [loserTxId, loserId, loserWallet.id, gameId, game.wagerAmountUsdc, loserWallet.balanceUsdc, loserWallet.balanceUsdc - game.wagerAmountUsdc],
  });

  // Update game with settlement info
  await db.execute({
    sql: `
      UPDATE games SET
        pot_amount_usdc = ?,
        house_rake_usdc = ?,
        winner_payout_usdc = ?
      WHERE id = ?
    `,
    args: [potAmount, houseRake, winnerPayout, gameId],
  });

  // Update platform stats
  await db.execute({
    sql: `
      UPDATE platform_stats SET
        total_wagered_usdc = total_wagered_usdc + ?,
        total_rake_collected_usdc = total_rake_collected_usdc + ?,
        total_payouts_usdc = total_payouts_usdc + ?
      WHERE id = 'global'
    `,
    args: [potAmount, houseRake, winnerPayout],
  });

  return { winnerPayout, houseRake };
}

export async function createWageredGame(
  difficulty: string,
  puzzle: string,
  solution: string,
  player1Id: string,
  wagerAmountUsdc: number
): Promise<Game | null> {
  await initDb();

  // Check if player has sufficient balance
  const wallet = await getWalletByAgentId(player1Id);
  if (!wallet) return null;

  const availableBalance = wallet.balanceUsdc - wallet.lockedUsdc;
  if (wagerAmountUsdc > availableBalance) return null;

  const id = generateId();

  // Lock the wager funds
  const locked = await lockWagerFunds(player1Id, id, wagerAmountUsdc);
  if (!locked) return null;

  await db.execute({
    sql: `
      INSERT INTO games (id, difficulty, puzzle, solution, player1_id, player1_board, wager_amount_usdc, player1_wager_locked, is_ranked)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
    `,
    args: [id, difficulty, puzzle, solution, player1Id, puzzle, wagerAmountUsdc],
  });

  return getGameById(id);
}

export async function joinWageredGame(gameId: string, playerId: string): Promise<Game | null> {
  await initDb();
  const game = await getGameById(gameId);
  if (!game || game.state !== 'waiting') return null;
  if (game.player1Id === playerId) return null;

  // Check if player has sufficient balance for the wager
  const wallet = await getWalletByAgentId(playerId);
  if (!wallet) return null;

  const availableBalance = wallet.balanceUsdc - wallet.lockedUsdc;
  if (game.wagerAmountUsdc > availableBalance) return null;

  // Lock the wager funds
  const locked = await lockWagerFunds(playerId, gameId, game.wagerAmountUsdc);
  if (!locked) return null;

  await db.execute({
    sql: `
      UPDATE games SET
        player2_id = ?,
        player2_board = puzzle,
        player2_wager_locked = 1,
        state = 'countdown',
        started_at = datetime('now')
      WHERE id = ? AND state = 'waiting'
    `,
    args: [playerId, gameId],
  });

  return getGameById(gameId);
}

// ============================================================================
// Cleanup
// ============================================================================

export async function cleanupOldGames(maxAgeMinutes: number = 60): Promise<number> {
  await initDb();

  // First, refund wagers for abandoned games
  const abandonedGames = await db.execute({
    sql: `
      SELECT id, player1_id, wager_amount_usdc FROM games
      WHERE state = 'waiting'
      AND wager_amount_usdc > 0
      AND created_at < datetime('now', '-' || ? || ' minutes')
    `,
    args: [maxAgeMinutes],
  });

  for (const row of abandonedGames.rows) {
    const gameId = row.id as string;
    const playerId = row.player1_id as string;
    const wagerAmount = row.wager_amount_usdc as number;
    if (playerId && wagerAmount > 0) {
      await unlockWagerFunds(playerId, gameId, wagerAmount);
    }
  }

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

// ============================================================================
// Constants
// ============================================================================

export const WAGER_CONFIG = {
  minWagerUsdc: 1,
  maxWagerUsdc: 1000,
  houseRakePercent: HOUSE_RAKE_PERCENT,
};

// Export the database client for direct queries if needed
export { db };
