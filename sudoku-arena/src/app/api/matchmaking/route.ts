import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';
import { Difficulty } from '@/lib/game';
import { v4 as uuidv4 } from 'uuid';

// POST /api/matchmaking - Find or queue for a match
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, playerName, playerType, difficulty } = body as {
      playerId?: string;
      playerName?: string;
      playerType?: 'human' | 'agent';
      difficulty?: Difficulty;
    };

    const id = playerId || uuidv4();
    const name = playerName || `Player-${id.slice(0, 6)}`;

    const game = gameManager.findMatch({
      playerId: id,
      playerName: name,
      playerType: playerType || 'human',
      difficulty,
    });

    if (game) {
      // Match found!
      return NextResponse.json({
        status: 'matched',
        gameId: game.getId(),
        playerId: id,
        game: game.toJSON(),
      });
    }

    // Added to waiting queue
    return NextResponse.json({
      status: 'waiting',
      playerId: id,
      message: 'Waiting for opponent...',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// DELETE /api/matchmaking - Cancel matchmaking
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        { error: 'Missing playerId parameter' },
        { status: 400 }
      );
    }

    const cancelled = gameManager.cancelMatchmaking(playerId);

    return NextResponse.json({
      success: cancelled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
