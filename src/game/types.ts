export type GameScreen = 'TITLE' | 'PLAYING' | 'PAUSED' | 'LEVEL_UP' | 'GAME_OVER' | 'VICTORY';

export type WeaponId =
  | 'pulse_carbine'
  | 'orbital_blades'
  | 'tesla_coil'
  | 'seeker_missiles'
  | 'laser_lance'
  | 'cryo_mine';

export type PassiveId =
  | 'overclock'
  | 'plasma_core'
  | 'gravity_magnet'
  | 'nano_hull'
  | 'thruster_boots'
  | 'subatomic_optics';

export type HeroId = 'vance' | 'nova' | 'titan' | 'kage';

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  avatarColor: string;
  startingWeapon: WeaponId;
  baseMaxHp: number;
  baseSpeed: number;
  description: string;
  passiveDescription: string;
  specialAbility: string;
  specialDescription: string;
}

export interface UpgradeOption {
  id: WeaponId | PassiveId;
  type: 'weapon' | 'passive';
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  iconName: string;
  accentColor: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  speed: number;
  magnetRadius: number;
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  critChance: number;
  armor: number;
  specialCooldown: number;
  specialMaxCooldown: number;
  isSpecialReady: boolean;
}

export interface WeaponState {
  id: WeaponId;
  level: number;
  timer: number;
  cooldown: number;
  damage: number;
  projectileCount: number;
  speed: number;
  range: number;
}

export interface PassiveState {
  id: PassiveId;
  level: number;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  color: string;
  type: 'crawler' | 'skitter' | 'brute' | 'spitter' | 'boss';
  xpValue: number;
  hitFlashTimer: number;
  attackCooldown: number;
  isBoss?: boolean;
  bossName?: string;
  telegraphTimer?: number;
  telegraphMax?: number;
  shootTimer?: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
  pierce: number;
  isEnemy?: boolean;
  type: 'bullet' | 'blade' | 'missile' | 'beam' | 'mine' | 'spit';
  targetEnemyId?: number;
  orbitAngle?: number;
}

export interface Gem {
  id: number;
  x: number;
  y: number;
  value: number;
  radius: number;
  color: string;
  isPickup?: boolean;
  pickupType?: 'heal' | 'magnet' | 'nuke';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface DamageNumber {
  x: number;
  y: number;
  damage: number;
  color: string;
  isCrit: boolean;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface GameRunStats {
  survivedTimeSeconds: number;
  totalKills: number;
  damageDealt: number;
  levelReached: number;
  hero: HeroDef;
  weaponsUsed: { id: WeaponId; level: number }[];
  passivesUsed: { id: PassiveId; level: number }[];
  score: number;
  isVictory: boolean;
}
