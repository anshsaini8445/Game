import { HeroDef, HeroId, PassiveId, WeaponId } from './types.ts';

export const HEROES: Record<HeroId, HeroDef> = {
  vance: {
    id: 'vance',
    name: 'Striker Vance',
    title: 'Vanguard Ranger',
    avatarColor: '#06b6d4', // cyan-500
    startingWeapon: 'pulse_carbine',
    baseMaxHp: 100,
    baseSpeed: 210,
    description: 'Elite frontline operative with superior agility and steady firepower.',
    passiveDescription: '+15% Move Speed, +10% Fire Rate',
    specialAbility: 'Tactical Dash',
    specialDescription: 'Quick evasive burst granting invulnerability and shockwave trail.',
  },
  nova: {
    id: 'nova',
    name: 'Nova Ray',
    title: 'Void Sorceress',
    avatarColor: '#a855f7', // purple-500
    startingWeapon: 'orbital_blades',
    baseMaxHp: 85,
    baseSpeed: 195,
    description: 'Harnesses orbital anti-matter shields and gravitational phenomena.',
    passiveDescription: '+25% Area of Effect, +1 Extra Orbital Blade',
    specialAbility: 'Singularity Vortex',
    specialDescription: 'Pulls nearby enemies toward center and collapses them in blast.',
  },
  titan: {
    id: 'titan',
    name: 'Titan Rex',
    title: 'Armored Juggernaut',
    avatarColor: '#f59e0b', // amber-500
    startingWeapon: 'tesla_coil',
    baseMaxHp: 160,
    baseSpeed: 175,
    description: 'Impenetrable mech armor that shrugs off hits and clears crowds.',
    passiveDescription: '+60% Max HP, +30% Knockback resistance, +2 Armor',
    specialAbility: 'Seismic Shockwave',
    specialDescription: 'Stomp ground crushing and stunning all nearby enemies.',
  },
  kage: {
    id: 'kage',
    name: 'Kage Shinobi',
    title: 'Cyber Assassin',
    avatarColor: '#10b981', // emerald-500
    startingWeapon: 'seeker_missiles',
    baseMaxHp: 90,
    baseSpeed: 230,
    description: 'Lethal shadow operative focused on critical strikes and swift strikes.',
    passiveDescription: '+25% Critical Hit Chance, +50% Crit Damage',
    specialAbility: 'Phantom Shift',
    specialDescription: 'Teleports forward slicing through all enemies in flight.',
  },
};

export interface UpgradeDetails {
  id: WeaponId | PassiveId;
  type: 'weapon' | 'passive';
  name: string;
  iconName: string;
  accentColor: string;
  levels: {
    level: number;
    description: string;
  }[];
}

