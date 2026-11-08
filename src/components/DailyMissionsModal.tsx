import React, { useState } from 'react';
import { EXCLUSIVE_RELICS, equipExclusiveRelic, loadProgression } from '../game/missions.ts';
import { ExclusiveRelicId, PlayerProgression } from '../game/types.ts';
import { Target, CheckCircle2, Lock, Sparkles, Shield, Zap, Magnet, Heart, X, Award } from 'lucide-react';

interface DailyMissionsModalProps {
  progression: PlayerProgression;
  onUpdateProgression: (prog: PlayerProgression) => void;
  onClose: () => void;
}

const renderRelicIcon = (id: ExclusiveRelicId, color: string) => {
  const props = { className: 'w-5 h-5 shrink-0', style: { color } };
  switch (id) {
    case 'chrono_core':
      return <Zap {...props} />;
    case 'vampiric_siphon':
      return <Heart {...props} />;
    case 'quantum_attractor':
      return <Magnet {...props} />;
    case 'aegis_matrix':
      return <Shield {...props} />;
  }
};

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  progression,
  onUpdateProgression,
  onClose,
}) => {
  const [tab, setTab] = useState<'missions' | 'relics'>('missions');

  const handleEquipRelic = (relicId: ExclusiveRelicId) => {
    const nextId = progression.equippedRelic === relicId ? null : relicId;
    const updated = equipExclusiveRelic(nextId);
    onUpdateProgression({ ...updated });
  };

  const completedTodayCount = progression.missions.filter((m) => m.completed).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm select-none"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-left flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Target className="w-4 h-4" />
              <span>DAILY OPERATIONS · {progression.dateKey}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">
              Vanguard Bounties & Exclusive Relics
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right font-mono text-xs">
              <div className="text-slate-400">SHARDS</div>
              <div className="font-bold text-amber-400 tabular-nums">
                {progression.vanguardShards.toLocaleString()}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4">
          <button
            onClick={() => setTab('missions')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'missions'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily Missions ({completedTodayCount}/{progression.missions.length})
          </button>
          <button
            onClick={() => setTab('relics')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'relics'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Exclusive Relics ({progression.unlockedRelics.length}/4 Unlocked)
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto space-y-3 pr-1">
          {tab === 'missions' ? (
            <>
              <p className="text-xs text-slate-400 mb-2">
                Complete daily combat objectives during any run to receive instant in-run <strong>Bonus XP</strong> and unlock permanent <strong>Exclusive Relics</strong>.
              </p>

              {progression.missions.map((mission) => {
                const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
                const linkedRelic = mission.unlockRelicId
                  ? EXCLUSIVE_RELICS[mission.unlockRelicId]
                  : null;

                return (
                  <div
                    key={mission.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      mission.completed
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          {mission.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Target className="w-4 h-4 text-cyan-400 shrink-0" />
                          )}
                          <span className="font-bold text-sm text-slate-100">{mission.title}</span>
                          <span className="text-xs font-mono text-slate-500">·</span>
                          <span className="text-xs font-mono text-cyan-400">
                            +{mission.rewardXp} Bonus XP
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{mission.description}</p>
                      </div>

                      <div className="text-right font-mono text-xs shrink-0 tabular-nums">
                        <div className={mission.completed ? 'text-emerald-400 font-bold' : 'text-slate-200 font-bold'}>
                          {mission.progress} / {mission.target}
                        </div>
                        <div className="text-[11px] text-amber-400 mt-0.5">
                          +{mission.rewardShards} Shards
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all duration-300 ${
                          mission.completed
                            ? 'bg-emerald-400'
                            : 'bg-gradient-to-r from-cyan-500 to-sky-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {linkedRelic && (
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                        <span>
                          Exclusive Unlock: <strong className="text-amber-300">{linkedRelic.name}</strong>
                        </span>
                        <span>{mission.completed ? 'UNLOCKED' : 'IN PROGRESS'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-2">
                Equip 1 unlocked <strong>Exclusive Relic</strong> before deploying to supercharge your operative across the entire run. Total Missions Completed: <strong className="text-cyan-400 font-mono tabular-nums">{progression.totalMissionsCompleted}</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(EXCLUSIVE_RELICS).map((relic) => {
                  const isUnlocked = progression.unlockedRelics.includes(relic.id);
                  const isEquipped = progression.equippedRelic === relic.id;

                  return (
                    <div
                      key={relic.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        isEquipped
                          ? 'bg-amber-950/25 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : isUnlocked
                          ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/40 border-slate-800/60 opacity-70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {isUnlocked ? (
                              renderRelicIcon(relic.id, relic.accentColor)
                            ) : (
                              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <span className="font-bold text-sm text-slate-100">{relic.name}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 mb-2">{relic.description}</p>
                        <div className="text-xs font-mono text-cyan-300 mb-3">
                          {relic.effectSummary}
                        </div>
                      </div>

                      {isUnlocked ? (
                        <button
                          onClick={() => handleEquipRelic(relic.id)}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                            isEquipped
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          {isEquipped ? 'EQUIPPED FOR RUN' : 'EQUIP RELIC'}
                        </button>
                      ) : (
                        <div className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-center text-[11px] font-mono text-slate-500">
                          Complete {relic.requiredMissionsCompleted} Daily Mission{relic.requiredMissionsCompleted > 1 ? 's' : ''} ({progression.totalMissionsCompleted}/{relic.requiredMissionsCompleted})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 transition-colors cursor-pointer"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
