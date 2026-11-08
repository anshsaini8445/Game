import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { Download, Smartphone, GitBranch, Copy, Check, X, Terminal } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'install' | 'github'>('install');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const gitCommands = `git init
git add .
git commit -m "feat: Neon Vanguard Horde Survivor PWA & GitHub CI/CD"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/neon-vanguard.git
git push -u origin main`;

  const copyCommands = () => {
    navigator.clipboard.writeText(gitCommands).catch(() => {});
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {!isOnline && (
          <span className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 border border-amber-500/40 text-[11px] font-mono text-amber-300">
            Offline Ready
          </span>
        )}

        {!isInstalled && isInstallable ? (
          <button
            onClick={install}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/60 bg-cyan-950/60 hover:bg-cyan-900/80 text-xs font-mono font-semibold text-cyan-300 transition-colors cursor-pointer"
            title="Install Neon Vanguard as a standalone App"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="whitespace-nowrap">Install App</span>
          </button>
        ) : !isInstalled ? (
          <button
            onClick={() => {
              setActiveTab('install');
              setShowGuideModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
            title="Install App on Desktop or Mobile"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span className="whitespace-nowrap">{isIOS ? 'Install on iOS' : 'Get App'}</span>
          </button>
        ) : null}

        <button
          onClick={() => {
            setActiveTab('github');
            setShowGuideModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
          title="GitHub Push & Deployment Guide"
        >
          <GitBranch className="w-3.5 h-3.5 text-purple-400" />
          <span className="whitespace-nowrap">GitHub Push</span>
        </button>
      </div>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm select-text"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('install')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                    activeTab === 'install'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Install PWA App
                </button>
                <button
                  onClick={() => setActiveTab('github')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                    activeTab === 'github'
                      ? 'bg-purple-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  GitHub Push Ready
                </button>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeTab === 'install' ? (
              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <p className="text-slate-200 font-medium">
                  <strong>Neon Vanguard</strong> is configured as a standalone Progressive Web App (PWA) with offline Service Worker caching and custom icons.
                </p>

                {isInstallable && (
                  <button
                    onClick={install}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Standalone App Now</span>
                  </button>
                )}

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-mono font-bold text-cyan-400">Chrome / Edge / Android:</div>
                  <p className="text-slate-400">
                    Open the deployed app URL in a full browser tab and click the <strong>Install Neon Vanguard</strong> icon in the address bar (or tap <strong>Add to Home screen</strong> in Android Chrome menu).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-mono font-bold text-purple-400">iPhone / iPad (iOS Safari):</div>
                  <p className="text-slate-400">
                    1. Open the app in <strong>Safari</strong>.<br />
                    2. Tap the <strong>Share</strong> button at the bottom.<br />
                    3. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <p className="text-slate-200">
                  This repository is pre-configured with <strong>Git</strong>, <strong>README.md</strong>, <strong>LICENSE</strong>, and a <strong>GitHub Actions workflow</strong> (<code>.github/workflows/deploy.yml</code>) that automatically builds and deploys your game to <strong>GitHub Pages</strong> on every push to <code>main</code>.
                </p>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-purple-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      Push to GitHub Commands
                    </span>
                    <button
                      onClick={copyCommands}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200 cursor-pointer"
                    >
                      {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre leading-5">
                    {gitCommands}
                  </pre>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Tip: You can also use AI Studio&apos;s top-right <strong>Export to GitHub / Download ZIP</strong> option to push directly to your GitHub account in one click.
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 transition-colors cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
};
