const DEFAULT_BASE = process.env.REACT_APP_LEADERBOARD_API || '';

/**
 * PUBLIC_INTERFACE
 * LeaderboardAPI
 * Simple REST wrapper expected endpoints:
 * - GET /api/leaderboard/top -> [{ id,name,score,timeMs,level,createdAt }]
 * - POST /api/leaderboard/submit { name, score, level, timeMs } -> { ok: true }
 * If REACT_APP_LEADERBOARD_API is not provided, uses mock localStorage fallback.
 */
export const LeaderboardAPI = {
  async fetchTop() {
    if (!DEFAULT_BASE) {
      // Local mock fallback
      const raw = localStorage.getItem('mock_leaderboard_v1') || '[]';
      const arr = JSON.parse(raw);
      return arr.sort((a, b) => b.score - a.score).slice(0, 20);
    }
    const res = await fetch(`${DEFAULT_BASE}/api/leaderboard/top`);
    if (!res.ok) throw new Error('Failed leaderboard');
    return res.json();
  },

  async submitScore({ name, score, level, timeMs }) {
    if (!DEFAULT_BASE) {
      const raw = localStorage.getItem('mock_leaderboard_v1') || '[]';
      const arr = JSON.parse(raw);
      arr.push({
        id: `${Date.now()}_${Math.random()}`,
        name: name || 'Anonymous',
        score,
        level,
        timeMs,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('mock_leaderboard_v1', JSON.stringify(arr));
      return { ok: true, mock: true };
    }
    const res = await fetch(`${DEFAULT_BASE}/api/leaderboard/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, level, timeMs }),
    });
    if (!res.ok) throw new Error('Failed submit');
    return res.json();
  }
};
