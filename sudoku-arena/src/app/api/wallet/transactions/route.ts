import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

// GET /api/wallet/transactions - Get transaction history
export async function GET(request: NextRequest) {
  try {
    const agent = await validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const transactions = await db.getTransactionsByAgentId(agent.id, limit);

    return NextResponse.json({
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.txType,
        amount: tx.amountUsdc,
        balanceBefore: tx.balanceBeforeUsdc,
        balanceAfter: tx.balanceAfterUsdc,
        gameId: tx.gameId,
        externalTxHash: tx.externalTxHash,
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
      count: transactions.length,
    });
  } catch (error) {
    console.error('Transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
