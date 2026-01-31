import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';

// GET /api/games/[gameId] - Get game state
export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const game = gameManager.getGame(params.gameId);

  if (!game) {
    return NextResponse.json(
      { error: 'Game not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(game.toJSON());
}
