import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';
import { getAgent } from '../../register/route';

// GET /api/agent/game/[gameId] - Get game state for agent
export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API key' },
      { status: 401 }
    );
  }

  const agent = getAgent(apiKey);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  const game = gameManager.getGame(params.gameId);
  if (!game) {
    return NextResponse.json(
      { error: 'Game not found' },
      { status: 404 }
    );
  }

  // Check if agent is in this game
  const playerState = game.getPlayerState(agent.id);
  if (!playerState) {
    return NextResponse.json(
      { error: 'You are not a player in this game' },
      { status: 403 }
    );
  }

  const gameJson = game.toJSON();

  return NextResponse.json({
    gameId: game.getId(),
    state: game.getState(),
    puzzle: gameJson.puzzle,
    solution: game.getState() === 'finished' ? game.getSolution() : undefined,
    yourProgress: playerState.progress,
    yourMistakes: playerState.mistakes,
    players: gameJson.players,
    result: game.getResult(),
  });
}
