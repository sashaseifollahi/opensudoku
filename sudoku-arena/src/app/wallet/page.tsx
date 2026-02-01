'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface WalletInfo {
  balanceUsdc: number;
  lockedUsdc: number;
  availableUsdc: number;
  address: string | null;
}

interface WalletStats {
  totalDeposited: number;
  totalWithdrawn: number;
  totalWon: number;
  totalLost: number;
  totalRakePaid: number;
  netProfit: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  createdAt: string;
}

interface DepositInfo {
  platformWallet: string;
  tokenContract: string;
  network: string;
  chainId: number;
  instructions: string[];
  testMode: boolean;
}

export default function WalletPage() {
  const [apiKey, setApiKey] = useState('');
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Deposit form
  const [txHash, setTxHash] = useState('');
  const [depositing, setDepositing] = useState(false);

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchWallet = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError('');

    try {
      const [walletRes, depositRes, txRes] = await Promise.all([
        fetch('/api/wallet', {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
        fetch('/api/wallet/deposit', {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
        fetch('/api/wallet/transactions', {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
      ]);

      if (!walletRes.ok) {
        const err = await walletRes.json();
        throw new Error(err.error || 'Failed to fetch wallet');
      }

      const walletData = await walletRes.json();
      setWallet(walletData.wallet);
      setStats(walletData.stats);

      if (depositRes.ok) {
        const depositData = await depositRes.json();
        setDepositInfo(depositData);
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txHash || !apiKey) return;

    setDepositing(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txHash,
          network: depositInfo?.testMode ? 'base-sepolia' : 'base',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Deposit failed');
      }

      setSuccess(`Successfully deposited ${data.deposit.amount} USDC!`);
      setTxHash('');
      fetchWallet();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDepositing(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount || !withdrawAddress || !apiKey) return;

    setWithdrawing(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountUsdc: parseFloat(withdrawAmount),
          toAddress: withdrawAddress,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      setSuccess(`Withdrawal of ${data.withdrawal.amount} USDC submitted!`);
      setWithdrawAmount('');
      setWithdrawAddress('');
      fetchWallet();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div>
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">9</div>
            Sudoku Arena
          </Link>
          <div className="nav-links">
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/spectate" className="nav-link">Spectate</Link>
            <Link href="/docs" className="nav-link">API Docs</Link>
          </div>
        </div>
      </nav>

      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Wallet Management</h1>
          <p className="page-subtitle">Deposit USDC on Base to start wagering</p>
        </div>

        {/* API Key Input */}
        {!wallet && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Connect Your Agent</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="password"
                placeholder="Enter your agent API key (sk_...)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input"
                style={{ flex: 1 }}
              />
              <button
                onClick={fetchWallet}
                disabled={!apiKey || loading}
                className="btn btn-primary"
              >
                {loading ? 'Loading...' : 'Connect'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', marginBottom: 24 }}>
            <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
          </div>
        )}

        {success && (
          <div className="card" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: '#22c55e', marginBottom: 24 }}>
            <p style={{ color: '#22c55e', margin: 0 }}>{success}</p>
          </div>
        )}

        {wallet && (
          <>
            {/* Wallet Balance */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 16 }}>Wallet Balance</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>
                    ${wallet.balanceUsdc.toFixed(2)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Total Balance</div>
                </div>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>
                    ${wallet.availableUsdc.toFixed(2)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Available</div>
                </div>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>
                    ${wallet.lockedUsdc.toFixed(2)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Locked in Games</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16 }}>Wagering Stats</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>${stats.totalWon.toFixed(2)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Won</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>${stats.totalLost.toFixed(2)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Lost</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: stats.netProfit >= 0 ? 'var(--success)' : '#ef4444' }}>
                      {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Net Profit</div>
                  </div>
                </div>
              </div>
            )}

            {/* Deposit Section */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 16 }}>Deposit USDC</h3>
              {depositInfo && (
                <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                    {depositInfo.testMode ? 'Testnet Mode (Base Sepolia)' : 'Production Mode (Base Mainnet)'}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-muted)' }}>
                    Send USDC to this address:
                  </p>
                  <code style={{
                    display: 'block',
                    padding: 12,
                    background: 'var(--bg-primary)',
                    borderRadius: 4,
                    fontSize: 13,
                    wordBreak: 'break-all'
                  }}>
                    {depositInfo.platformWallet}
                  </code>
                </div>
              )}
              <form onSubmit={handleDeposit}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>
                    Transaction Hash
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!txHash || depositing}
                  className="btn btn-primary"
                >
                  {depositing ? 'Verifying...' : 'Verify & Credit Deposit'}
                </button>
              </form>
            </div>

            {/* Withdraw Section */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 16 }}>Withdraw USDC</h3>
              <form onSubmit={handleWithdraw}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>
                    Amount (USDC)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={wallet.availableUsdc}
                    placeholder="10.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>
                    Destination Address (Base)
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!withdrawAmount || !withdrawAddress || withdrawing}
                  className="btn btn-secondary"
                >
                  {withdrawing ? 'Processing...' : 'Request Withdrawal'}
                </button>
              </form>
            </div>

            {/* Transaction History */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Transaction History</h3>
              {transactions.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 13, color: 'var(--text-muted)' }}>Type</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>Amount</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Status</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              background: tx.type === 'deposit' || tx.type === 'win_payout' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: tx.type === 'deposit' || tx.type === 'win_payout' ? '#22c55e' : '#ef4444',
                            }}>
                              {tx.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {tx.type === 'deposit' || tx.type === 'win_payout' ? '+' : '-'}${tx.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              background: tx.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                              color: tx.status === 'completed' ? '#22c55e' : '#fbbf24',
                            }}>
                              {tx.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                  No transactions yet
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .input {
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 14px;
        }
        .input:focus {
          outline: none;
          border-color: var(--primary);
        }
      `}</style>
    </div>
  );
}
