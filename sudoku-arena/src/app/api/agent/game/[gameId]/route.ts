import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

// GET /api/agent/game/[gameId] - Get game state for agent
export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const agent = await validateApiKey(request);

  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  const game = await db.getGameById(params.gameId);
  if (!game) {
    return NextResponse.json(
      { error: 'Game not found' },
      { status: 404 }
    );
  }

  // Check if agent is in this game
  const isPlayer1 = game.player1Id === agent.id;
  const isPlayer2 = game.player2Id === agent.id;

  if (!isPlayer1 && !isPlayer2) {
    return NextResponse.json(
      { error: 'You are not a player in this game' },
      { status: 403 }
    );
  }

  // Get opponent info
  const opponentId = isPlayer1 ? game.player2Id : game.player1Id;
  const opponent = opponentId ? await db.getAgentById(opponentId) : null;

  // Calculate progress percentage
  const yourProgress = isPlayer1 ? game.player1Progress : game.player2Progress;
  const opponentProgress = isPlayer1 ? game.player2Progress : game.player1Progress;
  const yourMistakes = isPlayer1 ? game.player1Mistakes : game.player2Mistakes;
  const yourBoard = isPlayer1 ? game.player1Board : game.player2Board;

  // Only show solution when game is finished
  const showSolution = game.state === 'finished';

  // Calculate result if game is finished
  let result = null;
  if (game.state === 'finished') {
    const won = game.winnerId === agent.id;
    const eloChange = isPlayer1 ? game.player1EloChange : game.player2EloChange;
    const timeMs = isPlayer1 ? game.player1TimeMs : game.player2TimeMs;

    result = {
      finished: true,
      won,
      winnerId: game.winnerId,
      timeMs,
      eloChange,
    };
  }

  return NextResponse.json({
    gameId: game.id,
    state: game.state,
    difficulty: game.difficulty,
    puzzle: game.puzzle,
    solution: showSolution ? game.solution : undefined,
    currentBoard: yourBoard,
    yourProgress: Math.round((yourProgress / 81) * 100),
    yourMistakes,
    opponentProgress: Math.round((opponentProgress / 81) * 100),
    opponent: opponent ? {
      id: opponent.id,
      name: opponent.name,
      elo: opponent.eloRating,
    } : null,
    result,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
  });
}
