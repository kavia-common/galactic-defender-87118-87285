import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import GameCanvas from './components/GameCanvas';
import StartMenu from './components/StartMenu';
import PauseMenu from './components/PauseMenu';
import LeaderboardModal from './components/LeaderboardModal';
import RestartModal from './components/RestartModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAudio } from './hooks/useAudio';
import { LeaderboardAPI } from './services/leaderboardAPI';
import { formatTime } from './utils/format';

// Game defaults/constants
const MAX_LEVEL = 100;
const DEFAULT_SAVE_KEY = 'spaceship_game_session_v1';

// PUBLIC_INTERFACE
function App() {
  /** Session state */
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(true);
  const [inGame, setInGame] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [showPause, setShowPause] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playerName, setPlayerName] = useLocalStorage('player_name', '');
  const [saveData, setSaveData] = useLocalStorage(DEFAULT_SAVE_KEY, null);
  const [soundOn, setSoundOn] = useLocalStorage('sound_on', true);
  const [musicOn, setMusicOn] = useLocalStorage('music_on', true);

  const tickRef = useRef(null);
  const startTimeRef = useRef(null);

  // Audio hooks
  const { playEffect, toggleSound, soundEnabled } = useAudio({
    enabled: soundOn,
    effects: {
      shoot: '/assets/sfx_shoot.mp3',
      bomb: '/assets/sfx_bomb.mp3',
      hit: '/assets/sfx_hit.mp3',
      levelup: '/assets/sfx_levelup.mp3',
      click: '/assets/sfx_click.mp3',
    }
  });
  const { playMusic, stopMusic, toggleMusic, musicEnabled } = useAudio({
    enabled: musicOn,
    music: '/assets/bgm_theme.mp3',
  });

  useEffect(() => { // keep LS flags in sync with internal
    setSoundOn(soundEnabled);
    setMusicOn(musicEnabled);
  }, [soundEnabled, musicEnabled, setSoundOn, setMusicOn]);

  // Timer for elapsed
  useEffect(() => {
    if (inGame && !paused) {
      if (!startTimeRef.current) startTimeRef.current = performance.now() - elapsedMs;
      tickRef.current = requestAnimationFrame(function raf(now) {
        setElapsedMs(now - startTimeRef.current);
        tickRef.current = requestAnimationFrame(raf);
      });
    } else {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
    return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); };
  }, [inGame, paused]);

  // Music management
  useEffect(() => {
    if (inGame && !paused && musicEnabled) {
      playMusic();
    } else {
      stopMusic();
    }
  }, [inGame, paused, musicEnabled, playMusic, stopMusic]);

  // Load save on mount
  useEffect(() => {
    if (saveData && saveData.version === 1) {
      setScore(saveData.score || 0);
      setLevel(Math.min(MAX_LEVEL, saveData.level || 1));
      setLives(saveData.lives ?? 3);
      setElapsedMs(saveData.elapsedMs || 0);
      setInGame(Boolean(saveData.inGame));
      setPaused(true);
      setShowStart(!saveData.inGame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(() => {
    setSaveData({
      version: 1,
      score,
      level,
      lives,
      elapsedMs,
      inGame,
    });
  }, [score, level, lives, elapsedMs, inGame, setSaveData]);

  useEffect(() => {
    persist();
  }, [score, level, lives, elapsedMs, inGame, persist]);

  const handleStart = useCallback((opts) => {
    playEffect('click');
    setScore(0);
    setLevel(Math.min(MAX_LEVEL, (opts?.level) || 1));
    setLives(3);
    setElapsedMs(0);
    startTimeRef.current = performance.now();
    setInGame(true);
    setPaused(false);
    setShowStart(false);
    setShowRestart(false);
  }, [playEffect]);

  const handlePauseToggle = useCallback(() => {
    playEffect('click');
    setPaused(p => {
      const next = !p;
      setShowPause(next);
      return next;
    });
  }, [playEffect]);

  const handleOpenLeaderboard = useCallback(() => {
    playEffect('click');
    setShowLeaderboard(true);
    setPaused(true);
    setShowPause(false);
  }, [playEffect]);

  const handleCloseLeaderboard = useCallback(() => {
    setShowLeaderboard(false);
    setPaused(false);
  }, []);

  const handleGameOver = useCallback(async () => {
    setInGame(false);
    setPaused(true);
    setShowRestart(true);
    // submit score if playerName
    try {
      if (playerName) {
        await LeaderboardAPI.submitScore({
          name: playerName,
          score,
          level,
          timeMs: elapsedMs,
        });
      }
    } catch (e) {
      // silent fail to keep UX smooth
      // eslint-disable-next-line no-console
      console.warn('Failed to submit score', e);
    }
  }, [playerName, score, level, elapsedMs]);

  const handleScored = useCallback((delta) => {
    setScore(s => s + delta);
  }, []);

  const handleLifeLost = useCallback(() => {
    playEffect('hit');
    setLives(l => {
      const next = l - 1;
      if (next <= 0) {
        handleGameOver();
        return 0;
      }
      return next;
    });
  }, [handleGameOver, playEffect]);

  const handleLevelProgress = useCallback(() => {
    playEffect('levelup');
    setLevel(l => Math.min(MAX_LEVEL, l + 1));
  }, [playEffect]);

  const onShoot = useCallback(() => playEffect('shoot'), [playEffect]);
  const onBomb = useCallback(() => playEffect('bomb'), [playEffect]);

  const timeFmt = useMemo(() => formatTime(elapsedMs), [elapsedMs]);

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span style={{width: 10, height: 10, background: 'linear-gradient(135deg,#92400E,#b45309)', borderRadius: 2, display: 'inline-block'}} aria-hidden />
            <span>Heritage Defender</span>
            <span className="badge">v1.0</span>
          </div>
          <div className="hud">
            <div className="hud-item">
              <div className="hud-label">Score</div>
              <div className="hud-value">{score}</div>
            </div>
            <div className="hud-item">
              <div className="hud-label">Level</div>
              <div className="hud-value">{level}/{MAX_LEVEL}</div>
            </div>
            <div className="hud-item">
              <div className="hud-label">Lives</div>
              <div className="hud-value">{lives}</div>
            </div>
            <div className="hud-item">
              <div className="hud-label">Time</div>
              <div className="hud-value">{timeFmt}</div>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn" onClick={handleOpenLeaderboard} aria-label="Open leaderboard">Leaderboard</button>
            <button className="btn" onClick={handlePauseToggle} aria-label="Pause or Resume">{paused ? 'Resume' : 'Pause'}</button>
            <button className="btn" onClick={() => setShowStart(true)} aria-label="Menu">Menu</button>
            <button className="btn" onClick={toggleSound} aria-label="Toggle sound">{soundEnabled ? 'Sound: On' : 'Sound: Off'}</button>
            <button className="btn" onClick={toggleMusic} aria-label="Toggle music">{musicEnabled ? 'Music: On' : 'Music: Off'}</button>
          </div>
        </div>
      </header>

      <main className="game-container">
        <div className="canvas-wrapper">
          <GameCanvas
            running={inGame && !paused}
            level={level}
            onScore={handleScored}
            onLoseLife={handleLifeLost}
            onLevelProgress={handleLevelProgress}
            onShoot={onShoot}
            onBomb={onBomb}
          />

          {showStart && (
            <div className="overlay-center">
              <div className="panel" role="dialog" aria-modal="true" aria-label="Start Menu">
                <h2 className="panel-title">Start Mission</h2>
                <p className="panel-subtitle">Pilot your ship through incoming rockets. Avoid, shoot, or bomb. Survive to reach level 100.</p>
                <StartMenu
                  initialLevel={level}
                  playerName={playerName}
                  onPlayerNameChange={setPlayerName}
                  onStart={handleStart}
                  onOpenLeaderboard={handleOpenLeaderboard}
                />
                <div className="footer-hint">Controls: Arrows to move, Space to shoot, B to bomb, P to pause.</div>
              </div>
            </div>
          )}

          {showPause && !showStart && (
            <div className="overlay-center">
              <div className="panel" role="dialog" aria-modal="true" aria-label="Pause Menu">
                <h2 className="panel-title">Paused</h2>
                <p className="panel-subtitle">Take a breath, pilot.</p>
                <PauseMenu
                  onResume={handlePauseToggle}
                  onRestart={() => { setShowPause(false); setShowRestart(true); }}
                  onOpenLeaderboard={handleOpenLeaderboard}
                />
              </div>
            </div>
          )}

          {showRestart && !showStart && (
            <div className="overlay-center">
              <div className="panel" role="dialog" aria-modal="true" aria-label="Restart Menu">
                <h2 className="panel-title">Mission {inGame ? 'Control' : 'Complete'}</h2>
                <p className="panel-subtitle">Score: {score} • Level: {level} • Time: {timeFmt}</p>
                <RestartModal
                  onRestart={() => handleStart({ level: 1 })}
                  onQuitToMenu={() => { setShowRestart(false); setShowStart(true); }}
                />
              </div>
            </div>
          )}

          {showLeaderboard && (
            <div className="overlay-center">
              <div className="panel" role="dialog" aria-modal="true" aria-label="Leaderboard">
                <h2 className="panel-title">Leaderboard</h2>
                <p className="panel-subtitle">Top pilots by score.</p>
                <LeaderboardModal playerName={playerName} onClose={handleCloseLeaderboard} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
