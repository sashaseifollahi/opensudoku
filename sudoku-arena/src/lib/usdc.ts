import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// USDC Contract addresses
const USDC_ADDRESSES = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const;

// Platform wallet address (set via environment variable)
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';

// ERC20 Transfer event ABI
const ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
]);

// Network configuration
const NETWORKS = {
  base: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  },
  'base-sepolia': {
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  },
} as const;

type NetworkId = keyof typeof NETWORKS;

// Create client for a specific network (on demand to avoid type conflicts)
function getClient(network: NetworkId) {
  const config = NETWORKS[network];
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

export interface TransferDetails {
  from: string;
  to: string;
  amount: number; // In USDC (6 decimals)
  txHash: string;
  blockNumber: bigint;
  confirmed: boolean;
}

export interface VerificationResult {
  valid: boolean;
  transfer?: TransferDetails;
  error?: string;
}

/**
 * Verify a USDC transfer transaction on Base
 */
export async function verifyUsdcTransfer(
  txHash: string,
  expectedAmount: number,
  expectedFrom?: string,
  network: NetworkId = 'base'
): Promise<VerificationResult> {
  try {
    const client = getClient(network);
    const usdcAddress = USDC_ADDRESSES[network];

    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (receipt.status !== 'success') {
      return { valid: false, error: 'Transaction failed' };
    }

    // Find USDC Transfer event to platform wallet
    const transferLog = receipt.logs.find(log => {
      if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) return false;

      // Check if it's a Transfer event (topic[0] is the event signature)
      const transferEventSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      if (log.topics[0] !== transferEventSig) return false;

      // Check recipient (topic[2] is 'to' address, padded to 32 bytes)
      const toAddress = '0x' + log.topics[2]?.slice(26);
      if (toAddress.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) return false;

      return true;
    });

    if (!transferLog) {
      return { valid: false, error: 'No USDC transfer to platform wallet found in transaction' };
    }

    // Decode the transfer
    const from = '0x' + transferLog.topics[1]?.slice(26);
    const to = '0x' + transferLog.topics[2]?.slice(26);
    const value = BigInt(transferLog.data);
    const amountUsdc = Number(formatUnits(value, 6));

    // Validate sender if specified
    if (expectedFrom && from.toLowerCase() !== expectedFrom.toLowerCase()) {
      return { valid: false, error: 'Transfer from unexpected address' };
    }

    // Validate amount (with 1% tolerance for gas)
    if (amountUsdc < expectedAmount * 0.99) {
      return {
        valid: false,
        error: `Insufficient amount. Expected ${expectedAmount} USDC, got ${amountUsdc} USDC`,
      };
    }

    // Check confirmations (at least 1 for Base, which has fast finality)
    const currentBlock = await client.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    const confirmed = confirmations >= BigInt(1);

    return {
      valid: true,
      transfer: {
        from,
        to,
        amount: amountUsdc,
        txHash,
        blockNumber: receipt.blockNumber,
        confirmed,
      },
    };
  } catch (error: any) {
    console.error('USDC verification error:', error);
    return {
      valid: false,
      error: error.message || 'Failed to verify transaction',
    };
  }
}

/**
 * Get the platform wallet's USDC balance
 */
export async function getPlatformBalance(network: NetworkId = 'base'): Promise<number> {
  try {
    const client = getClient(network);
    const usdcAddress = USDC_ADDRESSES[network];

    const balance = await client.readContract({
      address: usdcAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [PLATFORM_WALLET as `0x${string}`],
    });

    return Number(formatUnits(balance, 6));
  } catch (error) {
    console.error('Balance check error:', error);
    return 0;
  }
}

/**
 * Check if the platform wallet is configured
 */
export function isPlatformWalletConfigured(): boolean {
  return PLATFORM_WALLET !== '0x0000000000000000000000000000000000000000';
}

/**
 * Get deposit instructions for agents
 */
export function getDepositInstructions(network: NetworkId = 'base') {
  return {
    platformWallet: PLATFORM_WALLET,
    tokenContract: USDC_ADDRESSES[network],
    network,
    chainId: NETWORKS[network].chain.id,
    instructions: [
      '1. Send USDC to the platform wallet address',
      '2. Wait for transaction confirmation',
      '3. Call POST /api/wallet/deposit with the txHash',
      '4. Your wallet will be credited automatically',
    ],
  };
}

export { PLATFORM_WALLET, USDC_ADDRESSES, NETWORKS };
