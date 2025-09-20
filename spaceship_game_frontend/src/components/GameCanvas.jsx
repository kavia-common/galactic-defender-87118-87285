import React, { useEffect, useRef } from 'react';

/**
 * PUBLIC_INTERFACE
 * GameCanvas
 * Renders the HTML canvas and runs game loop logic:
 * - Parallax background with multiple layers:
 *    • Sky with clouds (slowest)
 *    • Distant mountains
 *    • Midground hills
 *    • Foreground ground (interacts with gameplay)
 * - Player ship with arrow key movement; auto-scrolls to the right
 * - Rockets spawn on uneven foreground ground and launch vertically
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
    // dimensions
    width: 1280,
    height: 720,

    // input
    keys: {},

    // time
    lastTime: 0,

    // foreground ground (gameplay)
    terrain: [],
    terrainOffset: 0,

    // parallax layers
    hills: [],
    hillsOffset: 0,
    mountains: [],
    mountainsOffset: 0,
    clouds: [],

    // entities
    ship: { x: 120, y: 360, w: 38, h: 22, vx: 0, vy: 0, speed: 280 },
    bullets: [],
    bombs: [],
    rockets: [],
    particles: [],

    // level progression
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
      // Rebuild layers on size change for crisp visuals
      buildAllScenery();
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvasRef.current.parentElement);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset terrain and layers when level changes to slightly alter landscape
  useEffect(() => {
    buildAllScenery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  function buildAllScenery() {
    buildTerrain();
    buildHills();
    buildMountains();
    seedClouds();
  }

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

  function buildHills() {
    const st = stateRef.current;
    const pts = [];
    const width = st.width;
    const base = st.height * 0.78;
    const amplitude = 50 + (level % 3) * 8; // slightly larger arcs than ground
    const freq = 0.0018 + (level % 5) * 0.00012;
    for (let x = 0; x < width + 5000; x += 8) {
      const y =
        base +
        Math.sin((x + level * 137) * freq) * amplitude +
        Math.cos((x + level * 251) * freq * 0.7) * (amplitude * 0.25);
      pts.push({ x, y });
    }
    st.hills = pts;
    st.hillsOffset = 0;
  }

  function buildMountains() {
    const st = stateRef.current;
    const pts = [];
    const width = st.width;
    const base = st.height * 0.7;
    const amplitude = 90 + (level % 4) * 10;
    const freq = 0.0012 + (level % 6) * 0.00008;
    for (let x = 0; x < width + 7000; x += 10) {
      const y =
        base +
        Math.sin((x + level * 97) * freq) * amplitude +
        Math.cos((x + level * 173) * freq * 0.5) * (amplitude * 0.3);
      pts.push({ x, y });
    }
    st.mountains = pts;
    st.mountainsOffset = 0;
  }

  function seedClouds() {
    const st = stateRef.current;
    const clouds = [];
    const count = Math.max(6, Math.floor(st.width / 180));
    for (let i = 0; i < count; i++) {
      const scale = 0.6 + Math.random() * 1.1;
      const y = st.height * (0.1 + Math.random() * 0.25);
      const x = Math.random() * (st.width + 800) - 400;
      clouds.push(makeCloud(x, y, scale));
    }
    st.clouds = clouds;
  }

  function makeCloud(x, y, scale) {
    return {
      x, y, scale,
      // subtle variance in speed; very slow to emphasize depth
      vx: - (8 + Math.random() * 12) * (0.7 + scale * 0.3),
      opacity: 0.65 + Math.random() * 0.2,
    };
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

    // Base world scroll speed scales with level
    const scroll = 120 + level * 6;

    // Update parallax offsets (slower for distant layers)
    st.mountainsOffset += (scroll * 0.25) * dt;
    st.hillsOffset += (scroll * 0.55) * dt;
    st.terrainOffset += (scroll * 1.0) * dt;

    // Bound offsets to avoid large numbers (wrapping)
    const wrap = (offset, step) => {
      if (offset > step) {
        const shift = Math.floor(offset / step);
        return offset - shift * step;
      }
      return offset;
    };
    st.mountainsOffset = wrap(st.mountainsOffset, 10);
    st.hillsOffset = wrap(st.hillsOffset, 8);
    st.terrainOffset = wrap(st.terrainOffset, 6);

    // Clouds move slowly across the sky (independent subtle drift)
    st.clouds.forEach(c => {
      c.x += c.vx * dt;
      // wrap around
      if (c.x < -220 * c.scale) c.x = st.width + 220 * c.scale;
    });

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

    // Draw scene in correct depth order
    drawSky(ctx);           // background gradient
    drawClouds(ctx);        // clouds in the sky
    drawMountains(ctx);     // distant mountains
    drawHills(ctx);         // midground rolling hills
    drawTerrain(ctx);       // playable ground (foreground)

    // Draw rockets
    st.rockets.forEach(r => {
      ctx.save();
      ctx.fillStyle = r.active ? '#92400E' : '#B45309'; // Heritage Browns
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

  // Visuals

  function drawSky(ctx) {
    const st = stateRef.current;
    const grd = ctx.createLinearGradient(0, 0, 0, st.height);
    // Heritage Brown compatible sky tones
    grd.addColorStop(0, '#F7F2E6');
    grd.addColorStop(0.6, '#F3E9D2');
    grd.addColorStop(1, '#FDF6E3');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, st.width, st.height);
  }

  function drawClouds(ctx) {
    const st = stateRef.current;
    ctx.save();
    st.clouds.forEach(c => {
      drawCloudShape(ctx, c.x, c.y, c.scale, c.opacity);
    });
    ctx.restore();
  }

  function drawCloudShape(ctx, x, y, scale = 1, opacity = 0.75) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#FEF3C7'; // Heritage light cream
    ctx.beginPath();
    // simple puffy cloud using multiple arcs
    const r = 18 * scale;
    ctx.arc(x, y, r, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + r * 1.2, y - r * 0.8, r * 1.1, Math.PI, 0);
    ctx.arc(x + r * 2.2, y, r * 0.9, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMountains(ctx) {
    const st = stateRef.current;
    const pts = st.mountains;
    if (!pts.length) return;
    ctx.save();
    // deep muted brown silhouette
    ctx.fillStyle = '#AE8B5C';
    ctx.strokeStyle = '#987447';
    ctx.lineWidth = 2;

    ctx.beginPath();
    // shift points by parallax offset
    let started = false;
    const period = (pts[pts.length - 1]?.x || 0) + 200;
    const off = st.mountainsOffset % period;
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].x - off;
      if (x < -12) continue;
      if (x > st.width + 12) break;
      if (!started) { ctx.moveTo(x, pts[i].y); started = true; }
      else ctx.lineTo(x, pts[i].y);
    }
    ctx.lineTo(st.width, st.height);
    ctx.lineTo(0, st.height);
    ctx.closePath();
    ctx.fill();
    // optional subtle stroke for ridge definition
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawHills(ctx) {
    const st = stateRef.current;
    const pts = st.hills;
    if (!pts.length) return;
    ctx.save();
    // midground hill coloring
    ctx.fillStyle = '#C8B68A';
    ctx.strokeStyle = '#B89D6C';
    ctx.lineWidth = 2;

    ctx.beginPath();
    let started = false;
    const period = (pts[pts.length - 1]?.x || 0) + 200;
    const off = st.hillsOffset % period;
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].x - off;
      if (x < -10) continue;
      if (x > st.width + 10) break;
      if (!started) { ctx.moveTo(x, pts[i].y); started = true; }
      else ctx.lineTo(x, pts[i].y);
    }
    ctx.lineTo(st.width, st.height);
    ctx.lineTo(0, st.height);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawTerrain(ctx) {
    const st = stateRef.current;
    ctx.save();
    // foreground ground (playable)
    ctx.fillStyle = '#D6C8A5';
    ctx.strokeStyle = '#B89D6C';
    ctx.lineWidth = 2;

    ctx.beginPath();
    const pts = st.terrain;
    if (pts.length) {
      let started = false;
      const period = (pts[pts.length - 1]?.x || 0) + 200;
      const off = st.terrainOffset % period;
      for (let i = 0; i < pts.length; i++) {
        const x = pts[i].x - off;
        if (x < -6) continue;
        if (x > st.width + 6) break;
        if (!started) { ctx.moveTo(x, pts[i].y); started = true; }
        else ctx.lineTo(x, pts[i].y);
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

  return <canvas ref={canvasRef} role="img" aria-label="Game canvas with parallax terrain"></canvas>;
}

export default GameCanvas;
