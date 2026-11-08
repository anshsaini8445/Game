import { sound } from './audio.ts';
import { ALL_UPGRADES, HEROES, MAP_SIZE, VICTORY_TIME_SECONDS } from './constants.ts';
import {
  DamageNumber,
  Enemy,
  GameRunStats,
  Gem,
  HeroDef,
  HeroId,
  PassiveId,
  Particle,
  PlayerStats,
  Projectile,
  UpgradeOption,
  WeaponId,
  WeaponState,
} from './types.ts';

export interface EngineCallbacks {
  onLevelUp: (options: UpgradeOption[]) => void;
  onGameOver: (stats: GameRunStats) => void;
  onVictory: (stats: GameRunStats) => void;
  onStatsUpdate: (stats: {
    hp: number;
    maxHp: number;
    level: number;
    xp: number;
    xpToNext: number;
    time: number;
    kills: number;
    weapons: { id: WeaponId; level: number }[];
    passives: { id: PassiveId; level: number }[];
    dashReady: boolean;
    dashCooldownProgress: number;
    boss?: { name: string; hp: number; maxHp: number };
  }) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  // Running state
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Hitstop & Camera shake
  private hitstopTimer: number = 0;
  private cameraShakeIntensity: number = 0;
  private cameraX: number = 0;
  private cameraY: number = 0;

  // Selected hero
  public hero: HeroDef;

  // Player position & state
  public playerX: number = 0;
  public playerY: number = 0;
  public playerVx: number = 0;
  public playerVy: number = 0;
  public playerFacing: number = 0; // Angle in radians
  public playerRadius: number = 18;
  public playerStats: PlayerStats;
  private playerInvulnerableTimer: number = 0;
  private playerDashTimer: number = 0;
  private isDashing: boolean = false;
  private dashCooldownTimer: number = 0;
  private dashMaxCooldown: number = 3.5;
  private regenTimer: number = 0;

  // Weapons & Passives inventory
  public weapons: Map<WeaponId, WeaponState> = new Map();
  public passives: Map<PassiveId, number> = new Map();

  // Entities
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public gems: Gem[] = [];
  public particles: Particle[] = [];
  public damageNumbers: DamageNumber[] = [];

  // Spawners & Encounter Progression
  public elapsedTime: number = 0;
  public totalKills: number = 0;
  public totalDamageDealt: number = 0;
  private enemySpawnTimer: number = 0;
  private nextEnemyId: number = 1;
  private nextProjId: number = 1;
  private nextGemId: number = 1;
  private gemComboCount: number = 0;
  private gemComboTimer: number = 0;

  // Boss tracking
  public activeBoss: Enemy | null = null;
  private miniBossSpawned: boolean = false;
  private finalBossSpawned: boolean = false;

  // Input states
  private heldKeys: Set<string> = new Set();
  public touchMoveVector: { x: number; y: number } = { x: 0, y: 0 };
  public isTouchActive: boolean = false;

  // Stats throttle
  private lastStatsPush: number = 0;

  constructor(canvas: HTMLCanvasElement, heroId: HeroId, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;
    this.hero = HEROES[heroId] || HEROES.vance;

    // Initialize player stats based on hero
    this.playerStats = {
      hp: this.hero.baseMaxHp,
      maxHp: this.hero.baseMaxHp,
      level: 1,
      xp: 0,
      xpToNextLevel: 10,
      speed: this.hero.baseSpeed,
      magnetRadius: 100,
      damageMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      critChance: 0.08,
      armor: 0,
      specialCooldown: 0,
      specialMaxCooldown: 12,
      isSpecialReady: true,
    };

    // Apply hero passives
    if (this.hero.id === 'vance') {
      this.playerStats.speed *= 1.15;
      this.playerStats.attackSpeedMultiplier *= 1.1;
    } else if (this.hero.id === 'nova') {
      // Nova gets larger blast area
    } else if (this.hero.id === 'titan') {
      this.playerStats.armor += 2;
    } else if (this.hero.id === 'kage') {
      this.playerStats.critChance += 0.25;
    }

    // Add starting weapon
    this.addOrUpgradeWeapon(this.hero.startingWeapon);

    // Setup input listeners
    this.bindInputs();
    this.resizeCanvas();
  }

