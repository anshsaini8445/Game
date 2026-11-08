import {
  DailyMission,
  ExclusiveRelicDef,
  ExclusiveRelicId,
  MissionMetric,
  PlayerProgression,
} from './types.ts';

const STORAGE_KEY = 'neon_vanguard_daily_progression_v1';

export const EXCLUSIVE_RELICS: Record<ExclusiveRelicId, ExclusiveRelicDef> = {
  chrono_core: {
    id: 'chrono_core',
    name: 'Chrono-Accelerator Core',
    description: 'Ancient temporal overdrive unlocked through Vanguard Daily Operations.',
    effectSummary: '+20% Attack Speed & -25% Dash Cooldown',
    accentColor: '#06b6d4',
    requiredMissionsCompleted: 1,
  },
  vampiric_siphon: {
    id: 'vampiric_siphon',
    name: 'Crimson Nano-Siphon',
    description: 'Harvests bio-energy from eliminated swarm hostiles.',
    effectSummary: '+30 Max HP & Restore 2 HP every 15 Kills',
    accentColor: '#f43f5e',
    requiredMissionsCompleted: 2,
  },
  quantum_attractor: {
    id: 'quantum_attractor',
    name: 'Singularity Attractor',
    description: 'Warps local gravity to pull XP gems and amplify experience gain.',
    effectSummary: '+80% Magnet Radius & +25% XP Gain',
    accentColor: '#a855f7',
    requiredMissionsCompleted: 3,
  },
  aegis_matrix: {
    id: 'aegis_matrix',
    name: 'Aegis Sovereign Matrix',
    description: 'Elite Vanguard command plating forged from daily boss bounties.',
    effectSummary: '+25% All Weapon Damage, +15% Crit Chance & +3 Armor',
    accentColor: '#f59e0b',
    requiredMissionsCompleted: 5,
  },
};

interface MissionTemplate {
  key: string;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  rewardXp: number;
  rewardShards: number;
  unlockRelicId?: ExclusiveRelicId;
}

