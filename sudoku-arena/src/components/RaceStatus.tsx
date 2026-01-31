'use client';

import React from 'react';
import { PlayerState, RaceState } from '@/lib/game';

interface RaceStatusProps {
  state: RaceState;
  players: PlayerState[];
  currentPlayerId: string;
  countdown?: number;
}

export function RaceStatus({ state, players, currentPlayerId, countdown }: RaceStatusProps) {
  if (state === 'waiting') {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#424242' }}>Waiting for opponent...</h2>
        <p style={{ color: '#757575' }}>
          {players.length} / 2 players joined
        </p>
      </div>
    );
  }

  if (state === 'countdown' && countdown !== undefined) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#424242' }}>Get Ready!</h2>
        <div
          style={{
            fontSize: '72px',
            fontWeight: 'bold',
            color: countdown <= 1 ? '#4caf50' : '#ff9800',
          }}
        >
          {countdown === 0 ? 'GO!' : countdown}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
      {players.map(playerState => {
        const isCurrentPlayer = playerState.player.id === currentPlayerId;
        const progressPercent = Math.round(playerState.progress * 100);

        return (
          <div
            key={playerState.player.id}
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: isCurrentPlayer ? '#e3f2fd' : '#f5f5f5',
              border: isCurrentPlayer ? '2px solid #1976d2' : '2px solid transparent',
              minWidth: '180px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: playerState.player.connected ? '#4caf50' : '#bdbdbd',
                }}
              />
              <span style={{ fontWeight: 'bold', color: '#212121' }}>
                {playerState.player.name}
                {isCurrentPlayer && ' (You)'}
              </span>
              {playerState.player.type === 'agent' && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    backgroundColor: '#7c4dff',
                    color: 'white',
                    borderRadius: '4px',
                  }}
                >
                  AI
                </span>
              )}
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  height: '8px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    backgroundColor: progressPercent === 100 ? '#4caf50' : '#1976d2',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#757575' }}>
              <span>{progressPercent}%</span>
              <span>{playerState.correctCells}/81</span>
            </div>

            {playerState.mistakes > 0 && (
              <div style={{ fontSize: '12px', color: '#f44336', marginTop: '4px' }}>
                {playerState.mistakes} mistake{playerState.mistakes > 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
