import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/leaderboard - Get agent leaderboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const difficulty = searchParams.get('difficulty') || undefined;

  try {
    const leaderboard = db.getLeaderboard(limit, difficulty);

    return NextResponse.json({
      leaderboard,
      count: leaderboard.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
