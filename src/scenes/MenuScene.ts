import Phaser from 'phaser';
import { ScoreManager } from '../core/ScoreManager';
import { SoundManager } from '../core/SoundManager';
import { DifficultyManager, type Difficulty } from '../core/DifficultyManager';
import { GameModeManager, type GameMode } from '../core/GameModeManager';

export class MenuScene extends Phaser.Scene {
  private stars1!: Phaser.GameObjects.TileSprite;
  private stars2!: Phaser.GameObjects.TileSprite;
  private nebula!:  Phaser.GameObjects.TileSprite;
  private titleGlow!: Phaser.GameObjects.Text;
  private title!:     Phaser.GameObjects.Text;
  private demoShips:  Phaser.GameObjects.Image[] = [];

  constructor() { super('MenuScene'); }

  create(): void {
    const { width: W, height: H } = this.scale;

    // --- Background ---
    this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H);
    this.nebula  = this.add.tileSprite(W / 2, H / 2, W, H, 'nebula').setAlpha(0.6);
    this.stars1  = this.add.tileSprite(W / 2, H / 2, W, H, 'stars-far');
    this.stars2  = this.add.tileSprite(W / 2, H / 2, W, H, 'stars-near').setAlpha(0.9);

    // Planet decoration
    this.add.image(660, 420, 'planet').setAlpha(0.55).setScale(1.1);

    // --- Demo ships flying past ---
    this.spawnDemoShips();

    // --- Title ---
    // Shadow / glow layer
    this.titleGlow = this.add.text(W / 2, 145, 'NOVA GUARDIAN', {
      fontSize: '56px', color: '#003366',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#003366', strokeThickness: 20,
    }).setOrigin(0.5).setAlpha(0.7);

