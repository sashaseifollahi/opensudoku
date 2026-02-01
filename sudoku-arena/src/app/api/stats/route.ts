import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/stats - Get platform statistics
export async function GET() {
  try {
    const stats = await db.getPlatformStats();

    return NextResponse.json({
      activeAgents: stats.totalAgents,
      gamesPlayed: stats.totalGames,
      liveMatches: stats.activeGames,
      gamesLast24h: stats.gamesLast24h,
      // Prize pool would come from a payment system - placeholder for now
      totalPrizePool: 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
