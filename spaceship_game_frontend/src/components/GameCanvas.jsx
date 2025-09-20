import React, { useEffect, useRef } from 'react';

/**
 * PUBLIC_INTERFACE
 * GameCanvas
 * Renders the HTML canvas and runs game loop logic:
 * - Parallax background with multiple layers:
 *    • Animated twinkling stars (deepest)
 *    • Pulsing nebulae with Heritage Brown theme colors
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

    // camera/screen shake system
    camera: { x: 0, y: 0, shakeX: 0, shakeY: 0, shakeIntensity: 0, shakeDuration: 0 },

    // foreground ground (gameplay)
    terrain: [],
    terrainOffset: 0,

    // parallax layers (ordered from back to front)
    stars: [],
    starsOffset: 0,
    nebulae: [],
    nebulaeOffset: 0,
    hills: [],
    hillsOffset: 0,
    mountains: [],
    mountainsOffset: 0,
    clouds: [],

    // entities
    ship: { x: 120, y: 360, w: 38, h: 22, vx: 0, vy: 0, speed: 280, damageFlash: 0 },
    bullets: [],
    bombs: [],
    rockets: [],
    particles: [],

    // enhanced VFX
    flashes: [], // screen flash effects
    shockwaves: [], // expanding ring effects

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
    seedStars();
    seedNebulae();
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

  function seedStars() {
    const st = stateRef.current;
    const stars = [];
    const count = Math.max(80, Math.floor(st.width / 15)); // more stars for larger screens
    for (let i = 0; i < count; i++) {
      const scale = 0.3 + Math.random() * 1.2;
      const x = Math.random() * (st.width + 1000) - 500;
      const y = Math.random() * st.height * 0.6; // upper portion of sky
      const twinkleSpeed = 0.5 + Math.random() * 2;
      const brightness = 0.4 + Math.random() * 0.6;
      stars.push({
        x, y, scale, brightness, twinkleSpeed,
        vx: -(2 + Math.random() * 4), // very slow drift
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    st.stars = stars;
    st.starsOffset = 0;
  }

  function seedNebulae() {
    const st = stateRef.current;
    const nebulae = [];
    const count = Math.max(3, Math.floor(st.width / 400)); // fewer, larger nebulae
    for (let i = 0; i < count; i++) {
      const scale = 0.8 + Math.random() * 1.5;
      const x = Math.random() * (st.width + 1200) - 600;
      const y = st.height * (0.1 + Math.random() * 0.4);
      const opacity = 0.15 + Math.random() * 0.25;
      const colorType = Math.floor(Math.random() * 3); // 3 color variations
      nebulae.push({
        x, y, scale, opacity, colorType,
        vx: -(1 + Math.random() * 3), // very slow drift
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.3 + Math.random() * 0.7,
      });
    }
    st.nebulae = nebulae;
    st.nebulaeOffset = 0;
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

  function explode(x, y, count = 12, intensity = 'normal') {
    const st = stateRef.current;
    
    // Screen shake based on intensity and proximity to ship
    const distToShip = Math.sqrt((x - st.ship.x) ** 2 + (y - st.ship.y) ** 2);
    const maxShakeDistance = 300;
    const shakeStrength = intensity === 'heavy' ? 12 : intensity === 'medium' ? 8 : 5;
    const proximityFactor = Math.max(0, 1 - (distToShip / maxShakeDistance));
    
    if (proximityFactor > 0.1) {
      triggerScreenShake(shakeStrength * proximityFactor, 300 + (intensity === 'heavy' ? 200 : 0));
    }

    // Create flash effect for larger explosions
    if (intensity === 'heavy' || intensity === 'medium') {
      st.flashes.push({
        alpha: intensity === 'heavy' ? 0.4 : 0.25,
        life: intensity === 'heavy' ? 150 : 100,
        age: 0,
        color: intensity === 'heavy' ? '#F59E0B' : '#DC2626' // Orange flash for bombs, red for rockets
      });
    }

    // Create shockwave for heavy explosions
    if (intensity === 'heavy') {
      st.shockwaves.push({
        x, y,
        radius: 0,
        maxRadius: 120,
        life: 600,
        age: 0,
        color: '#92400E',
        lineWidth: 3
      });
    }

    // Enhanced particle system with multiple types
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.8;
      const baseSpeed = intensity === 'heavy' ? 150 : intensity === 'medium' ? 120 : 80;
      const sp = baseSpeed + Math.random() * (baseSpeed * 0.8);
      
      // Create different particle types
      const particleType = Math.random();
      
      if (particleType < 0.4) {
        // Fire/flame particles (Heritage Orange/Brown)
        st.particles.push({
          x, y,
          vx: Math.cos(ang) * sp * 0.7,
          vy: Math.sin(ang) * sp * 0.7 - 30, // slight upward bias for flames
          life: 800 + Math.random() * 600,
          age: 0,
          size: 2 + Math.random() * 4,
          type: 'flame',
          color: ['#F59E0B', '#92400E', '#B45309'][Math.floor(Math.random() * 3)]
        });
      } else if (particleType < 0.7) {
        // Sparks (bright yellow/orange)
        st.particles.push({
          x, y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: 400 + Math.random() * 300,
          age: 0,
          size: 1 + Math.random() * 2,
          type: 'spark',
          color: ['#FEF3C7', '#F59E0B', '#D97706'][Math.floor(Math.random() * 3)]
        });
      } else {
        // Debris/smoke (darker Heritage colors)
        st.particles.push({
          x, y,
          vx: Math.cos(ang) * sp * 0.5,
          vy: Math.sin(ang) * sp * 0.5,
          life: 1200 + Math.random() * 800,
          age: 0,
          size: 3 + Math.random() * 5,
          type: 'debris',
          color: ['#6B7280', '#4B5563', '#374151'][Math.floor(Math.random() * 3)]
        });
      }
    }
  }

  function triggerScreenShake(intensity, duration) {
    const st = stateRef.current;
    // Only update if new shake is stronger or current shake is nearly done
    if (intensity > st.camera.shakeIntensity || st.camera.shakeDuration < 50) {
      st.camera.shakeIntensity = Math.min(intensity, 15); // Cap shake intensity
      st.camera.shakeDuration = duration;
    }
  }

  function updateScreenShake(dt) {
    const st = stateRef.current;
    const cam = st.camera;
    
    if (cam.shakeDuration > 0) {
      cam.shakeDuration -= dt * 1000;
      
      // Generate shake offset with decreasing intensity
      const factor = Math.max(0, cam.shakeDuration / 300); // normalize over 300ms base
      const currentIntensity = cam.shakeIntensity * factor;
      
      cam.shakeX = (Math.random() - 0.5) * currentIntensity * 2;
      cam.shakeY = (Math.random() - 0.5) * currentIntensity * 2;
      
      if (cam.shakeDuration <= 0) {
        cam.shakeX = 0;
        cam.shakeY = 0;
        cam.shakeIntensity = 0;
      }
    }
  }

  function loop(now) {
    const st = stateRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) { requestAnimationFrame(loop); return; }

    const dt = st.lastTime ? Math.min(0.033, (now - st.lastTime) / 1000) : 0;
    st.lastTime = now;

    // Update screen shake
    updateScreenShake(dt);

    // Clear
    ctx.clearRect(0, 0, st.width, st.height);

    // Apply camera transform (screen shake)
    ctx.save();
    ctx.translate(st.camera.shakeX, st.camera.shakeY);

    // Base world scroll speed scales with level
    const scroll = 120 + level * 6;

    // Update parallax offsets (slower for distant layers)
    st.starsOffset += (scroll * 0.05) * dt;     // slowest - deep space
    st.nebulaeOffset += (scroll * 0.08) * dt;   // very slow - deep space
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
    st.starsOffset = wrap(st.starsOffset, 2);
    st.nebulaeOffset = wrap(st.nebulaeOffset, 3);
    st.mountainsOffset = wrap(st.mountainsOffset, 10);
    st.hillsOffset = wrap(st.hillsOffset, 8);
    st.terrainOffset = wrap(st.terrainOffset, 6);

    // Stars twinkle and drift slowly (independent movement)
    st.stars.forEach(s => {
      s.x += s.vx * dt;
      s.twinklePhase += s.twinkleSpeed * dt;
      // wrap around
      if (s.x < -50) s.x = st.width + 50;
    });

    // Nebulae pulse and drift slowly (independent movement)
    st.nebulae.forEach(n => {
      n.x += n.vx * dt;
      n.pulsePhase += n.pulseSpeed * dt;
      // wrap around
      if (n.x < -300 * n.scale) n.x = st.width + 300 * n.scale;
    });

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

    // Update ship damage flash
    if (st.ship.damageFlash > 0) {
      st.ship.damageFlash -= dt * 1000;
      if (st.ship.damageFlash < 0) st.ship.damageFlash = 0;
    }

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
        explode(b.x, b.y, 24, 'heavy'); // Heavy explosion for bombs
        // Destroy rockets in radius
        const radius = 90;
        let destroyed = 0;
        st.rockets = st.rockets.filter(r => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const d2 = (cx - b.x) ** 2 + (cy - b.y) ** 2;
          if (d2 < radius * radius) { 
            destroyed++; 
            explode(cx, cy, 12, 'medium'); // Medium explosions for destroyed rockets
            return false; 
          }
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
        explode(r.x + r.w / 2, r.y + r.h / 2, 12, 'medium');
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
        explode(st.ship.x + st.ship.w / 2, st.ship.y + st.ship.h / 2, 20, 'heavy');
        st.ship.damageFlash = 500; // Flash for 500ms
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
    drawStars(ctx);         // distant stars (deepest)
    drawNebulae(ctx);       // nebulae behind clouds
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

    // Update and draw enhanced particles
    st.particles.forEach(p => {
      p.x += p.vx * dt; 
      p.y += p.vy * dt;
      
      // Apply different physics based on particle type
      if (p.type === 'flame') {
        p.vx *= 0.95; // flames slow down faster
        p.vy *= 0.95;
        p.vy -= 20 * dt; // flames rise
      } else if (p.type === 'spark') {
        p.vx *= 0.92; // sparks have medium friction
        p.vy *= 0.92;
        p.vy += 80 * dt; // sparks fall
      } else if (p.type === 'debris') {
        p.vx *= 0.98; // debris maintains momentum longer
        p.vy *= 0.98;
        p.vy += 120 * dt; // debris falls faster
      } else {
        // Legacy particle behavior
        p.vx *= 0.98; 
        p.vy *= 0.98;
      }
      
      p.age += dt * 1000;
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      
      // Draw particles with size variation
      const size = p.size || 3;
      if (p.type === 'flame') {
        // Draw flame particles as circles with slight glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        if (size > 2) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === 'spark') {
        // Draw sparks as bright small circles
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw debris as rectangles
        ctx.fillRect(p.x - size/2, p.y - size/2, size, size);
      }
      
      ctx.globalAlpha = 1;
    });
    st.particles = st.particles.filter(p => p.age < p.life);

    // Update and draw shockwaves
    st.shockwaves.forEach(s => {
      s.age += dt * 1000;
      s.radius = (s.age / s.life) * s.maxRadius;
      
      const alpha = Math.max(0, 1 - s.age / s.life);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth * alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    st.shockwaves = st.shockwaves.filter(s => s.age < s.life);

    // Draw ship
    drawShip(ctx, st.ship);

    // Restore camera transform
    ctx.restore();

    // Draw screen flash effects (above camera shake)
    st.flashes.forEach(f => {
      f.age += dt * 1000;
      const alpha = Math.max(0, 1 - f.age / f.life) * f.alpha;
      if (alpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = f.color;
        ctx.fillRect(0, 0, st.width, st.height);
        ctx.restore();
      }
    });
    st.flashes = st.flashes.filter(f => f.age < f.life);

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

  function drawStars(ctx) {
    const st = stateRef.current;
    ctx.save();
    st.stars.forEach(s => {
      const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
      const alpha = s.brightness * twinkle;
      const x = s.x - st.starsOffset;
      
      // Skip stars outside visible area
      if (x < -10 || x > st.width + 10) return;
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#F7F2E6'; // Heritage cream-white for stars
      ctx.beginPath();
      
      // Draw star shape
      const size = s.scale * 2;
      ctx.arc(x, s.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Add subtle glow for larger stars
      if (s.scale > 0.8) {
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(x, s.y, size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawNebulae(ctx) {
    const st = stateRef.current;
    ctx.save();
    st.nebulae.forEach(n => {
      const pulse = 0.7 + 0.3 * Math.sin(n.pulsePhase);
      const alpha = n.opacity * pulse;
      const x = n.x - st.nebulaeOffset;
      
      // Skip nebulae outside visible area
      if (x < -400 * n.scale || x > st.width + 400 * n.scale) return;
      
      ctx.globalAlpha = alpha;
      
      // Heritage Brown theme nebula colors
      const colors = [
        '#E4D4B8', // light heritage cream
        '#D2C2A6', // medium heritage tan
        '#C8B68A'  // darker heritage beige
      ];
      ctx.fillStyle = colors[n.colorType % colors.length];
      
      // Draw nebula as gradient blob
      const grd = ctx.createRadialGradient(x, n.y, 0, x, n.y, 120 * n.scale);
      grd.addColorStop(0, colors[n.colorType % colors.length]);
      grd.addColorStop(0.6, colors[n.colorType % colors.length] + '80'); // semi-transparent
      grd.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grd;
      ctx.beginPath();
      // Create organic nebula shape using multiple overlapping circles
      for (let i = 0; i < 5; i++) {
        const offsetX = (Math.sin(n.pulsePhase + i) * 20 * n.scale);
        const offsetY = (Math.cos(n.pulsePhase + i * 0.7) * 15 * n.scale);
        const radius = (60 + i * 15) * n.scale * pulse;
        ctx.arc(x + offsetX, n.y + offsetY, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;
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
    
    // Apply damage flash effect
    if (s.damageFlash > 0) {
      const flashIntensity = (Math.sin(s.damageFlash * 0.02) + 1) * 0.5; // Oscillating flash
      ctx.globalAlpha = 0.7 + flashIntensity * 0.3;
      // Red tint when damaged
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-2, -2, s.w + 4, s.h + 4);
      ctx.globalAlpha = 1;
    }
    
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
    
    // Add engine trail when moving
    if (Math.abs(s.vx) > 50 || Math.abs(s.vy) > 50) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-8, s.h * 0.3, 6, s.h * 0.4);
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(-6, s.h * 0.4, 4, s.h * 0.2);
      ctx.globalAlpha = 1;
    }
    
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
