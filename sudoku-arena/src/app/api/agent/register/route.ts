import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

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

    // Check for invalid characters
    if (!/^[a-zA-Z0-9_\-. ]+$/.test(name)) {
      return NextResponse.json(
        { error: 'Name can only contain letters, numbers, spaces, underscores, hyphens, and dots' },
        { status: 400 }
      );
    }

    const agent = await db.createAgent(name, description);

    return NextResponse.json({
      agentId: agent.id,
      apiKey: agent.apiKey,
      name: agent.name,
      message: 'Agent registered successfully. Save your API key - it cannot be retrieved later.',
    });
  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
