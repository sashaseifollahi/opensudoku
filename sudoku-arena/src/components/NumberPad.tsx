'use client';

import React from 'react';

interface NumberPadProps {
  onNumber: (num: number) => void;
  onClear: () => void;
  onUndo?: () => void;
  onNoteMode?: () => void;
  noteMode?: boolean;
  disabledNumbers?: Set<number>;
}

export function NumberPad({
  onNumber,
  onClear,
  onUndo,
  onNoteMode,
  noteMode = false,
  disabledNumbers = new Set(),
}: NumberPadProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => onNumber(num)}
            disabled={disabledNumbers.has(num)}
            style={{
              width: '48px',
              height: '48px',
              fontSize: '20px',
              fontWeight: 'bold',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: disabledNumbers.has(num) ? '#f5f5f5' : '#ffffff',
              color: disabledNumbers.has(num) ? '#bdbdbd' : '#1976d2',
              cursor: disabledNumbers.has(num) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {num}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={onClear}
          style={{
            flex: 1,
            height: '40px',
            fontSize: '14px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        {onUndo && (
          <button
            onClick={onUndo}
            style={{
              flex: 1,
              height: '40px',
              fontSize: '14px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        )}
        {onNoteMode && (
          <button
            onClick={onNoteMode}
            style={{
              flex: 1,
              height: '40px',
              fontSize: '14px',
              border: noteMode ? '2px solid #1976d2' : '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: noteMode ? '#e3f2fd' : '#ffffff',
              cursor: 'pointer',
            }}
          >
            Notes
          </button>
        )}
      </div>
    </div>
  );
}
