import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

// POST /api/wallet/withdraw - Request USDC withdrawal
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
    const { amountUsdc, toAddress } = body as {
      amountUsdc: number;
      toAddress: string;
    };

    // Validate amount
    if (!amountUsdc || amountUsdc <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      );
    }

    // Validate address (basic check for Ethereum-style address)
    if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return NextResponse.json(
        { error: 'Invalid withdrawal address' },
        { status: 400 }
      );
    }

    // Check available balance
    const wallet = await db.getWalletByAgentId(agent.id);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const availableBalance = wallet.balanceUsdc - wallet.lockedUsdc;
    if (amountUsdc > availableBalance) {
      return NextResponse.json(
        {
          error: 'Insufficient available balance',
          available: availableBalance,
          requested: amountUsdc,
        },
        { status: 400 }
      );
    }

    // Process withdrawal request
    // In production, this would queue the withdrawal for processing
    const { wallet: updatedWallet, transaction } = await db.withdrawFromWallet(
      agent.id,
      amountUsdc
    );

    return NextResponse.json({
      success: true,
      withdrawal: {
        amount: amountUsdc,
        toAddress,
        transactionId: transaction.id,
        status: 'pending',
        estimatedTime: '1-24 hours',
      },
      wallet: {
        balanceUsdc: updatedWallet.balanceUsdc,
        availableUsdc: updatedWallet.balanceUsdc - updatedWallet.lockedUsdc,
      },
      message: 'Withdrawal request submitted. Processing may take up to 24 hours.',
    });
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}
