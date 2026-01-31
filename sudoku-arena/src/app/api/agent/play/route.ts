import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';
import { getAgent } from '../register/route';
import { Difficulty } from '@/lib/game';

// POST /api/agent/play - Find a match for an agent
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key. Use Authorization: Bearer <api_key>' },
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

    // Check if agent is already in a game
    const existingGame = gameManager.getPlayerGame(agent.id);
    if (existingGame && existingGame.getState() !== 'finished') {
      return NextResponse.json({
        status: 'in_game',
        gameId: existingGame.getId(),
        game: existingGame.toJSON(),
      });
    }

    const body = await request.json().catch(() => ({}));
    const { difficulty, waitForHuman } = body as {
      difficulty?: Difficulty;
      waitForHuman?: boolean;
    };

    // Try to find a match
    const game = gameManager.findMatch({
      playerId: agent.id,
      playerName: agent.name,
      playerType: 'agent',
      difficulty,
    });

    if (game) {
      return NextResponse.json({
        status: 'matched',
        gameId: game.getId(),
        game: game.toJSON(),
      });
    }

    return NextResponse.json({
      status: 'waiting',
      message: 'Waiting for opponent. Poll this endpoint to check status.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
