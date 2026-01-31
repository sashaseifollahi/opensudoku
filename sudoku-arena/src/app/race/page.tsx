'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SudokuBoard, NumberPad, GameTimer, RaceStatus } from '@/components';
import { Board, Game, Difficulty, PlayerState, RaceState } from '@/lib/game';

type MatchStatus = 'idle' | 'searching' | 'matched' | 'playing' | 'finished';

export default function RacePage() {
  const [status, setStatus] = useState<MatchStatus>('idle');
  const [playerId, setPlayerId] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');
  const [puzzle, setPuzzle] = useState<string>('');
  const [board, setBoard] = useState<Board | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [raceState, setRaceState] = useState<RaceState>('waiting');
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [countdown, setCountdown] = useState<number | undefined>();
  const [startTime, setStartTime] = useState<number | undefined>();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [result, setResult] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Generate a player ID on mount
  useEffect(() => {
    const id = `player_${Math.random().toString(36).slice(2, 10)}`;
    setPlayerId(id);
  }, []);

  const pollGameState = useCallback(async (gId: string, pId: string) => {
    try {
      const res = await fetch(`/api/games/${gId}`);
      if (!res.ok) return;

      const data = await res.json();
      setRaceState(data.state);
      setPlayers(data.players || []);

      if (data.state === 'countdown') {
        // Simulate countdown (real implementation would use WebSocket)
        setCountdown(3);
        setTimeout(() => setCountdown(2), 1000);
        setTimeout(() => setCountdown(1), 2000);
        setTimeout(() => setCountdown(0), 3000);
      }

      if (data.state === 'playing' && data.puzzle && !board) {
        setPuzzle(data.puzzle);
        setBoard(Board.fromString(data.puzzle));
        setStartTime(Date.now());
        setStatus('playing');
      }

      if (data.state === 'finished' && data.result) {
        setResult(data.result);
        setStatus('finished');
        if (pollRef.current) {
          clearInterval(pollRef.current);
        }
      }
    } catch (error) {
      console.error('Failed to poll game state:', error);
    }
  }, [board]);

  const findMatch = useCallback(async () => {
    setStatus('searching');

    try {
      const res = await fetch('/api/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          playerName: `Player-${playerId.slice(-6)}`,
          playerType: 'human',
          difficulty,
        }),
      });

      const data = await res.json();

      if (data.status === 'matched') {
        setGameId(data.gameId);
        setStatus('matched');

        // Start polling for game updates
        pollRef.current = setInterval(() => {
          pollGameState(data.gameId, playerId);
        }, 500);
      } else {
        // Keep polling for match
        pollRef.current = setInterval(async () => {
          const checkRes = await fetch('/api/matchmaking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId,
              playerName: `Player-${playerId.slice(-6)}`,
              playerType: 'human',
              difficulty,
            }),
          });
          const checkData = await checkRes.json();

          if (checkData.status === 'matched') {
            setGameId(checkData.gameId);
            setStatus('matched');
            clearInterval(pollRef.current);

            pollRef.current = setInterval(() => {
              pollGameState(checkData.gameId, playerId);
            }, 500);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Matchmaking error:', error);
      setStatus('idle');
    }
  }, [playerId, difficulty, pollGameState]);

  const cancelSearch = useCallback(async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    await fetch(`/api/matchmaking?playerId=${playerId}`, { method: 'DELETE' });
    setStatus('idle');
  }, [playerId]);

  const makeMove = useCallback(async (row: number, col: number, value: number) => {
    if (!board || !gameId || status !== 'playing') return;

    const cell = board.getCell(row, col);
    if (!cell.editable) return;

    // Update local board optimistically
    cell.value = value;
    setBoard(board.clone());

    // Send to server
    try {
      const res = await fetch(`/api/games/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, row, col, value }),
      });

      const data = await res.json();
      if (data.result) {
        setResult(data.result);
        setStatus('finished');
        if (pollRef.current) {
          clearInterval(pollRef.current);
        }
      }
    } catch (error) {
      console.error('Move error:', error);
    }
  }, [board, gameId, playerId, status]);

  const handleCellSelect = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const handleNumber = useCallback((num: number) => {
    if (!selectedCell) return;
    makeMove(selectedCell.row, selectedCell.col, num);
  }, [selectedCell, makeMove]);

  const handleClear = useCallback(() => {
    if (!selectedCell) return;
    makeMove(selectedCell.row, selectedCell.col, 0);
  }, [selectedCell, makeMove]);

  const playAgain = useCallback(() => {
    setStatus('idle');
    setGameId('');
    setPuzzle('');
    setBoard(null);
    setSelectedCell(null);
    setRaceState('waiting');
    setPlayers([]);
    setCountdown(undefined);
    setStartTime(undefined);
    setResult(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px 0', color: '#ff9800' }}>Race Mode</h1>
        <p style={{ margin: 0, color: '#757575' }}>
          Compete head-to-head - first to solve wins!
        </p>
      </header>

      {status === 'idle' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <p style={{ marginBottom: '16px', color: '#424242' }}>Select difficulty:</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  style={{
                    padding: '12px 24px',
                    fontSize: '16px',
                    border: difficulty === diff ? '2px solid #ff9800' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    backgroundColor: difficulty === diff ? '#fff3e0' : '#ffffff',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={findMatch}
            style={{
              padding: '16px 48px',
              fontSize: '18px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '12px',
              backgroundColor: '#ff9800',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Find Match
          </button>

          <p style={{ marginTop: '24px', color: '#9e9e9e', fontSize: '14px' }}>
            Your player ID: {playerId}
          </p>
        </div>
      )}

      {status === 'searching' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e0e0e0',
              borderTopColor: '#ff9800',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <h2 style={{ margin: '0 0 16px 0', color: '#424242' }}>Searching for opponent...</h2>
          <button
            onClick={cancelSearch}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {(status === 'matched' || status === 'playing') && (
        <>
          <RaceStatus
            state={raceState}
            players={players}
            currentPlayerId={playerId}
            countdown={countdown}
          />

          {board && status === 'playing' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
                <GameTimer
                  startTime={startTime}
                  running={status === 'playing'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
                <SudokuBoard
                  board={board}
                  selectedCell={selectedCell}
                  onCellSelect={handleCellSelect}
                  onCellValue={makeMove}
                />

                <NumberPad
                  onNumber={handleNumber}
                  onClear={handleClear}
                />
              </div>
            </>
          )}
        </>
      )}

      {status === 'finished' && result && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              padding: '32px',
              marginBottom: '24px',
              backgroundColor: result.winner?.id === playerId ? '#e8f5e9' : '#ffebee',
              borderRadius: '16px',
              border: `2px solid ${result.winner?.id === playerId ? '#4caf50' : '#f44336'}`,
            }}
          >
            <h2 style={{
              margin: '0 0 16px 0',
              color: result.winner?.id === playerId ? '#2e7d32' : '#c62828',
              fontSize: '32px',
            }}>
              {result.winner?.id === playerId ? '🎉 You Won!' : '😔 You Lost'}
            </h2>

            <div style={{ marginBottom: '16px' }}>
              {result.playerResults?.map((pr: any, idx: number) => (
                <div
                  key={pr.player.id}
                  style={{
                    padding: '12px',
                    margin: '8px 0',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: pr.player.id === playerId ? 'bold' : 'normal' }}>
                    #{pr.rank} {pr.player.name} {pr.player.id === playerId && '(You)'}
                  </span>
                  <span>
                    {pr.completed ? `${(pr.timeMs / 1000).toFixed(2)}s` : `${Math.round(pr.progress * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={playAgain}
            style={{
              padding: '16px 48px',
              fontSize: '18px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '12px',
              backgroundColor: '#ff9800',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Play Again
          </button>
        </div>
      )}

      <footer style={{ textAlign: 'center', marginTop: '48px' }}>
        <a
          href="/"
          style={{
            color: '#1976d2',
            textDecoration: 'none',
          }}
        >
          ← Back to Solo Mode
        </a>
      </footer>
    </div>
  );
}