    this.title = this.add.text(W / 2, 145, 'NOVA GUARDIAN', {
      fontSize: '56px', color: '#00eeff',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(W / 2, 198, 'SHOOTING DEFENSE', {
      fontSize: '16px', color: '#4499bb',
      fontFamily: 'monospace', letterSpacing: 8,
    }).setOrigin(0.5);

    // Decorative separator
    const sepGfx = this.add.graphics();
    sepGfx.lineStyle(1, 0x00aacc, 0.6);
    sepGfx.lineBetween(W / 2 - 160, 215, W / 2 + 160, 215);
    sepGfx.lineStyle(1, 0x00aacc, 0.3);
    sepGfx.lineBetween(W / 2 - 100, 220, W / 2 + 100, 220);

    // Best score display
    const best = ScoreManager.best();
    if (best > 0) {
      this.add.text(W / 2, H / 2 + 44, `BEST  ${best.toString().padStart(6, '0')}`, {
        fontSize: '13px', color: '#335566', fontFamily: 'monospace', letterSpacing: 2,
      }).setOrigin(0.5);
    }

    // --- Play button ---
    this.buildButton(W / 2, H / 2 + 80,  'PLAY',        0x00ccff, () => this.showDifficultySelect());
    this.buildButton(W / 2, H / 2 + 140, 'RANKING',     0xffdd00, () => this.showRanking());
    this.buildButton(W / 2, H / 2 + 200, 'HOW TO PLAY', 0x0088aa, () => this.showHelp());
    this.buildButton(W / 2, H / 2 + 260, 'SETTINGS',    0x8844ff, () => this.showSettings());

    // --- Controls hint ---
    const hints = [
      '↑↓  /  W S   MOVE',
      'AUTO-FIRE  |  SPACE  GRAVITY FLIP',
      'ESC  PAUSE',
    ];
    hints.forEach((h, i) => {
      this.add.text(W / 2, H - 80 + i * 18, h, {
        fontSize: '11px', color: '#335566',
        fontFamily: 'monospace', letterSpacing: 2,
      }).setOrigin(0.5);
    });

    // Copyright / version
    this.add.text(W - 10, H - 10, 'v1.0  ©2026 NOVA GUARDIAN', {
      fontSize: '10px', color: '#223344', fontFamily: 'monospace',
    }).setOrigin(1, 1);

    // --- Animations ---
    this.tweens.add({
      targets: this.title,
      alpha: { from: 0.85, to: 1 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.titleGlow,
      alpha: { from: 0.4, to: 0.8 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Fade in
    this.cameras.main.fadeIn(600, 0, 0, 8);

    // BGM — resume AudioContext on first pointer/key, then start menu BGM
    const startBGM = () => {
      SoundManager.resume();
      SoundManager.startBGM('menu');
      this.input.off('pointerdown', startBGM);
      this.input.keyboard?.off('keydown', startBGM);
    };
    this.input.once('pointerdown', startBGM);
    this.input.keyboard?.once('keydown', startBGM);
  }

  private buildButton(x: number, y: number, label: string, color: number, cb: () => void): Phaser.GameObjects.Container {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const bg = this.add.rectangle(0, 0, 220, 44, color, 0.15)
      .setStrokeStyle(1, color, 0.7);
    const text = this.add.text(0, 0, label, {
      fontSize: '16px', color: colorHex,
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const btn = this.add.container(x, y, [bg, text]);
    btn.setSize(220, 44);
    btn.setInteractive();

    btn.on('pointerover', () => {
      bg.setFillStyle(color, 0.35);
      text.setColor('#ffffff');
      this.tweens.add({ targets: btn, scaleX: 1.04, scaleY: 1.04, duration: 80 });
    });
    btn.on('pointerout', () => {
      bg.setFillStyle(color, 0.15);
      text.setColor(colorHex);
      this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 });
    });
    btn.on('pointerdown', () => { SoundManager.playButtonClick(); cb(); });
    return btn;
  }

  private spawnDemoShips(): void {
    const { width: W, height: H } = this.scale;
    const shipData = [
      { tex: 'player-ship',   y: H * 0.32, speed: 90,  scale: 0.9,  alpha: 0.35, delay: 0    },
      { tex: 'enemy-scout',   y: H * 0.55, speed: 130, scale: 0.85, alpha: 0.25, delay: 1200 },
      { tex: 'enemy-fighter', y: H * 0.70, speed: 80,  scale: 0.8,  alpha: 0.22, delay: 600  },
      { tex: 'enemy-bomber',  y: H * 0.42, speed: 55,  scale: 0.7,  alpha: 0.18, delay: 2000 },
    ];

    shipData.forEach(d => {
      this.time.delayedCall(d.delay, () => {
        const img = this.add.image(-100, d.y, d.tex)
          .setAlpha(0).setScale(d.scale);
        this.demoShips.push(img);
        this.tweens.add({
          targets: img, alpha: d.alpha,
          duration: 500, ease: 'Sine.easeIn',
        });
        this.tweens.add({
          targets: img, x: W + 120,
          duration: ((W + 220) / d.speed) * 1000,
          ease: 'Linear',
          onComplete: () => { img.destroy(); },
        });
      });
    });
  }

  private showDifficultySelect(): void {
    const { width: W, height: H } = this.scale;
    const objs: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000011, 0.9).setInteractive();
    objs.push(overlay);

    const panelW = Math.min(W - 40, 560);
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x00000e, 0.95);
    panelGfx.fillRect(W / 2 - panelW / 2, H / 2 - 155, panelW, 310);
    panelGfx.lineStyle(1, 0x003366, 0.9);
    panelGfx.strokeRect(W / 2 - panelW / 2, H / 2 - 155, panelW, 310);
    objs.push(panelGfx);

    const ttl = this.add.text(W / 2, H / 2 - 136, 'SELECT  DIFFICULTY', {
      fontSize: '18px', color: '#00eeff', fontFamily: 'monospace',
      fontStyle: 'bold', letterSpacing: 4, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    objs.push(ttl);

    const options = DifficultyManager.allOptions();
    const btnW = Math.floor((panelW - 60) / 3);
    const btnH = 180;
    const startX = W / 2 - btnW - btnW / 2 - 10;

    options.forEach((opt, i) => {
      const bx = startX + i * (btnW + 10);
      const by = H / 2 + 20;
      const colorHex = '#' + opt.color.toString(16).padStart(6, '0');

      const btnGfx = this.add.graphics();
      btnGfx.fillStyle(opt.color, 0.12);
      btnGfx.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
      btnGfx.lineStyle(opt.id === 'normal' ? 2 : 1, opt.color, 0.75);
      btnGfx.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
      objs.push(btnGfx);

      const lbl = this.add.text(bx, by - 55, opt.label, {
        fontSize: '16px', color: colorHex, fontFamily: 'monospace',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      objs.push(lbl);

      const livesStr = '♥'.repeat(opt.startLives);
      const livesT = this.add.text(bx, by - 20, livesStr, {
        fontSize: '13px', color: '#ff2244', fontFamily: 'monospace',
      }).setOrigin(0.5);
      objs.push(livesT);

      const descT = this.add.text(bx, by + 20, opt.desc, {
        fontSize: '11px', color: '#888888', fontFamily: 'monospace',
        wordWrap: { width: btnW - 12 }, align: 'center',
      }).setOrigin(0.5);
      objs.push(descT);

      const hitZone = this.add.rectangle(bx, by, btnW, btnH, 0xffffff, 0).setInteractive();
      objs.push(hitZone);

      hitZone.on('pointerover', () => {
        btnGfx.clear();
        btnGfx.fillStyle(opt.color, 0.28);
        btnGfx.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        btnGfx.lineStyle(2, opt.color, 1);
        btnGfx.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        lbl.setColor('#ffffff');
      });
      hitZone.on('pointerout', () => {
        btnGfx.clear();
        btnGfx.fillStyle(opt.color, 0.12);
        btnGfx.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        btnGfx.lineStyle(opt.id === 'normal' ? 2 : 1, opt.color, 0.75);
        btnGfx.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        lbl.setColor(colorHex);
      });
      hitZone.on('pointerdown', () => {
        SoundManager.playButtonClick();
        DifficultyManager.set(opt.id as Difficulty);
        objs.forEach(o => o.destroy());
        this.showModeSelect();
      });
    });

    const closeHint = this.add.text(W / 2, H / 2 + 130, 'TAP  TO  SELECT  ·  ESC  TO  CANCEL', {
      fontSize: '9px', color: '#224466', fontFamily: 'monospace', letterSpacing: 2,
    }).setOrigin(0.5);
    objs.push(closeHint);

    const close = () => objs.forEach(o => o.destroy());
    overlay.on('pointerdown', close);
    this.input.keyboard?.once('keydown-ESC', close);
  }

  private showModeSelect(): void {
    const { width: W, height: H } = this.scale;
    const objs: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000011, 0.92).setInteractive();
    objs.push(overlay);

    const panelW = Math.min(W - 40, 500);
    const panelH = 240;
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x00000e, 0.96);
    panelGfx.fillRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 20, panelW, panelH + 40);
    panelGfx.lineStyle(1, 0x003366, 0.9);
    panelGfx.strokeRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 20, panelW, panelH + 40);
    objs.push(panelGfx);

    const ttl = this.add.text(W / 2, H / 2 - panelH / 2 - 2, 'SELECT  MODE', {
      fontSize: '18px', color: '#00eeff', fontFamily: 'monospace',
      fontStyle: 'bold', letterSpacing: 6, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    objs.push(ttl);

    interface ModeOpt { id: GameMode; label: string; sub: string; color: number; desc: string[] }
    const modes: ModeOpt[] = [
      {
        id: 'campaign', label: 'CAMPAIGN', sub: 'NORMAL', color: 0x00ccff,
        desc: ['Wave-based battles', 'Upgrade & shop', 'between waves'],
      },
      {
        id: 'survival', label: 'SURVIVAL', sub: 'ENDLESS', color: 0xff8800,
        desc: ['Survive as long', 'as possible', 'Escalating threat'],
      },
    ];

    const btnW = Math.floor((panelW - 60) / 2);
    const btnH = 170;
    const startX = W / 2 - btnW / 2 - btnW / 2 - 10;

    modes.forEach((m, i) => {
      const bx = startX + i * (btnW + 20);
      const by = H / 2 + 16;
      const hex = '#' + m.color.toString(16).padStart(6, '0');

      const bg = this.add.graphics();
      bg.fillStyle(m.color, 0.12);
      bg.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
      bg.lineStyle(2, m.color, 0.8);
      bg.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
      objs.push(bg);

      const lbl = this.add.text(bx, by - 50, m.label, {
        fontSize: '18px', color: hex, fontFamily: 'monospace',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      objs.push(lbl);

      const sub = this.add.text(bx, by - 20, m.sub, {
        fontSize: '10px', color: hex, fontFamily: 'monospace', letterSpacing: 3,
      }).setOrigin(0.5);
      objs.push(sub);

      m.desc.forEach((line, li) => {
        const dt = this.add.text(bx, by + 14 + li * 16, line, {
          fontSize: '11px', color: '#778899', fontFamily: 'monospace', align: 'center',
        }).setOrigin(0.5);
        objs.push(dt);
      });

      const hitZone = this.add.rectangle(bx, by, btnW, btnH, 0xffffff, 0).setInteractive();
      objs.push(hitZone);

      hitZone.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(m.color, 0.28);
        bg.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        bg.lineStyle(2, m.color, 1);
        bg.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        lbl.setColor('#ffffff');
      });
      hitZone.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(m.color, 0.12);
        bg.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        bg.lineStyle(2, m.color, 0.8);
        bg.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        lbl.setColor(hex);
      });
      hitZone.on('pointerdown', () => {
        SoundManager.playButtonClick();
        GameModeManager.set(m.id);
        objs.forEach(o => o.destroy());
        this.startGame();
      });
    });

    const hint = this.add.text(W / 2, H / 2 + panelH / 2 + 18, 'TAP TO SELECT  ·  ESC BACK', {
      fontSize: '9px', color: '#224466', fontFamily: 'monospace', letterSpacing: 2,
    }).setOrigin(0.5);
    objs.push(hint);

    const close = () => objs.forEach(o => o.destroy());
    overlay.on('pointerdown', close);
    this.input.keyboard?.once('keydown-ESC', close);
  }

  private startGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
    });
  }

