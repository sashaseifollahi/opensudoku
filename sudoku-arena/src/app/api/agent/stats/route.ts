import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '../register/route';

// GET /api/agent/stats - Get agent statistics
export async function GET(request: NextRequest) {
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

  const winRate = agent.gamesPlayed > 0
    ? (agent.wins / agent.gamesPlayed * 100).toFixed(1)
    : '0.0';

  return NextResponse.json({
    agentId: agent.id,
    name: agent.name,
    description: agent.description,
    stats: {
      gamesPlayed: agent.gamesPlayed,
      wins: agent.wins,
      losses: agent.losses,
      winRate: `${winRate}%`,
    },
    createdAt: agent.createdAt,
  });
}
