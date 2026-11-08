import React, { useEffect, useState } from 'react';
import { ARENA_BACKDROP_URL, HEROES } from '../game/constants.ts';
import { EXCLUSIVE_RELICS, loadProgression } from '../game/missions.ts';
import { HeroId, PlayerProgression } from '../game/types.ts';
import { Zap, Sparkles, Volume2, VolumeX, Play, Target, Award, Heart, Gauge, Crosshair } from 'lucide-react';
import { sound } from '../game/audio.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { DailyMissionsModal } from './DailyMissionsModal.tsx';

interface TitleScreenProps {
  onStartGame: (heroId: HeroId) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame }) => {
  const [selectedHero, setSelectedHero] = useState<HeroId>('vance');
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  const [showMissionsModal, setShowMissionsModal] = useState<boolean>(false);
  const [backdropFailed, setBackdropFailed] = useState<boolean>(false);
  const [failedPortraits, setFailedPortraits] = useState<Record<string, boolean>>({});

  const heroList = Object.values(HEROES);
  const hero = HEROES[selectedHero];

  useEffect(() => {
    setProgression(loadProgression());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showMissionsModal) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartGame(selectedHero);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        const idx = heroList.findIndex((h) => h.id === selectedHero);
        setSelectedHero(heroList[(idx + 1) % heroList.length].id);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        const idx = heroList.findIndex((h) => h.id === selectedHero);
        setSelectedHero(heroList[(idx - 1 + heroList.length) % heroList.length].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHero, onStartGame, heroList, showMissionsModal]);

  const toggleSound = () => {
    const res = sound.toggleMute();
    setIsMuted(res);
  };

  const completedToday = progression.missions.filter((m) => m.completed).length;
  const equippedRelicDef = progression.equippedRelic
    ? EXCLUSIVE_RELICS[progression.equippedRelic]
    : null;

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 md:p-8 overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* High-Graphics Cinematic Arena Backdrop with Graceful Fallback */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#030712]">
        {!backdropFailed && (
          <img
            src={ARENA_BACKDROP_URL}
            alt="Neon Vanguard Cyber Arena"
            referrerPolicy="no-referrer"
            onError={() => setBackdropFailed(true)}
            className="w-full h-full object-cover object-center opacity-45 scale-105 transition-transform duration-700"
          />
        )}
        {/* Multi-layered directional scrims for guaranteed text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(6,182,212,0.16),transparent_65%)]" />
      </div>

      {/* Top Navigation & Quick Actions */}
      <div className="relative z-10 flex items-center justify-between w-full gap-4">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400/90 tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          <span>NEON VANGUARD · ADAPTIVE SWARM ENGINE</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowMissionsModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-amber-500/50 bg-slate-900/90 hover:bg-amber-950/60 text-xs font-mono font-semibold text-amber-300 transition-all cursor-pointer shadow-lg"
            title="Daily Missions & Exclusive Relics"
          >
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span className="whitespace-nowrap tabular-nums">
              Daily Bounties ({completedToday}/{progression.missions.length})
            </span>
            {equippedRelicDef && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-cyan-300 hidden sm:inline">{equippedRelicDef.name}</span>
              </>
            )}
          </button>

          <PWAInstallButton />

          <button
            onClick={toggleSound}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-xs text-slate-300 transition-colors cursor-pointer shadow-lg"
            title="Toggle procedural audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            <span className="whitespace-nowrap hidden sm:inline">{isMuted ? 'Muted' : 'Audio ON'}</span>
          </button>
        </div>
      </div>

      {/* Centerpiece: Clean High-Graphics Operative Showcase */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto max-w-5xl mx-auto w-full gap-4">
        {/* Bespoke SVG Title Lockup */}
        <div className="w-full max-w-md text-center">
          <svg viewBox="0 0 600 96" className="w-full h-auto drop-shadow-[0_0_28px_rgba(6,182,212,0.45)]">
            <defs>
              <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <text
              x="50%"
              y="52"
              textAnchor="middle"
              className="font-black text-5xl tracking-widest fill-slate-950/60 stroke-[2]"
              style={{ stroke: 'url(#neonGrad)' }}
            >
              NEON VANGUARD
            </text>
            <text
              x="50%"
              y="84"
              textAnchor="middle"
              className="font-mono text-[11px] uppercase tracking-[0.42em] fill-cyan-300 font-bold"
            >
              HORDE SURVIVOR · ADAPTIVE COMBAT EDITION
            </text>
          </svg>
        </div>

        {/* 4 High-Graphics Portrait Cards */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {heroList.map((h) => {
            const isSelected = h.id === selectedHero;
            const imgFailed = failedPortraits[h.id];
            return (
              <button
                key={h.id}
                onClick={() => setSelectedHero(h.id)}
                className={`group relative rounded-2xl overflow-hidden border text-left transition-all duration-200 cursor-pointer flex flex-col justify-end h-40 md:h-48 ${
                  isSelected
                    ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-[0_0_25px_rgba(6,182,212,0.35)] scale-[1.02]'
                    : 'border-slate-800/90 hover:border-slate-600 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Portrait Artwork */}
                <div
                  className="absolute inset-0 bg-slate-900"
                  style={{
                    backgroundImage: `radial-gradient(circle at 50% 30%, ${h.avatarColor}44, #020617 80%)`,
                  }}
                >
                  {!imgFailed ? (
                    <img
                      src={h.portraitUrl}
                      alt={h.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedPortraits((prev) => ({ ...prev, [h.id]: true }))
                      }
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span
                        className="text-4xl font-black"
                        style={{ color: h.avatarColor }}
                      >
                        {h.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
                </div>

                {/* Top Corner Selection Indicator */}
                <div className="relative z-10 p-2.5 mb-auto flex items-center justify-between w-full">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: h.avatarColor,
                      boxShadow: `0 0 10px ${h.avatarColor}`,
                    }}
                  />
                  {isSelected && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300 bg-slate-950/90 px-2 py-0.5 rounded border border-cyan-500/40">
                      READY
                    </span>
                  )}
                </div>

                {/* Bottom Card Name & Class */}
                <div className="relative z-10 p-3 w-full">
                  <div className="font-bold text-sm md:text-base text-white leading-tight truncate">
                    {h.name}
                  </div>
                  <div className="text-[11px] font-mono text-cyan-300/90 truncate">
                    {h.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Operative Spotlight Panel */}
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 text-left space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base md:text-lg font-extrabold text-white">
                {hero.name}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                {hero.title}
              </span>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-300 tabular-nums">
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-emerald-400" />
                  {hero.baseMaxHp} HP
                </span>
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-sky-400" />
                  {hero.baseSpeed} SPD
                </span>
                <span className="flex items-center gap-1 uppercase text-rose-300">
                  <Crosshair className="w-3.5 h-3.5 text-rose-400" />
                  {hero.startingWeapon.replace('_', ' ')}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              {hero.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{hero.passiveDescription}</span>
              </div>
              <span className="text-slate-600 hidden md:inline">·</span>
              <div className="flex items-center gap-1.5 text-cyan-300">
                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>ULT (E): {hero.specialAbility}</span>
              </div>
            </div>
          </div>

          {/* Primary Launch CTA & Relic Quick Access */}
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center justify-center gap-2.5 shrink-0">
            <button
              onClick={() => onStartGame(selectedHero)}
              className="group relative inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl font-black text-sm md:text-base text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-300 hover:from-cyan-300 hover:to-sky-200 shadow-[0_0_25px_rgba(6,182,212,0.55)] hover:shadow-[0_0_35px_rgba(6,182,212,0.85)] transition-all transform hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>DEPLOY OPERATIVE</span>
            </button>

            <button
              onClick={() => setShowMissionsModal(true)}
              className="py-1.5 px-3 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Relics ({progression.unlockedRelics.length}/4) & Daily Bounties →
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Flat Control-Hint Line */}
      <div className="relative z-10 w-full text-center text-xs font-mono text-slate-400/80 py-1.5 border-t border-slate-900/80">
        WASD / Arrows Move · Space / Shift Dash · E Special · Esc Pause · Enter Deploy
      </div>

      {showMissionsModal && (
        <DailyMissionsModal
          progression={progression}
          onUpdateProgression={setProgression}
          onClose={() => setShowMissionsModal(false)}
        />
      )}
    </div>
  );
};