  public resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private bindInputs() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);
  }

  public destroy() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.heldKeys.add(e.code);

    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'KeyK') {
      this.triggerDash();
    }
    if (e.code === 'KeyE' || e.code === 'KeyQ') {
      this.triggerSpecial();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.touchMoveVector = { x: 0, y: 0 };
    this.isTouchActive = false;
  };

  private handleResize = () => {
    this.resizeCanvas();
  };

  public setTouchMove(x: number, y: number) {
    this.touchMoveVector = { x, y };
    this.isTouchActive = Math.hypot(x, y) > 0.05;
  }

  public triggerDash() {
    if (this.dashCooldownTimer <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.playerDashTimer = 0.22;
      this.dashCooldownTimer = this.dashMaxCooldown;
      this.playerInvulnerableTimer = 0.28;
      sound.playDash();
      this.cameraShake(5);

      // Dash particle blast
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 120;
        this.particles.push({
          x: this.playerX,
          y: this.playerY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 3 + Math.random() * 3,
          color: this.hero.avatarColor,
          alpha: 0.9,
          life: 0.35,
          maxLife: 0.35,
        });
      }
    }
  }

  public triggerSpecial() {
    if (!this.playerStats.isSpecialReady) return;
    this.playerStats.isSpecialReady = false;
    this.playerStats.specialCooldown = this.playerStats.specialMaxCooldown;

    sound.playExplosion(true);
    this.cameraShake(14);
    this.hitstopTimer = 0.05;

    // Hero specific special effect
    if (this.hero.id === 'vance') {
      // Tactical Overdrive: rapid burst in 360 degrees
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        this.projectiles.push({
          id: this.nextProjId++,
          x: this.playerX,
          y: this.playerY,
          vx: Math.cos(ang) * 550,
          vy: Math.sin(ang) * 550,
          radius: 6,
          damage: 55 * this.playerStats.damageMultiplier,
          life: 1.2,
          maxLife: 1.2,
          color: '#38bdf8',
          pierce: 3,
          type: 'bullet',
        });
      }
    } else if (this.hero.id === 'nova') {
      // Singularity Vortex: draw in and crush all enemies within 400px
      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - this.playerX, enemy.y - this.playerY);
        if (dist < 450) {
          const ang = Math.atan2(this.playerY - enemy.y, this.playerX - enemy.x);
          enemy.vx += Math.cos(ang) * 350;
          enemy.vy += Math.sin(ang) * 350;
          this.damageEnemy(enemy, 90 * this.playerStats.damageMultiplier, true);
        }
      }
    } else if (this.hero.id === 'titan') {
      // Seismic Shockwave: stun and crush all nearby
      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - this.playerX, enemy.y - this.playerY);
        if (dist < 380) {
          const ang = Math.atan2(enemy.y - this.playerY, enemy.x - this.playerX);
          enemy.vx += Math.cos(ang) * 450;
          enemy.vy += Math.sin(ang) * 450;
          this.damageEnemy(enemy, 110 * this.playerStats.damageMultiplier, true);
        }
      }
    } else if (this.hero.id === 'kage') {
      // Phantom Shift: massive critical blast
      for (let i = 0; i < 32; i++) {
        const ang = (i / 32) * Math.PI * 2;
        this.projectiles.push({
          id: this.nextProjId++,
          x: this.playerX,
          y: this.playerY,
          vx: Math.cos(ang) * 600,
          vy: Math.sin(ang) * 600,
          radius: 5,
          damage: 75 * this.playerStats.damageMultiplier,
          life: 1.0,
          maxLife: 1.0,
          color: '#10b981',
          pierce: 5,
          type: 'blade',
        });
      }
    }
  }

  public cameraShake(intensity: number) {
    this.cameraShakeIntensity = Math.min(22, this.cameraShakeIntensity + intensity);
  }

  public start() {
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Clamp frame delta time as per guidelines
    const dt = Math.min(rawDt, 0.05);

    if (!this.isPaused) {
      // Hitstop logic: if active, freeze simulation update briefly while still rendering decaying shake
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.update(dt);
      }
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.elapsedTime += dt;

    // Victory check
    if (this.elapsedTime >= VICTORY_TIME_SECONDS && !this.activeBoss) {
      this.triggerVictory();
      return;
    }

    // Health Regeneration
    const hullLvl = this.passives.get('nano_hull') || 0;
    if (hullLvl > 0) {
      this.regenTimer += dt;
      if (this.regenTimer >= 2.5) {
        this.regenTimer = 0;
        this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + hullLvl * 2);
      }
    }

    // Cooldown timers
    if (this.playerInvulnerableTimer > 0) this.playerInvulnerableTimer -= dt;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

    if (this.isDashing) {
      this.playerDashTimer -= dt;
      if (this.playerDashTimer <= 0) {
        this.isDashing = false;
      }
    }

    if (this.playerStats.specialCooldown > 0) {
      this.playerStats.specialCooldown -= dt;
      if (this.playerStats.specialCooldown <= 0) {
        this.playerStats.specialCooldown = 0;
        this.playerStats.isSpecialReady = true;
      }
    }

    // Gem combo decay
    if (this.gemComboTimer > 0) {
      this.gemComboTimer -= dt;
      if (this.gemComboTimer <= 0) {
        this.gemComboCount = 0;
      }
    }

    // Camera shake decay
    if (this.cameraShakeIntensity > 0) {
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 25);
    }

    // Player Movement
    this.updatePlayerMovement(dt);

    // Weapons firing
    this.updateWeapons(dt);

    // Entities update
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateGems(dt);
    this.updateParticles(dt);
    this.updateDamageNumbers(dt);

    // Spawning logic
    this.updateSpawners(dt);

    // Push stats to React UI ~10 times per second for smooth zero-lag UI
    const now = performance.now();
    if (now - this.lastStatsPush > 100) {
      this.lastStatsPush = now;
      this.pushStats();
    }
  }

  private updatePlayerMovement(dt: number) {
    let moveX = 0;
    let moveY = 0;

    // Keyboard controls
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveY -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveY += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) moveX += 1;

    // Touch controls override
    if (this.isTouchActive) {
      moveX = this.touchMoveVector.x;
      moveY = this.touchMoveVector.y;
    }

    const len = Math.hypot(moveX, moveY);
    if (len > 0.05) {
      const normX = moveX / Math.max(1, len);
      const normY = moveY / Math.max(1, len);
      this.playerFacing = Math.atan2(normY, normX);

      const speedMultiplier = this.isDashing ? 3.0 : 1.0;
      const effectiveSpeed = this.playerStats.speed * speedMultiplier;

      this.playerVx = normX * effectiveSpeed;
      this.playerVy = normY * effectiveSpeed;
    } else {
      this.playerVx *= 0.75;
      this.playerVy *= 0.75;
    }

    this.playerX += this.playerVx * dt;
    this.playerY += this.playerVy * dt;

    // Map bounds clamp
    const half = MAP_SIZE / 2;
    this.playerX = Math.max(-half + 50, Math.min(half - 50, this.playerX));
    this.playerY = Math.max(-half + 50, Math.min(half - 50, this.playerY));

    // Smooth camera track with shake
    const targetCamX = this.playerX - this.canvas.width / 2;
    const targetCamY = this.playerY - this.canvas.height / 2;
    this.cameraX += (targetCamX - this.cameraX) * 0.12;
    this.cameraY += (targetCamY - this.cameraY) * 0.12;
  }

  private updateWeapons(dt: number) {
    for (const weapon of this.weapons.values()) {
      weapon.timer += dt * this.playerStats.attackSpeedMultiplier;

      // Pulse Carbine
      if (weapon.id === 'pulse_carbine' && weapon.timer >= weapon.cooldown) {
        weapon.timer = 0;
        this.firePulseCarbine(weapon);
      }

      // Orbital Blades
      if (weapon.id === 'orbital_blades') {
        // Handled continuously via persistent rotating blade projectiles
        this.maintainOrbitalBlades(weapon);
      }

      // Tesla Coil
      if (weapon.id === 'tesla_coil' && weapon.timer >= weapon.cooldown) {
        weapon.timer = 0;
        this.fireTeslaCoil(weapon);
      }

      // Seeker Missiles
      if (weapon.id === 'seeker_missiles' && weapon.timer >= weapon.cooldown) {
        weapon.timer = 0;
        this.fireSeekerMissiles(weapon);
      }

      // Laser Lance
      if (weapon.id === 'laser_lance' && weapon.timer >= weapon.cooldown) {
        weapon.timer = 0;
        this.fireLaserLance(weapon);
      }

      // Cryo Mine
      if (weapon.id === 'cryo_mine' && weapon.timer >= weapon.cooldown) {
        weapon.timer = 0;
        this.dropCryoMines(weapon);
      }
    }
  }

  private getNearestEnemies(count: number, maxRange: number = 700): Enemy[] {
    const sorted = [...this.enemies]
      .filter((e) => Math.hypot(e.x - this.playerX, e.y - this.playerY) <= maxRange)
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.playerX, a.y - this.playerY) -
          Math.hypot(b.x - this.playerX, b.y - this.playerY)
      );
    return sorted.slice(0, count);
  }

  private firePulseCarbine(weapon: WeaponState) {
    const targets = this.getNearestEnemies(1, weapon.range);
    const count = weapon.projectileCount;
    let baseAngle = this.playerFacing;

    if (targets.length > 0) {
      baseAngle = Math.atan2(targets[0].y - this.playerY, targets[0].x - this.playerX);
    }

    sound.playShoot(1.0 + Math.random() * 0.2);

    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.14 : 0;
      const angle = baseAngle + spread;
      this.projectiles.push({
        id: this.nextProjId++,
        x: this.playerX + Math.cos(angle) * 16,
        y: this.playerY + Math.sin(angle) * 16,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        radius: 4,
        damage: weapon.damage * this.playerStats.damageMultiplier,
        life: 1.1,
        maxLife: 1.1,
        color: '#06b6d4',
        pierce: weapon.level >= 5 ? 2 : 1,
        type: 'bullet',
      });
    }
  }

  private maintainOrbitalBlades(weapon: WeaponState) {
    const activeBlades = this.projectiles.filter((p) => p.type === 'blade');
    const requiredCount = weapon.projectileCount + (this.hero.id === 'nova' ? 1 : 0);

    if (activeBlades.length !== requiredCount) {
      // Clear old blades and spawn fresh configured set
      this.projectiles = this.projectiles.filter((p) => p.type !== 'blade');
      for (let i = 0; i < requiredCount; i++) {
        this.projectiles.push({
          id: this.nextProjId++,
          x: this.playerX,
          y: this.playerY,
          vx: 0,
          vy: 0,
          radius: 9,
          damage: weapon.damage * this.playerStats.damageMultiplier,
          life: 999999,
          maxLife: 999999,
          color: '#a855f7',
          pierce: 9999,
          type: 'blade',
          orbitAngle: (i / requiredCount) * Math.PI * 2,
        });
      }
    }
  }

  private fireTeslaCoil(weapon: WeaponState) {
    const targets = this.getNearestEnemies(weapon.projectileCount, weapon.range);
    if (targets.length === 0) return;

    sound.playLightning();

    let prevX = this.playerX;
    let prevY = this.playerY;

    for (const target of targets) {
      // Draw lightning bolt particle line
      this.createLightningParticles(prevX, prevY, target.x, target.y);
      this.damageEnemy(target, weapon.damage * this.playerStats.damageMultiplier, Math.random() < this.playerStats.critChance);

      // Stun slightly
      target.vx *= 0.2;
      target.vy *= 0.2;

      prevX = target.x;
      prevY = target.y;
    }
  }

  private createLightningParticles(x1: number, y1: number, x2: number, y2: number) {
    const segments = 5;
    let curX = x1;
    let curY = y1;
    for (let i = 1; i <= segments; i++) {
      const nextX = x1 + (x2 - x1) * (i / segments) + (Math.random() - 0.5) * 24;
      const nextY = y1 + (y2 - y1) * (i / segments) + (Math.random() - 0.5) * 24;
      this.particles.push({
        x: (curX + nextX) / 2,
        y: (curY + nextY) / 2,
        vx: 0,
        vy: 0,
        radius: 3,
        color: '#38bdf8',
        alpha: 1.0,
        life: 0.12,
        maxLife: 0.12,
      });
      curX = nextX;
      curY = nextY;
    }
  }

  private fireSeekerMissiles(weapon: WeaponState) {
    const count = weapon.projectileCount;
    sound.playPlasma();

    for (let i = 0; i < count; i++) {
      const angle = this.playerFacing + (i - (count - 1) / 2) * 0.4 + (Math.random() - 0.5) * 0.2;
      const targets = this.getNearestEnemies(3, weapon.range);
      const chosenTarget = targets[i % Math.max(1, targets.length)];

      this.projectiles.push({
        id: this.nextProjId++,
        x: this.playerX,
        y: this.playerY,
        vx: Math.cos(angle) * 140,
        vy: Math.sin(angle) * 140,
        radius: 6,
        damage: weapon.damage * this.playerStats.damageMultiplier,
        life: 2.2,
        maxLife: 2.2,
        color: '#f43f5e',
        pierce: 1,
        type: 'missile',
        targetEnemyId: chosenTarget ? chosenTarget.id : undefined,
      });
    }
  }

  private fireLaserLance(weapon: WeaponState) {
    const targets = this.getNearestEnemies(1, weapon.range);
    let angle = this.playerFacing;
    if (targets.length > 0) {
      angle = Math.atan2(targets[0].y - this.playerY, targets[0].x - this.playerX);
    }

    sound.playShoot(0.7);
    this.cameraShake(3);

    // Laser beam projectile that pierces all
    this.projectiles.push({
      id: this.nextProjId++,
      x: this.playerX,
      y: this.playerY,
      vx: Math.cos(angle) * 900,
      vy: Math.sin(angle) * 900,
      radius: 8 + weapon.level * 2,
      damage: weapon.damage * this.playerStats.damageMultiplier,
      life: 0.65,
      maxLife: 0.65,
      color: '#eab308',
      pierce: 99,
      type: 'beam',
    });
  }

  private dropCryoMines(weapon: WeaponState) {
    const count = weapon.projectileCount;
    for (let i = 0; i < count; i++) {
      const offsetAng = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 80;
      this.projectiles.push({
        id: this.nextProjId++,
        x: this.playerX + Math.cos(offsetAng) * dist,
        y: this.playerY + Math.sin(offsetAng) * dist,
        vx: 0,
        vy: 0,
        radius: 12,
        damage: weapon.damage * this.playerStats.damageMultiplier,
        life: 6.0,
        maxLife: 6.0,
        color: '#67e8f9',
        pierce: 99,
        type: 'mine',
      });
    }
  }

  private updateProjectiles(dt: number) {
    const orbitWeapon = this.weapons.get('orbital_blades');
    const orbitRadius = orbitWeapon ? 75 + orbitWeapon.level * 10 : 75;
    const orbitSpeed = orbitWeapon ? 3.5 + orbitWeapon.level * 0.5 : 3.5;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (p.type === 'blade') {
        // Orbit around player
        if (p.orbitAngle !== undefined) {
          p.orbitAngle += orbitSpeed * dt;
          p.x = this.playerX + Math.cos(p.orbitAngle) * orbitRadius;
          p.y = this.playerY + Math.sin(p.orbitAngle) * orbitRadius;
        }

        // Check collision against nearby enemies
        for (const enemy of this.enemies) {
          const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          if (dist < p.radius + enemy.radius) {
            this.damageEnemy(enemy, p.damage * dt * 4, Math.random() < this.playerStats.critChance);
            enemy.vx += Math.cos(p.orbitAngle || 0) * 80 * dt;
            enemy.vy += Math.sin(p.orbitAngle || 0) * 80 * dt;
          }
        }
        continue;
      }

      if (p.type === 'missile') {
        // Track target
        if (p.targetEnemyId) {
          const target = this.enemies.find((e) => e.id === p.targetEnemyId);
          if (target) {
            const desiredAngle = Math.atan2(target.y - p.y, target.x - p.x);
            const currentAngle = Math.atan2(p.vy, p.vx);
            const angleDiff = Math.atan2(Math.sin(desiredAngle - currentAngle), Math.cos(desiredAngle - currentAngle));
            const newAngle = currentAngle + angleDiff * Math.min(1, dt * 6);
            const currentSpeed = Math.hypot(p.vx, p.vy) + dt * 250;
            p.vx = Math.cos(newAngle) * currentSpeed;
            p.vy = Math.sin(newAngle) * currentSpeed;
          }
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // Projectile collision with enemies
      if (!p.isEnemy) {
        for (const enemy of this.enemies) {
          const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          if (dist < p.radius + enemy.radius) {
            const isCrit = Math.random() < this.playerStats.critChance;
            const mult = isCrit ? (this.hero.id === 'kage' ? 2.5 : 2.0) : 1.0;
            this.damageEnemy(enemy, p.damage * mult, isCrit);

            // Knockback
            const hitAng = Math.atan2(enemy.y - p.y, enemy.x - p.x);
            enemy.vx += Math.cos(hitAng) * (40 + (p.type === 'missile' ? 120 : 20));
            enemy.vy += Math.sin(hitAng) * (40 + (p.type === 'missile' ? 120 : 20));

            // Explosion on missile or mine
            if (p.type === 'missile' || p.type === 'mine') {
              this.createExplosionBlast(p.x, p.y, 65, p.damage * 0.6);
            }

            p.pierce -= 1;
            if (p.pierce <= 0) {
              p.life = 0;
              break;
            }
          }
        }
      } else {
        // Enemy projectile hitting player
        const dist = Math.hypot(this.playerX - p.x, this.playerY - p.y);
        if (dist < p.radius + this.playerRadius) {
          this.damagePlayer(p.damage);
          p.life = 0;
        }
      }

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private createExplosionBlast(x: number, y: number, radius: number, splashDamage: number) {
    sound.playExplosion(false);
    this.cameraShake(4);

    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist < radius + enemy.radius) {
        this.damageEnemy(enemy, splashDamage, false);
      }
    }

    // Explosion particles
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 2 + Math.random() * 4,
        color: Math.random() > 0.5 ? '#f43f5e' : '#fbbf24',
        alpha: 0.9,
        life: 0.35,
        maxLife: 0.35,
      });
    }
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer -= dt;
      if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

      // Boss telegraph
      if (enemy.isBoss && enemy.telegraphTimer !== undefined && enemy.telegraphTimer > 0) {
        enemy.telegraphTimer -= dt;
        if (enemy.telegraphTimer <= 0) {
          // Boss ground slam shockwave
          this.createExplosionBlast(enemy.x, enemy.y, 160, 40);
          sound.playExplosion(true);
          this.cameraShake(10);
          enemy.telegraphTimer = 4.5;
        }
      }

      // Spitter shooting
      if (enemy.type === 'spitter') {
        enemy.shootTimer = (enemy.shootTimer || 2.5) - dt;
        if (enemy.shootTimer <= 0) {
          enemy.shootTimer = 3.0;
          const ang = Math.atan2(this.playerY - enemy.y, this.playerX - enemy.x);
          this.projectiles.push({
            id: this.nextProjId++,
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(ang) * 190,
            vy: Math.sin(ang) * 190,
            radius: 6,
            damage: 18,
            life: 3.5,
            maxLife: 3.5,
            color: '#a3e635',
            pierce: 1,
            isEnemy: true,
            type: 'spit',
          });
        }
      }

      // Move toward player
      const dx = this.playerX - enemy.x;
      const dy = this.playerY - enemy.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 2) {
        const targetVx = (dx / dist) * enemy.speed;
        const targetVy = (dy / dist) * enemy.speed;
        enemy.vx += (targetVx - enemy.vx) * dt * 4;
        enemy.vy += (targetVy - enemy.vy) * dt * 4;
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Collision with player
      if (dist < enemy.radius + this.playerRadius) {
        if (enemy.attackCooldown <= 0) {
          this.damagePlayer(enemy.damage);
          enemy.attackCooldown = 0.8;
          // Slight pushback
          const pushAng = Math.atan2(enemy.y - this.playerY, enemy.x - this.playerX);
          enemy.vx += Math.cos(pushAng) * 60;
          enemy.vy += Math.sin(pushAng) * 60;
        }
      }

      // Death check
      if (enemy.hp <= 0) {
        this.killEnemy(enemy, i);
      }
    }

    // Soft separation between enemies to prevent stacking into a single point
    this.separateEnemies();
  }

  private separateEnemies() {
    const count = this.enemies.length;
    // Fast sampled separation
    for (let i = 0; i < count; i += 2) {
      const a = this.enemies[i];
      for (let j = i + 1; j < Math.min(count, i + 8); j++) {
        const b = this.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist > 0 && dist < minDist) {
          const overlap = (minDist - dist) * 0.15;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }

  private damageEnemy(enemy: Enemy, amount: number, isCrit: boolean) {
    enemy.hp -= amount;
    enemy.hitFlashTimer = 0.08;
    this.totalDamageDealt += Math.round(amount);

    sound.playHit();

    // Damage number popup
    this.damageNumbers.push({
      x: enemy.x + (Math.random() - 0.5) * 16,
      y: enemy.y - enemy.radius - 6,
      damage: Math.round(amount),
      color: isCrit ? '#f59e0b' : '#ffffff',
      isCrit,
      alpha: 1.0,
      life: 0.65,
      maxLife: 0.65,
    });

    // Blood / spark particles
    for (let i = 0; i < (isCrit ? 6 : 3); i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 80;
      this.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 2,
        color: enemy.color,
        alpha: 0.8,
        life: 0.25,
        maxLife: 0.25,
      });
    }

    if (isCrit) {
      this.hitstopTimer = 0.03;
      this.cameraShake(2);
    }
  }

  private killEnemy(enemy: Enemy, index: number) {
    this.totalKills += 1;
    this.enemies.splice(index, 1);
    sound.playExplosion(enemy.isBoss);

    if (enemy.isBoss) {
      this.hitstopTimer = 0.08;
      this.cameraShake(14);
      this.activeBoss = null;
      // Drop mega upgrade chest or massive gems
      for (let g = 0; g < 10; g++) {
        this.dropGem(enemy.x + (Math.random() - 0.5) * 60, enemy.y + (Math.random() - 0.5) * 60, 25);
      }
      this.dropPickup(enemy.x, enemy.y, 'nuke');
    } else {
      this.dropGem(enemy.x, enemy.y, enemy.xpValue);

      // Rare chance for special pickup drop (Heal, Magnet, Nuke)
      if (Math.random() < 0.02) {
        const rand = Math.random();
        if (rand < 0.45) this.dropPickup(enemy.x, enemy.y, 'heal');
        else if (rand < 0.8) this.dropPickup(enemy.x, enemy.y, 'magnet');
        else this.dropPickup(enemy.x, enemy.y, 'nuke');
      }
    }
  }

  private dropGem(x: number, y: number, value: number) {
    let color = '#38bdf8'; // blue
    if (value >= 15) color = '#ec4899'; // pink
    else if (value >= 6) color = '#10b981'; // emerald

    this.gems.push({
      id: this.nextGemId++,
      x,
      y,
      value,
      radius: 5 + Math.min(6, value * 0.4),
      color,
    });
  }

  private dropPickup(x: number, y: number, type: 'heal' | 'magnet' | 'nuke') {
    let color = '#22c55e';
    if (type === 'magnet') color = '#a855f7';
    if (type === 'nuke') color = '#f97316';

    this.gems.push({
      id: this.nextGemId++,
      x,
      y,
      value: 0,
      radius: 12,
      color,
      isPickup: true,
      pickupType: type,
    });
  }

  private updateGems(dt: number) {
    const magnetRange = this.playerStats.magnetRadius;

    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      const dx = this.playerX - gem.x;
      const dy = this.playerY - gem.y;
      const dist = Math.hypot(dx, dy);

      if (dist < magnetRange) {
        // Accelerate smoothly toward player
        const pullSpeed = (1 - dist / magnetRange) * 550 + 200;
        gem.x += (dx / dist) * pullSpeed * dt;
        gem.y += (dy / dist) * pullSpeed * dt;
      }

      // Collect gem
      if (dist < gem.radius + this.playerRadius) {
        this.gems.splice(i, 1);

        if (gem.isPickup) {
          if (gem.pickupType === 'heal') {
            this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 35);
            sound.playLevelUp();
          } else if (gem.pickupType === 'magnet') {
            // Vacuum all gems on screen directly to player!
            for (const other of this.gems) {
              other.x = this.playerX + (Math.random() - 0.5) * 40;
              other.y = this.playerY + (Math.random() - 0.5) * 40;
            }
            sound.playPlasma();
          } else if (gem.pickupType === 'nuke') {
            // Nuke wipes out all regular enemies on screen
            this.cameraShake(16);
            sound.playExplosion(true);
            for (const enemy of [...this.enemies]) {
              if (!enemy.isBoss) {
                this.damageEnemy(enemy, 9999, false);
              }
            }
          }
        } else {
          // Regular XP gem
          this.gemComboCount += 1;
          this.gemComboTimer = 1.2;
          sound.playGemCollect(this.gemComboCount);
          this.addXp(gem.value);
        }
      }
    }
  }

  private addXp(amount: number) {
    this.playerStats.xp += amount;
    if (this.playerStats.xp >= this.playerStats.xpToNextLevel) {
      this.playerStats.xp -= this.playerStats.xpToNextLevel;
      this.playerStats.level += 1;
      this.playerStats.xpToNextLevel = Math.round(this.playerStats.xpToNextLevel * 1.35 + 8);

      sound.playLevelUp();
      this.triggerLevelUp();
    }
  }

  private triggerLevelUp() {
    this.pause();

    // Prepare 3-4 randomized upgrade choices
    const availableChoices: UpgradeOption[] = [];

    for (const upgrade of ALL_UPGRADES) {
      if (upgrade.type === 'weapon') {
        const current = this.weapons.get(upgrade.id as WeaponId);
        const curLevel = current ? current.level : 0;
        if (curLevel < 5) {
          const nextLevel = curLevel + 1;
          const levelInfo = upgrade.levels.find((l) => l.level === nextLevel);
          availableChoices.push({
            id: upgrade.id,
            type: 'weapon',
            name: upgrade.name,
            description: levelInfo ? levelInfo.description : 'Upgrade weapon',
            currentLevel: curLevel,
            maxLevel: 5,
            iconName: upgrade.iconName,
            accentColor: upgrade.accentColor,
          });
        }
      } else {
        const curLevel = this.passives.get(upgrade.id as PassiveId) || 0;
        if (curLevel < 5) {
          const nextLevel = curLevel + 1;
          const levelInfo = upgrade.levels.find((l) => l.level === nextLevel);
          availableChoices.push({
            id: upgrade.id,
            type: 'passive',
            name: upgrade.name,
            description: levelInfo ? levelInfo.description : 'Upgrade passive attribute',
            currentLevel: curLevel,
            maxLevel: 5,
            iconName: upgrade.iconName,
            accentColor: upgrade.accentColor,
          });
        }
      }
    }

    // Shuffle and pick 3-4 options
    const shuffled = availableChoices.sort(() => Math.random() - 0.5).slice(0, 3);
    this.callbacks.onLevelUp(shuffled);
  }

  public applyUpgrade(id: WeaponId | PassiveId) {
    const upgradeDef = ALL_UPGRADES.find((u) => u.id === id);
    if (!upgradeDef) return;

    if (upgradeDef.type === 'weapon') {
      this.addOrUpgradeWeapon(id as WeaponId);
    } else {
      const cur = this.passives.get(id as PassiveId) || 0;
      const next = cur + 1;
      this.passives.set(id as PassiveId, next);

      // Apply passive modifiers directly
      if (id === 'overclock') {
        this.playerStats.attackSpeedMultiplier = 1.0 + next * 0.12;
      } else if (id === 'plasma_core') {
        this.playerStats.damageMultiplier = 1.0 + next * 0.15;
      } else if (id === 'gravity_magnet') {
        this.playerStats.magnetRadius = 100 + next * 50;
      } else if (id === 'nano_hull') {
        this.playerStats.maxHp += 25;
        this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 25);
      } else if (id === 'thruster_boots') {
        this.playerStats.speed = this.hero.baseSpeed * (1 + next * 0.12);
      } else if (id === 'subatomic_optics') {
        // Increases projectile blast radius & pierce
      }
    }

    this.resume();
  }

  private addOrUpgradeWeapon(id: WeaponId) {
    const existing = this.weapons.get(id);
    if (existing) {
      existing.level += 1;
      // Upgrade weapon stats based on level
      if (id === 'pulse_carbine') {
        existing.damage += 8;
        if (existing.level >= 2) existing.projectileCount = 2;
        if (existing.level >= 4) existing.projectileCount = 3;
        if (existing.level >= 5) existing.cooldown = 0.22;
      } else if (id === 'orbital_blades') {
        existing.damage += 12;
        existing.projectileCount = 2 + (existing.level - 1);
      } else if (id === 'tesla_coil') {
        existing.damage += 14;
        existing.projectileCount = 3 + (existing.level - 1);
      } else if (id === 'seeker_missiles') {
        existing.damage += 18;
        existing.projectileCount = 1 + Math.floor(existing.level / 2);
      } else if (id === 'laser_lance') {
        existing.damage += 22;
        existing.cooldown = Math.max(0.6, 1.4 - existing.level * 0.18);
      } else if (id === 'cryo_mine') {
        existing.damage += 15;
        existing.projectileCount = 1 + Math.floor(existing.level / 2);
      }
    } else {
      // Create new weapon state at level 1
      let initial: WeaponState = {
        id,
        level: 1,
        timer: 0,
        cooldown: 0.45,
        damage: 22,
        projectileCount: 1,
        speed: 480,
        range: 420,
      };

      if (id === 'orbital_blades') {
        initial = { id, level: 1, timer: 0, cooldown: 0.1, damage: 16, projectileCount: 2, speed: 0, range: 100 };
      } else if (id === 'tesla_coil') {
        initial = { id, level: 1, timer: 0, cooldown: 1.1, damage: 32, projectileCount: 3, speed: 0, range: 350 };
      } else if (id === 'seeker_missiles') {
        initial = { id, level: 1, timer: 0, cooldown: 1.5, damage: 45, projectileCount: 1, speed: 280, range: 500 };
      } else if (id === 'laser_lance') {
        initial = { id, level: 1, timer: 0, cooldown: 1.4, damage: 55, projectileCount: 1, speed: 900, range: 600 };
      } else if (id === 'cryo_mine') {
        initial = { id, level: 1, timer: 0, cooldown: 2.2, damage: 35, projectileCount: 1, speed: 0, range: 250 };
      }

      this.weapons.set(id, initial);
    }
  }

  private damagePlayer(amount: number) {
    if (this.playerInvulnerableTimer > 0 || this.isDashing) return;

    const effectiveDamage = Math.max(1, amount - this.playerStats.armor);
    this.playerStats.hp -= effectiveDamage;
    this.playerInvulnerableTimer = 0.35;

    sound.playHit();
    this.cameraShake(8);

    if (this.playerStats.hp <= 0) {
      this.playerStats.hp = 0;
      this.triggerGameOver();
    }
  }

  private triggerGameOver() {
    this.destroy();
    const stats: GameRunStats = {
      survivedTimeSeconds: Math.floor(this.elapsedTime),
      totalKills: this.totalKills,
      damageDealt: this.totalDamageDealt,
      levelReached: this.playerStats.level,
      hero: this.hero,
      weaponsUsed: Array.from(this.weapons.values()).map((w) => ({ id: w.id, level: w.level })),
      passivesUsed: Array.from(this.passives.entries()).map(([id, level]) => ({ id, level })),
      score: Math.floor(this.totalKills * 12 + this.elapsedTime * 15 + this.playerStats.level * 100),
      isVictory: false,
    };
    this.callbacks.onGameOver(stats);
  }

  private triggerVictory() {
    this.destroy();
    const stats: GameRunStats = {
      survivedTimeSeconds: Math.floor(this.elapsedTime),
      totalKills: this.totalKills,
      damageDealt: this.totalDamageDealt,
      levelReached: this.playerStats.level,
      hero: this.hero,
      weaponsUsed: Array.from(this.weapons.values()).map((w) => ({ id: w.id, level: w.level })),
      passivesUsed: Array.from(this.passives.entries()).map(([id, level]) => ({ id, level })),
      score: Math.floor(this.totalKills * 20 + this.elapsedTime * 25 + this.playerStats.level * 250 + 5000),
      isVictory: true,
    };
    this.callbacks.onVictory(stats);
  }

  private updateSpawners(dt: number) {
    this.enemySpawnTimer += dt;

    // Difficulty scaling based on elapsed minutes
    const minutes = this.elapsedTime / 60;
    const spawnInterval = Math.max(0.18, 0.9 - minutes * 0.12);

    if (this.enemySpawnTimer >= spawnInterval) {
      this.enemySpawnTimer = 0;
      this.spawnEnemiesWave(minutes);
    }

    // Mini-boss at 2:15
    if (this.elapsedTime >= 135 && !this.miniBossSpawned) {
      this.miniBossSpawned = true;
      this.spawnBoss('Goliath Mecha', 1400, 36, '#f97316', 35);
    }

    // Final Dreadnought Overlord Boss at 4:30
    if (this.elapsedTime >= 270 && !this.finalBossSpawned) {
      this.finalBossSpawned = true;
      this.spawnBoss('Dreadnought Overlord', 3200, 48, '#ef4444', 50);
    }
  }

  private spawnBoss(name: string, hp: number, radius: number, color: string, damage: number) {
    sound.playBossAlarm();
    this.cameraShake(12);

    const angle = Math.random() * Math.PI * 2;
    const dist = 550;
    const x = this.playerX + Math.cos(angle) * dist;
    const y = this.playerY + Math.sin(angle) * dist;

    const boss: Enemy = {
      id: this.nextEnemyId++,
      x,
      y,
      vx: 0,
      vy: 0,
      radius,
      hp,
      maxHp: hp,
      speed: 65,
      damage,
      color,
      type: 'boss',
      xpValue: 80,
      hitFlashTimer: 0,
      attackCooldown: 0,
      isBoss: true,
      bossName: name,
      telegraphTimer: 3.0,
      telegraphMax: 3.0,
    };

    this.enemies.push(boss);
    this.activeBoss = boss;
  }

  private spawnEnemiesWave(minutes: number) {
    if (this.enemies.length >= 260) return; // Prevent performance drop

    const count = 2 + Math.floor(minutes * 2);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 500 + Math.random() * 200;
      const x = this.playerX + Math.cos(angle) * dist;
      const y = this.playerY + Math.sin(angle) * dist;

      const rand = Math.random();
      let type: Enemy['type'] = 'crawler';
      let hp = 24 + minutes * 15;
      let speed = 90 + minutes * 8;
      let radius = 13;
      let color = '#a855f7'; // crawler purple
      let damage = 10 + minutes * 2;
      let xpValue = 1;

      if (minutes > 0.8 && rand < 0.3) {
        // Skitter: fast and agile
        type = 'skitter';
        hp = 18 + minutes * 10;
        speed = 150 + minutes * 12;
        radius = 10;
        color = '#ec4899';
        damage = 8;
        xpValue = 2;
      } else if (minutes > 1.8 && rand < 0.5) {
        // Brute: heavy, tanky
        type = 'brute';
        hp = 85 + minutes * 40;
        speed = 60 + minutes * 5;
        radius = 22;
        color = '#f59e0b';
        damage = 22;
        xpValue = 5;
      } else if (minutes > 2.5 && rand < 0.7) {
        // Spitter: fires ranged projectile
        type = 'spitter';
        hp = 45 + minutes * 20;
        speed = 75;
        radius = 15;
        color = '#10b981';
        damage = 14;
        xpValue = 4;
      }

      this.enemies.push({
        id: this.nextEnemyId++,
        x,
        y,
        vx: 0,
        vy: 0,
        radius,
        hp,
        maxHp: hp,
        speed,
        damage,
        color,
        type,
        xpValue,
        hitFlashTimer: 0,
        attackCooldown: 0,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateDamageNumbers(dt: number) {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.y -= 35 * dt;
      d.life -= dt;
      d.alpha = Math.max(0, d.life / d.maxLife);
      if (d.life <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  private pushStats() {
    this.callbacks.onStatsUpdate({
      hp: Math.round(this.playerStats.hp),
      maxHp: Math.round(this.playerStats.maxHp),
      level: this.playerStats.level,
      xp: Math.round(this.playerStats.xp),
      xpToNext: Math.round(this.playerStats.xpToNextLevel),
      time: Math.floor(this.elapsedTime),
      kills: this.totalKills,
      weapons: Array.from(this.weapons.values()).map((w) => ({ id: w.id, level: w.level })),
      passives: Array.from(this.passives.entries()).map(([id, level]) => ({ id, level })),
      dashReady: this.dashCooldownTimer <= 0,
      dashCooldownProgress: Math.max(0, 1 - this.dashCooldownTimer / this.dashMaxCooldown),
      boss: this.activeBoss
        ? {
            name: this.activeBoss.bossName || 'BOSS',
            hp: Math.max(0, Math.round(this.activeBoss.hp)),
            maxHp: Math.round(this.activeBoss.maxHp),
          }
        : undefined,
    });
  }

  // ================= RENDER PASS =================
  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Apply camera shake offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShakeIntensity > 0) {
      shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity * 2;
      shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity * 2;
    }

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Camera transform
    ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

    // Draw sci-fi cyberpunk grid arena floor
    this.renderFloor(ctx);

    // Draw Gems & Pickups
    this.renderGems(ctx);

    // Draw Particles
    this.renderParticles(ctx);

    // Draw Enemies
    this.renderEnemies(ctx);

    // Draw Projectiles
    this.renderProjectiles(ctx);

    // Draw Player
    this.renderPlayer(ctx);

    // Draw Damage numbers
    this.renderDamageNumbers(ctx);

    ctx.restore();
  }

  private renderFloor(ctx: CanvasRenderingContext2D) {
    const half = MAP_SIZE / 2;

    // Arena background
    ctx.fillStyle = '#030712';
    ctx.fillRect(-half, -half, MAP_SIZE, MAP_SIZE);

    // Grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    const step = 80;

    const startX = Math.floor((-half) / step) * step;
    const endX = Math.ceil(half / step) * step;
    const startY = Math.floor((-half) / step) * step;
    const endY = Math.ceil(half / step) * step;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, -half);
      ctx.lineTo(x, half);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(-half, y);
      ctx.lineTo(half, y);
    }
    ctx.stroke();

    // Map boundary hazard laser fence
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(-half + 40, -half + 40, MAP_SIZE - 80, MAP_SIZE - 80);

    // Arena center ring
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, Math.PI * 2);
    ctx.stroke();
  }

  private renderGems(ctx: CanvasRenderingContext2D) {
    for (const gem of this.gems) {
      if (gem.isPickup) {
        // Glowing animated icon for pickups
        ctx.save();
        ctx.shadowColor = gem.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = gem.color;
        ctx.beginPath();
        ctx.arc(gem.x, gem.y, gem.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner marker
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gem.x, gem.y, gem.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Diamond XP gem
        ctx.save();
        ctx.fillStyle = gem.color;
        ctx.shadowColor = gem.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const r = gem.radius;
        ctx.moveTo(gem.x, gem.y - r);
        ctx.lineTo(gem.x + r, gem.y);
        ctx.lineTo(gem.x, gem.y + r);
        ctx.lineTo(gem.x - r, gem.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      ctx.save();

      // Telegraph circle for bosses
      if (enemy.isBoss && enemy.telegraphTimer !== undefined) {
        const progress = 1 - enemy.telegraphTimer / (enemy.telegraphMax || 3.0);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + progress * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 160 * progress, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hit flash: pure white silhouette
      if (enemy.hitFlashTimer > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 14;
      } else {
        ctx.fillStyle = enemy.color;
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = enemy.isBoss ? 20 : 6;
      }

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner details for bosses or brutes
      if (enemy.radius >= 18) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Health bar above enemy if damaged
      if (enemy.hp < enemy.maxHp && !enemy.isBoss) {
        const barW = enemy.radius * 2.2;
        const barH = 3;
        const barX = enemy.x - barW / 2;
        const barY = enemy.y - enemy.radius - 8;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(barX, barY, barW, barH);

        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
      }

      ctx.restore();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;

      if (p.type === 'blade') {
        // Rotating laser blade
        ctx.translate(p.x, p.y);
        ctx.rotate((p.orbitAngle || 0) * 3);
        ctx.fillRect(-12, -4, 24, 8);
      } else if (p.type === 'beam') {
        // Laser beam segment
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillRect(-p.radius * 2, -p.radius / 2, p.radius * 4, p.radius);
      } else if (p.type === 'missile') {
        // Rocket body
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillRect(-8, -4, 16, 8);
        // Rocket flame
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-12, -2, 4, 4);
      } else if (p.type === 'mine') {
        // Proximity mine pulse
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Bullet / spit
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Magnet aura subtle ring
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, this.playerStats.magnetRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Dash trail effect
    if (this.isDashing) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.beginPath();
      ctx.arc(this.playerX - this.playerVx * 0.04, this.playerY - this.playerVy * 0.04, this.playerRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Invulnerability blink
    if (this.playerInvulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.restore();
      return;
    }

    // Player body
    ctx.shadowColor = this.hero.avatarColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.hero.avatarColor;
    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, this.playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Facing direction pointer
    const pointerX = this.playerX + Math.cos(this.playerFacing) * (this.playerRadius + 4);
    const pointerY = this.playerY + Math.sin(this.playerFacing) * (this.playerRadius + 4);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pointerX, pointerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player core icon
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, this.playerRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderDamageNumbers(ctx: CanvasRenderingContext2D) {
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (const d of this.damageNumbers) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      if (d.isCrit) {
        ctx.font = '900 18px "JetBrains Mono", monospace';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
      }
      ctx.fillText(`${d.damage}`, d.x, d.y);
      ctx.restore();
    }
  }
}
