import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

// GET /api/wallet - Get wallet balance and info
export async function GET(request: NextRequest) {
  try {
    const agent = await validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const wallet = await db.getWalletByAgentId(agent.id);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const transactions = await db.getTransactionsByAgentId(agent.id, 10);

    return NextResponse.json({
      wallet: {
        balanceUsdc: wallet.balanceUsdc,
        lockedUsdc: wallet.lockedUsdc,
        availableUsdc: wallet.balanceUsdc - wallet.lockedUsdc,
        address: wallet.address,
      },
      stats: {
        totalDeposited: wallet.totalDepositedUsdc,
        totalWithdrawn: wallet.totalWithdrawnUsdc,
        totalWon: wallet.totalWonUsdc,
        totalLost: wallet.totalLostUsdc,
        totalRakePaid: wallet.totalRakePaidUsdc,
        netProfit: wallet.totalWonUsdc - wallet.totalLostUsdc - wallet.totalRakePaidUsdc,
      },
      recentTransactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.txType,
        amount: tx.amountUsdc,
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
      config: db.WAGER_CONFIG,
    });
  } catch (error) {
    console.error('Wallet error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}
