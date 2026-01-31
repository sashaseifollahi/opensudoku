import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';

// POST /api/games/[gameId]/move - Make a move
export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const body = await request.json();
    const { playerId, row, col, value } = body as {
      playerId: string;
      row: number;
      col: number;
      value: number;
    };

    if (!playerId || row === undefined || col === undefined || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: playerId, row, col, value' },
        { status: 400 }
      );
    }

    const game = gameManager.getGame(params.gameId);
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const success = game.makeMove(playerId, row, col, value);
    if (!success) {
      return NextResponse.json(
        { error: 'Invalid move' },
        { status: 400 }
      );
    }

    const playerState = game.getPlayerState(playerId);

    return NextResponse.json({
      success: true,
      gameState: game.getState(),
      progress: playerState?.progress || 0,
      result: game.getResult(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
