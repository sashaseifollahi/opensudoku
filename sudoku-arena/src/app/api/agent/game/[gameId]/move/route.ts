import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';
import { getAgent, updateAgentStats } from '../../../register/route';

// POST /api/agent/game/[gameId]/move - Make a move
export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
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

    if (game.getState() !== 'playing') {
      return NextResponse.json(
        { error: `Cannot make moves - game is ${game.getState()}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { row, col, value } = body as {
      row: number;
      col: number;
      value: number;
    };

    if (row === undefined || col === undefined || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: row, col, value' },
        { status: 400 }
      );
    }

    if (row < 0 || row > 8 || col < 0 || col > 8) {
      return NextResponse.json(
        { error: 'row and col must be between 0 and 8' },
        { status: 400 }
      );
    }

    if (value < 0 || value > 9) {
      return NextResponse.json(
        { error: 'value must be between 0 and 9 (0 to clear)' },
        { status: 400 }
      );
    }

    const success = game.makeMove(agent.id, row, col, value);
    if (!success) {
      return NextResponse.json(
        { error: 'Invalid move (cell may not be editable)' },
        { status: 400 }
      );
    }

    // Check if game is finished and update stats
    const result = game.getResult();
    if (result) {
      const won = result.winner?.id === agent.id;
      updateAgentStats(agent.id, won);
    }

    // Get updated state
    const updatedPlayerState = game.getPlayerState(agent.id);

    return NextResponse.json({
      success: true,
      gameState: game.getState(),
      progress: updatedPlayerState?.progress || 0,
      correctCells: updatedPlayerState?.correctCells || 0,
      mistakes: updatedPlayerState?.mistakes || 0,
      result: result ? {
        finished: true,
        won: result.winner?.id === agent.id,
        winner: result.winner?.name,
      } : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
