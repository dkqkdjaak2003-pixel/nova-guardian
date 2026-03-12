import Phaser from 'phaser';

/** Generates all game textures procedurally using Phaser Graphics API. */
export class AssetGenerator {

  static generateAll(scene: Phaser.Scene): void {
    this.genBackground(scene);
    this.genStarsFar(scene);
    this.genStarsNear(scene);
    this.genNebula(scene);
    this.genPlanet(scene);
    this.genPlayerShip(scene);
    this.genEnemyScout(scene);
    this.genEnemyFighter(scene);
    this.genEnemyBomber(scene);
    this.genEnemyBoss(scene);
    this.genPlayerBullet(scene);
    this.genEnemyBullet(scene);
    this.genChargeBullet(scene);
    this.genParticle(scene);
    this.genExplosionParticle(scene);
    this.genHeart(scene);
    this.genGravityIcon(scene);
    this.genShieldRing(scene);
    this.genWavePulse(scene);
    this.genBossHealthBar(scene);
    this.genArenaGrid(scene);
    this.genJoystickBase(scene);
    this.genJoystickThumb(scene);
    this.genSpecialBtn(scene);
    this.genInterceptor(scene);
    this.genSniper(scene);
    this.genPowerups(scene);
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

  private static g(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    return scene.add.graphics();
  }

  // Draws an n-pointed star shape
  private static starPoly(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, outer: number, inner: number, pts: number): void {
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle = (Math.PI / pts) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      verts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
    gfx.fillPoints(verts, true);
  }

  // Draws a rounded hexagon
  private static hexPoly(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      verts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    gfx.fillPoints(verts, true);
  }

  // ── BACKGROUNDS ────────────────────────────────────────────────────────────

  private static genBackground(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 800, H = 600;

    // Deep space gradient bands
    const bands = [
      [0x020210, 0x030318, 0x040422, 0x050528, 0x060630,
       0x070738, 0x060635, 0x050530, 0x040425, 0x030318,
       0x020210, 0x010108, 0x020212, 0x030320, 0x040428,
       0x050530, 0x060638, 0x050530, 0x040425, 0x020210],
    ][0];
    bands.forEach((c, i) => {
      gfx.fillStyle(c, 1);
      gfx.fillRect(0, i * 30, W, 31);
    });

    // Subtle horizontal light rays
    for (let r = 0; r < 5; r++) {
      const cy = 60 + r * 120;
      gfx.fillStyle(0x0a0a40, 0.08);
      gfx.fillRect(0, cy - 15, W, 30);
    }

    gfx.generateTexture('bg', W, H);
    gfx.destroy();
  }

  private static genStarsFar(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 800, H = 600;
    // 200 tiny dim stars
    const rng = this.seededRng(42);
    for (let i = 0; i < 200; i++) {
      const x = rng() * W, y = rng() * H;
      const bright = 0.15 + rng() * 0.4;
      gfx.fillStyle(0xaabbff, bright);
      gfx.fillRect(x, y, 1, 1);
    }
    gfx.generateTexture('stars-far', W, H);
    gfx.destroy();
  }

  private static genStarsNear(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 800, H = 600;
    const rng = this.seededRng(99);
    // 80 brighter, slightly larger stars
    for (let i = 0; i < 80; i++) {
      const x = rng() * W, y = rng() * H;
      const bright = 0.5 + rng() * 0.5;
      const size = rng() < 0.2 ? 2 : 1;
      gfx.fillStyle(0xddeeff, bright);
      gfx.fillRect(x, y, size, size);
      // Occasional sparkle cross
      if (rng() < 0.15) {
        gfx.fillStyle(0xffffff, 0.3);
        gfx.fillRect(x - 2, y, 5, 1);
        gfx.fillRect(x, y - 2, 1, 5);
      }
    }
    gfx.generateTexture('stars-near', W, H);
    gfx.destroy();
  }

  private static genNebula(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 800, H = 600;
    // Large soft nebula clouds
    const clouds = [
      { x: 200, y: 150, rx: 220, ry: 120, color: 0x0a0055, alpha: 0.18 },
      { x: 180, y: 160, rx: 160, ry: 80,  color: 0x220044, alpha: 0.14 },
      { x: 600, y: 400, rx: 250, ry: 140, color: 0x003322, alpha: 0.16 },
      { x: 620, y: 380, rx: 180, ry: 100, color: 0x001133, alpha: 0.12 },
      { x: 400, y: 300, rx: 300, ry: 180, color: 0x110033, alpha: 0.10 },
      { x: 100, y: 500, rx: 180, ry: 100, color: 0x002244, alpha: 0.13 },
      { x: 700, y: 100, rx: 160, ry: 90,  color: 0x220022, alpha: 0.10 },
    ];
    clouds.forEach(c => {
      // Multiple passes for soft edges
      for (let pass = 0; pass < 4; pass++) {
        const scale = 1 - pass * 0.12;
        gfx.fillStyle(c.color, c.alpha * (1 - pass * 0.1));
        gfx.fillEllipse(c.x, c.y, c.rx * 2 * scale, c.ry * 2 * scale);
      }
    });
    // Subtle color highlights
    gfx.fillStyle(0x110055, 0.08);
    gfx.fillEllipse(300, 200, 400, 200);
    gfx.fillStyle(0x003311, 0.07);
    gfx.fillEllipse(500, 450, 350, 180);

    gfx.generateTexture('nebula', W, H);
    gfx.destroy();
  }

  private static genPlanet(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 180;
    const cx = 90, cy = 90, r = 85;

    // Shadow/outer glow
    gfx.fillStyle(0x002244, 0.3);
    gfx.fillCircle(cx + 4, cy + 4, r + 8);

    // Planet base (gas giant - teal/blue)
    gfx.fillStyle(0x0d3355, 1);
    gfx.fillCircle(cx, cy, r);

    // Atmospheric bands
    const atmo = [
      { y: -40, h: 14, c: 0x0e3d66, a: 0.9 },
      { y: -25, h: 10, c: 0x164d7a, a: 0.8 },
      { y: -14, h: 18, c: 0x1a5a8a, a: 0.7 },
      { y: 5,   h: 12, c: 0x123f6a, a: 0.85 },
      { y: 18,  h: 20, c: 0x0e3050, a: 0.9 },
      { y: 39,  h: 14, c: 0x1a5280, a: 0.75 },
      { y: 54,  h: 16, c: 0x0d2e4d, a: 0.9 },
    ];
    atmo.forEach(b => {
      gfx.fillStyle(b.c, b.a);
      // Clip to circle by drawing narrow rects (approx)
      const yw = cy + b.y;
      const half = Math.sqrt(Math.max(0, r * r - b.y * b.y));
      gfx.fillRect(cx - half, yw, half * 2, b.h);
    });

    // Storm eye
    gfx.fillStyle(0x2266aa, 0.5);
    gfx.fillEllipse(cx + 20, cy + 10, 30, 18);
    gfx.fillStyle(0x3388cc, 0.4);
    gfx.fillEllipse(cx + 20, cy + 10, 18, 10);
    gfx.fillStyle(0x44aadd, 0.3);
    gfx.fillEllipse(cx + 20, cy + 10, 8, 5);

    // Polar ice cap
    gfx.fillStyle(0xaaddff, 0.2);
    gfx.fillEllipse(cx, cy - r + 18, 60, 22);

    // Planet ring
    gfx.lineStyle(4, 0x336688, 0.5);
    gfx.strokeEllipse(cx, cy + 10, r * 2.6, r * 0.5);
    gfx.lineStyle(2, 0x4488aa, 0.35);
    gfx.strokeEllipse(cx, cy + 10, r * 2.9, r * 0.58);
    gfx.lineStyle(1, 0x224466, 0.25);
    gfx.strokeEllipse(cx, cy + 10, r * 2.3, r * 0.44);

    // Specular highlight
    gfx.fillStyle(0xffffff, 0.08);
    gfx.fillEllipse(cx - 25, cy - 30, 50, 30);

    // Limb darkening
    gfx.lineStyle(6, 0x000510, 0.35);
    gfx.strokeCircle(cx, cy, r);

    gfx.generateTexture('planet', S, S);
    gfx.destroy();
  }

  // ── PLAYER SHIP ────────────────────────────────────────────────────────────

  private static genPlayerShip(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 80, H = 48;
    const cy = H / 2;

    // Engine exhaust glow (back-most)
    gfx.fillStyle(0x0044ff, 0.12);
    gfx.fillEllipse(2, cy, 26, 32);
    gfx.fillStyle(0x0088ff, 0.18);
    gfx.fillEllipse(4, cy, 16, 20);

    // Lower wing
    gfx.fillStyle(0x122866, 1);
    gfx.fillPoints([
      { x: 18, y: cy + 4 }, { x: 54, y: cy + 4 },
      { x: 42, y: H - 2 },  { x: 14, y: H - 2 }
    ], true);
    gfx.fillStyle(0x1d3d99, 0.8);
    gfx.fillPoints([
      { x: 20, y: cy + 4 }, { x: 50, y: cy + 4 },
      { x: 40, y: H - 4 },  { x: 16, y: H - 4 }
    ], true);
    // Wing accent stripe
    gfx.fillStyle(0x00aaff, 0.5);
    gfx.fillRect(24, cy + 4, 22, 2);

    // Upper wing
    gfx.fillStyle(0x122866, 1);
    gfx.fillPoints([
      { x: 18, y: cy - 4 }, { x: 54, y: cy - 4 },
      { x: 42, y: 2 },       { x: 14, y: 2 }
    ], true);
    gfx.fillStyle(0x1d3d99, 0.8);
    gfx.fillPoints([
      { x: 20, y: cy - 4 }, { x: 50, y: cy - 4 },
      { x: 40, y: 4 },       { x: 16, y: 4 }
    ], true);
    // Wing accent stripe
    gfx.fillStyle(0x00aaff, 0.5);
    gfx.fillRect(24, cy - 6, 22, 2);

    // Main fuselage (dark navy base)
    gfx.fillStyle(0x0a1a44, 1);
    gfx.fillRect(10, cy - 10, 62, 20);

    // Fuselage plating (center)
    gfx.fillStyle(0x142255, 1);
    gfx.fillRect(10, cy - 8, 62, 16);
    gfx.fillStyle(0x1a2e6a, 1);
    gfx.fillRect(14, cy - 6, 56, 12);

    // Hull stripe detail
    gfx.fillStyle(0x00ccff, 0.35);
    gfx.fillRect(18, cy - 2, 46, 4);
    gfx.fillStyle(0x0088dd, 0.2);
    gfx.fillRect(18, cy - 4, 46, 2);
    gfx.fillStyle(0x0088dd, 0.2);
    gfx.fillRect(18, cy + 2, 46, 2);

    // Nose cone (points right)
    gfx.fillStyle(0x122866, 1);
    gfx.fillPoints([
      { x: 72, y: cy - 10 }, { x: 72, y: cy + 10 }, { x: W - 1, y: cy }
    ], true);
    gfx.fillStyle(0x1e3d99, 1);
    gfx.fillPoints([
      { x: 72, y: cy - 8 }, { x: 72, y: cy + 8 }, { x: W - 3, y: cy }
    ], true);
    gfx.fillStyle(0x2a54cc, 0.7);
    gfx.fillPoints([
      { x: 72, y: cy - 5 }, { x: 72, y: cy + 5 }, { x: W - 6, y: cy }
    ], true);

    // Cockpit frame
    gfx.fillStyle(0x061533, 1);
    gfx.fillEllipse(54, cy, 22, 14);
    // Cockpit glass
    gfx.fillStyle(0x00aaff, 0.85);
    gfx.fillEllipse(54, cy, 18, 10);
    // Cockpit tint layers
    gfx.fillStyle(0x003366, 0.5);
    gfx.fillEllipse(55, cy + 1, 14, 7);
    // Cockpit glare
    gfx.fillStyle(0xffffff, 0.45);
    gfx.fillEllipse(50, cy - 2, 7, 4);
    gfx.fillStyle(0xffffff, 0.2);
    gfx.fillEllipse(52, cy - 1, 3, 2);

    // Engine nacelles (back)
    gfx.fillStyle(0x0c1840, 1);
    gfx.fillRect(6, cy - 9, 14, 7);
    gfx.fillRect(6, cy + 2, 14, 7);
    // Nacelle edging
    gfx.fillStyle(0x1a2e6a, 1);
    gfx.fillRect(8, cy - 8, 10, 5);
    gfx.fillRect(8, cy + 3, 10, 5);
    // Engine ports
    gfx.fillStyle(0x000a22, 1);
    gfx.fillRect(6, cy - 7, 6, 3);
    gfx.fillRect(6, cy + 4, 6, 3);
    // Engine glow cores
    gfx.fillStyle(0x0066ff, 1);
    gfx.fillRect(6, cy - 7, 3, 3);
    gfx.fillRect(6, cy + 4, 3, 3);
    // Engine outer glow
    gfx.fillStyle(0x004dcc, 0.4);
    gfx.fillRect(4, cy - 8, 3, 5);
    gfx.fillRect(4, cy + 3, 3, 5);

    // Dual weapon cannons (upper/lower)
    gfx.fillStyle(0x1a3366, 1);
    gfx.fillRect(58, cy - 14, 20, 5);
    gfx.fillRect(58, cy + 9,  20, 5);
    // Cannon barrel highlight
    gfx.fillStyle(0x2244aa, 1);
    gfx.fillRect(60, cy - 13, 16, 3);
    gfx.fillRect(60, cy + 10, 16, 3);
    // Cannon muzzle glow
    gfx.fillStyle(0x00ffcc, 0.9);
    gfx.fillRect(76, cy - 13, 4, 3);
    gfx.fillRect(76, cy + 10, 4, 3);
    gfx.fillStyle(0x88ffee, 0.5);
    gfx.fillRect(78, cy - 14, 3, 5);
    gfx.fillRect(78, cy + 9,  3, 5);

    // Rivet / panel details
    gfx.fillStyle(0x2255bb, 0.6);
    [[20, cy - 9], [36, cy - 9], [20, cy + 8], [36, cy + 8]].forEach(([rx, ry]) => {
      gfx.fillRect(rx, ry, 2, 2);
    });

    gfx.generateTexture('player-ship', W, H);
    gfx.destroy();
  }

  // ── ENEMY SHIPS ────────────────────────────────────────────────────────────

  private static genEnemyScout(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 50, H = 36;
    const cy = H / 2;

    // Engine glow (right side - faces left)
    gfx.fillStyle(0xff4400, 0.15);
    gfx.fillEllipse(W - 2, cy, 20, 24);

    // Sharp delta wings
    gfx.fillStyle(0x661100, 1);
    gfx.fillPoints([
      { x: W - 8, y: cy - 3 }, { x: 8, y: 1 }, { x: 2, y: cy }
    ], true);
    gfx.fillPoints([
      { x: W - 8, y: cy + 3 }, { x: 8, y: H - 1 }, { x: 2, y: cy }
    ], true);

    // Wing highlights
    gfx.fillStyle(0xaa2200, 0.8);
    gfx.fillPoints([
      { x: W - 10, y: cy - 2 }, { x: 10, y: 3 }, { x: 4, y: cy }
    ], true);
    gfx.fillPoints([
      { x: W - 10, y: cy + 2 }, { x: 10, y: H - 3 }, { x: 4, y: cy }
    ], true);

    // Central fuselage
    gfx.fillStyle(0x551100, 1);
    gfx.fillRect(10, cy - 5, 34, 10);
    gfx.fillStyle(0x881a00, 1);
    gfx.fillRect(12, cy - 4, 30, 8);
    gfx.fillStyle(0xaa2200, 0.6);
    gfx.fillRect(14, cy - 2, 26, 4);

    // Nose (points left)
    gfx.fillStyle(0x882200, 1);
    gfx.fillPoints([
      { x: 10, y: cy - 5 }, { x: 10, y: cy + 5 }, { x: 1, y: cy }
    ], true);
    gfx.fillStyle(0xcc3300, 0.8);
    gfx.fillPoints([
      { x: 10, y: cy - 3 }, { x: 10, y: cy + 3 }, { x: 3, y: cy }
    ], true);

    // Engine ports (right side)
    gfx.fillStyle(0xff6600, 0.9);
    gfx.fillRect(W - 5, cy - 4, 4, 3);
    gfx.fillRect(W - 5, cy + 1, 4, 3);
    gfx.fillStyle(0xffaa00, 0.5);
    gfx.fillRect(W - 4, cy - 3, 3, 2);
    gfx.fillRect(W - 4, cy + 2, 3, 2);

    // Red energy pulse stripe
    gfx.fillStyle(0xff3300, 0.6);
    gfx.fillRect(14, cy - 1, 24, 2);

    gfx.generateTexture('enemy-scout', W, H);
    gfx.destroy();
  }

  private static genEnemyFighter(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 70, H = 52;
    const cy = H / 2;

    // Engine glow
    gfx.fillStyle(0xff6600, 0.12);
    gfx.fillEllipse(W - 2, cy, 24, 36);

    // Heavy swept wings
    gfx.fillStyle(0x5c2200, 1);
    gfx.fillPoints([
      { x: W - 12, y: cy - 6 }, { x: 16, y: 2 }, { x: 4, y: cy - 2 }, { x: 10, y: cy - 6 }
    ], true);
    gfx.fillPoints([
      { x: W - 12, y: cy + 6 }, { x: 16, y: H - 2 }, { x: 4, y: cy + 2 }, { x: 10, y: cy + 6 }
    ], true);
    // Wing plating highlights
    gfx.fillStyle(0x8a3300, 0.8);
    gfx.fillPoints([
      { x: W - 14, y: cy - 5 }, { x: 18, y: 4 }, { x: 6, y: cy - 1 }, { x: 12, y: cy - 5 }
    ], true);
    gfx.fillPoints([
      { x: W - 14, y: cy + 5 }, { x: 18, y: H - 4 }, { x: 6, y: cy + 1 }, { x: 12, y: cy + 5 }
    ], true);
    // Wing energy stripes
    gfx.fillStyle(0xff7700, 0.4);
    gfx.fillRect(18, cy - 6, 28, 2);
    gfx.fillRect(18, cy + 4, 28, 2);

    // Armored fuselage
    gfx.fillStyle(0x4a1a00, 1);
    gfx.fillRect(12, cy - 9, 50, 18);
    gfx.fillStyle(0x6e2800, 1);
    gfx.fillRect(14, cy - 8, 46, 16);
    gfx.fillStyle(0x8c3500, 1);
    gfx.fillRect(16, cy - 6, 42, 12);
    // Fuselage center panel
    gfx.fillStyle(0xaa4400, 0.7);
    gfx.fillRect(20, cy - 3, 34, 6);

    // Nose (left-pointing)
    gfx.fillStyle(0x7a2a00, 1);
    gfx.fillPoints([
      { x: 12, y: cy - 9 }, { x: 12, y: cy + 9 }, { x: 1, y: cy }
    ], true);
    gfx.fillStyle(0xbb4400, 1);
    gfx.fillPoints([
      { x: 12, y: cy - 6 }, { x: 12, y: cy + 6 }, { x: 4, y: cy }
    ], true);

    // Cockpit
    gfx.fillStyle(0x1a0500, 1);
    gfx.fillEllipse(42, cy, 20, 12);
    gfx.fillStyle(0xff6600, 0.7);
    gfx.fillEllipse(42, cy, 16, 8);
    gfx.fillStyle(0xff9900, 0.4);
    gfx.fillEllipse(40, cy - 1, 8, 4);

    // Dual cannons (left-pointing)
    gfx.fillStyle(0x3a1200, 1);
    gfx.fillRect(10, cy - 14, 24, 5);
    gfx.fillRect(10, cy + 9,  24, 5);
    gfx.fillStyle(0x6a2200, 1);
    gfx.fillRect(10, cy - 13, 22, 3);
    gfx.fillRect(10, cy + 10, 22, 3);
    // Cannon muzzles
    gfx.fillStyle(0xff5500, 0.9);
    gfx.fillRect(10, cy - 13, 4, 3);
    gfx.fillRect(10, cy + 10, 4, 3);

    // Engine ports
    gfx.fillStyle(0xff7700, 0.9);
    gfx.fillRect(W - 6, cy - 6, 5, 4);
    gfx.fillRect(W - 6, cy + 2, 5, 4);
    gfx.fillStyle(0xffaa44, 0.6);
    gfx.fillRect(W - 5, cy - 5, 4, 2);
    gfx.fillRect(W - 5, cy + 3, 4, 2);

    gfx.generateTexture('enemy-fighter', W, H);
    gfx.destroy();
  }

  private static genEnemyBomber(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 100, H = 80;
    const cx = 50, cy = 40;

    // Engine glow halo
    gfx.fillStyle(0x6600cc, 0.12);
    gfx.fillEllipse(W, cy, 36, 60);

    // Massive body - hexagonal warship
    gfx.fillStyle(0x220044, 1);
    this.hexPoly(gfx, cx + 4, cy, 36);
    gfx.fillStyle(0x330066, 1);
    this.hexPoly(gfx, cx + 4, cy, 32);
    gfx.fillStyle(0x440088, 0.8);
    this.hexPoly(gfx, cx + 4, cy, 26);

    // Armor plating panels
    gfx.fillStyle(0x2a0055, 1);
    gfx.fillRect(20, cy - 8, 60, 16);
    gfx.fillStyle(0x3d0077, 1);
    gfx.fillRect(22, cy - 6, 56, 12);
    // Center spine
    gfx.fillStyle(0x7700ee, 0.5);
    gfx.fillRect(24, cy - 2, 50, 4);

    // Nose/prow
    gfx.fillStyle(0x330066, 1);
    gfx.fillPoints([
      { x: 20, y: cy - 14 }, { x: 20, y: cy + 14 }, { x: 2, y: cy }
    ], true);
    gfx.fillStyle(0x5500aa, 0.9);
    gfx.fillPoints([
      { x: 20, y: cy - 10 }, { x: 20, y: cy + 10 }, { x: 5, y: cy }
    ], true);
    // Prow glow
    gfx.fillStyle(0xaa00ff, 0.5);
    gfx.fillPoints([
      { x: 20, y: cy - 6 }, { x: 20, y: cy + 6 }, { x: 8, y: cy }
    ], true);

    // Top/bottom weapon pods
    gfx.fillStyle(0x1a0033, 1);
    gfx.fillRect(28, cy - 36, 36, 20);
    gfx.fillRect(28, cy + 16, 36, 20);
    gfx.fillStyle(0x2d0055, 1);
    gfx.fillRect(30, cy - 34, 32, 16);
    gfx.fillRect(30, cy + 18, 32, 16);
    // Pod cannons
    gfx.fillStyle(0x660099, 1);
    gfx.fillRect(28, cy - 32, 8, 12);
    gfx.fillRect(28, cy + 20, 8, 12);
    // Pod muzzles
    gfx.fillStyle(0xcc00ff, 0.8);
    gfx.fillRect(28, cy - 30, 4, 8);
    gfx.fillRect(28, cy + 22, 4, 8);
    gfx.fillStyle(0xff88ff, 0.6);
    gfx.fillRect(28, cy - 28, 3, 4);
    gfx.fillRect(28, cy + 24, 3, 4);

    // Sensor orb / cockpit eye
    gfx.fillStyle(0x110022, 1);
    gfx.fillCircle(52, cy, 12);
    gfx.fillStyle(0xaa00ff, 0.7);
    gfx.fillCircle(52, cy, 9);
    gfx.fillStyle(0xdd44ff, 0.5);
    gfx.fillCircle(52, cy, 6);
    gfx.fillStyle(0xff88ff, 0.4);
    gfx.fillCircle(50, cy - 2, 3);

    // Engine array (right side)
    for (let i = 0; i < 3; i++) {
      const ey = cy - 12 + i * 12;
      gfx.fillStyle(0x1a0033, 1);
      gfx.fillRect(W - 12, ey - 3, 12, 6);
      gfx.fillStyle(0x8800cc, 0.9);
      gfx.fillRect(W - 8, ey - 2, 8, 4);
      gfx.fillStyle(0xcc44ff, 0.6);
      gfx.fillRect(W - 6, ey - 1, 6, 2);
    }

    gfx.generateTexture('enemy-bomber', W, H);
    gfx.destroy();
  }

  private static genEnemyBoss(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 160, H = 120;
    const cx = 80, cy = 60;

    // Outer aura
    gfx.fillStyle(0xcc0000, 0.08);
    gfx.fillCircle(cx + 10, cy, 68);
    gfx.fillStyle(0xff0033, 0.05);
    gfx.fillCircle(cx + 10, cy, 58);

    // Massive armored hull - 8-sided
    const hullPts = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 4) * i - Math.PI / 8;
      return { x: cx + 8 + Math.cos(a) * 50, y: cy + Math.sin(a) * 46 };
    });
    gfx.fillStyle(0x330000, 1);
    gfx.fillPoints(hullPts, true);

    const innerHull = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 4) * i - Math.PI / 8;
      return { x: cx + 8 + Math.cos(a) * 44, y: cy + Math.sin(a) * 40 };
    });
    gfx.fillStyle(0x4a0000, 1);
    gfx.fillPoints(innerHull, true);

    // Armored plates (panels)
    gfx.fillStyle(0x380000, 1);
    gfx.fillRect(26, cy - 18, 82, 36);
    gfx.fillStyle(0x4f0000, 1);
    gfx.fillRect(28, cy - 16, 78, 32);
    gfx.fillStyle(0x660000, 0.8);
    gfx.fillRect(32, cy - 12, 70, 24);

    // Spine / energy conduit
    gfx.fillStyle(0xff0000, 0.5);
    gfx.fillRect(30, cy - 3, 74, 6);
    gfx.fillStyle(0xff4444, 0.3);
    gfx.fillRect(30, cy - 5, 74, 10);

    // Massive prow (left)
    gfx.fillStyle(0x440000, 1);
    gfx.fillPoints([
      { x: 26, y: cy - 18 }, { x: 26, y: cy + 18 }, { x: 2, y: cy }
    ], true);
    gfx.fillStyle(0x770000, 1);
    gfx.fillPoints([
      { x: 26, y: cy - 13 }, { x: 26, y: cy + 13 }, { x: 6, y: cy }
    ], true);
    gfx.fillStyle(0xcc0000, 0.7);
    gfx.fillPoints([
      { x: 26, y: cy - 8 }, { x: 26, y: cy + 8 }, { x: 10, y: cy }
    ], true);
    // Prow weapon emitter
    gfx.fillStyle(0xff0000, 0.9);
    gfx.fillPoints([
      { x: 26, y: cy - 4 }, { x: 26, y: cy + 4 }, { x: 14, y: cy }
    ], true);

    // Upper/lower heavy wings
    gfx.fillStyle(0x2a0000, 1);
    gfx.fillPoints([
      { x: 40, y: cy - 18 }, { x: 100, y: cy - 18 }, { x: 110, y: cy - 52 }, { x: 34, y: cy - 52 }
    ], true);
    gfx.fillPoints([
      { x: 40, y: cy + 18 }, { x: 100, y: cy + 18 }, { x: 110, y: cy + 52 }, { x: 34, y: cy + 52 }
    ], true);
    // Wing plating
    gfx.fillStyle(0x3f0000, 1);
    gfx.fillPoints([
      { x: 42, y: cy - 18 }, { x: 98, y: cy - 18 }, { x: 107, y: cy - 50 }, { x: 36, y: cy - 50 }
    ], true);
    gfx.fillPoints([
      { x: 42, y: cy + 18 }, { x: 98, y: cy + 18 }, { x: 107, y: cy + 50 }, { x: 36, y: cy + 50 }
    ], true);
    // Wing energy veins
    gfx.fillStyle(0xff0033, 0.4);
    gfx.fillRect(44, cy - 48, 58, 3);
    gfx.fillRect(44, cy + 45, 58, 3);
    gfx.fillStyle(0xff0033, 0.25);
    gfx.fillRect(40, cy - 36, 64, 2);
    gfx.fillRect(40, cy + 34, 64, 2);

    // Weapon battery (left-center, upper/lower)
    for (let side = -1; side <= 1; side += 2) {
      const wy = cy + side * 30;
      gfx.fillStyle(0x1a0000, 1);
      gfx.fillRect(20, wy - 5, 32, 10);
      gfx.fillStyle(0x550000, 1);
      gfx.fillRect(20, wy - 4, 28, 8);
      gfx.fillStyle(0xff0000, 0.8);
      gfx.fillRect(20, wy - 3, 8, 6);
      gfx.fillStyle(0xff5555, 0.6);
      gfx.fillRect(20, wy - 2, 5, 4);
    }

    // Command bridge / bridge dome
    gfx.fillStyle(0x0a0000, 1);
    gfx.fillEllipse(88, cy, 28, 18);
    gfx.fillStyle(0xdd0000, 0.6);
    gfx.fillEllipse(88, cy, 22, 13);
    gfx.fillStyle(0xff2222, 0.4);
    gfx.fillEllipse(88, cy, 16, 9);
    gfx.fillStyle(0xff6666, 0.3);
    gfx.fillEllipse(85, cy - 2, 8, 5);

    // Thrusters (right side)
    const thrusters = [cy - 24, cy - 8, cy + 8, cy + 24];
    thrusters.forEach(ty => {
      gfx.fillStyle(0x1a0000, 1);
      gfx.fillRect(W - 18, ty - 5, 18, 10);
      gfx.fillStyle(0x440000, 1);
      gfx.fillRect(W - 16, ty - 4, 14, 8);
      gfx.fillStyle(0xff2200, 0.9);
      gfx.fillRect(W - 10, ty - 3, 10, 6);
      gfx.fillStyle(0xff8844, 0.6);
      gfx.fillRect(W - 8, ty - 2, 8, 4);
    });

    // Rivet lines / panel seams
    gfx.lineStyle(1, 0x880000, 0.5);
    gfx.lineBetween(30, cy - 14, 108, cy - 14);
    gfx.lineBetween(30, cy + 14, 108, cy + 14);
    gfx.lineBetween(60, cy - 18, 60, cy + 18);
    gfx.lineBetween(80, cy - 18, 80, cy + 18);

    gfx.generateTexture('enemy-boss', W, H);
    gfx.destroy();
  }

  // ── PROJECTILES ────────────────────────────────────────────────────────────

  private static genPlayerBullet(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    // Outer glow
    gfx.fillStyle(0x00ffee, 0.2);
    gfx.fillRect(0, 0, 28, 10);
    gfx.fillStyle(0x00ddcc, 0.4);
    gfx.fillRect(1, 1, 26, 8);
    // Core bolt
    gfx.fillStyle(0x00ffdd, 1);
    gfx.fillRect(2, 3, 22, 4);
    // Hot center
    gfx.fillStyle(0xaaffee, 1);
    gfx.fillRect(4, 4, 16, 2);
    // Bright tip
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillRect(20, 3, 6, 4);
    gfx.fillStyle(0x00ffee, 0.6);
    gfx.fillRect(24, 2, 4, 6);
    gfx.generateTexture('bullet-player', 28, 10);
    gfx.destroy();
  }

  private static genEnemyBullet(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 18;
    // Outer glow ring
    gfx.fillStyle(0xff2200, 0.2);
    gfx.fillCircle(S / 2, S / 2, 9);
    gfx.fillStyle(0xff4400, 0.35);
    gfx.fillCircle(S / 2, S / 2, 7);
    // Core
    gfx.fillStyle(0xff6600, 0.9);
    gfx.fillCircle(S / 2, S / 2, 5);
    gfx.fillStyle(0xff9900, 1);
    gfx.fillCircle(S / 2, S / 2, 3);
    gfx.fillStyle(0xffee00, 0.9);
    gfx.fillCircle(S / 2, S / 2, 1);
    gfx.generateTexture('bullet-enemy', S, S);
    gfx.destroy();
  }

  private static genChargeBullet(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 36;
    const c = S / 2;
    // Outer halo
    gfx.fillStyle(0x00ffaa, 0.1);
    gfx.fillCircle(c, c, 18);
    gfx.fillStyle(0x00ffcc, 0.2);
    gfx.fillCircle(c, c, 14);
    gfx.fillStyle(0x00ffdd, 0.35);
    gfx.fillCircle(c, c, 10);
    // Core
    gfx.fillStyle(0x00ffee, 0.8);
    gfx.fillCircle(c, c, 7);
    gfx.fillStyle(0x88ffee, 1);
    gfx.fillCircle(c, c, 4);
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(c, c, 2);
    // Star spikes
    gfx.fillStyle(0x00ffcc, 0.5);
    this.starPoly(gfx, c, c, 16, 6, 4);
    gfx.generateTexture('bullet-charge', S, S);
    gfx.destroy();
  }

  // ── FX TEXTURES ────────────────────────────────────────────────────────────

  private static genParticle(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture('particle', 8, 8);
    gfx.destroy();
  }

  private static genExplosionParticle(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 12, c = 6;
    gfx.fillStyle(0xff8800, 0.9);
    gfx.fillCircle(c, c, 6);
    gfx.fillStyle(0xffdd00, 0.8);
    gfx.fillCircle(c, c, 4);
    gfx.fillStyle(0xffffff, 0.6);
    gfx.fillCircle(c, c, 2);
    gfx.generateTexture('particle-explode', S, S);
    gfx.destroy();
  }

  private static genHeart(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 24, H = 22;
    // Full heart
    gfx.fillStyle(0xff2244, 1);
    gfx.fillCircle(8,  7, 6);
    gfx.fillCircle(16, 7, 6);
    gfx.fillPoints([
      { x: 2, y: 9 }, { x: 12, y: 20 }, { x: 22, y: 9 }
    ], true);
    // Highlight
    gfx.fillStyle(0xff88aa, 0.6);
    gfx.fillCircle(7, 5, 3);
    gfx.generateTexture('heart', W, H);
    gfx.destroy();

    // Empty heart
    const gfx2 = this.g(scene);
    gfx2.fillStyle(0x442233, 1);
    gfx2.fillCircle(8,  7, 6);
    gfx2.fillCircle(16, 7, 6);
    gfx2.fillPoints([
      { x: 2, y: 9 }, { x: 12, y: 20 }, { x: 22, y: 9 }
    ], true);
    gfx2.lineStyle(1, 0x884466, 0.5);
    gfx2.strokeCircle(8,  7, 5);
    gfx2.strokeCircle(16, 7, 5);
    gfx2.generateTexture('heart-empty', W, H);
    gfx2.destroy();
  }

  private static genGravityIcon(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 36, c = 18;
    // Outer ring
    gfx.lineStyle(2, 0x00ccff, 0.8);
    gfx.strokeCircle(c, c, 16);
    // Inner ring
    gfx.lineStyle(1, 0x0088cc, 0.6);
    gfx.strokeCircle(c, c, 11);
    // Arrows (up and down)
    gfx.fillStyle(0x00eeff, 0.9);
    gfx.fillTriangle(c, c - 14, c - 4, c - 7, c + 4, c - 7);
    gfx.fillTriangle(c, c + 14, c - 4, c + 7, c + 4, c + 7);
    // Center dot
    gfx.fillStyle(0x00ffff, 1);
    gfx.fillCircle(c, c, 3);
    gfx.generateTexture('gravity-icon', S, S);
    gfx.destroy();
  }

  private static genShieldRing(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 100, c = 50;
    // Outer glow
    gfx.lineStyle(8, 0x00aaff, 0.1);
    gfx.strokeCircle(c, c, 46);
    gfx.lineStyle(5, 0x00ccff, 0.2);
    gfx.strokeCircle(c, c, 44);
    gfx.lineStyle(3, 0x00eeff, 0.5);
    gfx.strokeCircle(c, c, 42);
    gfx.lineStyle(1, 0x88ffff, 0.8);
    gfx.strokeCircle(c, c, 40);
    // Hex segments
    gfx.fillStyle(0x00aaff, 0.06);
    for (let i = 0; i < 6; i++) {
      const a1 = (Math.PI / 3) * i;
      const a2 = a1 + Math.PI / 3;
      gfx.fillPoints([
        { x: c, y: c },
        { x: c + Math.cos(a1) * 40, y: c + Math.sin(a1) * 40 },
        { x: c + Math.cos(a2) * 40, y: c + Math.sin(a2) * 40 },
      ], true);
    }
    gfx.generateTexture('shield-ring', S, S);
    gfx.destroy();
  }

  private static genWavePulse(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 300, c = 150;
    // Concentric rings for gravity pulse
    const rings = [
      { r: 140, a: 0.04 }, { r: 120, a: 0.07 },
      { r: 100, a: 0.1  }, { r: 80,  a: 0.15 },
      { r: 60,  a: 0.1  }, { r: 40,  a: 0.07 },
    ];
    rings.forEach(({ r, a }) => {
      gfx.lineStyle(4, 0x00ddff, a);
      gfx.strokeCircle(c, c, r);
    });
    gfx.generateTexture('wave-pulse', S, S);
    gfx.destroy();
  }

  private static genBossHealthBar(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 500, H = 22;
    // Background
    gfx.fillStyle(0x110000, 1);
    gfx.fillRect(0, 0, W, H);
    gfx.fillStyle(0x330000, 1);
    gfx.fillRect(1, 1, W - 2, H - 2);
    // Fill (red)
    gfx.fillStyle(0xcc0000, 1);
    gfx.fillRect(2, 2, W - 4, H - 4);
    gfx.fillStyle(0xff2200, 0.7);
    gfx.fillRect(2, 2, W - 4, (H - 4) / 2);
    // Tick marks
    gfx.fillStyle(0x000000, 0.3);
    for (let i = 1; i < 10; i++) {
      gfx.fillRect(Math.floor(i * W / 10), 2, 1, H - 4);
    }
    // Border
    gfx.lineStyle(2, 0xff4400, 0.8);
    gfx.strokeRect(0, 0, W, H);
    gfx.generateTexture('boss-healthbar-fill', W, H);
    gfx.destroy();
  }

  // ── MOBILE / ARENA TEXTURES ───────────────────────────────────────────────

  private static genArenaGrid(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 800, H = 600;
    // Subtle hex-grid overlay for the arena floor
    gfx.lineStyle(1, 0x002244, 0.18);
    const size = 60;
    for (let row = 0; row < Math.ceil(H / (size * 0.866)) + 1; row++) {
      for (let col = 0; col < Math.ceil(W / (size * 1.5)) + 1; col++) {
        const ox = col * size * 1.5;
        const oy = row * size * 1.732 + (col % 2 === 0 ? 0 : size * 0.866);
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          pts.push({ x: ox + Math.cos(a) * size * 0.5, y: oy + Math.sin(a) * size * 0.5 });
        }
        gfx.strokePoints(pts, true);
      }
    }
    gfx.generateTexture('arena-grid', W, H);
    gfx.destroy();
  }

  private static genJoystickBase(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 140, c = 70;
    gfx.fillStyle(0x001122, 0.55);
    gfx.fillCircle(c, c, 66);
    gfx.lineStyle(2, 0x0088cc, 0.5);
    gfx.strokeCircle(c, c, 66);
    gfx.lineStyle(1, 0x004466, 0.4);
    gfx.strokeCircle(c, c, 48);
    // Cardinal tick marks
    [[c, c-58], [c, c+58], [c-58, c], [c+58, c]].forEach(([x, y]) => {
      gfx.fillStyle(0x0099cc, 0.5);
      gfx.fillCircle(x, y, 4);
    });
    gfx.generateTexture('joystick-base', S, S);
    gfx.destroy();
  }

  private static genJoystickThumb(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 70, c = 35;
    // Glow ring
    gfx.fillStyle(0x0066aa, 0.3);
    gfx.fillCircle(c, c, 34);
    // Body
    gfx.fillStyle(0x003355, 0.9);
    gfx.fillCircle(c, c, 28);
    gfx.fillStyle(0x0055aa, 0.8);
    gfx.fillCircle(c, c, 22);
    gfx.fillStyle(0x0088cc, 0.7);
    gfx.fillCircle(c, c, 16);
    // Specular
    gfx.fillStyle(0xffffff, 0.25);
    gfx.fillCircle(c - 6, c - 6, 8);
    gfx.generateTexture('joystick-thumb', S, S);
    gfx.destroy();
  }

  private static genSpecialBtn(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const S = 90, c = 45;
    // Glow
    gfx.fillStyle(0x004466, 0.3);
    gfx.fillCircle(c, c, 44);
    // Body
    gfx.fillStyle(0x001a33, 0.9);
    gfx.fillCircle(c, c, 38);
    gfx.lineStyle(2, 0x0099cc, 0.7);
    gfx.strokeCircle(c, c, 38);
    gfx.lineStyle(1, 0x004466, 0.5);
    gfx.strokeCircle(c, c, 30);
    // Up/down arrows (gravity icon)
    gfx.fillStyle(0x00eeff, 0.9);
    gfx.fillTriangle(c, c - 28, c - 10, c - 15, c + 10, c - 15);
    gfx.fillTriangle(c, c + 28, c - 10, c + 15, c + 10, c + 15);
    // Center dot
    gfx.fillStyle(0x00ffff, 1);
    gfx.fillCircle(c, c, 5);
    // Label
    gfx.lineStyle(1, 0x00aacc, 0.5);
    gfx.strokeCircle(c, c, 18);
    gfx.generateTexture('btn-special', S, S);
    gfx.destroy();
  }

  // ── INTERCEPTOR ───────────────────────────────────────────────────────────
  private static genInterceptor(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 44, H = 22, cy = H / 2;
    // Engine glow
    gfx.fillStyle(0xff6600, 0.2);
    gfx.fillEllipse(W, cy, 18, 18);
    // Sharp arrowhead body (faces left)
    gfx.fillStyle(0x882200, 1);
    gfx.fillPoints([{ x: W-2, y: cy-8 }, { x: 8, y: cy }, { x: W-2, y: cy+8 }], true);
    gfx.fillStyle(0xcc3300, 1);
    gfx.fillPoints([{ x: W-2, y: cy-5 }, { x: 12, y: cy }, { x: W-2, y: cy+5 }], true);
    gfx.fillStyle(0xff5500, 0.9);
    gfx.fillPoints([{ x: W-2, y: cy-2 }, { x: 16, y: cy }, { x: W-2, y: cy+2 }], true);
    // Nose
    gfx.fillStyle(0xff8800, 1);
    gfx.fillPoints([{ x: 8, y: cy-2 }, { x: 8, y: cy+2 }, { x: 1, y: cy }], true);
    // Engine ports
    gfx.fillStyle(0xff9900, 0.9);
    gfx.fillRect(W-4, cy-4, 4, 3);
    gfx.fillRect(W-4, cy+1, 4, 3);
    gfx.fillStyle(0xffcc44, 0.7);
    gfx.fillRect(W-3, cy-3, 3, 1);
    gfx.fillRect(W-3, cy+2, 3, 1);
    // Speed stripe
    gfx.fillStyle(0xffcc00, 0.5);
    gfx.fillRect(10, cy-1, 30, 2);
    gfx.generateTexture('enemy-interceptor', W, H);
    gfx.destroy();
  }

  // ── SNIPER ────────────────────────────────────────────────────────────────
  private static genSniper(scene: Phaser.Scene): void {
    const gfx = this.g(scene);
    const W = 76, H = 28, cy = H / 2;
    // Scope glow
    gfx.fillStyle(0x9900ff, 0.12);
    gfx.fillEllipse(W, cy, 20, 20);
    // Long thin fuselage
    gfx.fillStyle(0x220033, 1);
    gfx.fillRect(10, cy-5, 58, 10);
    gfx.fillStyle(0x330055, 1);
    gfx.fillRect(12, cy-4, 54, 8);
    gfx.fillStyle(0x4d0088, 0.9);
    gfx.fillRect(14, cy-2, 50, 4);
    // Narrow prow
    gfx.fillStyle(0x330055, 1);
    gfx.fillPoints([{ x: 10, y: cy-5 }, { x: 10, y: cy+5 }, { x: 1, y: cy }], true);
    gfx.fillStyle(0x6600cc, 0.9);
    gfx.fillPoints([{ x: 10, y: cy-3 }, { x: 10, y: cy+3 }, { x: 4, y: cy }], true);
    // Long barrel (left-protruding)
    gfx.fillStyle(0x1a0033, 1);
    gfx.fillRect(10, cy-1, 66, 2);
    gfx.fillStyle(0x8800ff, 0.8);
    gfx.fillRect(10, cy-1, 66, 1);
    // Scope
    gfx.fillStyle(0x110022, 1);
    gfx.fillEllipse(52, cy, 14, 10);
    gfx.fillStyle(0xaa00ff, 0.7);
    gfx.fillEllipse(52, cy, 10, 7);
    gfx.fillStyle(0xdd88ff, 0.5);
    gfx.fillEllipse(50, cy-1, 5, 4);
    // Engine
    gfx.fillStyle(0x8800cc, 0.9);
    gfx.fillRect(W-7, cy-3, 6, 6);
    gfx.fillStyle(0xcc44ff, 0.7);
    gfx.fillRect(W-5, cy-2, 5, 4);
    gfx.generateTexture('enemy-sniper', W, H);
    gfx.destroy();
  }

  // ── POWERUPS ──────────────────────────────────────────────────────────────
  private static genPowerups(scene: Phaser.Scene): void {
    const defs: Array<{ key: string; color: number; sym: number }> = [
      { key: 'powerup-rapid',  color: 0xff8800, sym: 0xffaa44 },
      { key: 'powerup-shield', color: 0x00ccff, sym: 0x88eeff },
      { key: 'powerup-nuke',   color: 0xff2244, sym: 0xff8888 },
      { key: 'powerup-speed',  color: 0x00ff88, sym: 0x88ffcc },
      { key: 'powerup-multi',  color: 0xffdd00, sym: 0xffee88 },
    ];
    const S = 28, c = 14;
    defs.forEach(({ key, color, sym }) => {
      const g = this.g(scene);
      // Outer glow
      g.fillStyle(color, 0.2); g.fillCircle(c, c, 14);
      g.fillStyle(color, 0.35); g.fillCircle(c, c, 11);
      // Body
      g.fillStyle(color, 0.9); g.fillCircle(c, c, 8);
      // Inner highlight
      g.fillStyle(sym, 0.8); g.fillCircle(c-2, c-2, 4);
      g.fillStyle(0xffffff, 0.4); g.fillCircle(c-3, c-3, 2);
      // Border ring
      g.lineStyle(1, color, 1); g.strokeCircle(c, c, 10);
      g.generateTexture(key, S, S);
      g.destroy();
    });
  }

  // ── SEEDED PRNG (so stars look the same each run) ─────────────────────────

  private static seededRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
}
