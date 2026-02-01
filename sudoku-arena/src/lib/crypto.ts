import { createHash, createHmac, randomBytes } from 'crypto';

// Server secret for HMAC operations - should be set via environment variable
const SERVER_SECRET = process.env.GAME_SECRET || 'sudoku-arena-default-secret-change-in-production';

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureId(bytes: number = 16): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Hash a solution with game-specific salt to prevent rainbow table attacks
 * The solution is never stored in plaintext - only this hash is stored
 */
export function hashSolution(solution: string, gameId: string): string {
  const hmac = createHmac('sha256', SERVER_SECRET);
  hmac.update(`${gameId}:${solution}`);
  return hmac.digest('hex');
}

/**
 * Verify a solution against its stored hash
 */
export function verifySolution(solution: string, gameId: string, storedHash: string): boolean {
  const computedHash = hashSolution(solution, gameId);
  // Use timing-safe comparison to prevent timing attacks
  if (computedHash.length !== storedHash.length) return false;

  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Create a game integrity hash that covers all critical game data
 * This is used to detect any tampering with game state
 */
export function createGameIntegrityHash(
  gameId: string,
  puzzle: string,
  solution: string,
  difficulty: string,
  createdAt: string,
  wagerAmount: number = 0
): string {
  const hmac = createHmac('sha256', SERVER_SECRET);
  hmac.update(`${gameId}|${puzzle}|${solution}|${difficulty}|${createdAt}|${wagerAmount}`);
  return hmac.digest('hex');
}

/**
 * Verify game integrity hasn't been tampered with
 */
export function verifyGameIntegrity(
  gameId: string,
  puzzle: string,
  solution: string,
  difficulty: string,
  createdAt: string,
  wagerAmount: number,
  storedHash: string
): boolean {
  const computedHash = createGameIntegrityHash(gameId, puzzle, solution, difficulty, createdAt, wagerAmount);

  if (computedHash.length !== storedHash.length) return false;

  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Create a move signature to verify move authenticity
 */
export function signMove(
  gameId: string,
  agentId: string,
  moveSequence: number,
  row: number,
  col: number,
  value: number
): string {
  const hmac = createHmac('sha256', SERVER_SECRET);
  hmac.update(`${gameId}:${agentId}:${moveSequence}:${row}:${col}:${value}`);
  return hmac.digest('hex').substring(0, 16); // Shorter signature for API responses
}

/**
 * Verify a move signature
 */
export function verifyMoveSignature(
  gameId: string,
  agentId: string,
  moveSequence: number,
  row: number,
  col: number,
  value: number,
  signature: string
): boolean {
  const expectedSig = signMove(gameId, agentId, moveSequence, row, col, value);
  return expectedSig === signature;
}

/**
 * Generate a commitment hash for puzzle (used in future for commit-reveal scheme)
 * Agent commits to solving, then puzzle is revealed
 */
export function createPuzzleCommitment(puzzle: string, nonce: string): string {
  const hash = createHash('sha256');
  hash.update(`${puzzle}:${nonce}`);
  return hash.digest('hex');
}

/**
 * Hash for deduplication of blockchain transactions
 */
export function hashTransaction(txHash: string, agentId: string): string {
  const hash = createHash('sha256');
  hash.update(`${txHash}:${agentId}`);
  return hash.digest('hex');
}
