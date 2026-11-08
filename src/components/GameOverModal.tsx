import React, { useEffect, useState } from 'react';
import { GameRunStats } from '../game/types.ts';
import confetti from 'canvas-confetti';
import { Trophy, Skull, RotateCcw, Home, Clock, Crosshair, Zap, Award } from 'lucide-react';
import { sound } from '../game/audio.ts';

interface GameOverModalProps {
  stats: GameRunStats;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ stats, onRestart, onQuitToTitle }) => {
  const [highScore, setHighScore] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  useEffect(() => {
    // Highscore management
    try {
      const stored = localStorage.getItem('neon_vanguard_highscore');
      const prevBest = stored ? parseInt(stored, 10) : 0;
      if (stats.score > prevBest) {
        localStorage.setItem('neon_vanguard_highscore', stats.score.toString());
        setHighScore(stats.score);
        setIsNewRecord(true);
      } else {
        setHighScore(prevBest);
      }
    } catch {
      // LocalStorage fallback
    }

    // Victory celebration fanfare & confetti
    if (stats.isVictory) {
      sound.playLevelUp();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#38bdf8', '#a855f7', '#fbbf24'],
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onRestart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stats, onRestart]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md select-none animate-in zoom-in-95 duration-200">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Banner Badge */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
            stats.isVictory
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
          }`}
        >
          {stats.isVictory ? <Trophy className="w-8 h-8" /> : <Skull className="w-8 h-8" />}
        </div>

        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-100 uppercase">
          {stats.isVictory ? 'SWARM OVERCOME!' : 'OPERATIVE FALLEN'}
        </h2>

        <p className="text-xs font-mono text-slate-400 mt-1 mb-6">
          {stats.isVictory
            ? 'Extraction beacon locked. All alien hordes neutralized.'
            : 'Vanguard suit breached. Telemetry recorded.'}
        </p>

        {/* Final Score Callout */}
        <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800 mb-6">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1">
            FINAL SCORE
          </div>
          <div className="text-3xl font-black font-mono text-cyan-400 tabular-nums">
            {stats.score.toLocaleString()}
          </div>
          {isNewRecord && (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400 mt-1">
              <Award className="w-3.5 h-3.5" />
              <span>NEW PERSONAL BEST!</span>
            </div>
          )}
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2.5 w-full mb-6 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Survived
            </span>
            <span className="font-bold text-slate-200 tabular-nums">
              {formatTime(stats.survivedTimeSeconds)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-rose-400" />
              Kills
            </span>
            <span className="font-bold text-rose-400 tabular-nums">{stats.totalKills}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Level
            </span>
            <span className="font-bold text-amber-400 tabular-nums">{stats.levelReached}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-purple-400" />
              Record
            </span>
            <span className="font-bold text-purple-400 tabular-nums">{highScore.toLocaleString()}</span>
          </div>
        </div>

        {stats.missionsCompletedThisRun && stats.missionsCompletedThisRun.length > 0 && (
          <div className="w-full p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 mb-5 text-left font-mono text-xs">
            <div className="text-emerald-400 font-bold mb-1">
              DAILY BOUNTIES COMPLETED (+{stats.bonusXpEarnedThisRun || 0} BONUS XP)
            </div>
            <div className="text-slate-300 text-[11px]">
              {stats.missionsCompletedThisRun.join(' · ')}
            </div>
          </div>
        )}

        {/* Primary CTA Buttons */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN (ENTER / SPACE)</span>
          </button>

          <button
            onClick={onQuitToTitle}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>RETURN TO TITLE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
