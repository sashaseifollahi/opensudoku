import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '../register/route';
import { PuzzleGenerator, Difficulty } from '@/lib/game';

// POST /api/agent/play - Find a match for an agent
export async function POST(request: NextRequest) {
  try {
    const agent = validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key. Use Authorization: Bearer <api_key>' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { difficulty = 'medium' } = body as {
      difficulty?: Difficulty;
    };

    // Validate difficulty
    if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid difficulty. Must be: easy, medium, hard, or expert' },
        { status: 400 }
      );
    }

    // Check if agent is already in an active game
    const activeGames = db.getActiveGames();
    const existingGame = activeGames.find(
      g => g.player1Id === agent.id || g.player2Id === agent.id
    );

    if (existingGame) {
      const isPlayer1 = existingGame.player1Id === agent.id;
      const opponent = isPlayer1
        ? (existingGame.player2Id ? db.getAgentById(existingGame.player2Id) : null)
        : (existingGame.player1Id ? db.getAgentById(existingGame.player1Id) : null);

      return NextResponse.json({
        status: 'in_game',
        gameId: existingGame.id,
        puzzle: existingGame.puzzle,
        difficulty: existingGame.difficulty,
        state: existingGame.state,
        yourProgress: isPlayer1 ? existingGame.player1Progress : existingGame.player2Progress,
        opponentProgress: isPlayer1 ? existingGame.player2Progress : existingGame.player1Progress,
        opponent: opponent ? { id: opponent.id, name: opponent.name, elo: opponent.eloRating } : null,
      });
    }

    // Look for waiting games to join
    const waitingGames = db.getWaitingGames(difficulty);
    const gameToJoin = waitingGames.find(g => g.player1Id !== agent.id);

    if (gameToJoin) {
      // Join existing game
      const updatedGame = db.joinGame(gameToJoin.id, agent.id);
      if (updatedGame) {
        const opponent = updatedGame.player1Id ? db.getAgentById(updatedGame.player1Id) : null;

        // Start game after brief countdown
        setTimeout(() => {
          db.updateGameState(updatedGame.id, 'playing');
        }, 3000);

        return NextResponse.json({
          status: 'matched',
          gameId: updatedGame.id,
          puzzle: updatedGame.puzzle,
          difficulty: updatedGame.difficulty,
          state: 'countdown',
          opponent: opponent ? { id: opponent.id, name: opponent.name, elo: opponent.eloRating } : null,
        });
      }
    }

    // Create new game and wait for opponent
    const { puzzle, solution } = PuzzleGenerator.generate(difficulty);
    const newGame = db.createGame(difficulty, puzzle, solution, agent.id);

    return NextResponse.json({
      status: 'waiting',
      gameId: newGame.id,
      message: 'Waiting for opponent. Poll this endpoint or /api/agent/game/{gameId} to check status.',
    });
  } catch (error) {
    console.error('Agent play error:', error);
    return NextResponse.json(
      { error: 'Failed to find match' },
      { status: 500 }
    );
  }
}