  private showRanking(): void {
    const { width: W, height: H } = this.scale;
    const scores = ScoreManager.getAll();
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88).setInteractive();
    const objs: Phaser.GameObjects.GameObject[] = [overlay];

    const panel = this.add.graphics();
    panel.fillStyle(0x00000e, 0.95);
    panel.fillRect(W / 2 - 220, H / 2 - 200, 440, 400);
    panel.lineStyle(1, 0x003366, 0.9);
    panel.strokeRect(W / 2 - 220, H / 2 - 200, 440, 400);
    objs.push(panel);

    const ttl = this.add.text(W / 2, H / 2 - 180, 'TOP  10  PILOTS', {
      fontSize: '16px', color: '#00ccff', fontFamily: 'monospace',
      fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);
    objs.push(ttl);

    const hdrStyle = { fontSize: '10px', color: '#335566', fontFamily: 'monospace' };
    objs.push(this.add.text(W / 2 - 190, H / 2 - 158, '#   SCORE    WAVE   DATE', hdrStyle));

    if (scores.length === 0) {
      objs.push(this.add.text(W / 2, H / 2, 'NO RECORDS YET', {
        fontSize: '14px', color: '#334455', fontFamily: 'monospace',
      }).setOrigin(0.5));
    } else {
      scores.slice(0, 10).forEach((e, i) => {
        const rowY = H / 2 - 138 + i * 30;
        const isTop3 = i < 3;
        const numCol  = ['#ffdd00', '#cccccc', '#cc8844', '#4488aa'][Math.min(i, 3)];
        const rowGfx = this.add.graphics();
        if (isTop3) {
          rowGfx.fillStyle(0x001133, 0.5);
          rowGfx.fillRect(W / 2 - 212, rowY - 4, 424, 22);
        }
        objs.push(rowGfx);
        objs.push(this.add.text(W / 2 - 198, rowY, `${i + 1}.`, { fontSize: '13px', color: numCol, fontFamily: 'monospace', fontStyle: 'bold' }));
        objs.push(this.add.text(W / 2 - 174, rowY, e.score.toString().padStart(6, '0'), { fontSize: '13px', color: '#00eeff', fontFamily: 'monospace' }));
        objs.push(this.add.text(W / 2 - 60,  rowY, `W${e.wave}`, { fontSize: '13px', color: '#4488aa', fontFamily: 'monospace' }));
        objs.push(this.add.text(W / 2 + 30,  rowY, e.date,       { fontSize: '12px', color: '#223344', fontFamily: 'monospace' }));
      });
    }

    const closeHint = this.add.text(W / 2, H / 2 + 185, 'TAP TO CLOSE', {
      fontSize: '11px', color: '#223344', fontFamily: 'monospace',
    }).setOrigin(0.5);
    objs.push(closeHint);

    const close = () => objs.forEach(o => o.destroy());
    overlay.on('pointerdown', close);
    this.input.keyboard?.once('keydown-ESC', close);
  }

