import React, { useEffect } from 'react';
import { UpgradeOption } from '../game/types.ts';
import { Crosshair, Disc, Zap, Rocket, Sun, Snowflake, Gauge, Flame, Magnet, Shield, Wind, Maximize2, Sparkles } from 'lucide-react';

interface LevelUpModalProps {
  options: UpgradeOption[];
  onSelect: (id: UpgradeOption['id']) => void;
}

const renderUpgradeIcon = (id: string, color: string) => {
  const props = { className: 'w-7 h-7', style: { color } };
  switch (id) {
    case 'pulse_carbine':
      return <Crosshair {...props} />;
    case 'orbital_blades':
      return <Disc {...props} />;
    case 'tesla_coil':
      return <Zap {...props} />;
    case 'seeker_missiles':
      return <Rocket {...props} />;
    case 'laser_lance':
      return <Sun {...props} />;
    case 'cryo_mine':
      return <Snowflake {...props} />;
    case 'overclock':
      return <Gauge {...props} />;
    case 'plasma_core':
      return <Flame {...props} />;
    case 'gravity_magnet':
      return <Magnet {...props} />;
    case 'nano_hull':
      return <Shield {...props} />;
    case 'thruster_boots':
      return <Wind {...props} />;
    case 'subatomic_optics':
      return <Maximize2 {...props} />;
    default:
      return <Sparkles {...props} />;
  }
};

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ options, onSelect }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' && options[0]) onSelect(options[0].id);
      if (e.key === '2' && options[1]) onSelect(options[1].id);
      if (e.key === '3' && options[2]) onSelect(options[2].id);
      if (e.key === '4' && options[3]) onSelect(options[3].id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, onSelect]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="max-w-2xl w-full flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase mb-1">
            <Sparkles className="w-4 h-4" />
            LEVEL UP REACHED
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
            SELECT SYSTEM UPGRADE
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Press [1], [2], or [3] or click a card to install
          </p>
        </div>

        {/* Upgrade Cards List */}
        <div className="grid grid-cols-1 gap-3.5 w-full">
          {options.map((opt, idx) => {
            const isNew = opt.currentLevel === 0;
            return (
              <button
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                className="group relative flex items-center justify-between p-4 md:p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-400/80 shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-left cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Number key badge & Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center border border-slate-700/60 bg-slate-950/80 shrink-0"
                    style={{ borderColor: `${opt.accentColor}50` }}
                  >
                    {renderUpgradeIcon(opt.id, opt.accentColor)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {opt.name}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {opt.type}
                      </span>
                      {isNew ? (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          NEW
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-cyan-400">
                          Lv.{opt.currentLevel} → Lv.{opt.currentLevel + 1}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </div>

                {/* Keyboard shortcut hint */}
                <div className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-400 group-hover:text-cyan-300 group-hover:border-cyan-500/50 transition-colors">
                  {idx + 1}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
