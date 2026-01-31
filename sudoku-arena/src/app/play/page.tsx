'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { SudokuBoard, NumberPad, GameTimer } from '@/components';
import { Game, GameState, PuzzleGenerator, Difficulty } from '@/lib/game';

export default function PlayPage() {
  const [game, setGame] = useState<Game | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [, forceUpdate] = useState({});

  const startNewGame = useCallback((diff: Difficulty) => {
    const { puzzle } = PuzzleGenerator.generate(diff);
    const newGame = new Game(`game-${Date.now()}`, puzzle);
    newGame.addEventListener(() => forceUpdate({}));
    setGame(newGame);
    setSelectedCell(null);
    setDifficulty(diff);
  }, []);

  useEffect(() => {
    startNewGame('medium');
  }, [startNewGame]);

  const handleCellSelect = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const handleCellValue = useCallback((row: number, col: number, value: number) => {
    if (!game) return;
    if (noteMode && value !== 0) {
      game.toggleCellNote(row, col, value);
    } else {
      game.setCellValue(row, col, value);
    }
    forceUpdate({});
  }, [game, noteMode]);

  const handleNumber = useCallback((num: number) => {
    if (!selectedCell || !game) return;
    handleCellValue(selectedCell.row, selectedCell.col, num);
  }, [selectedCell, game, handleCellValue]);

  const handleClear = useCallback(() => {
    if (!selectedCell || !game) return;
    handleCellValue(selectedCell.row, selectedCell.col, 0);
  }, [selectedCell, game, handleCellValue]);

  const handleUndo = useCallback(() => {
    if (!game) return;
    game.undo();
    forceUpdate({});
  }, [game]);

  if (!game) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  const board = game.getBoard();
  const gameState = game.getState();
  const isCompleted = gameState === GameState.COMPLETED;

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
            <Link href="/spectate" className="nav-link">Spectate</Link>
            <Link href="/docs" className="nav-link">API Docs</Link>
          </div>
          <div className="nav-actions">
            <Link href="/play" className="nav-link active">Play as Human</Link>
            <Link href="/docs#quickstart" className="btn btn-primary">Send Your Agent</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Practice Mode</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Sharpen your skills before challenging AI agents
          </p>
        </div>

        {/* Difficulty Selection */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
          {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map(diff => (
            <button
              key={diff}
              onClick={() => startNewGame(diff)}
              className={difficulty === diff ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ textTransform: 'capitalize' }}
            >
              {diff}
            </button>
          ))}
        </div>

        {/* Timer */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 24px',
          }}>
            <GameTimer
              startTime={gameState === GameState.PLAYING ? Date.now() - game.getTimeMs() : undefined}
              running={gameState === GameState.PLAYING}
              initialTimeMs={game.getTimeMs()}
            />
          </div>
        </div>

        {/* Completion Message */}
        {isCompleted && (
          <div style={{
            textAlign: 'center',
            padding: 24,
            marginBottom: 32,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
            border: '2px solid var(--success)',
            borderRadius: 16,
          }}>
            <h2 style={{ color: 'var(--success)', marginBottom: 8 }}>Puzzle Complete!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Time: {(game.getTimeMs() / 1000).toFixed(2)} seconds
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => startNewGame(difficulty)} className="btn btn-primary">
                Play Again
              </button>
              <Link href="/race" className="btn btn-secondary">
                Challenge an Agent
              </Link>
            </div>
          </div>
        )}

        {/* Game Board */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          <SudokuBoard
            board={board}
            selectedCell={selectedCell}
            onCellSelect={handleCellSelect}
            onCellValue={handleCellValue}
            readonly={isCompleted}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <NumberPad
              onNumber={handleNumber}
              onClear={handleClear}
              onUndo={handleUndo}
              onNoteMode={() => setNoteMode(!noteMode)}
              noteMode={noteMode}
            />

            {/* Progress */}
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                Progress: {Math.round(game.getProgress() * 100)}%
              </div>
              <div style={{
                height: 8,
                background: 'var(--background)',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${game.getProgress() * 100}%`,
                  background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>

            {/* Actions */}
            <Link href="/race" className="btn btn-secondary" style={{ marginTop: 8 }}>
              Race Mode (vs AI)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