  private showSettings(): void {
    const { width: W, height: H } = this.scale;
    const objs: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000011, 0.92).setInteractive();
    objs.push(overlay);

    const panelW = Math.min(W - 60, 440);
    const panelH = 260;
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x00000e, 0.96);
    panelGfx.fillRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 20, panelW, panelH + 40);
    panelGfx.lineStyle(1, 0x4422aa, 0.9);
    panelGfx.strokeRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 20, panelW, panelH + 40);
    objs.push(panelGfx);

    const ttl = this.add.text(W / 2, H / 2 - panelH / 2 - 2, 'SETTINGS', {
      fontSize: '20px', color: '#aa88ff', fontFamily: 'monospace',
      fontStyle: 'bold', letterSpacing: 6,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    objs.push(ttl);

    // Slider builder
    const trackW = panelW - 80;
    const trackX = W / 2 - trackW / 2;
    const trackH  = 8;

    const addSlider = (
      label: string,
      y: number,
      initVal: number,
      onChange: (v: number) => void,
    ): void => {
      const lbl = this.add.text(trackX, y - 22, label, {
        fontSize: '11px', color: '#6644cc', fontFamily: 'monospace', letterSpacing: 2,
      });
      objs.push(lbl);

      const trackBg = this.add.graphics();
      trackBg.fillStyle(0x110022, 0.9);
      trackBg.fillRect(trackX, y, trackW, trackH);
      trackBg.lineStyle(1, 0x330066, 0.9);
      trackBg.strokeRect(trackX, y, trackW, trackH);
      objs.push(trackBg);

      const fillGfx  = this.add.graphics();
      const thumbGfx = this.add.graphics();
      objs.push(fillGfx, thumbGfx);

      const valText = this.add.text(trackX + trackW + 14, y - 1, '', {
        fontSize: '12px', color: '#aa88ff', fontFamily: 'monospace', fontStyle: 'bold',
      });
      objs.push(valText);

      const draw = (v: number) => {
        fillGfx.clear();
        thumbGfx.clear();
        fillGfx.fillStyle(0x6633cc, 1);
        fillGfx.fillRect(trackX, y, trackW * v, trackH);
        const tx = trackX + trackW * v;
        thumbGfx.fillStyle(0xaa88ff, 1);
        thumbGfx.fillCircle(tx, y + trackH / 2, 9);
        thumbGfx.lineStyle(2, 0x000011, 0.7);
        thumbGfx.strokeCircle(tx, y + trackH / 2, 9);
        valText.setText(Math.round(v * 100) + '%');
      };
      draw(initVal);

      const hitZone = this.add.rectangle(W / 2, y + trackH / 2, trackW + 24, 32, 0xffffff, 0).setInteractive();
      objs.push(hitZone);

      const handlePtr = (ptr: Phaser.Input.Pointer) => {
        const v = Phaser.Math.Clamp((ptr.x - trackX) / trackW, 0, 1);
        draw(v);
        onChange(v);
      };
      hitZone.on('pointerdown', handlePtr);
      hitZone.on('pointermove', (ptr: Phaser.Input.Pointer) => { if (ptr.isDown) handlePtr(ptr); });
    };

    addSlider('BGM VOLUME', H / 2 - 50, SoundManager.getBgmVolume(), v => SoundManager.setBgmVolume(v));
    addSlider('SFX VOLUME', H / 2 + 50, SoundManager.getSfxVolume(), v => SoundManager.setSfxVolume(v));

    const hint = this.add.text(W / 2, H / 2 + panelH / 2 + 14, 'TAP OUTSIDE  ·  ESC  TO  CLOSE', {
      fontSize: '9px', color: '#332255', fontFamily: 'monospace', letterSpacing: 2,
    }).setOrigin(0.5);
    objs.push(hint);

    const close = () => objs.forEach(o => o.destroy());
    overlay.on('pointerdown', close);
    this.input.keyboard?.once('keydown-ESC', close);
  }

  private showHelp(): void {
    const { width: W, height: H } = this.scale;
    const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS || this.sys.game.device.input.touch;

    const objs: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88).setDepth(200);
    objs.push(overlay);

    // Panel background
    const panelW = Math.min(W - 40, 440);
    const panelH = 310;
    const panelGfx = this.add.graphics().setDepth(201);
    panelGfx.fillStyle(0x00000e, 0.96);
    panelGfx.fillRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH);
    panelGfx.lineStyle(1, 0x003366, 0.9);
    panelGfx.strokeRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH);
    objs.push(panelGfx);

    const lines: [string, string, string][] = [
      ['HOW  TO  PLAY', '#00eeff', '20px'],
      ['', '#ffffff', '6px'],
      [isMobile ? '🕹  LEFT SIDE   Move' : 'W / ↑    Move Up',    '#aaccee', '13px'],
      [isMobile ? '         RIGHT SIDE  G-Flip' : 'S / ↓    Move Down', '#aaccee', '13px'],
      [isMobile ? '' : 'SPACE    Gravity Flip',  '#00ffcc', '13px'],
      ['(G-Flip cooldown: 5s)',          '#4499bb', '11px'],
      ['', '#ffffff', '8px'],
      ['OBJECTIVE', '#00eeff', '16px'],
      ['Destroy enemy waves before', '#aaccee', '13px'],
      ['they breach your defense line.', '#aaccee', '13px'],
      ['', '#ffffff', '6px'],
      ['GRAVITY FLIP creates a shockwave', '#00ffcc', '12px'],
      ['that reverses enemy bullets!',     '#00ffcc', '12px'],
    ];

    let yy = H / 2 - panelH / 2 + 22;
    lines.forEach(([txt, color, size]) => {
      const t = this.add.text(W / 2, yy, txt, {
        fontSize: size, color, fontFamily: 'monospace', align: 'center',
        wordWrap: { width: panelW - 30 },
      }).setOrigin(0.5).setDepth(202);
      objs.push(t);
      yy += parseInt(size) + 4;
    });

    // Explicit CLOSE button (especially important for mobile)
    const closeBtnBg = this.add.rectangle(W / 2, H / 2 + panelH / 2 - 26, 180, 38, 0x003366, 0.8)
      .setStrokeStyle(1, 0x00ccff, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(203);
    const closeBtnTxt = this.add.text(W / 2, H / 2 + panelH / 2 - 26, '✕  CLOSE', {
      fontSize: '14px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(204);
    objs.push(closeBtnBg, closeBtnTxt);

    const close = () => objs.forEach(o => o.destroy());

    closeBtnBg.on('pointerover', () => { closeBtnBg.setFillStyle(0x005599, 0.9); closeBtnTxt.setColor('#ffffff'); });
    closeBtnBg.on('pointerout',  () => { closeBtnBg.setFillStyle(0x003366, 0.8); closeBtnTxt.setColor('#00eeff'); });
    closeBtnBg.on('pointerdown', close);

    overlay.on('pointerdown', close);
    this.input.keyboard?.once('keydown-ESC', close);
  }

  update(): void {
    this.stars1.tilePositionX  += 0.25;
    this.stars2.tilePositionX  += 0.55;
    this.nebula.tilePositionX  += 0.08;
  }
}
