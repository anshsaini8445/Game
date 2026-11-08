import React from 'react';
import { HeroDef, PassiveId, WeaponId } from '../game/types.ts';
import { Play, RotateCcw, Home, Volume2, VolumeX, Shield, Crosshair } from 'lucide-react';
import { sound } from '../game/audio.ts';

interface PauseModalProps {
  hero: HeroDef;
  time: number;
  kills: number;
  weapons: { id: WeaponId; level: number }[];
  passives: { id: PassiveId; level: number }[];
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  hero,
  time,
  kills,
  weapons,
  passives,
  onResume,
  onRestart,
  onQuitToTitle,
  isMuted,
  onToggleMute,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
        <h2 className="text-xl font-bold font-mono tracking-widest text-slate-100 uppercase mb-1">
          TACTICAL PAUSE
        </h2>
        <div className="text-xs text-slate-400 font-mono mb-6">
          Operative: <span className="text-cyan-400">{hero.name}</span>
        </div>

        {/* Current Run Metrics */}
        <div className="grid grid-cols-2 gap-3 w-full mb-6 text-center font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 mb-0.5">SURVIVAL TIME</div>
            <div className="text-base font-bold text-slate-200 tabular-nums">{formatTime(time)}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 mb-0.5">ELIMINATIONS</div>
            <div className="text-base font-bold text-rose-400 tabular-nums">{kills}</div>
          </div>
        </div>

        {/* Loadout overview */}
        <div className="w-full bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 mb-6">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
            Active Loadout
          </div>
          <div className="flex flex-wrap gap-2">
            {weapons.map((w) => (
              <span
                key={w.id}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300"
              >
                {w.id.replace('_', ' ')} Lv.{w.level}
              </span>
            ))}
            {passives.map((p) => (
              <span
                key={p.id}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-300"
              >
                {p.id.replace('_', ' ')} Lv.{p.level}
              </span>
            ))}
          </div>
        </div>

        {/* Audio Toggle */}
        <button
          onClick={onToggleMute}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors w-full justify-center mb-6 cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          <span>Audio: {isMuted ? 'Muted' : 'Sound ON'}</span>
        </button>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>RESUME MISSION (ESC)</span>
          </button>

          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESTART RUN</span>
          </button>

          <button
            onClick={onQuitToTitle}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>QUIT TO TITLE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
