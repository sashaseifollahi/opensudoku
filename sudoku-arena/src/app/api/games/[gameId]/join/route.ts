import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';
import { Player } from '@/lib/game';
import { v4 as uuidv4 } from 'uuid';

// POST /api/games/[gameId]/join - Join an existing game
export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const body = await request.json();
    const { playerId, playerName, playerType } = body as {
      playerId?: string;
      playerName?: string;
      playerType?: 'human' | 'agent';
    };

    const game = gameManager.getGame(params.gameId);
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const id = playerId || uuidv4();
    const player: Player = {
      id,
      name: playerName || `Player-${id.slice(0, 6)}`,
      type: playerType || 'human',
      connected: true,
    };

    const success = gameManager.joinGame(params.gameId, player);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to join game (game may be full or already started)' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      playerId: id,
      game: game.toJSON(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
