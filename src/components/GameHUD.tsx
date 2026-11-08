import React, { useState } from 'react';
import { DailyMission, ExclusiveRelicDef, ExclusiveRelicId, HeroDef, PassiveId, WeaponId } from '../game/types.ts';
import { EXCLUSIVE_RELICS } from '../game/missions.ts';
import {
  Pause,
  Volume2,
  VolumeX,
  Zap,
  Shield,
  Crosshair,
  Disc,
  Rocket,
  Sun,
  Snowflake,
  Gauge,
  Flame,
  Magnet,
  Wind,
  Maximize2,
  Target,
  CheckCircle2,
  Award,
  Activity,
} from 'lucide-react';

interface GameHUDProps {
  stats: {
    hp: number;
    maxHp: number;
    level: number;
    xp: number;
    xpToNext: number;
    time: number;
    kills: number;
    threatMultiplier?: number;
    threatTier?: string;
    weapons: { id: WeaponId; level: number }[];
    passives: { id: PassiveId; level: number }[];
    dashReady: boolean;
    dashCooldownProgress: number;
    boss?: { name: string; hp: number; maxHp: number };
    missions?: DailyMission[];
    equippedRelic?: ExclusiveRelicId | null;
  };
  hero: HeroDef;
  missionBanner: { mission: DailyMission; unlockedRelics: ExclusiveRelicDef[] } | null;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onTriggerDash: () => void;
  onTriggerSpecial: () => void;
}

