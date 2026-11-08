import React, { useEffect, useState } from 'react';
import { HEROES } from '../game/constants.ts';
import { HeroId } from '../game/types.ts';
import { Shield, Zap, Sparkles, Volume2, VolumeX, Play } from 'lucide-react';
import { sound } from '../game/audio.ts';

interface TitleScreenProps {
  onStartGame: (heroId: HeroId) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame }) => {
  const [selectedHero, setSelectedHero] = useState<HeroId>('vance');
  const [isMuted, setIsMuted] = useState(sound.isMuted);

  const heroList = Object.values(HEROES);
  const hero = HEROES[selectedHero];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [selectedHero, onStartGame, heroList]);

  const toggleSound = () => {
    const res = sound.toggleMute();
    setIsMuted(res);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-6 md:p-12 overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Background sci-fi atmospheric grid & glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56, 189, 248, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Header / Audio toggle */}
      <div className="relative z-10 flex items-center justify-between w-full">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400/80 tracking-wider">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
          <span>GLOBAL BULLET HEAVEN SURVIVAL</span>
        </div>

        <button
          onClick={toggleSound}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-xs text-slate-300 transition-colors"
          title="Toggle procedural audio"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          <span>{isMuted ? 'Muted' : 'Audio ON'}</span>
        </button>
      </div>

      {/* Centerpiece: Bespoke SVG Title Lockup & 30-40% Negative Space */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto max-w-4xl mx-auto w-full">
        {/* Inline SVG Title Lockup */}
        <div className="w-full max-w-xl mb-4">
          <svg viewBox="0 0 600 110" className="w-full h-auto drop-shadow-[0_0_24px_rgba(6,182,212,0.4)]">
            <defs>
              <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <text
              x="50%"
              y="60"
              textAnchor="middle"
              className="font-black text-5xl tracking-widest fill-transparent stroke-[1.5]"
              style={{ stroke: 'url(#neonGrad)' }}
            >
              NEON VANGUARD
            </text>
            <text
              x="50%"
              y="98"
              textAnchor="middle"
              className="font-mono text-xs uppercase tracking-[0.45em] fill-cyan-300 font-bold"
            >
              HORDE SURVIVOR · 60 FPS ROGUELITE
            </text>
          </svg>
        </div>

        {/* Hero Selector Tabs */}
        <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 md:p-6 shadow-2xl backdrop-blur-md mb-6">
          <div className="text-xs font-mono text-slate-400 mb-3 uppercase tracking-wider text-left">
            Select Operative
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {heroList.map((h) => {
              const isSelected = h.id === selectedHero;
              return (
                <button
                  key={h.id}
                  onClick={() => setSelectedHero(h.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: h.avatarColor, color: '#030712' }}
                  >
                    {h.name.charAt(0)}
                  </div>
                  <div className="font-semibold text-xs truncate text-slate-100">{h.name.split(' ')[0]}</div>
                </button>
              );
            })}
          </div>

          {/* Active Hero Details */}
          <div className="text-left bg-slate-950/80 rounded-xl p-4 border border-slate-800/80">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-base text-slate-100">{hero.name}</span>
              <span className="text-xs font-mono text-cyan-400">{hero.title}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">{hero.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 p-2 rounded bg-slate-900/70 border border-slate-800 text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{hero.passiveDescription}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-slate-900/70 border border-slate-800 text-slate-300">
                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">Special: {hero.specialAbility}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Start Game CTA */}
        <button
          onClick={() => onStartGame(selectedHero)}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-base text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-300 hover:from-cyan-300 hover:to-sky-200 shadow-[0_0_25px_rgba(6,182,212,0.5)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>DEPLOY OPERATIVE</span>
        </button>
      </div>

      {/* Flat Control-Hint Line (per Guidelines) */}
      <div className="relative z-10 w-full text-center text-xs font-mono text-slate-500 py-2 border-t border-slate-900">
        WASD / Arrows Move · Space / Shift Dash · E Special · Esc Pause · Enter Start
      </div>
    </div>
  );
};
