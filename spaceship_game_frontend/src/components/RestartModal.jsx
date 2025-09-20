import React from 'react';

/**
 * PUBLIC_INTERFACE
 * RestartModal
 * Props:
 * - onRestart: () => void
 * - onQuitToMenu: () => void
 */
function RestartModal({ onRestart, onQuitToMenu }) {
  return (
    <div>
      <div className="panel-actions">
        <button className="btn btn-primary" onClick={onRestart}>Restart</button>
        <button className="btn" onClick={onQuitToMenu}>Quit to Menu</button>
      </div>
      <div className="footer-hint">Your last session is saved automatically.</div>
    </div>
  );
}

export default RestartModal;
