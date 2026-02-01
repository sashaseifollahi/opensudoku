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
      // Wagering stats
      totalWagered: stats.totalWageredUsdc || 0,
      totalPayouts: stats.totalPayoutsUsdc || 0,
      totalRakeCollected: stats.totalRakeCollectedUsdc || 0,
      // Prize pool is total payouts (what agents have won)
      totalPrizePool: stats.totalPayoutsUsdc || 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
