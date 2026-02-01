import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import {
  verifyUsdcTransfer,
  getDepositInstructions,
  isPlatformWalletConfigured,
} from '@/lib/usdc';

// GET /api/wallet/deposit - Get deposit instructions
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
    const network = process.env.USDC_NETWORK === 'mainnet' ? 'base' : 'base-sepolia';

    return NextResponse.json({
      ...getDepositInstructions(network),
      yourWallet: wallet?.address || null,
      configured: isPlatformWalletConfigured(),
      testMode: network === 'base-sepolia',
    });
  } catch (error) {
    console.error('Deposit info error:', error);
    return NextResponse.json(
      { error: 'Failed to get deposit info' },
      { status: 500 }
    );
  }
}

// POST /api/wallet/deposit - Verify and credit USDC deposit
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
    const { txHash, network = 'base' } = body as {
      txHash: string;
      network?: 'base' | 'base-sepolia';
    };

    // Validate txHash format
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash format' },
        { status: 400 }
      );
    }

    // Check if this transaction has already been processed
    const existingTx = await db.getTransactionsByAgentId(agent.id, 100);
    const alreadyProcessed = existingTx.some(
      tx => tx.externalTxHash?.toLowerCase() === txHash.toLowerCase()
    );

    if (alreadyProcessed) {
      return NextResponse.json(
        { error: 'This transaction has already been credited' },
        { status: 400 }
      );
    }

    // Verify the USDC transfer on Base
    const verification = await verifyUsdcTransfer(
      txHash,
      0, // Minimum amount (we accept any amount)
      undefined, // From any address
      network
    );

    if (!verification.valid || !verification.transfer) {
      return NextResponse.json(
        {
          error: verification.error || 'Transaction verification failed',
          details: 'Make sure you sent USDC to the correct platform wallet address',
        },
        { status: 400 }
      );
    }

    const { transfer } = verification;

    // Credit the deposit to the agent's wallet
    const { wallet, transaction } = await db.depositToWallet(
      agent.id,
      transfer.amount,
      txHash
    );

    return NextResponse.json({
      success: true,
      deposit: {
        amount: transfer.amount,
        txHash,
        from: transfer.from,
        blockNumber: transfer.blockNumber.toString(),
        confirmed: transfer.confirmed,
        transactionId: transaction.id,
      },
      wallet: {
        balanceUsdc: wallet.balanceUsdc,
        availableUsdc: wallet.balanceUsdc - wallet.lockedUsdc,
      },
      message: `Successfully credited ${transfer.amount} USDC to your wallet`,
    });
  } catch (error: any) {
    console.error('Deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process deposit' },
      { status: 500 }
    );
  }
}
