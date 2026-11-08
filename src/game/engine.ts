import { sound } from './audio.ts';
import { ALL_UPGRADES, HEROES, MAP_SIZE, VICTORY_TIME_SECONDS } from './constants.ts';
import { loadProgression, updateMissionProgress } from './missions.ts';
import {
  DailyMission,
  DamageNumber,
  Enemy,
  ExclusiveRelicDef,
  ExclusiveRelicId,
  GameRunStats,
  Gem,
  HeroDef,
  HeroId,
  LightPulse,
  MissionMetric,
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
  onMissionComplete?: (mission: DailyMission, unlockedRelics: ExclusiveRelicDef[]) => void;
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
    missions: DailyMission[];
    equippedRelic: ExclusiveRelicId | null;
    threatMultiplier: number;
    threatTier: string;
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

  // Hitstop, Camera Shake & Chromatic Aberration
  private hitstopTimer: number = 0;
  private cameraShakeIntensity: number = 0;
  private cameraShakeAngle: number = 0;
  private chromaticAberration: number = 0;
  private combatAdrenaline: number = 0;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private shockwaves: {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    color: string;
    alpha: number;
    lineWidth: number;
  }[] = [];

  // Selected hero & equipped relic
  public hero: HeroDef;
  public equippedRelic: ExclusiveRelicId | null = null;
  private xpGainMultiplier: number = 1.0;

  // Daily mission tracking within run
  private currentMissions: DailyMission[] = [];
  private missionsCompletedThisRun: string[] = [];
  private bonusXpEarnedThisRun: number = 0;
  private lastTrackedSecond: number = 0;

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
  public lightPulses: LightPulse[] = [];

  // Spawners & Adaptive Encounter Progression
  public elapsedTime: number = 0;
  public totalKills: number = 0;
  public totalDamageDealt: number = 0;
  public threatMultiplier: number = 1.0;
  public threatTier: string = 'LOW';
  private enemySpawnTimer: number = 0;
  private swarmSurgeCooldown: number = 22;
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

    const prog = loadProgression();
    this.currentMissions = prog.missions;
    this.equippedRelic = prog.equippedRelic;

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

    // Apply Exclusive Relic bonuses
    if (this.equippedRelic === 'chrono_core') {
      this.playerStats.attackSpeedMultiplier *= 1.2;
      this.dashMaxCooldown *= 0.75;
    } else if (this.equippedRelic === 'vampiric_siphon') {
      this.playerStats.maxHp += 30;
      this.playerStats.hp += 30;
    } else if (this.equippedRelic === 'quantum_attractor') {
      this.playerStats.magnetRadius *= 1.8;
      this.xpGainMultiplier = 1.25;
    } else if (this.equippedRelic === 'aegis_matrix') {
      this.playerStats.damageMultiplier *= 1.25;
      this.playerStats.critChance += 0.15;
      this.playerStats.armor += 3;
    }

    // Add starting weapon
    this.addOrUpgradeWeapon(this.hero.startingWeapon);

    // Setup input listeners
    this.bindInputs();
    this.resizeCanvas();
  }

  private recordMissionEvent(metric: MissionMetric, amount: number, mode: 'increment' | 'max' = 'increment') {
    const res = updateMissionProgress(metric, amount, mode);
    this.currentMissions = res.progression.missions;

    if (res.newlyCompleted.length > 0) {
      for (const completed of res.newlyCompleted) {
        this.missionsCompletedThisRun.push(completed.title);
        this.bonusXpEarnedThisRun += completed.rewardXp;

        // Visual & audio celebration
        sound.playLevelUp();
        this.cameraShake(8);
        this.damageNumbers.push({
          x: this.playerX,
          y: this.playerY - 40,
          damage: completed.rewardXp,
          color: '#38bdf8',
          isCrit: true,
          alpha: 1.0,
          life: 1.4,
          maxLife: 1.4,
        });

        // Grant bonus experience immediately!
        this.addXp(completed.rewardXp, true);

        if (this.callbacks.onMissionComplete) {
          this.callbacks.onMissionComplete(completed, res.newlyUnlockedRelics);
        }
      }
      this.pushStats();
    }
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
      this.cameraShake(6, this.playerFacing, 3.5);
      this.spawnShockwave(this.playerX, this.playerY, 95, this.hero.avatarColor, 3);
      this.spawnLightPulse(this.playerX, this.playerY, 195, this.hero.avatarColor, 0.7, 0.32);
      this.recordMissionEvent('dashes_used', 1, 'increment');

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
    this.cameraShake(16, undefined, 11);
    this.spawnShockwave(this.playerX, this.playerY, 380, this.hero.avatarColor, 6);
    this.spawnLightPulse(this.playerX, this.playerY, 480, this.hero.avatarColor, 0.95, 0.65);
    this.hitstopTimer = 0.055;
    this.recordMissionEvent('specials_used', 1, 'increment');

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

  public cameraShake(intensity: number, angle?: number, aberrationBoost?: number) {
    this.cameraShakeIntensity = Math.min(28, this.cameraShakeIntensity + intensity);
    this.cameraShakeAngle = angle !== undefined ? angle : Math.random() * Math.PI * 2;
    const chroma = aberrationBoost !== undefined ? aberrationBoost : intensity * 0.55;
    this.chromaticAberration = Math.min(16, this.chromaticAberration + chroma);
  }

  private spawnShockwave(x: number, y: number, maxRadius: number, color: string, lineWidth: number = 4) {
    this.shockwaves.push({
      x,
      y,
      radius: 12,
      maxRadius,
      color,
      alpha: 0.95,
      lineWidth,
    });
  }

  private spawnLightPulse(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    intensity: number = 0.65,
    duration: number = 0.35
  ) {
    if (this.lightPulses.length >= 64) {
      this.lightPulses.shift();
    }
    this.lightPulses.push({
      x,
      y,
      radius: maxRadius * 0.35,
      maxRadius,
      color,
      intensity: Math.min(1.0, intensity),
      life: duration,
      maxLife: duration,
    });
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

    const currentSec = Math.floor(this.elapsedTime);
    if (currentSec > this.lastTrackedSecond) {
      this.lastTrackedSecond = currentSec;
      this.recordMissionEvent('survive_seconds', currentSec, 'max');
    }

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

    // Camera shake & Chromatic Aberration decay + Combat Adrenaline calculation
    if (this.cameraShakeIntensity > 0) {
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 28);
    }

    // Calculate ambient combat intensity (nearby swarm density, active boss, or low HP)
    let nearbyThreats = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (Math.hypot(e.x - this.playerX, e.y - this.playerY) < 340) {
        nearbyThreats += e.isBoss ? 8 : 1;
      }
    }
    const lowHpFactor =
      this.playerStats.hp / this.playerStats.maxHp < 0.3
        ? (0.3 - this.playerStats.hp / this.playerStats.maxHp) * 3.3
        : 0;
    const targetAdrenaline = Math.min(1, nearbyThreats / 28 + lowHpFactor * 0.65);
    this.combatAdrenaline += (targetAdrenaline - this.combatAdrenaline) * Math.min(1, dt * 4);

    const minChroma = this.combatAdrenaline > 0.35 ? (this.combatAdrenaline - 0.35) * 4.5 : 0;
    if (this.chromaticAberration > minChroma) {
      this.chromaticAberration = Math.max(minChroma, this.chromaticAberration - dt * 20);
    } else {
      this.chromaticAberration = minChroma;
    }

    // Update expanding shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 11) + dt * 120;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0.02) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update dynamic light pulses
    for (let i = this.lightPulses.length - 1; i >= 0; i--) {
      const lp = this.lightPulses[i];
      lp.life -= dt;
      const progress = 1 - Math.max(0, lp.life / lp.maxLife);
      // Fast expansion in first 35%, then smooth lingering fade
      lp.radius = lp.maxRadius * (0.35 + 0.65 * Math.sin(Math.min(1, progress * 1.4) * (Math.PI / 2)));
      if (lp.life <= 0) {
        this.lightPulses.splice(i, 1);
      }
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

    // Muzzle flash light pulse
    this.spawnLightPulse(
      this.playerX + Math.cos(baseAngle) * 18,
      this.playerY + Math.sin(baseAngle) * 18,
      70,
      '#06b6d4',
      0.42,
      0.13
    );

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
      // Draw lightning bolt particle line & electric floor flash
      this.createLightningParticles(prevX, prevY, target.x, target.y);
      this.spawnLightPulse(target.x, target.y, 135, '#38bdf8', 0.78, 0.26);
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
    this.spawnLightPulse(this.playerX, this.playerY, 95, '#f43f5e', 0.55, 0.2);

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
    this.spawnLightPulse(
      this.playerX + Math.cos(angle) * 24,
      this.playerY + Math.sin(angle) * 24,
      145,
      '#eab308',
      0.72,
      0.24
    );

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
    this.cameraShake(5.5, undefined, 3.2);
    this.spawnShockwave(x, y, radius * 1.15, '#f43f5e', 3);
    this.spawnLightPulse(x, y, radius * 2.4, '#f43f5e', 0.9, 0.45);

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
          this.cameraShake(14, undefined, 9.5);
          this.spawnShockwave(enemy.x, enemy.y, 220, '#ef4444', 6);
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
      this.cameraShake(3, undefined, 2.2);
      this.spawnLightPulse(enemy.x, enemy.y, 90, '#f59e0b', 0.65, 0.22);
    }
  }

  private killEnemy(enemy: Enemy, index: number) {
    this.totalKills += 1;
    this.enemies.splice(index, 1);
    sound.playExplosion(enemy.isBoss);

    // Cast temporary dynamic death light pulse onto the cyber-arena environment
    const deathLightRadius = enemy.isBoss ? 480 : 105 + enemy.radius * 3.8;
    const deathLightIntensity = enemy.isBoss ? 1.0 : 0.72;
    const deathLightDuration = enemy.isBoss ? 0.85 : 0.38;
    this.spawnLightPulse(enemy.x, enemy.y, deathLightRadius, enemy.color, deathLightIntensity, deathLightDuration);

    // Extra death burst particles for rich visual impact
    const burstCount = enemy.isBoss ? 32 : 8;
    for (let p = 0; p < burstCount; p++) {
      const ang = (p / burstCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const spd = (enemy.isBoss ? 90 : 45) + Math.random() * 110;
      this.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: enemy.isBoss ? 4 : 2.5,
        color: p % 3 === 0 ? '#ffffff' : enemy.color,
        alpha: 0.95,
        life: enemy.isBoss ? 0.55 : 0.32,
        maxLife: enemy.isBoss ? 0.55 : 0.32,
      });
    }

    // Vampiric Siphon relic healing on every 15 kills
    if (this.equippedRelic === 'vampiric_siphon' && this.totalKills % 15 === 0) {
      this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 2);
    }

    this.recordMissionEvent('kills', 1, 'increment');

    if (enemy.isBoss) {
      this.hitstopTimer = 0.085;
      this.cameraShake(18, undefined, 13);
      this.spawnShockwave(enemy.x, enemy.y, 340, '#f59e0b', 7);
      this.activeBoss = null;
      this.recordMissionEvent('boss_kills', 1, 'increment');
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
            this.cameraShake(19, undefined, 14);
            this.spawnShockwave(this.playerX, this.playerY, 620, '#f97316', 8);
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
          this.recordMissionEvent('gems_collected', 1, 'increment');
          this.addXp(gem.value);
        }
      }
    }
  }

  private addXp(amount: number, isBonusReward: boolean = false) {
    const scaledXp = isBonusReward ? amount : amount * this.xpGainMultiplier;
    this.playerStats.xp += scaledXp;
    if (this.playerStats.xp >= this.playerStats.xpToNextLevel) {
      this.playerStats.xp -= this.playerStats.xpToNextLevel;
      this.playerStats.level += 1;
      this.playerStats.xpToNextLevel = Math.round(this.playerStats.xpToNextLevel * 1.35 + 8);

      sound.playLevelUp();
      this.recordMissionEvent('reach_level', this.playerStats.level, 'max');
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
    this.cameraShake(11, undefined, 8.5);
    this.spawnShockwave(this.playerX, this.playerY, 130, '#ef4444', 4);

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
      score: Math.floor(
        this.totalKills * 12 +
          this.elapsedTime * 15 +
          this.playerStats.level * 100 +
          this.missionsCompletedThisRun.length * 350
      ),
      isVictory: false,
      missionsCompletedThisRun: this.missionsCompletedThisRun,
      bonusXpEarnedThisRun: this.bonusXpEarnedThisRun,
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
      score: Math.floor(
        this.totalKills * 20 +
          this.elapsedTime * 25 +
          this.playerStats.level * 250 +
          5000 +
          this.missionsCompletedThisRun.length * 500
      ),
      isVictory: true,
      missionsCompletedThisRun: this.missionsCompletedThisRun,
      bonusXpEarnedThisRun: this.bonusXpEarnedThisRun,
    };
    this.callbacks.onVictory(stats);
  }

  private updateSpawners(dt: number) {
    this.enemySpawnTimer += dt;
    this.swarmSurgeCooldown -= dt;

    // Adaptive Director Algorithm: combines elapsed time, total kills, and kill velocity (Kills Per Minute)
    const minutes = this.elapsedTime / 60;
    const effectiveMinutes = Math.max(0.25, minutes);
    const killRatePerMin = this.totalKills / effectiveMinutes;

    const timeFactor = Math.pow(minutes, 1.18) * 0.48;
    const killFactor = (this.totalKills / 120) * 0.42;
    const tempoBonus = Math.min(1.2, (killRatePerMin / 65) * 0.35);

    this.threatMultiplier = Number((1.0 + timeFactor + killFactor + tempoBonus).toFixed(2));

    if (this.threatMultiplier < 1.5) this.threatTier = 'STABLE';
    else if (this.threatMultiplier < 2.3) this.threatTier = 'ELEVATED';
    else if (this.threatMultiplier < 3.4) this.threatTier = 'HIGH';
    else if (this.threatMultiplier < 4.8) this.threatTier = 'CRITICAL';
    else this.threatTier = 'OVERDRIVE';

    // Spawn interval tightens with both time and kill-driven threatMultiplier
    const spawnInterval = Math.max(0.12, 0.88 / Math.pow(this.threatMultiplier, 0.58));

    if (this.enemySpawnTimer >= spawnInterval) {
      this.enemySpawnTimer = 0;
      this.spawnEnemiesWave(minutes, this.threatMultiplier);
    }

    // Coordinated Swarm Encirclement Surge when kill tempo or threat is high
    if (this.swarmSurgeCooldown <= 0 && (this.totalKills >= 30 || minutes >= 0.6)) {
      this.swarmSurgeCooldown = Math.max(12, 26 - this.threatMultiplier * 2.5);
      this.spawnSwarmRing(this.threatMultiplier);
    }

    // Mini-boss at 2:00 or 140 kills
    if ((this.elapsedTime >= 120 || this.totalKills >= 140) && !this.miniBossSpawned) {
      this.miniBossSpawned = true;
      this.spawnBoss('Goliath Mecha', Math.round(1400 * Math.max(1, this.threatMultiplier * 0.65)), 36, '#f97316', 35);
    }

    // Final Dreadnought Overlord Boss at 4:15 or 320 kills
    if ((this.elapsedTime >= 255 || this.totalKills >= 320) && !this.finalBossSpawned) {
      this.finalBossSpawned = true;
      this.spawnBoss('Dreadnought Overlord', Math.round(3200 * Math.max(1, this.threatMultiplier * 0.6)), 48, '#ef4444', 50);
    }
  }

  private spawnSwarmRing(threat: number) {
    const dynamicCap = Math.min(340, Math.floor(170 + threat * 45));
    if (this.enemies.length >= dynamicCap) return;

    const ringCount = Math.min(18, Math.floor(8 + threat * 2.2));
    const radius = 520;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const x = this.playerX + Math.cos(angle) * radius;
      const y = this.playerY + Math.sin(angle) * radius;
      this.enemies.push({
        id: this.nextEnemyId++,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 11,
        hp: 20 + threat * 11,
        maxHp: 20 + threat * 11,
        speed: 135 + threat * 9,
        damage: 9 + threat * 1.5,
        color: '#ec4899',
        type: 'skitter',
        xpValue: 2,
        hitFlashTimer: 0,
        attackCooldown: 0,
      });
    }
  }

  private spawnBoss(name: string, hp: number, radius: number, color: string, damage: number) {
    sound.playBossAlarm();
    this.cameraShake(15, undefined, 10);

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
      speed: 68,
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

  private spawnEnemiesWave(minutes: number, threat: number) {
    const dynamicCap = Math.min(340, Math.floor(170 + threat * 45));
    if (this.enemies.length >= dynamicCap) return;

    // Swarm batch size scales with both elapsed time and kill-based threatMultiplier
    const count = Math.min(12, Math.floor(2 + threat * 1.65 + (this.totalKills / 95)));
    const clusterAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      // Mix 60% directional pack clustering with 40% 360-degree surround
      const angle =
        i % 3 === 0
          ? Math.random() * Math.PI * 2
          : clusterAngle + (Math.random() - 0.5) * 0.65;
      const dist = 480 + Math.random() * 210;
      const x = this.playerX + Math.cos(angle) * dist;
      const y = this.playerY + Math.sin(angle) * dist;

      const rand = Math.random();
      let type: Enemy['type'] = 'crawler';
      let hp = 22 + threat * 14;
      let speed = 92 + threat * 7;
      let radius = 13;
      let color = '#a855f7'; // crawler purple
      let damage = 10 + threat * 2;
      let xpValue = 1;

      const skitterUnlock = minutes > 0.4 || this.totalKills >= 20;
      const bruteUnlock = minutes > 1.2 || this.totalKills >= 65;
      const spitterUnlock = minutes > 1.8 || this.totalKills >= 110;

      if (spitterUnlock && rand < Math.min(0.26, 0.1 + threat * 0.03)) {
        // Spitter: ranged bio-plasma artillery
        type = 'spitter';
        hp = 42 + threat * 18;
        speed = 78 + threat * 4;
        radius = 15;
        color = '#10b981';
        damage = 14 + threat * 2;
        xpValue = 4;
      } else if (bruteUnlock && rand < Math.min(0.46, 0.22 + threat * 0.04)) {
        // Brute: heavy armored juggernaut
        type = 'brute';
        hp = 82 + threat * 36;
        speed = 62 + threat * 5;
        radius = 22;
        color = '#f59e0b';
        damage = 22 + threat * 3;
        xpValue = 5;
      } else if (skitterUnlock && rand < Math.min(0.75, 0.45 + threat * 0.05)) {
        // Skitter: high-speed swarminterceptor
        type = 'skitter';
        hp = 16 + threat * 9;
        speed = 148 + threat * 11;
        radius = 10;
        color = '#ec4899';
        damage = 8 + threat * 1.5;
        xpValue = 2;
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
      missions: this.currentMissions,
      equippedRelic: this.equippedRelic,
      threatMultiplier: this.threatMultiplier,
      threatTier: this.threatTier,
    });
  }

  // ================= RENDER PASS =================
  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Directional + high-frequency trauma screen shake
    let shakeX = 0;
    let shakeY = 0;
    let rollAngle = 0;
    if (this.cameraShakeIntensity > 0.1) {
      const t = performance.now() * 0.055;
      const directionalKick = Math.sin(t * 1.7) * this.cameraShakeIntensity * 0.65;
      const jitterX = (Math.random() - 0.5) * this.cameraShakeIntensity * 1.45;
      const jitterY = (Math.random() - 0.5) * this.cameraShakeIntensity * 1.45;
      shakeX = Math.cos(this.cameraShakeAngle) * directionalKick + jitterX;
      shakeY = Math.sin(this.cameraShakeAngle) * directionalKick + jitterY;
      rollAngle = ((Math.random() - 0.5) * this.cameraShakeIntensity * 0.0018);
    }

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Subtle rotational camera roll around screen center during heavy impacts
    if (Math.abs(rollAngle) > 0.0001) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rollAngle);
      ctx.translate(-w / 2, -h / 2);
    }

    // Camera transform
    ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

    // Draw sci-fi cyberpunk grid arena floor + dynamic environment lighting
    this.renderFloor(ctx);
    this.renderDynamicFloorLighting(ctx, w, h);

    // Draw expanding shockwave rings
    this.renderShockwaves(ctx);

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

    // Draw volumetric atmospheric bloom from projectiles & death light pulses
    this.renderAtmosphericBloom(ctx, w, h);

    // Draw Chromatic Aberration RGB channel split pass during intense combat
    if (this.chromaticAberration > 0.25) {
      this.renderChromaticAberrationPass(ctx);
    }

    // Draw Damage numbers
    this.renderDamageNumbers(ctx);

    ctx.restore();

    // Screen-space adrenaline & chromatic edge vignette
    if (this.chromaticAberration > 0.35 || this.combatAdrenaline > 0.25) {
      this.renderScreenSpaceEffects(ctx, w, h);
    }
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
    if (Number.isNaN(num)) return { r: 56, g: 189, b: 248 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  private renderDynamicFloorLighting(ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const cullX = viewW * 0.72;
    const cullY = viewH * 0.72;
    const gridStep = 80;

    // 1. Render temporary light pulses (enemy deaths, explosions, muzzle flashes, abilities)
    for (let i = 0; i < this.lightPulses.length; i++) {
      const lp = this.lightPulses[i];
      if (Math.abs(lp.x - this.playerX) > cullX || Math.abs(lp.y - this.playerY) > cullY) continue;

      const lifeRatio = Math.max(0, lp.life / lp.maxLife);
      // Smooth ease-out curve for atmospheric decay
      const alpha = lp.intensity * Math.pow(lifeRatio, 1.35) * 0.38;
      if (alpha <= 0.01) continue;

      const { r, g, b } = this.hexToRgb(lp.color);
      const grad = ctx.createRadialGradient(lp.x, lp.y, 2, lp.x, lp.y, lp.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.65, alpha * 1.35)})`);
      grad.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      grad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, ${alpha * 0.35})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, lp.radius, 0, Math.PI * 2);
      ctx.fill();

      // Illuminate nearby cyber-grid lines & intersection nodes within the light pulse!
      const gxStart = Math.ceil((lp.x - lp.radius) / gridStep) * gridStep;
      const gxEnd = Math.floor((lp.x + lp.radius) / gridStep) * gridStep;
      const gyStart = Math.ceil((lp.y - lp.radius) / gridStep) * gridStep;
      const gyEnd = Math.floor((lp.y + lp.radius) / gridStep) * gridStep;

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.55, alpha * 1.4)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let gx = gxStart; gx <= gxEnd; gx += gridStep) {
        const dx = Math.abs(gx - lp.x);
        if (dx < lp.radius) {
          const span = Math.sqrt(lp.radius * lp.radius - dx * dx);
          ctx.moveTo(gx, lp.y - span);
          ctx.lineTo(gx, lp.y + span);
        }
      }
      for (let gy = gyStart; gy <= gyEnd; gy += gridStep) {
        const dy = Math.abs(gy - lp.y);
        if (dy < lp.radius) {
          const span = Math.sqrt(lp.radius * lp.radius - dy * dy);
          ctx.moveTo(lp.x - span, gy);
          ctx.lineTo(lp.x + span, gy);
        }
      }
      ctx.stroke();
    }

    // 2. Render real-time moving floor illumination from active projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (Math.abs(p.x - this.playerX) > cullX || Math.abs(p.y - this.playerY) > cullY) continue;

      let lightRadius = 58;
      let baseAlpha = 0.16;
      if (p.type === 'beam') {
        lightRadius = 135;
        baseAlpha = 0.28;
      } else if (p.type === 'missile') {
        lightRadius = 92;
        baseAlpha = 0.22;
      } else if (p.type === 'mine') {
        lightRadius = 82 + Math.sin(performance.now() * 0.008 + p.id) * 10;
        baseAlpha = 0.2;
      } else if (p.type === 'blade') {
        lightRadius = 68;
        baseAlpha = 0.17;
      }

      const { r, g, b } = this.hexToRgb(p.color);
      const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, lightRadius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${baseAlpha})`);
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${baseAlpha * 0.4})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, lightRadius, 0, Math.PI * 2);
      ctx.fill();

      // Highlight nearest grid intersection node under the projectile
      const nearGx = Math.round(p.x / gridStep) * gridStep;
      const nearGy = Math.round(p.y / gridStep) * gridStep;
      const nodeDist = Math.hypot(nearGx - p.x, nearGy - p.y);
      if (nodeDist < lightRadius * 0.85) {
        const nodeAlpha = (1 - nodeDist / (lightRadius * 0.85)) * 0.55;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${nodeAlpha})`;
        ctx.fillRect(nearGx - 3, nearGy - 3, 6, 6);
      }
    }

    ctx.restore();
  }

  private renderAtmosphericBloom(ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const cullX = viewW * 0.72;
    const cullY = viewH * 0.72;

    // Soft volumetric top-layer bloom for death light pulses & explosions
    for (let i = 0; i < this.lightPulses.length; i++) {
      const lp = this.lightPulses[i];
      if (Math.abs(lp.x - this.playerX) > cullX || Math.abs(lp.y - this.playerY) > cullY) continue;

      const lifeRatio = Math.max(0, lp.life / lp.maxLife);
      const bloomAlpha = lp.intensity * Math.pow(lifeRatio, 1.6) * 0.24;
      if (bloomAlpha <= 0.01) continue;

      const { r, g, b } = this.hexToRgb(lp.color);
      const bloomRadius = lp.radius * 0.65;
      const grad = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, bloomRadius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${bloomAlpha * 1.2})`);
      grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${bloomAlpha})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, bloomRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderShockwaves(ctx: CanvasRenderingContext2D) {
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderChromaticAberrationPass(ctx: CanvasRenderingContext2D) {
    const shift = Math.min(14, this.chromaticAberration * 1.15);
    const alpha = Math.min(0.55, 0.14 + (this.chromaticAberration / 16) * 0.42);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;

    // Red-channel horizontal shift (-shift) & Cyan-channel shift (+shift) around player, active enemies, and projectiles
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(this.playerX - shift, this.playerY - shift * 0.35, this.playerRadius + 2, 0, Math.PI * 2);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (Math.abs(e.x - this.playerX) < 680 && Math.abs(e.y - this.playerY) < 480) {
        ctx.moveTo(e.x - shift + e.radius, e.y);
        ctx.arc(e.x - shift, e.y - shift * 0.25, e.radius, 0, Math.PI * 2);
      }
    }
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      ctx.moveTo(p.x - shift + p.radius, p.y);
      ctx.arc(p.x - shift, p.y, p.radius + 1, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(this.playerX + shift, this.playerY + shift * 0.35, this.playerRadius + 2, 0, Math.PI * 2);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (Math.abs(e.x - this.playerX) < 680 && Math.abs(e.y - this.playerY) < 480) {
        ctx.moveTo(e.x + shift + e.radius, e.y);
        ctx.arc(e.x + shift, e.y + shift * 0.25, e.radius, 0, Math.PI * 2);
      }
    }
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      ctx.moveTo(p.x + shift + p.radius, p.y);
      ctx.arc(p.x + shift, p.y, p.radius + 1, 0, Math.PI * 2);
    }
    ctx.fill();

    // Chromatic split on shockwave rings
    for (const sw of this.shockwaves) {
      ctx.lineWidth = Math.max(1.5, sw.lineWidth * 0.7);
      ctx.strokeStyle = '#ff1744';
      ctx.beginPath();
      ctx.arc(sw.x - shift * 0.9, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(sw.x + shift * 0.9, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderScreenSpaceEffects(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const chromaRatio = Math.min(1, this.chromaticAberration / 14);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
    const edgeAlpha = Math.min(0.32, chromaRatio * 0.24 + this.combatAdrenaline * 0.12 * pulse);

    if (edgeAlpha > 0.02) {
      // Left Red/Magenta fringe
      const leftGrad = ctx.createLinearGradient(0, 0, w * 0.12, 0);
      leftGrad.addColorStop(0, `rgba(255, 23, 68, ${edgeAlpha})`);
      leftGrad.addColorStop(1, 'rgba(255, 23, 68, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, w * 0.12, h);

      // Right Cyan fringe
      const rightGrad = ctx.createLinearGradient(w, 0, w * 0.88, 0);
      rightGrad.addColorStop(0, `rgba(0, 229, 255, ${edgeAlpha})`);
      rightGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(w * 0.88, 0, w * 0.12, h);

      // Top/Bottom subtle chromatic scanlines on heavy impacts
      if (this.chromaticAberration > 4.5) {
        const glitchLines = Math.min(6, Math.floor(this.chromaticAberration / 2.2));
        for (let i = 0; i < glitchLines; i++) {
          const sliceY = ((performance.now() * 0.37 + i * 197) % h);
          const sliceH = 2 + (i % 3);
          ctx.fillStyle = i % 2 === 0 ? `rgba(255, 23, 68, ${edgeAlpha * 0.65})` : `rgba(0, 229, 255, ${edgeAlpha * 0.65})`;
          ctx.fillRect(0, sliceY, w, sliceH);
        }
      }
    }

    ctx.restore();
  }

  private renderFloor(ctx: CanvasRenderingContext2D) {
    const half = MAP_SIZE / 2;

    // Deep obsidian cyber-arena floor
    ctx.fillStyle = '#02050d';
    ctx.fillRect(-half, -half, MAP_SIZE, MAP_SIZE);

    // Subtle radial spotlight around player
    const spot = ctx.createRadialGradient(
      this.playerX,
      this.playerY,
      20,
      this.playerX,
      this.playerY,
      540
    );
    spot.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
    spot.addColorStop(0.5, 'rgba(168, 85, 247, 0.03)');
    spot.addColorStop(1, 'rgba(2, 5, 13, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(this.playerX - 560, this.playerY - 560, 1120, 1120);

    // Primary Grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    const step = 80;

    const startX = Math.floor(-half / step) * step;
    const endX = Math.ceil(half / step) * step;
    const startY = Math.floor(-half / step) * step;
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

    // Glowing intersection nodes every 320px
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    for (let x = startX; x <= endX; x += 320) {
      for (let y = startY; y <= endY; y += 320) {
        if (Math.abs(x - this.playerX) < 850 && Math.abs(y - this.playerY) < 600) {
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      }
    }

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
        ctx.save();
        ctx.shadowColor = gem.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = gem.color;
        ctx.beginPath();
        ctx.arc(gem.x, gem.y, gem.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gem.x, gem.y, gem.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Faceted crystalline XP gem
        ctx.save();
        ctx.fillStyle = gem.color;
        ctx.shadowColor = gem.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const r = gem.radius * 1.15;
        ctx.moveTo(gem.x, gem.y - r);
        ctx.lineTo(gem.x + r * 0.85, gem.y);
        ctx.lineTo(gem.x, gem.y + r);
        ctx.lineTo(gem.x - r * 0.85, gem.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gem.x, gem.y - r * 0.25, r * 0.22, 0, Math.PI * 2);
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
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 160 * progress, 0, Math.PI * 2);
        ctx.stroke();
      }

      const ang = Math.atan2(this.playerY - enemy.y, this.playerX - enemy.x);
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(ang);

      if (enemy.hitFlashTimer > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 16;
      } else {
        ctx.fillStyle = enemy.color;
        ctx.strokeStyle = '#f8fafc';
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = enemy.isBoss ? 22 : 8;
      }

      const r = enemy.radius;

      if (enemy.type === 'skitter') {
        // Sleek swept-wing dart silhouette
        ctx.beginPath();
        ctx.moveTo(r * 1.3, 0);
        ctx.lineTo(-r * 0.9, -r * 0.95);
        ctx.lineTo(-r * 0.4, 0);
        ctx.lineTo(-r * 0.9, r * 0.95);
        ctx.closePath();
        ctx.fill();
      } else if (enemy.type === 'brute' || enemy.isBoss) {
        // Hexagonal heavy mecha dreadnought carapace
        ctx.beginPath();
        const sides = enemy.isBoss ? 8 : 6;
        for (let s = 0; s < sides; s++) {
          const a = (s / sides) * Math.PI * 2;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Dark armored core & glowing reactor eye
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#ffffff' : '#fef08a';
        ctx.beginPath();
        ctx.arc(r * 0.2, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'spitter') {
        // Bio-plasma artillery diamond pod
        ctx.beginPath();
        ctx.moveTo(r * 1.15, 0);
        ctx.lineTo(0, -r * 0.9);
        ctx.lineTo(-r, 0);
        ctx.lineTo(0, r * 0.9);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ecfccb';
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Crawler: multi-mandible alien drone
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Health bar above enemy if damaged
      if (enemy.hp < enemy.maxHp && !enemy.isBoss) {
        const barW = enemy.radius * 2.2;
        const barH = 3;
        const barX = enemy.x - barW / 2;
        const barY = enemy.y - enemy.radius - 9;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(barX, barY, barW, barH);

        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
      }
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;

      if (p.type === 'blade') {
        ctx.translate(p.x, p.y);
        ctx.rotate((p.orbitAngle || 0) * 3.5);
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(0, -5);
        ctx.lineTo(-15, 0);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'beam') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillRect(-p.radius * 2.2, -p.radius / 2, p.radius * 4.4, p.radius);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-p.radius * 2, -p.radius * 0.2, p.radius * 4, p.radius * 0.4);
      } else if (p.type === 'missile') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillRect(-8, -4, 16, 8);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-13, -2.5, 5, 5);
      } else if (p.type === 'mine') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.6, p.radius * 0.85, 0, 0, Math.PI * 2);
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

    // Dash afterimage trail effect
    if (this.isDashing) {
      ctx.fillStyle = this.hero.avatarColor;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(
        this.playerX - this.playerVx * 0.04,
        this.playerY - this.playerVy * 0.04,
        this.playerRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Invulnerability blink
    if (this.playerInvulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.restore();
      return;
    }

    ctx.translate(this.playerX, this.playerY);
    ctx.rotate(this.playerFacing);

    // Outer tactical energy halo
    ctx.strokeStyle = this.hero.avatarColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.hero.avatarColor;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, this.playerRadius + 3, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();

    // Armored operative chassis
    ctx.fillStyle = this.hero.avatarColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner dark titanium cockpit & glowing visor
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(-2, 0, this.playerRadius * 0.58, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(4, -5, 11, 10, 3);
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
