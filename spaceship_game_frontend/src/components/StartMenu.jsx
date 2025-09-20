import React, { useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * StartMenu
 * Props:
 * - initialLevel: number
 * - playerName: string
 * - onPlayerNameChange: (name) => void
 * - onStart: ({ level }) => void
 * - onOpenLeaderboard: () => void
 */
function StartMenu({ initialLevel = 1, playerName, onPlayerNameChange, onStart, onOpenLeaderboard }) {
  const [level, setLevel] = useState(initialLevel);

  return (
    <div>
      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Pilot Name</div>
          <input
            type="text"
            value={playerName || ''}
            onChange={e => onPlayerNameChange?.(e.target.value)}
            placeholder="Enter your callsign"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(146,64,14,0.25)' }}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Start Level (1-100)</div>
          <input
            type="number"
            min={1}
            max={100}
            value={level}
            onChange={e => setLevel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(146,64,14,0.25)' }}
          />
        </label>
      </div>
      <div className="panel-actions">
        <button className="btn btn-primary" onClick={() => onStart?.({ level })}>Start</button>
        <button className="btn" onClick={onOpenLeaderboard}>Leaderboard</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <span className="kbd"><span className="kbd-key">Arrows</span> Move</span>{' '}
        <span className="kbd"><span className="kbd-key">Space</span> Shoot</span>{' '}
        <span className="kbd"><span className="kbd-key">B</span> Bomb</span>{' '}
        <span className="kbd"><span className="kbd-key">P</span> Pause</span>
      </div>
    </div>
  );
}

export default StartMenu;
