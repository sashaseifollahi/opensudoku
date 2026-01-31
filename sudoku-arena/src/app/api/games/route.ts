import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/server/GameManager';
import { Difficulty } from '@/lib/game';
import { v4 as uuidv4 } from 'uuid';

// GET /api/games - List lobby games
export async function GET() {
  const lobbyGames = gameManager.getLobbyGames();

  return NextResponse.json({
    games: lobbyGames.map(lobby => ({
      id: lobby.game.getId(),
      hostId: lobby.hostId,
      players: lobby.game.getPlayers(),
      state: lobby.game.getState(),
      createdAt: lobby.createdAt,
    })),
    stats: gameManager.getStats(),
  });
}

// POST /api/games - Create a new game
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, playerName, difficulty } = body as {
      playerId?: string;
      playerName?: string;
      difficulty?: Difficulty;
    };

    const id = playerId || uuidv4();
    const name = playerName || `Player-${id.slice(0, 6)}`;

    const game = gameManager.createLobbyGame(id, name, { difficulty });

    return NextResponse.json({
      gameId: game.getId(),
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
