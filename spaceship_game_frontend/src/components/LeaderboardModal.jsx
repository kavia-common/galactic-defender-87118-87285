import React, { useEffect, useState } from 'react';
import { LeaderboardAPI } from '../services/leaderboardAPI';
import { formatTime } from '../utils/format';

/**
 * PUBLIC_INTERFACE
 * LeaderboardModal
 * Props:
 * - onClose: () => void
 * - playerName: string
 */
function LeaderboardModal({ onClose, playerName }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await LeaderboardAPI.fetchTop();
        if (!active) return;
        setEntries(data);
        setStatus(data.length ? '' : 'No entries yet.');
      } catch (e) {
        setStatus('Failed to load leaderboard.');
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <div className="panel-actions" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      {status && <div className="footer-hint">{status}</div>}
      {!status && (
        <ul className="leaderboard-list">
          {entries.map((e, idx) => (
            <li className="leaderboard-item" key={e.id || idx} aria-label={`Rank ${idx+1}`}>
              <div style={{ fontWeight: 700, color: '#111827' }}>
                {idx + 1}. {e.name || 'Anonymous'} {e.name && playerName && e.name === playerName ? '• You' : ''}
              </div>
              <div>Score: {e.score}</div>
              <div style={{ textAlign: 'right' }}>{formatTime(e.timeMs)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LeaderboardModal;
