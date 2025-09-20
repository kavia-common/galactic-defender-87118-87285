import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * useAudio
 * Manages sound effects and optional background music.
 * Options:
 * - enabled: boolean
 * - effects: { [name]: url }
 * - music: url
 */
export function useAudio(options = {}) {
  const [soundEnabled, setSoundEnabled] = useState(Boolean(options.enabled));
  const [musicEnabled, setMusicEnabled] = useState(Boolean(options.enabled));
  const effects = useRef({});
  const musicRef = useRef(null);

  useEffect(() => {
    effects.current = {};
    if (options.effects) {
      for (const [name, url] of Object.entries(options.effects)) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        effects.current[name] = audio;
      }
    }
    if (options.music) {
      musicRef.current = new Audio(options.music);
      musicRef.current.loop = true;
      musicRef.current.volume = 0.35;
    }
    // cleanup
    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
      effects.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options.effects), options.music]);

  const playEffect = useCallback((name) => {
    if (!soundEnabled) return;
    const base = effects.current[name];
    if (!base) return;
    // clone to allow overlapping
    const a = base.cloneNode(true);
    a.volume = 0.7;
    a.play().catch(() => {});
  }, [soundEnabled]);

  const playMusic = useCallback(() => {
    if (!musicEnabled || !musicRef.current) return;
    musicRef.current.play().catch(() => {});
  }, [musicEnabled]);

  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }
  }, []);

  const toggleSound = useCallback(() => setSoundEnabled(s => !s), []);
  const toggleMusic = useCallback(() => {
    setMusicEnabled(m => {
      const next = !m;
      if (!next) { if (musicRef.current) musicRef.current.pause(); }
      return next;
    });
  }, []);

  return useMemo(() => ({
    playEffect,
    playMusic,
    stopMusic,
    toggleSound,
    toggleMusic,
    soundEnabled,
    musicEnabled
  }), [playEffect, playMusic, stopMusic, toggleSound, toggleMusic, soundEnabled, musicEnabled]);
}
