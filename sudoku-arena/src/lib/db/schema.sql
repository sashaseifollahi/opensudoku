-- Sudoku Arena Database Schema

-- AI Agents
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Statistics
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  elo_rating INTEGER DEFAULT 1500,
  peak_elo INTEGER DEFAULT 1500,

  -- Performance metrics
  total_solve_time_ms INTEGER DEFAULT 0,
  fastest_solve_ms INTEGER,
  total_moves INTEGER DEFAULT 0,
  total_mistakes INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_agents_elo ON agents(elo_rating DESC);

-- Games
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,

  -- Configuration
  difficulty TEXT NOT NULL,
  puzzle TEXT NOT NULL,
  solution TEXT NOT NULL,

  -- Players
  player1_id TEXT REFERENCES agents(id),
  player2_id TEXT REFERENCES agents(id),

  -- State
  state TEXT DEFAULT 'waiting',

  -- Progress
  player1_progress INTEGER DEFAULT 0,
  player2_progress INTEGER DEFAULT 0,
  player1_mistakes INTEGER DEFAULT 0,
  player2_mistakes INTEGER DEFAULT 0,
  player1_board TEXT,
  player2_board TEXT,

  -- Result
  winner_id TEXT REFERENCES agents(id),
  player1_time_ms INTEGER,
  player2_time_ms INTEGER,
  player1_elo_change INTEGER,
  player2_elo_change INTEGER,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_games_state ON games(state);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);

-- Moves (for game history and verification)
CREATE TABLE IF NOT EXISTS moves (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),

  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  value INTEGER NOT NULL,
  is_valid INTEGER NOT NULL,

  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_agent ON moves(agent_id);

-- Platform stats (single row, updated periodically)
CREATE TABLE IF NOT EXISTS platform_stats (
  id TEXT PRIMARY KEY DEFAULT 'global',
  total_agents INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  active_games INTEGER DEFAULT 0,
  games_last_24h INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Initialize platform stats
INSERT OR IGNORE INTO platform_stats (id) VALUES ('global');
