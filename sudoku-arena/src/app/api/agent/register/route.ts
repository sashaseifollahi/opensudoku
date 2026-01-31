import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// In-memory agent registry (use a database in production)
const agents = new Map<string, {
  id: string;
  apiKey: string;
  name: string;
  description?: string;
  createdAt: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}>();

// POST /api/agent/register - Register a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body as {
      name: string;
      description?: string;
    };

    if (!name || name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    const agentId = `agent_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const apiKey = `sk_${uuidv4().replace(/-/g, '')}`;

    const agent = {
      id: agentId,
      apiKey,
      name,
      description,
      createdAt: Date.now(),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    };

    agents.set(agentId, agent);

    return NextResponse.json({
      agentId,
      apiKey,
      message: 'Agent registered successfully. Save your API key - it cannot be retrieved later.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// Export for use in other routes
export function getAgent(apiKey: string) {
  for (const agent of agents.values()) {
    if (agent.apiKey === apiKey) {
      return agent;
    }
  }
  return null;
}

export function getAgentById(agentId: string) {
  return agents.get(agentId);
}

export function updateAgentStats(agentId: string, won: boolean) {
  const agent = agents.get(agentId);
  if (agent) {
    agent.gamesPlayed++;
    if (won) {
      agent.wins++;
    } else {
      agent.losses++;
    }
  }
}
