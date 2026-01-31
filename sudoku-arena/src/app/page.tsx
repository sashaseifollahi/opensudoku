'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { SudokuBoard, NumberPad, GameTimer } from '@/components';
import { Board, Game, GameState, PuzzleGenerator, Difficulty } from '@/lib/game';

export default function HomePage() {
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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>Sudoku Arena</h1>
        <p style={{ margin: 0, color: '#757575' }}>
          Race against the clock - or challenge others!
        </p>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
        {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map(diff => (
          <button
            key={diff}
            onClick={() => startNewGame(diff)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              border: difficulty === diff ? '2px solid #1976d2' : '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: difficulty === diff ? '#e3f2fd' : '#ffffff',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {diff}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <GameTimer
          startTime={gameState === GameState.PLAYING ? Date.now() - game.getTimeMs() : undefined}
          running={gameState === GameState.PLAYING}
          initialTimeMs={game.getTimeMs()}
        />
      </div>

      {isCompleted && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            marginBottom: '24px',
            backgroundColor: '#e8f5e9',
            borderRadius: '12px',
            border: '2px solid #4caf50',
          }}
        >
          <h2 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>Puzzle Complete!</h2>
          <p style={{ margin: 0, color: '#388e3c' }}>
            Time: {(game.getTimeMs() / 1000).toFixed(2)} seconds
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
        <SudokuBoard
          board={board}
          selectedCell={selectedCell}
          onCellSelect={handleCellSelect}
          onCellValue={handleCellValue}
          readonly={isCompleted}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <NumberPad
            onNumber={handleNumber}
            onClear={handleClear}
            onUndo={handleUndo}
            onNoteMode={() => setNoteMode(!noteMode)}
            noteMode={noteMode}
          />

          <div style={{ marginTop: '16px' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#757575' }}>
              Progress: {Math.round(game.getProgress() * 100)}%
            </p>
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
                  width: `${game.getProgress() * 100}%`,
                  backgroundColor: '#1976d2',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          <a
            href="/race"
            style={{
              display: 'block',
              marginTop: '16px',
              padding: '12px 24px',
              backgroundColor: '#ff9800',
              color: 'white',
              textAlign: 'center',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
            }}
          >
            Race Mode (Multiplayer)
          </a>
        </div>
      </div>

      <footer style={{ textAlign: 'center', marginTop: '48px', color: '#9e9e9e', fontSize: '14px' }}>
        <p>Based on OpenSudoku by Roman Masek (GPL v3)</p>
      </footer>
    </div>
  );
}
