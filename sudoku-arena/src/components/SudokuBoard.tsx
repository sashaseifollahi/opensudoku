'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Board, BOARD_SIZE } from '@/lib/game';

interface SudokuBoardProps {
  board: Board;
  selectedCell?: { row: number; col: number } | null;
  onCellSelect?: (row: number, col: number) => void;
  onCellValue?: (row: number, col: number, value: number) => void;
  highlightErrors?: boolean;
  highlightRelated?: boolean;
  readonly?: boolean;
  showCandidates?: boolean;
}

const CELL_SIZE = 48;
const BOARD_PADDING = 2;
const THICK_LINE = 2;
const THIN_LINE = 1;

export function SudokuBoard({
  board,
  selectedCell,
  onCellSelect,
  onCellValue,
  highlightErrors = true,
  highlightRelated = true,
  readonly = false,
  showCandidates = true,
}: SudokuBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const boardSize = CELL_SIZE * BOARD_SIZE + THICK_LINE * 4 + THIN_LINE * 6 + BOARD_PADDING * 2;

  const getCellPosition = useCallback((row: number, col: number) => {
    const thickLinesBefore = (n: number) => Math.floor(n / 3) + 1;
    const thinLinesBefore = (n: number) => n - Math.floor(n / 3);

    const x = BOARD_PADDING + thickLinesBefore(col) * THICK_LINE + thinLinesBefore(col) * THIN_LINE + col * CELL_SIZE;
    const y = BOARD_PADDING + thickLinesBefore(row) * THICK_LINE + thinLinesBefore(row) * THIN_LINE + row * CELL_SIZE;

    return { x, y };
  }, []);

  const getCellFromPosition = useCallback((clientX: number, clientY: number): { row: number; col: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const pos = getCellPosition(row, col);
        if (x >= pos.x && x < pos.x + CELL_SIZE && y >= pos.y && y < pos.y + CELL_SIZE) {
          return { row, col };
        }
      }
    }

    return null;
  }, [getCellPosition]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = boardSize * dpr;
    canvas.height = boardSize * dpr;
    canvas.style.width = `${boardSize}px`;
    canvas.style.height = `${boardSize}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, boardSize, boardSize);

    // Draw cells
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = board.getCell(row, col);
        const pos = getCellPosition(row, col);
        const isSelected = selectedCell?.row === row && selectedCell?.col === col;
        const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
        const isRelated = highlightRelated && selectedCell && (
          selectedCell.row === row ||
          selectedCell.col === col ||
          (Math.floor(selectedCell.row / 3) === Math.floor(row / 3) &&
           Math.floor(selectedCell.col / 3) === Math.floor(col / 3))
        );
        const selectedValue = selectedCell ? board.getCell(selectedCell.row, selectedCell.col).value : 0;
        const isSameValue = highlightRelated && selectedValue !== 0 && cell.value === selectedValue;

        // Cell background
        if (isSelected) {
          ctx.fillStyle = '#bbdefb';
        } else if (isSameValue) {
          ctx.fillStyle = '#c8e6c9';
        } else if (isRelated) {
          ctx.fillStyle = '#e3f2fd';
        } else if (isHovered && !readonly) {
          ctx.fillStyle = '#f5f5f5';
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillRect(pos.x, pos.y, CELL_SIZE, CELL_SIZE);

        // Error highlight
        if (highlightErrors && !cell.valid) {
          ctx.fillStyle = 'rgba(244, 67, 54, 0.2)';
          ctx.fillRect(pos.x, pos.y, CELL_SIZE, CELL_SIZE);
        }

        // Cell value or notes
        if (cell.value !== 0) {
          ctx.font = `${cell.editable ? 'normal' : 'bold'} 24px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = cell.editable
            ? (cell.valid ? '#1976d2' : '#f44336')
            : '#212121';
          ctx.fillText(cell.value.toString(), pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2 + 2);
        } else if (showCandidates && !cell.note.isEmpty()) {
          // Draw notes/candidates
          ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#757575';

          const noteSize = CELL_SIZE / 3;
          for (const num of cell.note.getNumbers()) {
            const noteRow = Math.floor((num - 1) / 3);
            const noteCol = (num - 1) % 3;
            const noteX = pos.x + noteCol * noteSize + noteSize / 2;
            const noteY = pos.y + noteRow * noteSize + noteSize / 2;
            ctx.fillText(num.toString(), noteX, noteY);
          }
        }
      }
    }

    // Draw grid lines
    ctx.strokeStyle = '#bdbdbd';
    ctx.lineWidth = THIN_LINE;

    // Thin lines
    for (let i = 1; i < BOARD_SIZE; i++) {
      if (i % 3 !== 0) {
        const pos = getCellPosition(0, i);
        ctx.beginPath();
        ctx.moveTo(pos.x - THIN_LINE / 2, BOARD_PADDING);
        ctx.lineTo(pos.x - THIN_LINE / 2, boardSize - BOARD_PADDING);
        ctx.stroke();
      }
    }

    for (let i = 1; i < BOARD_SIZE; i++) {
      if (i % 3 !== 0) {
        const pos = getCellPosition(i, 0);
        ctx.beginPath();
        ctx.moveTo(BOARD_PADDING, pos.y - THIN_LINE / 2);
        ctx.lineTo(boardSize - BOARD_PADDING, pos.y - THIN_LINE / 2);
        ctx.stroke();
      }
    }

    // Thick lines (borders and 3x3 separators)
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = THICK_LINE;

    // Vertical thick lines
    for (let i = 0; i <= 3; i++) {
      const col = i * 3;
      const pos = col < BOARD_SIZE ? getCellPosition(0, col) : { x: boardSize - BOARD_PADDING - THICK_LINE / 2 };
      const x = col === 0 ? BOARD_PADDING + THICK_LINE / 2 : (col === 9 ? boardSize - BOARD_PADDING - THICK_LINE / 2 : pos.x - THICK_LINE / 2);
      ctx.beginPath();
      ctx.moveTo(x, BOARD_PADDING);
      ctx.lineTo(x, boardSize - BOARD_PADDING);
      ctx.stroke();
    }

    // Horizontal thick lines
    for (let i = 0; i <= 3; i++) {
      const row = i * 3;
      const pos = row < BOARD_SIZE ? getCellPosition(row, 0) : { y: boardSize - BOARD_PADDING - THICK_LINE / 2 };
      const y = row === 0 ? BOARD_PADDING + THICK_LINE / 2 : (row === 9 ? boardSize - BOARD_PADDING - THICK_LINE / 2 : pos.y - THICK_LINE / 2);
      ctx.beginPath();
      ctx.moveTo(BOARD_PADDING, y);
      ctx.lineTo(boardSize - BOARD_PADDING, y);
      ctx.stroke();
    }
  }, [board, selectedCell, hoveredCell, highlightErrors, highlightRelated, showCandidates, readonly, getCellPosition, boardSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const listener = () => draw();
    board.addChangeListener(listener);
    return () => board.removeChangeListener(listener);
  }, [board, draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly) return;
    const cell = getCellFromPosition(e.clientX, e.clientY);
    if (cell && onCellSelect) {
      onCellSelect(cell.row, cell.col);
    }
  }, [readonly, getCellFromPosition, onCellSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly) return;
    const cell = getCellFromPosition(e.clientX, e.clientY);
    setHoveredCell(cell);
  }, [readonly, getCellFromPosition]);

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (readonly || !selectedCell) return;

    const cell = board.getCell(selectedCell.row, selectedCell.col);
    if (!cell.editable) return;

    if (e.key >= '1' && e.key <= '9') {
      onCellValue?.(selectedCell.row, selectedCell.col, parseInt(e.key, 10));
    } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
      onCellValue?.(selectedCell.row, selectedCell.col, 0);
    } else if (e.key === 'ArrowUp' && selectedCell.row > 0) {
      onCellSelect?.(selectedCell.row - 1, selectedCell.col);
    } else if (e.key === 'ArrowDown' && selectedCell.row < 8) {
      onCellSelect?.(selectedCell.row + 1, selectedCell.col);
    } else if (e.key === 'ArrowLeft' && selectedCell.col > 0) {
      onCellSelect?.(selectedCell.row, selectedCell.col - 1);
    } else if (e.key === 'ArrowRight' && selectedCell.col < 8) {
      onCellSelect?.(selectedCell.row, selectedCell.col + 1);
    }
  }, [readonly, selectedCell, board, onCellSelect, onCellValue]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        cursor: readonly ? 'default' : 'pointer',
        outline: 'none',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    />
  );
}
