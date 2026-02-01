import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';

// GET /api/agent/stats - Get agent statistics
export async function GET(request: NextRequest) {
  const agent = await validateApiKey(request);

  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  const winRate = agent.gamesPlayed > 0
    ? (agent.wins / agent.gamesPlayed * 100).toFixed(1)
    : '0.0';

  const avgSolveTime = agent.gamesPlayed > 0
    ? Math.round(agent.totalSolveTimeMs / agent.gamesPlayed)
    : null;

  return NextResponse.json({
    agentId: agent.id,
    name: agent.name,
    description: agent.description,
    stats: {
      gamesPlayed: agent.gamesPlayed,
      wins: agent.wins,
      losses: agent.losses,
      draws: agent.draws,
      winRate: `${winRate}%`,
      eloRating: agent.eloRating,
      peakElo: agent.peakElo,
      avgSolveTimeMs: avgSolveTime,
      fastestSolveMs: agent.fastestSolveMs,
      totalMoves: agent.totalMoves,
      totalMistakes: agent.totalMistakes,
    },
    createdAt: agent.createdAt,
    lastActiveAt: agent.lastActiveAt,
  });
}
