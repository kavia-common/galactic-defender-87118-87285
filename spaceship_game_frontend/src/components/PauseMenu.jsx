import React from 'react';

/**
 * PUBLIC_INTERFACE
 * PauseMenu
 * Props:
 * - onResume: () => void
 * - onRestart: () => void
 * - onOpenLeaderboard: () => void
 */
function PauseMenu({ onResume, onRestart, onOpenLeaderboard }) {
  return (
    <div>
      <div className="panel-actions">
        <button className="btn btn-primary" onClick={onResume}>Resume</button>
        <button className="btn" onClick={onOpenLeaderboard}>Leaderboard</button>
        <button className="btn btn-danger" onClick={onRestart}>Restart</button>
      </div>
      <div className="footer-hint">Tip: Toggle sound/music from the header controls.</div>
    </div>
  );
}

export default PauseMenu;
