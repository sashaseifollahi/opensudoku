'use client';

import React, { useEffect, useState } from 'react';

interface GameTimerProps {
  startTime?: number;
  running: boolean;
  initialTimeMs?: number;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
}

export function GameTimer({ startTime, running, initialTimeMs = 0 }: GameTimerProps) {
  const [elapsed, setElapsed] = useState(initialTimeMs);

  useEffect(() => {
    if (!running || !startTime) {
      return;
    }

    const interval = setInterval(() => {
      setElapsed(initialTimeMs + (Date.now() - startTime));
    }, 10);

    return () => clearInterval(interval);
  }, [running, startTime, initialTimeMs]);

  return (
    <div
      style={{
        fontFamily: 'monospace',
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#212121',
        padding: '8px 16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        minWidth: '140px',
        textAlign: 'center',
      }}
    >
      {formatTime(elapsed)}
    </div>
  );
}
