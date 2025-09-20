import React, { useEffect, useRef } from 'react';

/**
 * PUBLIC_INTERFACE
 * GameCanvas
 * Renders the HTML canvas and runs game loop logic:
 * - Parallax background with multiple layers
 * - Player ship with arrow key movement; auto-scrolls to the right
 * - Enhanced rocket AI that actively targets the player
 * - Bullets (space) and Bombs ('b') to destroy rockets
 * - Level scaling increases spawn rate and rocket intelligence
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
    ship: { 
      x: 120, y: 360, w: 38, h: 22, vx: 0, vy: 0, speed: 280, damageFlash: 0,
      thrusterTime: 0, // for animated thruster flames
      engineHeat: 0, // engine heat effect
      wingFlicker: 0 // wing light flicker
    },
    bullets: [],
    bombs: [],
    rockets: [],
    particles: [],

    // enhanced VFX
    flashes: [], // screen flash effects
    shockwaves: [], // expanding ring effects

    // weather and lighting system
    weather: {
      // Time of day system (0 = dawn, 0.25 = day, 0.5 = dusk, 0.75 = night, 1 = dawn)
      timeOfDay: 0.25, // start at day
      timeSpeed: 0.00008, // slow progression (full cycle ~12.5 minutes)
      
      // Lightning system
      lightningTimer: 0,
      lightningInterval: 8000 + Math.random() * 12000, // 8-20 seconds between strikes
      activeLightning: null,
      
      // Fog system
      fogLayers: [],
      fogDensity: 0.3 + Math.random() * 0.4,
      fogSpeed: 1.2 + Math.random() * 0.8,
      
      // Atmospheric effects
      rainDrops: [],
      windStrength: 0.5 + Math.random() * 0.5,
      weatherIntensity: 0.6 + Math.random() * 0.4,
    },

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
    initializeWeatherSystems();
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
    const count = Math.max(8, Math.floor(st.width / 160));
    for (let i = 0; i < count; i++) {
      const scale = 0.4 + Math.random() * 1.4;
      const y = st.height * (0.08 + Math.random() * 0.3);
      const x = Math.random() * (st.width + 1000) - 500;
      clouds.push(makeCloud(x, y, scale, i));
    }
    st.clouds = clouds;
  }

  function makeCloud(x, y, scale, index) {
    const cloudType = Math.floor(Math.random() * 4);
    const depthLayer = Math.random();
    
    return {
      x, y, scale, cloudType, depthLayer, index,
      vx: -(3 + Math.random() * 10) * (0.6 + depthLayer * 0.7),
      opacity: (0.4 + Math.random() * 0.4) * (0.7 + depthLayer * 0.3),
      baseOpacity: 0.4 + Math.random() * 0.4,
      morphPhase: Math.random() * Math.PI * 2,
      morphSpeed: 0.2 + Math.random() * 0.4,
      morphIntensity: 0.1 + Math.random() * 0.15,
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: 0.3 + Math.random() * 0.5,
      driftAmplitude: 3 + Math.random() * 8,
      colorVariant: Math.floor(Math.random() * 5),
      softness: 0.6 + Math.random() * 0.4,
      volumeIntensity: 0.5 + Math.random() * 0.5,
      layerCount: 2 + Math.floor(Math.random() * 3),
      layerOffsets: [],
    };
  }

  function seedStars() {
    const st = stateRef.current;
    const stars = [];
    const count = Math.max(80, Math.floor(st.width / 15));
    for (let i = 0; i < count; i++) {
      const scale = 0.3 + Math.random() * 1.2;
      const x = Math.random() * (st.width + 1000) - 500;
      const y = Math.random() * st.height * 0.6;
      const twinkleSpeed = 0.5 + Math.random() * 2;
      const brightness = 0.4 + Math.random() * 0.6;
      stars.push({
        x, y, scale, brightness, twinkleSpeed,
        vx: -(2 + Math.random() * 4),
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    st.stars = stars;
    st.starsOffset = 0;
  }

  function seedNebulae() {
    const st = stateRef.current;
    const nebulae = [];
    const count = Math.max(3, Math.floor(st.width / 400));
    for (let i = 0; i < count; i++) {
      const scale = 0.8 + Math.random() * 1.5;
      const x = Math.random() * (st.width + 1200) - 600;
      const y = st.height * (0.1 + Math.random() * 0.4);
      const opacity = 0.15 + Math.random() * 0.25;
      const colorType = Math.floor(Math.random() * 3);
      nebulae.push({
        x, y, scale, opacity, colorType,
        vx: -(1 + Math.random() * 3),
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.3 + Math.random() * 0.7,
      });
    }
    st.nebulae = nebulae;
    st.nebulaeOffset = 0;
  }

  function initializeWeatherSystems() {
    const st = stateRef.current;
    
    st.weather.fogLayers = [];
    const fogLayerCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < fogLayerCount; i++) {
      const depth = i / fogLayerCount;
      const layer = {
        x: Math.random() * st.width * 2 - st.width,
        y: st.height * (0.3 + Math.random() * 0.4),
        width: st.width * (1.5 + Math.random() * 2),
        height: 60 + Math.random() * 120,
        vx: -(10 + Math.random() * 20) * (1 - depth * 0.7),
        opacity: (0.1 + Math.random() * 0.2) * st.weather.fogDensity,
        depth: depth,
        wavePhase: Math.random() * Math.PI * 2,
        waveSpeed: 0.5 + Math.random() * 1.0,
        waveAmplitude: 8 + Math.random() * 15,
      };
      st.weather.fogLayers.push(layer);
    }
    
    st.weather.lightningTimer = 0;
    st.weather.lightningInterval = 8000 + Math.random() * 12000;
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
    const spawnRate = 0.5 + level * 0.03;
    st.rocketAcc = (st.rocketAcc || 0) + dt * spawnRate;
    while (st.rocketAcc > 1) {
      st.rocketAcc -= 1;
      const aheadX = st.ship.x + st.width * 0.6 + Math.random() * (st.width * 0.4);
      const idx = Math.min(st.terrain.length - 1, Math.max(0, Math.floor(aheadX / 6)));
      const groundY = st.terrain[idx]?.y || st.height * 0.85;
      const baseX = aheadX + (Math.random() - 0.5) * 40;
      st.rockets.push({
        x: baseX,
        y: groundY - 8,
        vx: - (120 + level * 4),
        vy: - (180 + Math.random() * (60 + level * 3)),
        w: 8,
        h: 18,
        active: false,
        exhaustTime: 0,
        exhaustIntensity: 0.5 + Math.random() * 0.5,
        wobble: Math.random() * Math.PI * 2,
        launched: false,
        // AI targeting properties
        targetingEnabled: false,
        steeringForce: 180 + level * 15,
        predictionTime: 0.8 + level * 0.1,
        maxTurnRate: 2.5 + level * 0.3,
        interceptMode: false,
        lastTargetX: st.ship.x,
        lastTargetY: st.ship.y,
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
    
    const distToShip = Math.sqrt((x - st.ship.x) ** 2 + (y - st.ship.y) ** 2);
    const maxShakeDistance = 300;
    const shakeStrength = intensity === 'heavy' ? 12 : intensity === 'medium' ? 8 : 5;
    const proximityFactor = Math.max(0, 1 - (distToShip / maxShakeDistance));
    
    if (proximityFactor > 0.1) {
      triggerScreenShake(shakeStrength * proximityFactor, 300 + (intensity === 'heavy' ? 200 : 0));
    }

    if (intensity === 'heavy' || intensity === 'medium') {
      st.flashes.push({
        alpha: intensity === 'heavy' ? 0.4 : 0.25,
        life: intensity === 'heavy' ? 150 : 100,
        age: 0,
        color: intensity === 'heavy' ? '#F59E0B' : '#DC2626'
      });
    }

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

    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.8;
      const baseSpeed = intensity === 'heavy' ? 150 : intensity === 'medium' ? 120 : 80;
      const sp = baseSpeed + Math.random() * (baseSpeed * 0.8);
      
      const particleType = Math.random();
      
      if (particleType < 0.4) {
        st.particles.push({
          x, y,
          vx: Math.cos(ang) * sp * 0.7,
          vy: Math.sin(ang) * sp * 0.7 - 30,
          life: 800 + Math.random() * 600,
          age: 0,
          size: 2 + Math.random() * 4,
          type: 'flame',
          color: ['#F59E0B', '#92400E', '#B45309'][Math.floor(Math.random() * 3)]
        });
      } else if (particleType < 0.7) {
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
    if (intensity > st.camera.shakeIntensity || st.camera.shakeDuration < 50) {
      st.camera.shakeIntensity = Math.min(intensity, 15);
      st.camera.shakeDuration = duration;
    }
  }

  function updateScreenShake(dt) {
    const st = stateRef.current;
    const cam = st.camera;
    
    if (cam.shakeDuration > 0) {
      cam.shakeDuration -= dt * 1000;
      
      const factor = Math.max(0, cam.shakeDuration / 300);
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

    updateScreenShake(dt);

    ctx.clearRect(0, 0, st.width, st.height);

    ctx.save();
    ctx.translate(st.camera.shakeX, st.camera.shakeY);

    const baseScrollSpeed = 100;
    const levelScrollBonus = level * 3;
    const totalScrollSpeed = baseScrollSpeed + levelScrollBonus;

    const starScrollSpeed = totalScrollSpeed * 0.08;
    const nebulaeScrollSpeed = totalScrollSpeed * 0.12;
    const cloudScrollSpeed = totalScrollSpeed * 0.18;
    const mountainScrollSpeed = totalScrollSpeed * 0.35;
    const hillScrollSpeed = totalScrollSpeed * 0.65;
    const terrainScrollSpeed = totalScrollSpeed * 1.0;

    st.starsOffset += starScrollSpeed * dt;
    st.nebulaeOffset += nebulaeScrollSpeed * dt;
    st.mountainsOffset += mountainScrollSpeed * dt;
    st.hillsOffset += hillScrollSpeed * dt;
    st.terrainOffset += terrainScrollSpeed * dt;

    const wrap = (offset, period) => {
      while (offset >= period) offset -= period;
      return offset;
    };
    st.starsOffset = wrap(st.starsOffset, 1000);
    st.nebulaeOffset = wrap(st.nebulaeOffset, 1200);
    st.mountainsOffset = wrap(st.mountainsOffset, 500);
    st.hillsOffset = wrap(st.hillsOffset, 400);
    st.terrainOffset = wrap(st.terrainOffset, 300);

    st.stars.forEach(s => {
      s.x += s.vx * dt;
      s.twinklePhase += s.twinkleSpeed * dt;
      if (s.x < -100) s.x = st.width + 100 + Math.random() * 200;
    });

    st.nebulae.forEach(n => {
      n.x += n.vx * dt;
      n.pulsePhase += n.pulseSpeed * dt;
      const wrapBuffer = 400 * n.scale;
      if (n.x < -wrapBuffer) n.x = st.width + wrapBuffer + Math.random() * 200;
    });

    st.clouds.forEach(c => {
      const parallaxMultiplier = 0.5 + (1 - c.depthLayer) * 0.8;
      c.x += c.vx * dt * parallaxMultiplier;
      
      c.morphPhase += c.morphSpeed * dt;
      c.driftPhase += c.driftSpeed * dt;
      
      const driftOffset = Math.sin(c.driftPhase) * c.driftAmplitude * 0.5;
      c.currentY = c.y + driftOffset;
      
      const opacityBreathing = 1 + Math.sin(c.morphPhase * 0.7) * 0.15;
      c.currentOpacity = c.baseOpacity * opacityBreathing * (0.8 + c.depthLayer * 0.2);
      
      if (!c.layerOffsets.length) {
        for (let i = 0; i < c.layerCount; i++) {
          c.layerOffsets.push({
            x: (Math.random() - 0.5) * 15 * c.scale,
            y: (Math.random() - 0.5) * 10 * c.scale,
            scale: 0.7 + Math.random() * 0.6,
            opacity: 0.3 + Math.random() * 0.4
          });
        }
      }
      
      const wrapBuffer = (250 + c.depthLayer * 100) * c.scale;
      if (c.x < -wrapBuffer) {
        c.x = st.width + wrapBuffer + Math.random() * 400;
        c.morphPhase = Math.random() * Math.PI * 2;
        c.driftPhase = Math.random() * Math.PI * 2;
        c.layerOffsets = [];
      }
    });

    // Ship control
    const k = st.keys;
    st.ship.vx = (k['ArrowRight'] ? 1 : 0) * st.ship.speed - (k['ArrowLeft'] ? 1 : 0) * st.ship.speed * 0.8;
    st.ship.vy = (k['ArrowDown'] ? 1 : 0) * st.ship.speed - (k['ArrowUp'] ? 1 : 0) * st.ship.speed;
    
    const shipAutoScrollSpeed = totalScrollSpeed * 0.4;
    st.ship.x += (shipAutoScrollSpeed + st.ship.vx) * dt;
    st.ship.y += (st.ship.vy) * dt;

    st.ship.x = Math.max(20, Math.min(st.width * 0.7, st.ship.x));
    const groundYAtShip = groundYAt(st.ship.x);
    st.ship.y = Math.max(40, Math.min(groundYAtShip - st.ship.h - 10, st.ship.y));

    st.ship.thrusterTime += dt * 8;
    st.ship.wingFlicker += dt * 6;
    const isMoving = Math.abs(st.ship.vx) > 50 || Math.abs(st.ship.vy) > 50;
    st.ship.engineHeat = Math.max(0, st.ship.engineHeat + (isMoving ? dt * 3 : -dt * 2));
    st.ship.engineHeat = Math.min(1, st.ship.engineHeat);

    if (st.ship.damageFlash > 0) {
      st.ship.damageFlash -= dt * 1000;
      if (st.ship.damageFlash < 0) st.ship.damageFlash = 0;
    }

    spawnRockets(dt);

    // Enhanced AI rocket update system
    const g = 320 + level * 6;
    st.rockets.forEach(r => {
      // Enable targeting once rocket is airborne and active
      if (!r.active && r.y < groundYAt(r.x) - 30) {
        r.active = true;
        r.targetingEnabled = true;
        r.interceptMode = true;
      }

      // Enhanced AI targeting logic for active rockets
      if (r.active && r.targetingEnabled && r.interceptMode) {
        const rocketCenterX = r.x + r.w * 0.5;
        const rocketCenterY = r.y + r.h * 0.5;
        
        const shipCenterX = st.ship.x + st.ship.w * 0.5;
        const shipCenterY = st.ship.y + st.ship.h * 0.5;
        
        const shipVelX = st.ship.vx || 0;
        const shipVelY = st.ship.vy || 0;
        
        const predictionTime = Math.min(r.predictionTime, 2.0);
        const predictedShipX = shipCenterX + shipVelX * predictionTime;
        const predictedShipY = shipCenterY + shipVelY * predictionTime;
        
        const deltaX = predictedShipX - rocketCenterX;
        const deltaY = predictedShipY - rocketCenterY;
        const distanceToTarget = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        const desiredAngle = Math.atan2(deltaY, deltaX);
        const currentAngle = Math.atan2(r.vy, r.vx);
        
        let angleDiff = desiredAngle - currentAngle;
        
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const maxTurnThisFrame = r.maxTurnRate * dt;
        const actualTurnAmount = Math.max(-maxTurnThisFrame, Math.min(maxTurnThisFrame, angleDiff));
        
        const newAngle = currentAngle + actualTurnAmount;
        const currentSpeed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
        
        const steeringIntensity = Math.min(1.0, distanceToTarget / 200);
        const steeringMultiplier = steeringIntensity * (r.steeringForce / 200) * dt;
        
        const targetVelX = Math.cos(newAngle) * currentSpeed;
        const targetVelY = Math.sin(newAngle) * currentSpeed;
        
        r.vx += (targetVelX - r.vx) * steeringMultiplier;
        r.vy += (targetVelY - r.vy) * steeringMultiplier;
        
        if (distanceToTarget > 50) {
          const interceptForceX = deltaX / distanceToTarget * r.steeringForce * 0.3 * dt;
          const interceptForceY = deltaY / distanceToTarget * r.steeringForce * 0.3 * dt;
          r.vx += interceptForceX;
          r.vy += interceptForceY;
        }
        
        r.lastTargetX = predictedShipX;
        r.lastTargetY = predictedShipY;
        
        const shipSpeedChange = Math.abs((st.ship.vx || 0) - (st.ship.lastVx || 0)) + 
                               Math.abs((st.ship.vy || 0) - (st.ship.lastVy || 0));
        if (shipSpeedChange > 100) {
          r.steeringForce *= 1.1;
          r.maxTurnRate *= 1.05;
        }
      }
      
      r.x += (r.vx - terrainScrollSpeed) * dt;
      r.y += r.vy * dt;
      
      const gravityReduction = (r.active && r.interceptMode) ? 0.15 : 0.35;
      r.vy += g * dt * gravityReduction;
      
      r.exhaustTime += dt * 12;
      r.wobble += dt * 3;
      if (r.vy < 0) r.launched = true;
      
      const exhaustChance = (r.active && r.interceptMode) ? 0.5 : 0.3;
      if (r.launched && r.active && Math.random() < exhaustChance) {
        const exhaustX = r.x + r.w * 0.5;
        const exhaustY = r.y + r.h;
        const exhaustIntensity = (r.active && r.interceptMode) ? 1.5 : 1.0;
        st.particles.push({
          x: exhaustX + (Math.random() - 0.5) * 2,
          y: exhaustY + Math.random() * 3,
          vx: (Math.random() - 0.5) * 30 * exhaustIntensity,
          vy: 80 + Math.random() * 40 * exhaustIntensity,
          life: 300 + Math.random() * 200,
          age: 0,
          size: (1 + Math.random() * 2) * exhaustIntensity,
          type: 'rocket_exhaust',
          color: ['#F59E0B', '#FEF3C7', '#D97706'][Math.floor(Math.random() * 3)]
        });
      }
    });
    
    st.ship.lastVx = st.ship.vx;
    st.ship.lastVy = st.ship.vy;
    st.rockets = st.rockets.filter(r => r.x > -60 && r.y < st.height + 60);

    // Update bullets
    st.bullets.forEach(b => { 
      b.x += (b.vx - terrainScrollSpeed) * dt; 
      b.y += b.vy * dt; 
    });
    st.bullets = st.bullets.filter(b => b.x < st.width + 40 && b.x > -40);

    // Update bombs
    st.bombs.forEach(b => {
      b.x += (b.vx - terrainScrollSpeed) * dt;
      b.y += b.vy * dt;
      b.vy += 480 * dt;
    });
    const nowMs = performance.now();
    st.bombs = st.bombs.filter(b => {
      const exploded = (nowMs - b.spawn) > b.fuse || b.y > groundYAt(b.x) - 4;
      if (exploded) {
        explode(b.x, b.y, 24, 'heavy');
        const radius = 90;
        let destroyed = 0;
        st.rockets = st.rockets.filter(r => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const d2 = (cx - b.x) ** 2 + (cy - b.y) ** 2;
          if (d2 < radius * radius) { 
            destroyed++; 
            explode(cx, cy, 12, 'medium');
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
        st.ship.damageFlash = 500;
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

    updateWeatherSystems(dt);

    drawSky(ctx);
    drawStars(ctx);
    drawNebulae(ctx);
    drawClouds(ctx);
    drawMountains(ctx);
    drawHills(ctx);
    drawTerrain(ctx);

    st.rockets.forEach(r => {
      drawRocket(ctx, r);
    });

    st.bullets.forEach(b => {
      ctx.beginPath();
      ctx.fillStyle = '#DC2626';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    st.bombs.forEach(b => {
      ctx.beginPath();
      ctx.fillStyle = '#6B7280';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    st.particles.forEach(p => {
      p.x += p.vx * dt; 
      p.y += p.vy * dt;
      
      if (p.type === 'flame') {
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.vy -= 20 * dt;
      } else if (p.type === 'spark') {
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.vy += 80 * dt;
      } else if (p.type === 'debris') {
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.vy += 120 * dt;
      } else if (p.type === 'rocket_exhaust') {
        p.vx *= 0.90;
        p.vy *= 0.94;
        p.vy += 60 * dt;
      } else {
        p.vx *= 0.98; 
        p.vy *= 0.98;
      }
      
      p.age += dt * 1000;
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      
      const size = p.size || 3;
      if (p.type === 'flame') {
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'rocket_exhaust') {
        ctx.save();
        ctx.scale(1, 1.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y / 1.5, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillRect(p.x - size/2, p.y - size/2, size, size);
      }
      
      ctx.globalAlpha = 1;
    });
    st.particles = st.particles.filter(p => p.age < p.life);

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

    drawEnhancedShip(ctx, st.ship, dt);

    ctx.restore();

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
    const idx = Math.floor((x + st.terrainOffset) / 6);
    return st.terrain[idx]?.y ?? st.height * 0.85;
  }

  function updateWeatherSystems(dt) {
    const st = stateRef.current;
    const weather = st.weather;
    
    weather.timeOfDay += weather.timeSpeed * dt;
    if (weather.timeOfDay > 1) weather.timeOfDay -= 1;
    
    weather.lightningTimer += dt * 1000;
    if (weather.lightningTimer >= weather.lightningInterval) {
      weather.lightningTimer = 0;
      weather.lightningInterval = 8000 + Math.random() * 12000;
    }
    
    weather.fogLayers.forEach(fog => {
      fog.x += fog.vx * dt;
      fog.wavePhase += fog.waveSpeed * dt;
      
      if (fog.x + fog.width < -st.width * 0.5) {
        fog.x = st.width + Math.random() * st.width;
      }
    });
    
    weather.weatherIntensity += (Math.random() - 0.5) * dt * 0.1;
    weather.weatherIntensity = Math.max(0.2, Math.min(1.0, weather.weatherIntensity));
  }

  function drawSky(ctx) {
    const st = stateRef.current;
    const grd = ctx.createLinearGradient(0, 0, 0, st.height);
    grd.addColorStop(0, '#F7F2E6');
    grd.addColorStop(0.6, '#F3E9D2');
    grd.addColorStop(1, '#FDF6E3');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, st.width, st.height);
  }

  function drawStars(ctx) {
    const st = stateRef.current;
    ctx.save();
    st.stars.forEach(s => {
      const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
      const alpha = s.brightness * twinkle;
      const x = s.x - st.starsOffset;
      
      if (x < -10 || x > st.width + 10) return;
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#F7F2E6';
      ctx.beginPath();
      
      const size = s.scale * 2;
      ctx.arc(x, s.y, size, 0, Math.PI * 2);
      ctx.fill();
      
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
      
      if (x < -400 * n.scale || x > st.width + 400 * n.scale) return;
      
      ctx.globalAlpha = alpha;
      
      const colors = [
        '#E4D4B8',
        '#D2C2A6',
        '#C8B68A'
      ];
      ctx.fillStyle = colors[n.colorType % colors.length];
      
      const grd = ctx.createRadialGradient(x, n.y, 0, x, n.y, 120 * n.scale);
      grd.addColorStop(0, colors[n.colorType % colors.length]);
      grd.addColorStop(0.6, colors[n.colorType % colors.length] + '80');
      grd.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grd;
      ctx.beginPath();
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

  function drawClouds(ctx) {
    const st = stateRef.current;
    ctx.save();
    
    const sortedClouds = [...st.clouds].sort((a, b) => b.depthLayer - a.depthLayer);
    
    sortedClouds.forEach(cloud => {
      const cloudSize = (15 + cloud.scale * 8) * 3;
      if (cloud.x > -cloudSize && cloud.x < st.width + cloudSize) {
        drawAdvancedCloudShape(ctx, cloud);
      }
    });
    
    ctx.restore();
  }

  function drawAdvancedCloudShape(ctx, cloud) {
    const { x, currentY, scale, currentOpacity } = cloud;
    
    ctx.save();
    ctx.globalAlpha = currentOpacity || 0.5;
    ctx.fillStyle = '#F3E9D2';
    
    const radius = (15 + scale * 8);
    ctx.beginPath();
    ctx.arc(x, currentY || cloud.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  function drawMountains(ctx) {
    const st = stateRef.current;
    const pts = st.mountains;
    if (!pts.length) return;
    ctx.save();
    ctx.fillStyle = '#AE8B5C';
    ctx.strokeStyle = '#987447';
    ctx.lineWidth = 2;

    ctx.beginPath();
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

  function drawEnhancedShip(ctx, s, dt) {
    ctx.save();
    ctx.translate(s.x, s.y);
    
    if (s.damageFlash > 0) {
      const flashIntensity = (Math.sin(s.damageFlash * 0.02) + 1) * 0.5;
      ctx.globalAlpha = 0.7 + flashIntensity * 0.3;
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-2, -2, s.w + 4, s.h + 4);
      ctx.globalAlpha = 1;
    }
    
    const timeShimmer = 0.8 + 0.2 * Math.sin(performance.now() * 0.001);
    
    ctx.fillStyle = '#451A03';
    ctx.fillRect(1, 1, s.w, s.h);
    
    const hullGrd = ctx.createLinearGradient(0, 0, s.w, s.h);
    hullGrd.addColorStop(0, '#5D1F0A');
    hullGrd.addColorStop(0.18, '#92400E');
    hullGrd.addColorStop(0.5, `rgba(217, 119, 6, ${timeShimmer})`);
    hullGrd.addColorStop(0.8, '#B45309');
    hullGrd.addColorStop(1, '#5D1F0A');
    ctx.fillStyle = hullGrd;
    ctx.fillRect(0, 0, s.w, s.h);
    
    // Nose cone
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.moveTo(s.w, s.h / 2);
    ctx.lineTo(s.w + 10, s.h / 2 - 5);
    ctx.lineTo(s.w + 14, s.h / 2 - 3);
    ctx.lineTo(s.w + 14, s.h / 2 + 3);
    ctx.lineTo(s.w + 10, s.h / 2 + 5);
    ctx.closePath();
    ctx.fill();
    
    // Canopy
    ctx.fillStyle = '#E6D5B0';
    ctx.fillRect(s.w * 0.36, 3, 12, s.h - 6);
    
    // Wings
    ctx.fillStyle = '#B45309';
    ctx.fillRect(s.w * 0.57, 0, 12, 3);
    ctx.fillRect(s.w * 0.57, s.h - 3, 12, 3);
    
    ctx.restore();
  }
  
  function drawRocket(ctx, r) {
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    
    if (r.launched) {
      const wobbleAmount = Math.sin(r.wobble) * 0.5;
      ctx.rotate(wobbleAmount * 0.1);
    }
    
    const halfW = r.w / 2;
    const halfH = r.h / 2;
    
    const bodyGrd = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    if (r.active) {
      bodyGrd.addColorStop(0, '#92400E');
      bodyGrd.addColorStop(0.5, '#B45309');
      bodyGrd.addColorStop(1, '#7C2D12');
    } else {
      bodyGrd.addColorStop(0, '#B45309');
      bodyGrd.addColorStop(1, '#92400E');
    }
    
    ctx.fillStyle = bodyGrd;
    ctx.fillRect(-halfW, -halfH, r.w, r.h);
    
    // Fins
    ctx.fillStyle = '#7C2D12';
    ctx.beginPath();
    ctx.moveTo(-halfW, halfH - 3);
    ctx.lineTo(-halfW - 3, halfH + 2);
    ctx.lineTo(-halfW, halfH);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(halfW, halfH - 3);
    ctx.lineTo(halfW + 3, halfH + 2);
    ctx.lineTo(halfW, halfH);
    ctx.closePath();
    ctx.fill();
    
    // Nose cone
    ctx.fillStyle = r.active ? '#D97706' : '#B45309';
    ctx.beginPath();
    ctx.moveTo(-halfW + 1, -halfH);
    ctx.lineTo(halfW - 1, -halfH);
    ctx.lineTo(0, -halfH - 4);
    ctx.closePath();
    ctx.fill();
    
    // Stripes
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(-halfW + 1, -halfH + 2, r.w - 2, 1);
    ctx.fillRect(-halfW + 1, halfH - 3, r.w - 2, 1);
    
    // Warning light
    if (r.active) {
      const lightFlash = 0.5 + 0.5 * Math.sin(r.exhaustTime * 2);
      ctx.globalAlpha = lightFlash;
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-1, -halfH + 4, 2, 1);
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
