# Neon Vanguard: Horde Survivor

An adrenaline-fueled 60 FPS sci-fi Bullet Heaven / Roguelite Survival game built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **HTML5 Canvas**, and **Web Audio API**, packaged as an offline-ready **Progressive Web App (PWA)**.

---

## Features

- **4 Playable Operatives**:
  - **Striker Vance** (*Vanguard Ranger*) — High mobility, rapid Pulse Carbine, and Tactical Dash.
  - **Nova Ray** (*Void Sorceress*) — Expanded AoE, extra Orbital Blades, and Singularity Vortex.
  - **Titan Rex** (*Armored Juggernaut*) — Heavy armor plating, Tesla Chain Coil, and Seismic Shockwave.
  - **Kage Shinobi** (*Cyber Assassin*) — High critical strike multiplier, Seeker Missiles, and Phantom Shift.
- **Roguelite Arsenal & Synergies**:
  - **6 Weapons**: Pulse Carbine, Orbital Blades, Tesla Chain Coil, Seeker Missiles, Laser Lance, Cryo Mines.
  - **6 Passives**: Overclock Core, Hollow-Point Plasma, Gravity Attractor, Nano-Composite Hull, Vector Thrusters, Sub-Atomic Optics.
- **60 FPS Simulation & Juicy Game Feel**:
  - Clamped delta-time physics loop, enemy crowd separation, hitstop impact freeze, decaying camera shake, and critical damage popups.
  - Zero-dependency procedural Web Audio synthesizer for laser fire, plasma explosions, chain lightning, and harmonic XP gem combos.
- **Installable Progressive Web App (PWA)**:
  - Full Web App Manifest, Service Worker asset caching (`vite-plugin-pwa`), iOS/Android home screen icons, and in-app installation support.

---

## Controls

| Action | Keyboard | Mobile / Touch |
| :--- | :--- | :--- |
| **Move** | `W A S D` or `Arrow Keys` | Bottom-Left Virtual Joystick |
| **Dash (Invulnerable)** | `Space` / `Left Shift` / `K` | On-Screen `DASH` Button |
| **Ultimate Special** | `E` / `Q` | On-Screen `ULT` Button |
| **Pause / Resume** | `Esc` | Top-Right Pause Button |
| **Select Upgrade** | `1`, `2`, `3` or Click | Tap Upgrade Card |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server on port 3000
npm run dev

# 3. Type-check and build production bundle
npm run lint
npm run build
```

---

## Push to GitHub & Deploy

This repository is pre-initialized with Git and includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`) for **GitHub Pages**, **Vercel**, or **Netlify**.

```bash
# Link your GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/neon-vanguard.git
git branch -M main
git push -u origin main
```

Once pushed to GitHub:
1. Go to your repository **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Every push to `main` will automatically build and publish your playable PWA game!

---

## License

Apache-2.0