const MISSION_POOL: MissionTemplate[] = [
  {
    key: 'slayer_80',
    title: 'Swarm Purge',
    description: 'Eliminate 80 alien hostiles during runs today.',
    metric: 'kills',
    target: 80,
    rewardXp: 45,
    rewardShards: 100,
    unlockRelicId: 'chrono_core',
  },
  {
    key: 'gems_60',
    title: 'Crystal Harvester',
    description: 'Collect 60 XP Gems across your deployments.',
    metric: 'gems_collected',
    target: 60,
    rewardXp: 40,
    rewardShards: 100,
    unlockRelicId: 'vampiric_siphon',
  },
  {
    key: 'dash_12',
    title: 'Phase Evasion',
    description: 'Execute 12 Tactical Dashes while in combat.',
    metric: 'dashes_used',
    target: 12,
    rewardXp: 35,
    rewardShards: 90,
    unlockRelicId: 'chrono_core',
  },
  {
    key: 'survive_120',
    title: 'Frontline Endurance',
    description: 'Survive for 120 seconds in a single run.',
    metric: 'survive_seconds',
    target: 120,
    rewardXp: 60,
    rewardShards: 150,
    unlockRelicId: 'quantum_attractor',
  },
  {
    key: 'level_6',
    title: 'System Overclock',
    description: 'Reach Operative Level 6 during a run.',
    metric: 'reach_level',
    target: 6,
    rewardXp: 50,
    rewardShards: 125,
    unlockRelicId: 'vampiric_siphon',
  },
  {
    key: 'special_4',
    title: 'Ultimate Unleashed',
    description: 'Trigger your Hero Ultimate ability 4 times.',
    metric: 'specials_used',
    target: 4,
    rewardXp: 50,
    rewardShards: 120,
    unlockRelicId: 'quantum_attractor',
  },
  {
    key: 'boss_1',
    title: 'Titan Hunter',
    description: 'Neutralize 1 Mini-Boss or Dreadnought Overlord.',
    metric: 'boss_kills',
    target: 1,
    rewardXp: 90,
    rewardShards: 250,
    unlockRelicId: 'aegis_matrix',
  },
];

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashDateString(dateStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function generateDailyMissionsForDate(dateKey: string): DailyMission[] {
  const seed = hashDateString(dateKey);
  const pool = [...MISSION_POOL];
  const selected: MissionTemplate[] = [];

  // Always pick 3 distinct missions deterministically for the day
  for (let i = 0; i < 3; i++) {
    const idx = (seed + i * 7) % pool.length;
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return selected.map((tpl, i) => ({
    id: `${dateKey}_${tpl.key}_${i}`,
    title: tpl.title,
    description: tpl.description,
    metric: tpl.metric,
    target: tpl.target,
    progress: 0,
    completed: false,
    rewardXp: tpl.rewardXp,
    rewardShards: tpl.rewardShards,
    unlockRelicId: tpl.unlockRelicId,
  }));
}

export function loadProgression(): PlayerProgression {
  const today = getTodayDateKey();
  const fallback: PlayerProgression = {
    dateKey: today,
    missions: generateDailyMissionsForDate(today),
    totalMissionsCompleted: 0,
    vanguardShards: 0,
    unlockedRelics: [],
    equippedRelic: null,
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveProgression(fallback);
      return fallback;
    }

    const parsed = JSON.parse(raw) as PlayerProgression;
    // If the date has rolled over, generate fresh daily missions while keeping permanent unlocks
    if (parsed.dateKey !== today || !Array.isArray(parsed.missions) || parsed.missions.length === 0) {
      const updated: PlayerProgression = {
        ...parsed,
        dateKey: today,
        missions: generateDailyMissionsForDate(today),
        totalMissionsCompleted: parsed.totalMissionsCompleted || 0,
        vanguardShards: parsed.vanguardShards || 0,
        unlockedRelics: Array.isArray(parsed.unlockedRelics) ? parsed.unlockedRelics : [],
        equippedRelic: parsed.equippedRelic || null,
      };
      saveProgression(updated);
      return updated;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function saveProgression(prog: PlayerProgression): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
  } catch {
    // Ignore storage quota errors
  }
}

export function equipExclusiveRelic(relicId: ExclusiveRelicId | null): PlayerProgression {
  const prog = loadProgression();
  if (relicId === null || prog.unlockedRelics.includes(relicId)) {
    prog.equippedRelic = relicId;
    saveProgression(prog);
  }
  return prog;
}

export function updateMissionProgress(
  metric: MissionMetric,
  amount: number,
  mode: 'increment' | 'max' = 'increment'
): {
  progression: PlayerProgression;
  newlyCompleted: DailyMission[];
  newlyUnlockedRelics: ExclusiveRelicDef[];
} {
  const prog = loadProgression();
  const newlyCompleted: DailyMission[] = [];
  const newlyUnlockedRelics: ExclusiveRelicDef[] = [];

  let changed = false;

  for (const mission of prog.missions) {
    if (mission.completed || mission.metric !== metric) continue;

    const prevProgress = mission.progress;
    if (mode === 'increment') {
      mission.progress = Math.min(mission.target, mission.progress + amount);
    } else {
      mission.progress = Math.min(mission.target, Math.max(mission.progress, amount));
    }

    if (mission.progress !== prevProgress) {
      changed = true;
    }

    if (mission.progress >= mission.target && !mission.completed) {
      mission.completed = true;
      prog.totalMissionsCompleted += 1;
      prog.vanguardShards += mission.rewardShards;
      newlyCompleted.push({ ...mission });
      changed = true;

      // Check if mission directly unlocks a relic or if milestone unlocks a relic
      for (const relic of Object.values(EXCLUSIVE_RELICS)) {
        const shouldUnlock =
          (mission.unlockRelicId === relic.id ||
            prog.totalMissionsCompleted >= relic.requiredMissionsCompleted) &&
          !prog.unlockedRelics.includes(relic.id);

        if (shouldUnlock) {
          prog.unlockedRelics.push(relic.id);
          if (!prog.equippedRelic) {
            prog.equippedRelic = relic.id;
          }
          newlyUnlockedRelics.push(relic);
        }
      }
    }
  }

  if (changed) {
    saveProgression(prog);
  }

  return {
    progression: prog,
    newlyCompleted,
    newlyUnlockedRelics,
  };
}