export const ALL_UPGRADES: UpgradeDetails[] = [
  // Weapons
  {
    id: 'pulse_carbine',
    type: 'weapon',
    name: 'Pulse Carbine',
    iconName: 'Crosshair',
    accentColor: '#06b6d4',
    levels: [
      { level: 1, description: 'Rapid energy bolts fired toward nearest threats.' },
      { level: 2, description: 'Fires +1 additional projectile per burst.' },
      { level: 3, description: '+25% projectile damage and speed.' },
      { level: 4, description: 'Fires +1 additional projectile (3 total).' },
      { level: 5, description: '+40% attack rate and armor piercing.' },
    ],
  },
  {
    id: 'orbital_blades',
    type: 'weapon',
    name: 'Orbital Blades',
    iconName: 'Disc',
    accentColor: '#a855f7',
    levels: [
      { level: 1, description: 'Twin plasma blades revolving around your perimeter.' },
      { level: 2, description: 'Adds +1 blade and expands rotation orbit radius.' },
      { level: 3, description: '+30% blade rotation speed and base damage.' },
      { level: 4, description: 'Adds +1 blade (4 blades total) and knockback.' },
      { level: 5, description: 'Hyper-resonating blades disintegrate swarms on contact.' },
    ],
  },
  {
    id: 'tesla_coil',
    type: 'weapon',
    name: 'Tesla Chain Coil',
    iconName: 'Zap',
    accentColor: '#38bdf8',
    levels: [
      { level: 1, description: 'Crackling lightning arcs into 3 nearby enemies.' },
      { level: 2, description: 'Arcs jump to +2 additional targets (5 total).' },
      { level: 3, description: '+35% lightning damage and stun chance.' },
      { level: 4, description: 'Reduced cooldown between electrical discharges.' },
      { level: 5, description: 'Fires double lightning arcs that chain infinitely across clusters.' },
    ],
  },
  {
    id: 'seeker_missiles',
    type: 'weapon',
    name: 'Seeker Missiles',
    iconName: 'Rocket',
    accentColor: '#f43f5e',
    levels: [
      { level: 1, description: 'Launches spiral tracking rockets with explosive blast radius.' },
      { level: 2, description: '+1 missile per salvo and +20% blast area.' },
      { level: 3, description: '+35% rocket impact damage.' },
      { level: 4, description: '+1 missile (3 total) with faster homing tracking.' },
      { level: 5, description: 'Thermal warheads ignite secondary cluster explosions.' },
    ],
  },
  {
    id: 'laser_lance',
    type: 'weapon',
    name: 'Laser Lance',
    iconName: 'Sun',
    accentColor: '#eab308',
    levels: [
      { level: 1, description: 'Fires a concentrated piercing laser beam through all enemies in a line.' },
      { level: 2, description: '+30% beam length and width.' },
      { level: 3, description: '+40% beam damage.' },
      { level: 4, description: 'Fires dual cross-lasers.' },
      { level: 5, description: 'Continuous hyper-frequency thermal beam melting bosses.' },
    ],
  },
  {
    id: 'cryo_mine',
    type: 'weapon',
    name: 'Cryo Mines',
    iconName: 'Snowflake',
    accentColor: '#67e8f9',
    levels: [
      { level: 1, description: 'Deploys proximity mines that detonate into freezing frost pulses.' },
      { level: 2, description: 'Enemies hit are slowed by 50% for 3 seconds.' },
      { level: 3, description: '+2 mines dropped simultaneously.' },
      { level: 4, description: '+40% blast radius and damage.' },
      { level: 5, description: 'Absolute Zero: enemies in epicenter are frozen solid.' },
    ],
  },

  // Passives
  {
    id: 'overclock',
    type: 'passive',
    name: 'Overclock Core',
    iconName: 'Gauge',
    accentColor: '#f59e0b',
    levels: [
      { level: 1, description: '+12% attack speed for all equipped weapons.' },
      { level: 2, description: '+24% total attack speed.' },
      { level: 3, description: '+36% total attack speed.' },
      { level: 4, description: '+48% total attack speed.' },
      { level: 5, description: '+60% max overclock rate.' },
    ],
  },
  {
    id: 'plasma_core',
    type: 'passive',
    name: 'Hollow-Point Plasma',
    iconName: 'Flame',
    accentColor: '#ef4444',
    levels: [
      { level: 1, description: '+15% damage bonus to all weapons.' },
      { level: 2, description: '+30% damage bonus.' },
      { level: 3, description: '+45% damage bonus.' },
      { level: 4, description: '+60% damage bonus.' },
      { level: 5, description: '+80% raw destructive output.' },
    ],
  },
  {
    id: 'gravity_magnet',
    type: 'passive',
    name: 'Gravity Attractor',
    iconName: 'Magnet',
    accentColor: '#8b5cf6',
    levels: [
      { level: 1, description: '+50% collection radius for XP gems and pickups.' },
      { level: 2, description: '+100% collection radius.' },
      { level: 3, description: '+160% collection radius.' },
      { level: 4, description: '+220% collection radius.' },
      { level: 5, description: 'Universal vacuum pulls gems across the screen.' },
    ],
  },
  {
    id: 'nano_hull',
    type: 'passive',
    name: 'Nano-Composite Hull',
    iconName: 'Shield',
    accentColor: '#10b981',
    levels: [
      { level: 1, description: '+25 Max HP and recovers 1 HP every 3 seconds.' },
      { level: 2, description: '+50 Max HP and recovers 2 HP every 3 seconds.' },
      { level: 3, description: '+75 Max HP and recovers 3 HP every 3 seconds.' },
      { level: 4, description: '+100 Max HP and recovers 4 HP every 3 seconds.' },
      { level: 5, description: '+150 Max HP and fast nanite self-repair.' },
    ],
  },
  {
    id: 'thruster_boots',
    type: 'passive',
    name: 'Vector Thrusters',
    iconName: 'Wind',
    accentColor: '#06b6d4',
    levels: [
      { level: 1, description: '+12% movement speed and maneuverability.' },
      { level: 2, description: '+24% movement speed.' },
      { level: 3, description: '+36% movement speed.' },
      { level: 4, description: '+48% movement speed.' },
      { level: 5, description: '+60% hyper-speed vector propulsion.' },
    ],
  },
  {
    id: 'subatomic_optics',
    type: 'passive',
    name: 'Sub-Atomic Optics',
    iconName: 'Maximize2',
    accentColor: '#ec4899',
    levels: [
      { level: 1, description: '+20% projectile size and area of effect.' },
      { level: 2, description: '+40% projectile size and area of effect.' },
      { level: 3, description: '+60% projectile size and area of effect.' },
      { level: 4, description: '+80% projectile size and area of effect.' },
      { level: 5, description: '+100% massive screen-clearing blast radiuses.' },
    ],
  },
];

export const MAP_SIZE = 3200; // Large 2D open arena
export const VICTORY_TIME_SECONDS = 360; // 6 minutes survival for victory
