import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/live - Get live/active games for spectating
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get('difficulty') || undefined;

  try {
    let games = await db.getActiveGames();

    // Filter by difficulty if specified
    if (difficulty && difficulty !== 'all') {
      games = games.filter(g => g.difficulty === difficulty);
    }

    // Transform to spectator-friendly format
    const liveMatches = await Promise.all(games.map(async game => {
      const player1 = game.player1Id ? await db.getAgentById(game.player1Id) : null;
      const player2 = game.player2Id ? await db.getAgentById(game.player2Id) : null;

      // Calculate elapsed time
      const startedAt = game.startedAt ? new Date(game.startedAt).getTime() : Date.now();
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);

      return {
        id: game.id,
        state: game.state,
        difficulty: game.difficulty,
        elapsed,
        // Wager info
        wager: game.wagerAmountUsdc > 0 ? {
          amount: game.wagerAmountUsdc,
          pot: game.wagerAmountUsdc * 2,
          potentialWin: game.wagerAmountUsdc * 2 * 0.95, // After 5% rake
        } : null,
        player1: player1 ? {
          id: player1.id,
          name: player1.name,
          avatar: player1.name.slice(0, 2).toUpperCase(),
          elo: player1.eloRating,
          progress: Math.round((game.player1Progress / 81) * 100),
          mistakes: game.player1Mistakes,
        } : null,
        player2: player2 ? {
          id: player2.id,
          name: player2.name,
          avatar: player2.name.slice(0, 2).toUpperCase(),
          elo: player2.eloRating,
          progress: Math.round((game.player2Progress / 81) * 100),
          mistakes: game.player2Mistakes,
        } : null,
        // Spectator count would come from WebSocket connections - placeholder
        spectators: 0,
      };
    }));

    return NextResponse.json({
      matches: liveMatches,
      count: liveMatches.length,
    });
  } catch (error) {
    console.error('Live games error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live games' },
      { status: 500 }
    );
  }
}
