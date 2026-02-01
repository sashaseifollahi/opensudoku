import { NextRequest } from 'next/server';
import * as db from '@/lib/db';

// Helper to validate API key and get agent (async)
export async function validateApiKey(request: NextRequest): Promise<db.Agent | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.replace('Bearer ', '');
  return await db.getAgentByApiKey(apiKey);
}
