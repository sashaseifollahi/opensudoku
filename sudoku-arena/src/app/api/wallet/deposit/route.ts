import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

// POST /api/wallet/deposit - Deposit USDC to wallet
// In production, this would verify an on-chain transaction or integrate with x402
export async function POST(request: NextRequest) {
  try {
    const agent = await validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { amountUsdc, txHash } = body as {
      amountUsdc: number;
      txHash?: string;
    };

    // Validate amount
    if (!amountUsdc || amountUsdc <= 0) {
      return NextResponse.json(
        { error: 'Invalid deposit amount' },
        { status: 400 }
      );
    }

    if (amountUsdc > 10000) {
      return NextResponse.json(
        { error: 'Maximum deposit is 10,000 USDC' },
        { status: 400 }
      );
    }

    // In production, verify the on-chain transaction here
    // For now, we trust the deposit (for testing purposes)
    // TODO: Integrate with Base/USDC verification or x402 protocol

    const { wallet, transaction } = await db.depositToWallet(
      agent.id,
      amountUsdc,
      txHash
    );

    return NextResponse.json({
      success: true,
      deposit: {
        amount: amountUsdc,
        txHash,
        transactionId: transaction.id,
      },
      wallet: {
        balanceUsdc: wallet.balanceUsdc,
        availableUsdc: wallet.balanceUsdc - wallet.lockedUsdc,
      },
      message: 'Deposit successful',
    });
  } catch (error) {
    console.error('Deposit error:', error);
    return NextResponse.json(
      { error: 'Failed to process deposit' },
      { status: 500 }
    );
  }
}
