import Phaser from 'phaser';

interface GOData { score: number; wave: number }

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data: GOData): void {
    const { width: W, height: H } = this.scale;
    const score = data?.score ?? 0;
    const wave  = data?.wave  ?? 1;

    // Background
    this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H);
    this.add.tileSprite(W / 2, H / 2, W, H, 'nebula').setAlpha(0.4);
    this.add.tileSprite(W / 2, H / 2, W, H, 'stars-far').setAlpha(0.7);

    // Debris / wreckage particles
    this.add.particles(W / 2, H / 2, 'particle-explode', {
      speed: { min: 20, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xff4400, 0xff8800, 0xffcc00, 0x882200],
      lifespan: { min: 2000, max: 4000 },
      frequency: 120,
      quantity: 2,
    });

    // Title
    const shadow = this.add.text(W / 2 + 3, H / 2 - 130 + 3, 'MISSION FAILED', {
      fontSize: '48px', color: '#330000',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const title = this.add.text(W / 2, H / 2 - 130, 'MISSION FAILED', {
      fontSize: '48px', color: '#ff2244',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#ffaaaa', strokeThickness: 2,
    }).setOrigin(0.5);

    // Stats panel
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x000a22, 0.8);
    panelGfx.fillRect(W / 2 - 200, H / 2 - 80, 400, 130);
    panelGfx.lineStyle(1, 0x003366, 0.8);
    panelGfx.strokeRect(W / 2 - 200, H / 2 - 80, 400, 130);
    panelGfx.lineStyle(1, 0x001a44, 0.5);
    panelGfx.strokeRect(W / 2 - 196, H / 2 - 76, 392, 122);

    const statStyle = { fontSize: '14px', color: '#4488aa', fontFamily: 'monospace' };
    const valStyle  = { fontSize: '22px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold' };

    this.add.text(W / 2 - 160, H / 2 - 64, 'FINAL SCORE',    statStyle);
    this.add.text(W / 2 - 160, H / 2 - 64 + 32, this.fmt(score), valStyle);
    this.add.text(W / 2 + 30,  H / 2 - 64, 'WAVES SURVIVED', statStyle);
    this.add.text(W / 2 + 80,  H / 2 - 64 + 32, wave.toString(), valStyle);

    // Rating
    const rating = score >= 10000 ? 'S' : score >= 5000 ? 'A' : score >= 2000 ? 'B' : score >= 500 ? 'C' : 'D';
    const ratingColor = { S: '#ffdd00', A: '#00ffaa', B: '#00aaff', C: '#aaaaff', D: '#ff8866' }[rating]!;
    this.add.text(W / 2 + 140, H / 2 - 54, 'RANK', { fontSize: '11px', color: '#335566', fontFamily: 'monospace' });
    this.add.text(W / 2 + 148, H / 2 - 42, rating, {
      fontSize: '40px', color: ratingColor,
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    });

    // High score
    const prev = parseInt(localStorage.getItem('nova_hiscore') ?? '0');
    const isNew = score > prev;
    if (isNew) localStorage.setItem('nova_hiscore', score.toString());
    const hiScore = Math.max(score, prev);

    const hiTxt = isNew ? '★  NEW BEST!  ' + this.fmt(hiScore) : 'BEST: ' + this.fmt(hiScore);
    const hiObj = this.add.text(W / 2, H / 2 + 72, hiTxt, {
      fontSize: '13px',
      color: isNew ? '#ffdd00' : '#335566',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    if (isNew) {
      this.tweens.add({
        targets: hiObj, scale: { from: 1, to: 1.06 },
        duration: 600, yoyo: true, repeat: -1,
      });
    }

    // Buttons
    this.buildButton(W / 2, H / 2 + 120, 'PLAY AGAIN', 0x00ccff, () => {
      this.cameras.main.fadeOut(400, 0, 0, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
    });
    this.buildButton(W / 2, H / 2 + 178, 'MAIN MENU', 0x0088aa, () => {
      this.cameras.main.fadeOut(400, 0, 0, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });

    // Fade in
    title.setAlpha(0); shadow.setAlpha(0);
    this.tweens.add({ targets: [title, shadow], alpha: 1, duration: 700, delay: 200 });

    this.cameras.main.fadeIn(500, 0, 0, 8);
  }

  private buildButton(x: number, y: number, label: string, color: number, cb: () => void): void {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const bg = this.add.rectangle(x, y, 220, 40, color, 0.15).setStrokeStyle(1, color, 0.6);
    const txt = this.add.text(x, y, label, {
      fontSize: '15px', color: hex, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const btn = this.add.container(0, 0, [bg, txt]);
    btn.setSize(220, 40);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerover',  () => { bg.setFillStyle(color, 0.3); txt.setColor('#ffffff'); });
    btn.on('pointerout',   () => { bg.setFillStyle(color, 0.15); txt.setColor(hex); });
    btn.on('pointerdown',  cb);
  }

  private fmt(n: number): string { return n.toString().padStart(6, '0'); }
}
