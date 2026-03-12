import Phaser from 'phaser';

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

    // --- Play button ---
    this.buildButton(W / 2, H / 2 + 80, 'PLAY', 0x00ccff, () => this.startGame());
    this.buildButton(W / 2, H / 2 + 150, 'HOW TO PLAY', 0x0088aa, () => this.showHelp());

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
    btn.on('pointerdown', cb);
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

  private startGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
    });
  }

  private showHelp(): void {
    const { width: W, height: H } = this.scale;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85)
      .setInteractive();

    const lines = [
      ['CONTROLS', '#00eeff', '22px'],
      ['', '#ffffff', '1px'],
      ['W / ↑    Move Up',       '#aaccee', '14px'],
      ['S / ↓    Move Down',     '#aaccee', '14px'],
      ['SPACE    Gravity Flip',  '#00ffcc', '14px'],
      ['(cooldown: 5s)',          '#4499bb', '12px'],
      ['', '#ffffff', '1px'],
      ['OBJECTIVE', '#00eeff', '18px'],
      ['Destroy enemy waves before', '#aaccee', '14px'],
      ['they breach your defense line.', '#aaccee', '14px'],
      ['', '#ffffff', '1px'],
      ['GRAVITY FLIP creates a shockwave', '#00ffcc', '13px'],
      ['that reverses enemy bullets!',     '#00ffcc', '13px'],
      ['', '#ffffff', '1px'],
      ['Click or press ESC to close', '#446677', '11px'],
    ];
    let yy = H / 2 - 120;
    const objs: Phaser.GameObjects.GameObject[] = [overlay];
    lines.forEach(([txt, color, size]) => {
      const t = this.add.text(W / 2, yy, txt, {
        fontSize: size, color, fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5);
      objs.push(t);
      yy += parseInt(size) + 6;
    });

    const close = () => objs.forEach(o => o.destroy());
    overlay.on('pointerdown', close);
    this.input.keyboard?.once('keydown-ESC', close);
  }

  update(): void {
    this.stars1.tilePositionX  += 0.25;
    this.stars2.tilePositionX  += 0.55;
    this.nebula.tilePositionX  += 0.08;
  }
}
