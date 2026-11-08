import React from 'react';
import { HeroDef, PassiveId, WeaponId } from '../game/types.ts';
import { ALL_UPGRADES } from '../game/constants.ts';
import { Pause, Volume2, VolumeX, Zap, Shield, Crosshair, Disc, Rocket, Sun, Snowflake, Gauge, Flame, Magnet, Wind, Maximize2 } from 'lucide-react';
import { sound } from '../game/audio.ts';

interface GameHUDProps {
  stats: {
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
  };
  hero: HeroDef;
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
  onPause,
  isMuted,
  onToggleMute,
  onTriggerDash,
  onTriggerSpecial,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const xpPercent = Math.min(100, Math.max(0, (stats.xp / Math.max(1, stats.xpToNext)) * 100));
  const hpPercent = Math.min(100, Math.max(0, (stats.hp / Math.max(1, stats.maxHp)) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 md:p-6 z-20">
      {/* Top Status Perimeter */}
      <div className="w-full flex flex-col gap-2">
        {/* Full-width slim XP bar at top edge */}
        <div className="w-full bg-slate-900/90 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-150"
            style={{ width: `${xpPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Left Cluster: Level & Stats */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono tabular-nums text-slate-200 shadow-md">
              <span className="text-cyan-400 font-bold">LVL {stats.level}</span>
              <span className="text-slate-500 mx-1.5">·</span>
              <span>{formatTime(stats.time)}</span>
              <span className="text-slate-500 mx-1.5">·</span>
              <span className="text-rose-400 font-bold">{stats.kills}</span>
              <span className="text-slate-500 text-[10px] ml-1">KILLS</span>
            </div>
          </div>

          {/* Center Cluster: Active Boss Health Bar */}
          {stats.boss && (
            <div className="flex flex-col items-center max-w-xs md:max-w-md w-full px-2 animate-pulse">
              <div className="text-[11px] font-mono font-bold text-rose-400 tracking-wider uppercase mb-0.5">
                ⚠ {stats.boss.name}
              </div>
              <div className="w-full bg-slate-950/90 h-3 rounded-full border border-rose-500/50 overflow-hidden shadow-[0_0_12px_rgba(239,68,68,0.4)]">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all"
                  style={{ width: `${(stats.boss.hp / stats.boss.maxHp) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Right Cluster: Control Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Toggle Audio"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
            <button
              onClick={onPause}
              className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Pause Game (Esc)"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Perimeter */}
      <div className="w-full flex items-end justify-between">
        {/* Bottom Left: Health & Ability Cluster */}
        <div className="flex flex-col gap-2 max-w-xs w-full">
          {/* Health Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-lg">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1">
              <span className="font-bold text-slate-200">{hero.name}</span>
              <span className="text-emerald-400">
                {stats.hp} / {stats.maxHp} HP
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
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

          {/* Action triggers for mobile / quick click */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onTriggerDash}
              disabled={!stats.dashReady}
              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                stats.dashReady
                  ? 'border-cyan-400/80 bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)] active:scale-95'
                  : 'border-slate-800 bg-slate-900/60 text-slate-500 opacity-60'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span>DASH (SPACE)</span>
            </button>

            <button
              onClick={onTriggerSpecial}
              className="py-2 px-3 rounded-xl border border-amber-500/80 bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>ULT (E)</span>
            </button>
          </div>
        </div>

        {/* Bottom Right: Arsenal Inventory (Weapons & Passives) */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {stats.weapons.map((w) => (
              <div
                key={w.id}
                className="relative p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-center shadow-md"
                title={`${w.id} Lv.${w.level}`}
              >
                {renderUpgradeIcon(w.id)}
                <span className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold bg-cyan-500 text-slate-950 rounded px-1">
                  {w.level}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {stats.passives.map((p) => (
              <div
                key={p.id}
                className="relative p-1.5 rounded-lg bg-slate-900/70 border border-slate-800/80 flex items-center justify-center shadow-md"
                title={`${p.id} Lv.${p.level}`}
              >
                {renderUpgradeIcon(p.id)}
                <span className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold bg-amber-500 text-slate-950 rounded px-1">
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
