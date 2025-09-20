import React, { useEffect, useRef } from 'react';

/**
 * PUBLIC_INTERFACE
 * GameCanvas
 * Renders the HTML canvas and runs game loop logic:
 * - Side scrolling background/terrain
 * - Player ship with arrow key movement; auto-scroll to the right
 * - Rockets spawn on uneven ground and launch vertically with random timing
 * - Bullets (space) and Bombs ('b') to destroy rockets
 * - Level scaling increases spawn rate and rocket speed
 * - Emits callbacks: onScore, onLoseLife, onLevelProgress, onShoot, onBomb
 */
function GameCanvas({
  running,
  level,
  onScore,
  onLoseLife,
  onLevelProgress,
  onShoot,
  onBomb,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    keys: {},
    lastTime: 0,
    width: 1280,
    height: 720,
    terrain: [],
    terrainOffset: 0,
    ship: { x: 120, y: 360, w: 38, h: 22, vx: 0, vy: 0, speed: 280 },
    bullets: [],
    bombs: [],
    rockets: [],
    particles: [],
    levelTimer: 0,
    levelDuration: 20_000, // ms per level section
  });

  // Handle keyboard
  useEffect(() => {
    const onDown = (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','b','B','p','P'].includes(e.key)) {
        e.preventDefault();
      }
      stateRef.current.keys[e.key] = true;
      if (e.key === ' ') {
        shoot();
      }
      if (e.key === 'b' || e.key === 'B') {
        bomb();
      }
    };
    const onUp = (e) => { stateRef.current.keys[e.key] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize canvas to parent size
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      const w = parent.clientWidth;
      // Maintain 16:9
      const h = Math.max(360, Math.floor((w * 9) / 16));
      canvas.width = w;
      canvas.height = h;
      stateRef.current.width = w;
      stateRef.current.height = h;
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvasRef.current.parentElement);
    return () => obs.disconnect();
  }, []);

  // Reset terrain when level changes to slightly alter landscape
  useEffect(() => {
    buildTerrain();
  }, [level]);

  function buildTerrain() {
    const st = stateRef.current;
    const pts = [];
    const width = st.width;
    const base = st.height * 0.82;
    const amplitude = 28 + (level % 5) * 7;
    const freq = 0.0035 + (level % 7) * 0.00025;
    for (let x = 0; x < width + 3000; x += 6) {
      const y =
        base +
        Math.sin((x + level * 217) * freq) * amplitude +
        Math.cos((x + level * 389) * freq * 0.7) * (amplitude * 0.35);
      pts.push({ x, y });
    }
    st.terrain = pts;
    st.terrainOffset = 0;
  }

  function shoot() {
    const st = stateRef.current;
    const now = performance.now();
    if (st.lastShot && now - st.lastShot < 180) return;
    st.lastShot = now;
    st.bullets.push({
      x: st.ship.x + st.ship.w,
      y: st.ship.y + st.ship.h * 0.4,
      vx: 520,
      vy: 0,
      r: 3,
    });
    onShoot && onShoot();
  }

  function bomb() {
    const st = stateRef.current;
    const now = performance.now();
    if (st.lastBomb && now - st.lastBomb < 1200) return;
    st.lastBomb = now;
    st.bombs.push({
      x: st.ship.x + st.ship.w * 0.5,
      y: st.ship.y + st.ship.h,
      vx: 60,
      vy: 120,
      r: 8,
      fuse: 1200,
      spawn: now,
    });
    onBomb && onBomb();
  }

  function spawnRockets(dt) {
    const st = stateRef.current;
    const spawnRate = 0.5 + level * 0.03; // rockets/sec
    st.rocketAcc = (st.rocketAcc || 0) + dt * spawnRate;
    while (st.rocketAcc > 1) {
      st.rocketAcc -= 1;
      // pick a ground point slightly ahead
      const aheadX = st.ship.x + st.width * 0.6 + Math.random() * (st.width * 0.4);
      const idx = Math.min(st.terrain.length - 1, Math.max(0, Math.floor(aheadX / 6)));
      const groundY = st.terrain[idx]?.y || st.height * 0.85;
      const baseX = aheadX + (Math.random() - 0.5) * 40;
      st.rockets.push({
        x: baseX,
        y: groundY - 8,
        vx: - (120 + level * 4), // horizontal drift relative to world
        vy: - (180 + Math.random() * (60 + level * 3)), // launch speed
        w: 8,
        h: 18,
        active: false, // becomes active once above ground a bit
      });
    }
  }

  function aabb(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  function explode(x, y, count = 12) {
    const st = stateRef.current;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const sp = 80 + Math.random() * 120;
      st.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 600 + Math.random() * 400,
        age: 0,
        color: i % 2 ? '#92400E' : '#DC2626',
      });
    }
  }

  function loop(now) {
    const st = stateRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) { requestAnimationFrame(loop); return; }

    const dt = st.lastTime ? Math.min(0.033, (now - st.lastTime) / 1000) : 0;
    st.lastTime = now;

    // Clear
    ctx.clearRect(0, 0, st.width, st.height);

    // World scroll speed scales with level
    const scroll = 120 + level * 6;

    // Update terrain offset
    st.terrainOffset += scroll * dt;
    if (st.terrainOffset > 6) {
      const shift = Math.floor(st.terrainOffset / 6);
      st.terrainOffset -= shift * 6;
    }

    // Ship control
    const k = st.keys;
    st.ship.vx = (k['ArrowRight'] ? 1 : 0) * st.ship.speed - (k['ArrowLeft'] ? 1 : 0) * st.ship.speed * 0.8;
    st.ship.vy = (k['ArrowDown'] ? 1 : 0) * st.ship.speed - (k['ArrowUp'] ? 1 : 0) * st.ship.speed;
    // Auto scroll pushes ship to the right
    st.ship.x += (scroll * 0.5 + st.ship.vx) * dt;
    st.ship.y += (st.ship.vy) * dt;

    // Clamp ship inside safe bounds and above ground
    st.ship.x = Math.max(20, Math.min(st.width * 0.7, st.ship.x));
    const groundYAtShip = groundYAt(st.ship.x);
    st.ship.y = Math.max(40, Math.min(groundYAtShip - st.ship.h - 10, st.ship.y));

    // Spawn rockets
    spawnRockets(dt);

    // Update rockets
    const g = 320 + level * 6;
    st.rockets.forEach(r => {
      r.x += (r.vx - scroll) * dt; // world scroll minus rocket drift
      r.y += r.vy * dt;
      r.vy += g * dt * 0.35; // simple gravity after launch
      if (!r.active && r.y < groundYAt(r.x) - 30) r.active = true;
    });
    st.rockets = st.rockets.filter(r => r.x > -60 && r.y < st.height + 60);

    // Update bullets
    st.bullets.forEach(b => { b.x += (b.vx - scroll) * dt; b.y += b.vy * dt; });
    st.bullets = st.bullets.filter(b => b.x < st.width + 40 && b.x > -40);

    // Update bombs
    st.bombs.forEach(b => {
      b.x += (b.vx - scroll) * dt;
      b.y += b.vy * dt;
      b.vy += 480 * dt;
    });
    const nowMs = performance.now();
    st.bombs = st.bombs.filter(b => {
      const exploded = (nowMs - b.spawn) > b.fuse || b.y > groundYAt(b.x) - 4;
      if (exploded) {
        explode(b.x, b.y, 18);
        // Destroy rockets in radius
        const radius = 90;
        let destroyed = 0;
        st.rockets = st.rockets.filter(r => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const d2 = (cx - b.x) ** 2 + (cy - b.y) ** 2;
          if (d2 < radius * radius) { destroyed++; explode(cx, cy, 8); return false; }
          return true;
        });
        if (destroyed > 0) onScore && onScore(destroyed * 20);
        return false;
      }
      return b.y < st.height + 40 && b.x > -40;
    });

    // Bullet-rocket collisions
    let hits = 0;
    st.rockets = st.rockets.filter(r => {
      const hitIdx = st.bullets.findIndex(b => {
        const a = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
        return aabb(a, r);
      });
      if (hitIdx >= 0) {
        const b = st.bullets[hitIdx];
        explode(r.x + r.w / 2, r.y + r.h / 2, 10);
        st.bullets.splice(hitIdx, 1);
        hits++;
        return false;
      }
      return true;
    });
    if (hits) onScore && onScore(hits * 10);

    // Rocket-ship collisions
    const shipBox = { x: st.ship.x, y: st.ship.y, w: st.ship.w, h: st.ship.h };
    let damage = 0;
    st.rockets = st.rockets.filter(r => {
      if (r.active && aabb(shipBox, r)) {
        explode(st.ship.x + st.ship.w / 2, st.ship.y + st.ship.h / 2, 16);
        damage++;
        return false;
      }
      return true;
    });
    if (damage) onLoseLife && onLoseLife();

    // Level progress
    st.levelTimer += (dt * 1000);
    if (st.levelTimer >= st.levelDuration) {
      st.levelTimer = 0;
      onLevelProgress && onLevelProgress();
    }

    // Draw background sky
    drawSky(ctx);

    // Draw terrain
    drawTerrain(ctx);

    // Draw rockets
    ctx.fillStyle = '#92400E';
    st.rockets.forEach(r => {
      ctx.save();
      ctx.fillStyle = r.active ? '#92400E' : '#B45309';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    });

    // Draw bullets
    st.bullets.forEach(b => {
      ctx.beginPath();
      ctx.fillStyle = '#DC2626';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw bombs
    st.bombs.forEach(b => {
      ctx.beginPath();
      ctx.fillStyle = '#6B7280';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw particles
    st.particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.98; p.vy *= 0.98;
      p.age += dt * 1000;
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1;
    });
    st.particles = st.particles.filter(p => p.age < p.life);

    // Draw ship
    drawShip(ctx, st.ship);

    if (running) {
      requestAnimationFrame(loop);
    }
  }

  function groundYAt(x) {
    const st = stateRef.current;
    // terrain points every 6px, with offset for scroll
    const idx = Math.floor((x + st.terrainOffset) / 6);
    return st.terrain[idx]?.y ?? st.height * 0.85;
  }

  function drawSky(ctx) {
    const st = stateRef.current;
    const grd = ctx.createLinearGradient(0, 0, 0, st.height);
    grd.addColorStop(0, '#F3E9D2');
    grd.addColorStop(1, '#FDF6E3');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, st.width, st.height);
  }

  function drawTerrain(ctx) {
    const st = stateRef.current;
    ctx.save();
    ctx.fillStyle = '#D6C8A5';
    ctx.strokeStyle = '#B89D6C';
    ctx.lineWidth = 2;

    ctx.beginPath();
    const pts = st.terrain;
    if (pts.length) {
      ctx.moveTo(0, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const x = pts[i].x - (st.terrainOffset % (pts.length * 6));
        if (x < -6) continue;
        if (x > st.width + 6) break;
        ctx.lineTo(x, pts[i].y);
      }
      ctx.lineTo(st.width, st.height);
      ctx.lineTo(0, st.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShip(ctx, s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    // body
    ctx.fillStyle = '#92400E';
    ctx.fillRect(0, 0, s.w, s.h);
    // nose
    ctx.beginPath();
    ctx.moveTo(s.w, s.h / 2);
    ctx.lineTo(s.w + 10, s.h / 2 - 5);
    ctx.lineTo(s.w + 10, s.h / 2 + 5);
    ctx.closePath();
    ctx.fillStyle = '#B45309';
    ctx.fill();
    // canopy
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(s.w * 0.4, 3, 10, s.h - 6);
    // stripe
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(4, s.h - 4, s.w - 8, 3);
    ctx.restore();
  }

  useEffect(() => {
    if (!running) return;
    stateRef.current.lastTime = 0;
    requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, level]);

  return <canvas ref={canvasRef} role="img" aria-label="Game canvas"></canvas>;
}

export default GameCanvas;
