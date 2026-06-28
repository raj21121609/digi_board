import React, { useState } from 'react';
import Board from './components/Board';
import HandView from './components/HandView';

export default function App() {
  const [view, setView] = useState('board');

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* App-level nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        zIndex: 30,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '-0.3px',
          background: 'linear-gradient(90deg, var(--accent-light), var(--cyan))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginRight: 12,
        }}>
          ◈ DigiBoard
        </span>
        <button
          id="nav-board"
          onClick={() => setView('board')}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: view === 'board' ? 'var(--bg-active)' : 'none',
            border: view === 'board' ? '1px solid var(--accent)' : '1px solid transparent',
            color: view === 'board' ? 'var(--accent-light)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ✏ Canvas
        </button>
        <button
          id="nav-hands"
          onClick={() => setView('hands')}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: view === 'hands' ? 'var(--bg-active)' : 'none',
            border: view === 'hands' ? '1px solid var(--accent)' : '1px solid transparent',
            color: view === 'hands' ? 'var(--accent-light)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ✋ Hand Tracking
        </button>
      </nav>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {view === 'board' ? <Board /> : <HandView />}
      </div>
    </div>
  );
}