const renderUpgradeIcon = (id: string) => {
  switch (id) {
    case 'pulse_carbine':
      return <Crosshair className="w-4 h-4 text-cyan-400" />;
    case 'orbital_blades':
      return <Disc className="w-4 h-4 text-purple-400" />;
    case 'tesla_coil':
      return <Zap className="w-4 h-4 text-sky-400" />;
    case 'seeker_missiles':
      return <Rocket className="w-4 h-4 text-rose-400" />;
    case 'laser_lance':
      return <Sun className="w-4 h-4 text-yellow-400" />;
    case 'cryo_mine':
      return <Snowflake className="w-4 h-4 text-cyan-200" />;
    case 'overclock':
      return <Gauge className="w-4 h-4 text-amber-400" />;
    case 'plasma_core':
      return <Flame className="w-4 h-4 text-red-400" />;
    case 'gravity_magnet':
      return <Magnet className="w-4 h-4 text-indigo-400" />;
    case 'nano_hull':
      return <Shield className="w-4 h-4 text-emerald-400" />;
    case 'thruster_boots':
      return <Wind className="w-4 h-4 text-cyan-300" />;
    case 'subatomic_optics':
      return <Maximize2 className="w-4 h-4 text-pink-400" />;
    default:
      return <Zap className="w-4 h-4 text-cyan-400" />;
  }
};

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  hero,
  missionBanner,
  onPause,
  isMuted,
  onToggleMute,
  onTriggerDash,
  onTriggerSpecial,
}) => {
  const [portraitFailed, setPortraitFailed] = useState(false);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const xpPercent = Math.min(100, Math.max(0, (stats.xp / Math.max(1, stats.xpToNext)) * 100));
  const hpPercent = Math.min(100, Math.max(0, (stats.hp / Math.max(1, stats.maxHp)) * 100));
  const activeRelic = stats.equippedRelic ? EXCLUSIVE_RELICS[stats.equippedRelic] : null;

  const threatMult = stats.threatMultiplier ?? 1.0;
  const threatTier = stats.threatTier ?? 'STABLE';

  const getThreatColor = (tier: string) => {
    switch (tier) {
      case 'OVERDRIVE':
        return 'text-fuchsia-400 border-fuchsia-500/50';
      case 'CRITICAL':
        return 'text-rose-400 border-rose-500/50';
      case 'HIGH':
        return 'text-amber-400 border-amber-500/50';
      case 'ELEVATED':
        return 'text-sky-400 border-sky-500/40';
      default:
        return 'text-emerald-400 border-slate-800';
    }
  };

  // Pick next incomplete daily mission to display unobtrusively
  const activeMission = stats.missions?.find((m) => !m.completed) || stats.missions?.[0];

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 md:p-5 z-20">
      {/* Top Status Perimeter */}
      <div className="w-full flex flex-col gap-2">
        {/* Full-width slim XP bar at top edge */}
        <div className="w-full bg-slate-900/95 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-150"
            style={{ width: `${xpPercent}%` }}
          />
        </div>

        <div className="flex items-start justify-between gap-2">
          {/* Left Cluster: Core Telemetry + Adaptive Threat Director */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono tabular-nums text-slate-200 shadow-lg flex items-center">
              <span className="text-cyan-400 font-bold">LVL {stats.level}</span>
              <span className="text-slate-600 mx-2">·</span>
              <span className="font-bold text-white">{formatTime(stats.time)}</span>
              <span className="text-slate-600 mx-2">·</span>
              <span className="text-rose-400 font-bold">{stats.kills}</span>
              <span className="text-slate-500 text-[10px] ml-1">KILLS</span>
            </div>

            {/* Adaptive Swarm Threat Indicator */}
            <div
              className={`px-2.5 py-1.5 rounded-xl bg-slate-950/90 border text-[11px] font-mono tabular-nums shadow-lg flex items-center gap-1.5 ${getThreatColor(
                threatTier
              )}`}
              title="Adaptive Enemy Spawn Intensity (scales with Kill Velocity & Time)"
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span className="font-bold">SWARM {threatMult.toFixed(1)}x</span>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <span className="hidden sm:inline font-semibold">{threatTier}</span>
            </div>

            {activeRelic && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-amber-500/40 text-[11px] font-mono text-amber-300 shadow-lg">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>{activeRelic.name}</span>
              </div>
            )}

            {/* Single-line Unobtrusive Active Bounty Pill-Free Readout */}
            {activeMission && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-800/90 text-[11px] font-mono tabular-nums text-slate-300">
                {activeMission.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                <span className="truncate max-w-[180px]">{activeMission.title}</span>
                <span className="text-slate-600">·</span>
                <span className={activeMission.completed ? 'text-emerald-400 font-bold' : 'text-cyan-400 font-bold'}>
                  {activeMission.progress}/{activeMission.target}
                </span>
              </div>
            )}
          </div>

          {/* Center Cluster: Active Boss Health Bar OR Mission Complete Banner */}
          <div className="flex flex-col items-center max-w-xs md:max-w-md w-full px-2">
            {stats.boss && (
              <div className="w-full flex flex-col items-center mb-1.5">
                <div className="text-[11px] font-mono font-bold text-rose-400 tracking-wider uppercase mb-0.5">
                  ⚠ {stats.boss.name}
                </div>
                <div className="w-full bg-slate-950/95 h-3 rounded-full border border-rose-500/60 overflow-hidden shadow-[0_0_12px_rgba(239,68,68,0.4)]">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all"
                    style={{ width: `${(stats.boss.hp / stats.boss.maxHp) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {missionBanner && (
              <div className="px-4 py-2 rounded-xl bg-slate-950/95 border border-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.35)] text-center animate-in fade-in duration-150">
                <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                  DAILY BOUNTY COMPLETED
                </div>
                <div className="text-xs font-bold text-slate-100 mt-0.5">
                  {missionBanner.mission.title} · +{missionBanner.mission.rewardXp} BONUS XP
                </div>
                {missionBanner.unlockedRelics.length > 0 && (
                  <div className="text-[11px] font-mono text-amber-300 mt-0.5">
                    Unlocked Relic: {missionBanner.unlockedRelics.map((r) => r.name).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Cluster: Audio & Pause Controls */}
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-300 transition-colors cursor-pointer shadow-lg"
              title="Toggle Audio"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
            <button
              onClick={onPause}
              className="p-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-300 transition-colors cursor-pointer shadow-lg"
              title="Pause Game (Esc)"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Perimeter */}
      <div className="w-full flex items-end justify-between">
        {/* Bottom Left: High-Graphics Operative Badge, HP & Ability Triggers */}
        <div className="flex flex-col gap-2 max-w-xs w-full">
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-2.5 shadow-xl flex items-center gap-3">
            {/* Hero Portrait Avatar */}
            <div
              className="w-11 h-11 rounded-xl overflow-hidden border border-cyan-500/40 shrink-0 bg-slate-900 flex items-center justify-center"
              style={{ boxShadow: `0 0 12px ${hero.avatarColor}33` }}
            >
              {!portraitFailed ? (
                <img
                  src={hero.portraitUrl}
                  alt={hero.name}
                  referrerPolicy="no-referrer"
                  onError={() => setPortraitFailed(true)}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <span className="font-bold text-sm" style={{ color: hero.avatarColor }}>
                  {hero.name.charAt(0)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1">
                <span className="font-bold text-slate-100 truncate">{hero.name}</span>
                <span className="text-emerald-400 font-bold">
                  {stats.hp}/{stats.maxHp}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-150 ${
                    hpPercent < 25
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                      : hpPercent < 50
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tactile Ability Triggers */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onTriggerDash}
              disabled={!stats.dashReady}
              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                stats.dashReady
                  ? 'border-cyan-400/80 bg-slate-950/90 hover:bg-cyan-950/80 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)] active:scale-95'
                  : 'border-slate-800 bg-slate-950/70 text-slate-500 opacity-60'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span>DASH (SPACE)</span>
            </button>

            <button
              onClick={onTriggerSpecial}
              className="py-2 px-3 rounded-xl border border-amber-500/80 bg-slate-950/90 hover:bg-amber-950/80 text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.2)]"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>ULT (E)</span>
            </button>
          </div>
        </div>

        {/* Bottom Right: Compact Arsenal Inventory */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {stats.weapons.map((w) => (
              <div
                key={w.id}
                className="relative p-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-center shadow-lg"
                title={`${w.id} Lv.${w.level}`}
              >
                {renderUpgradeIcon(w.id)}
                <span className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold bg-cyan-400 text-slate-950 rounded px-1 tabular-nums">
                  {w.level}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {stats.passives.map((p) => (
              <div
                key={p.id}
                className="relative p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center shadow-lg"
                title={`${p.id} Lv.${p.level}`}
              >
                {renderUpgradeIcon(p.id)}
                <span className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold bg-amber-400 text-slate-950 rounded px-1 tabular-nums">
                  {p.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
