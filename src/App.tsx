/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine.ts';
import { HEROES } from './game/constants.ts';
import {
  GameRunStats,
  GameScreen,
  HeroDef,
  HeroId,
  PassiveId,
  UpgradeOption,
  WeaponId,
} from './game/types.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { GameHUD } from './components/GameHUD.tsx';
import { LevelUpModal } from './components/LevelUpModal.tsx';
import { PauseModal } from './components/PauseModal.tsx';
import { GameOverModal } from './components/GameOverModal.tsx';
import { VirtualJoystick } from './components/VirtualJoystick.tsx';
import { sound } from './game/audio.ts';

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const [selectedHeroId, setSelectedHeroId] = useState<HeroId>('vance');
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted);

  // Upgrade modal state
  const [levelUpOptions, setLevelUpOptions] = useState<UpgradeOption[]>([]);

  // End run stats
  const [runStats, setRunStats] = useState<GameRunStats | null>(null);

  // HUD stats state
  const [hudStats, setHudStats] = useState<{
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
  }>({
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 10,
    time: 0,
    kills: 0,
    weapons: [{ id: 'pulse_carbine', level: 1 }],
    passives: [],
    dashReady: true,
    dashCooldownProgress: 1,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Start new game run
  const startGame = useCallback((heroId: HeroId) => {
    setSelectedHeroId(heroId);
    setScreen('PLAYING');

    setTimeout(() => {
      if (!canvasRef.current) return;

      // Clean up any old engine instance
      if (engineRef.current) {
        engineRef.current.destroy();
      }

      const engine = new GameEngine(canvasRef.current, heroId, {
        onLevelUp: (options) => {
          setLevelUpOptions(options);
          setScreen('LEVEL_UP');
        },
        onGameOver: (stats) => {
          setRunStats(stats);
          setScreen('GAME_OVER');
        },
        onVictory: (stats) => {
          setRunStats(stats);
          setScreen('VICTORY');
        },
        onStatsUpdate: (stats) => {
          setHudStats(stats);
        },
      });

      engineRef.current = engine;
      engine.start();
    }, 20);
  }, []);

  // Handle Level-Up upgrade selection
  const handleSelectUpgrade = (upgradeId: UpgradeOption['id']) => {
    if (engineRef.current) {
      engineRef.current.applyUpgrade(upgradeId);
    }
    setScreen('PLAYING');
  };

  // Pause / Resume handlers
  const handlePause = () => {
    if (screen === 'PLAYING') {
      engineRef.current?.pause();
      setScreen('PAUSED');
    }
  };

  const handleResume = () => {
    if (screen === 'PAUSED') {
      engineRef.current?.resume();
      setScreen('PLAYING');
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    startGame(selectedHeroId);
  };

  const handleQuitToTitle = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setScreen('TITLE');
  };

  const handleToggleMute = () => {
    const res = sound.toggleMute();
    setIsMuted(res);
  };

  const handleTriggerDash = () => {
    engineRef.current?.triggerDash();
  };

  const handleTriggerSpecial = () => {
    engineRef.current?.triggerSpecial();
  };

  // Keyboard shortcut for Escape pause
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (screen === 'PLAYING') {
          handlePause();
        } else if (screen === 'PAUSED') {
          handleResume();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [screen]);

  // Clean up engine on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  const hero = HEROES[selectedHeroId] || HEROES.vance;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Title Screen View */}
      {screen === 'TITLE' && <TitleScreen onStartGame={startGame} />}

      {/* Persistent Canvas for Active Gameplay */}
      <div
        className={`absolute inset-0 w-full h-full ${
          screen === 'TITLE' ? 'hidden pointer-events-none' : 'block'
        }`}
      >
        <canvas ref={canvasRef} className="w-full h-full block bg-slate-950" />

        {/* Low-Occlusion In-Game HUD */}
        {(screen === 'PLAYING' || screen === 'LEVEL_UP' || screen === 'PAUSED') && (
          <GameHUD
            stats={hudStats}
            hero={hero}
            onPause={handlePause}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onTriggerDash={handleTriggerDash}
            onTriggerSpecial={handleTriggerSpecial}
          />
        )}

        {/* Mobile touch Virtual Joystick (placed unobtrusively on bottom-left) */}
        {screen === 'PLAYING' && (
          <div className="absolute bottom-6 left-6 z-30 pointer-events-auto md:hidden">
            <VirtualJoystick
              onMove={(vector) => {
                engineRef.current?.setTouchMove(vector.x, vector.y);
              }}
            />
          </div>
        )}
      </div>

      {/* Level-Up Modal */}
      {screen === 'LEVEL_UP' && (
        <LevelUpModal options={levelUpOptions} onSelect={handleSelectUpgrade} />
      )}

      {/* Tactical Pause Modal */}
      {screen === 'PAUSED' && (
        <PauseModal
          hero={hero}
          time={hudStats.time}
          kills={hudStats.kills}
          weapons={hudStats.weapons}
          passives={hudStats.passives}
          onResume={handleResume}
          onRestart={handleRestart}
          onQuitToTitle={handleQuitToTitle}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Game Over / Victory Modal */}
      {(screen === 'GAME_OVER' || screen === 'VICTORY') && runStats && (
        <GameOverModal
          stats={runStats}
          onRestart={handleRestart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}
    </div>
  );
}
