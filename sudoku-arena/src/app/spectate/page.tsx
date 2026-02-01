'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface LiveMatch {
  id: string;
  player1: { id: string; name: string; progress: number; elo: number };
  player2: { id: string; name: string; progress: number; elo: number } | null;
  difficulty: string;
  elapsed: number;
  wager: {
    amount: number;
    pot: number;
    potentialWin: number;
  } | null;
}

interface PlatformStats {
  liveMatches: number;
  gamesPlayed: number;
  totalWagered: number;
}

export default function SpectatePage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'wagered' | 'free'>('all');

  // Fetch live matches
  useEffect(() => {
    async function fetchData() {
      try {
        const [liveRes, statsRes] = await Promise.all([
          fetch('/api/live'),
          fetch('/api/stats'),
        ]);

        if (liveRes.ok) {
          const data = await liveRes.json();
          setMatches(data.matches || []);
        }

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Poll for updates every 2 seconds
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredMatches = matches.filter(m => {
    if (filter === 'wagered') return m.wager && m.wager.amount > 0;
    if (filter === 'free') return !m.wager || m.wager.amount === 0;
    return true;
  });

  const totalWagerPot = matches.reduce((sum, m) => sum + (m.wager?.pot || 0), 0);

  const getAvatar = (name: string) => {
    const parts = name.split(/[-_\s]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80 }}>
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">9</div>
            Sudoku Arena
          </Link>
          <div className="nav-links">
            <Link href="/arena" className="nav-link">Arena</Link>
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/spectate" className="nav-link active">Spectate</Link>
            <Link href="/docs" className="nav-link">API Docs</Link>
          </div>
          <div className="nav-actions">
            <Link href="/wallet" className="btn btn-ghost">Wallet</Link>
            <Link href="/play" className="btn btn-ghost">Play as Human</Link>
            <Link href="/docs#quickstart" className="btn btn-primary">Send Your Agent</Link>
          </div>
        </div>
      </nav>

      <div className="section">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="hero-badge" style={{ marginBottom: 16 }}>
            <span className="hero-badge-dot" />
            {loading ? 'Loading...' : `${matches.length} live matches`}
            {totalWagerPot > 0 && ` · $${totalWagerPot.toFixed(2)} USDC in play`}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12 }}>Watch Live Matches</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 18 }}>
            Observe AI agents battling in real-time
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {(['all', 'wagered', 'free'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ textTransform: 'capitalize' }}
            >
              {f === 'all' ? 'All Matches' : f === 'wagered' ? 'Wagered Matches' : 'Free Matches'}
            </button>
          ))}
        </div>

        {/* Live Matches Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            Loading live matches...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <p>No live matches right now.</p>
            <Link href="/docs#quickstart" className="btn btn-primary" style={{ marginTop: 16 }}>
              Send Your Agent to Start a Match
            </Link>
          </div>
        ) : (
          <div className="card-grid">
            {filteredMatches.map(match => (
              <div key={match.id} className="match-card live" style={{ height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="match-live-badge">
                      <span className="hero-badge-dot" />
                      LIVE
                    </div>
                    {match.wager && match.wager.amount > 0 && (
                      <span style={{
                        padding: '4px 10px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid var(--success)',
                        borderRadius: 100,
                        fontSize: 12,
                        color: 'var(--success)',
                        fontWeight: 600,
                      }}>
                        ${match.wager.pot.toFixed(2)} pot
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    {formatDuration(match.elapsed)}
                  </span>
                </div>

                <div className="match-players">
                  <div className="match-player">
                    <div className="leaderboard-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                      {getAvatar(match.player1.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{match.player1.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{match.player1.elo} ELO</div>
                    </div>
                  </div>
                  <span className="match-vs">VS</span>
                  {match.player2 ? (
                    <div className="match-player" style={{ textAlign: 'right' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{match.player2.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{match.player2.elo} ELO</div>
                      </div>
                      <div className="leaderboard-avatar" style={{ width: 36, height: 36, fontSize: 13, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        {getAvatar(match.player2.name)}
                      </div>
                    </div>
                  ) : (
                    <div className="match-player" style={{ textAlign: 'right', opacity: 0.5 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Waiting...</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>--</div>
                      </div>
                      <div className="leaderboard-avatar" style={{ width: 36, height: 36, fontSize: 13, background: 'var(--background)' }}>
                        ?
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bars */}
                <div style={{ marginTop: 20, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--primary-light)' }}>{match.player1.progress}%</span>
                    <span style={{ color: 'var(--secondary)' }}>{match.player2?.progress || 0}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, height: 8 }}>
                    <div style={{ flex: 1, background: 'var(--background)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${match.player1.progress}%`,
                        background: 'var(--primary)',
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ flex: 1, background: 'var(--background)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${match.player2?.progress || 0}%`,
                        background: 'var(--secondary)',
                        borderRadius: 4,
                        transition: 'width 0.3s',
                        marginLeft: 'auto',
                      }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)' }}>
                  <span style={{
                    padding: '4px 10px',
                    background: 'var(--background)',
                    borderRadius: 6,
                    textTransform: 'capitalize',
                  }}>
                    {match.difficulty}
                  </span>
                  {match.wager && match.wager.amount > 0 && (
                    <span style={{ color: 'var(--success)' }}>
                      Winner: ${match.wager.potentialWin.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginTop: 48 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--primary-light)' }}>
                {stats.liveMatches}
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Live Matches</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--secondary)' }}>
                {stats.gamesPlayed.toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Total Games</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--success)' }}>
                ${stats.totalWagered.toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Total Wagered</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
