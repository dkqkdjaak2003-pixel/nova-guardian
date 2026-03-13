import Phaser from 'phaser';
import { ScoreManager } from '../core/ScoreManager';
import { SoundManager } from '../core/SoundManager';

interface GOStats {
  totalKills: number;
  maxCombo: number;
  perfectWaves: number;
  bonusScore: number;
  difficulty: string;
  diffColor: number;
}
interface GOData { score: number; wave: number; stats?: GOStats }

const RANK_COLORS: Record<string, string> = {
  S: '#ffdd00', A: '#00ffaa', B: '#00aaff', C: '#aaaaff', D: '#ff8866',
};

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data: GOData): void {
    const { width: W, height: H } = this.scale;
    const score = data?.score ?? 0;
    const wave  = data?.wave  ?? 1;
    const stats = data?.stats;

    // ── Background ──
    this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H);
    this.add.tileSprite(W / 2, H / 2, W, H, 'nebula').setAlpha(0.4);
    this.add.tileSprite(W / 2, H / 2, W, H, 'stars-far').setAlpha(0.7);

    this.add.particles(W / 2, H / 2, 'particle-explode', {
      speed: { min: 20, max: 80 }, angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0.1 }, alpha: { start: 0.7, end: 0 },
      tint: [0xff4400, 0xff8800, 0xffcc00, 0x882200],
      lifespan: { min: 2000, max: 4000 }, frequency: 120, quantity: 2,
    });

    // ── BGM → menu after game over ──
    SoundManager.startBGM('menu');

    // ── Register score → get rank ──
    const rank = ScoreManager.add(score, wave);
    const isNewRecord = rank === 1;
    const topScores = ScoreManager.getAll();

    // ── Difficulty label ──
    if (stats) {
      const diffHex = '#' + (stats.diffColor ?? 0x00ccff).toString(16).padStart(6, '0');
      this.add.text(W / 2, H / 2 - 232, stats.difficulty, {
        fontSize: '11px', color: diffHex, fontFamily: 'monospace',
        fontStyle: 'bold', letterSpacing: 3,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    // ── Title ──
    const shadow = this.add.text(W / 2 + 3, H / 2 - 200 + 3, 'MISSION FAILED', {
      fontSize: '40px', color: '#330000', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    const title = this.add.text(W / 2, H / 2 - 200, 'MISSION FAILED', {
      fontSize: '40px', color: '#ff2244', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#ffaaaa', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [title, shadow], alpha: 1, duration: 700, delay: 200 });

    // ── Stats panel ──
    const px = W / 2 - 190, py = H / 2 - 165, pw = 380, ph = 80;
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x000a22, 0.85); panelGfx.fillRect(px, py, pw, ph);
    panelGfx.lineStyle(1, 0x003366, 0.8); panelGfx.strokeRect(px, py, pw, ph);

    const sS = { fontSize: '11px', color: '#4488aa', fontFamily: 'monospace' };
    const vS = { fontSize: '20px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold' };

    this.add.text(px + 14,  py + 8,  'FINAL SCORE',    sS);
    this.add.text(px + 14,  py + 24, this.fmt(score),  vS);
    this.add.text(px + 150, py + 8,  'WAVES SURVIVED', sS);
    this.add.text(px + 168, py + 24, wave.toString(),  vS);

    // Rank letter
    const rating = score >= 50000 ? 'S' : score >= 20000 ? 'A' : score >= 8000 ? 'B' : score >= 2000 ? 'C' : 'D';
    this.add.text(px + 305, py + 4,  'RANK', { fontSize: '10px', color: '#335566', fontFamily: 'monospace' });
    this.add.text(px + 310, py + 16, rating, {
      fontSize: '36px', color: RANK_COLORS[rating],
      fontFamily: 'monospace', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    });

    // ── New record banner ──
    if (isNewRecord) {
      const rec = this.add.text(W / 2, H / 2 - 80, '★  NEW RECORD  ★', {
        fontSize: '17px', color: '#ffdd00', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5);
      this.tweens.add({ targets: rec, scale: { from: 1, to: 1.08 }, duration: 550, yoyo: true, repeat: -1 });
    } else if (rank !== null) {
      this.add.text(W / 2, H / 2 - 80, `# ${rank}  RANKING`, {
        fontSize: '15px', color: '#00ffaa', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);
    } else {
      this.add.text(W / 2, H / 2 - 80, `BEST: ${this.fmt(ScoreManager.best())}`, {
        fontSize: '13px', color: '#335566', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    // ── TOP 5 Leaderboard ──
    const lbX = W / 2 - 190, lbY = H / 2 - 58, lbW = 380, lbH = 130;
    const lbGfx = this.add.graphics();
    lbGfx.fillStyle(0x00000e, 0.85); lbGfx.fillRect(lbX, lbY, lbW, lbH);
    lbGfx.lineStyle(1, 0x002244, 0.7); lbGfx.strokeRect(lbX, lbY, lbW, lbH);

    this.add.text(lbX + lbW / 2, lbY + 8, 'TOP  10', {
      fontSize: '10px', color: '#4488aa', fontFamily: 'monospace', letterSpacing: 4,
    }).setOrigin(0.5, 0);

    topScores.slice(0, 5).forEach((entry, i) => {
      const rowY = lbY + 24 + i * 20;
      const isMe = i === (rank ? rank - 1 : -1);
      const numCol  = isMe ? '#ffdd00' : '#335566';
      const nameCol = isMe ? '#00ffff' : '#88aacc';
      const valCol  = isMe ? '#00eeff' : '#6699bb';

      this.add.text(lbX + 16, rowY, `${i + 1}.`, { fontSize: '12px', color: numCol, fontFamily: 'monospace', fontStyle: 'bold' });
      this.add.text(lbX + 40, rowY, this.fmt(entry.score),    { fontSize: '12px', color: valCol,  fontFamily: 'monospace' });
      this.add.text(lbX + 130, rowY, `W${entry.wave}`,        { fontSize: '12px', color: nameCol, fontFamily: 'monospace' });
      this.add.text(lbX + 185, rowY, entry.date,              { fontSize: '11px', color: '#334455', fontFamily: 'monospace' });

      if (isMe) {
        const bar = this.add.graphics();
        bar.fillStyle(0x003355, 0.4);
        bar.fillRect(lbX + 2, rowY - 2, lbW - 4, 18);
      }
    });

    // Show rank 6-10 if current score is in that range
    if (rank !== null && rank > 5 && rank <= 10) {
      const rowY = lbY + 24 + 5 * 20;
      this.add.text(lbX + 16, rowY - 6, '  ···', { fontSize: '11px', color: '#222233', fontFamily: 'monospace' });
      const entry = topScores[rank - 1];
      if (entry) {
        const barY = lbY + 24 + 6 * 20 - 8;
        const bar = this.add.graphics();
        bar.fillStyle(0x003355, 0.4);
        bar.fillRect(lbX + 2, barY - 2, lbW - 4, 18);
        this.add.text(lbX + 16, barY, `${rank}.`, { fontSize: '12px', color: '#ffdd00', fontFamily: 'monospace', fontStyle: 'bold' });
        this.add.text(lbX + 40, barY, this.fmt(entry.score), { fontSize: '12px', color: '#6699bb', fontFamily: 'monospace' });
        this.add.text(lbX + 130, barY, `W${entry.wave}`, { fontSize: '12px', color: '#88aacc', fontFamily: 'monospace' });
      }
    }

    // ── Stats panel ──
    if (stats) {
      const spx = W / 2 - 190, spy = H / 2 + 80, spw = 380, sph = 50;
      const spGfx = this.add.graphics();
      spGfx.fillStyle(0x000a22, 0.8);
      spGfx.fillRect(spx, spy, spw, sph);
      spGfx.lineStyle(1, 0x002244, 0.7);
      spGfx.strokeRect(spx, spy, spw, sph);

      const sS2 = { fontSize: '9px', color: '#334466', fontFamily: 'monospace' };
      const vS2 = { fontSize: '14px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold' };
      this.add.text(spx + 12,  spy + 5,  'KILLS',         sS2);
      this.add.text(spx + 12,  spy + 17, stats.totalKills.toString(),  vS2);
      this.add.text(spx + 90,  spy + 5,  'MAX COMBO',     sS2);
      this.add.text(spx + 90,  spy + 17, `×${stats.maxCombo}`, vS2);
      this.add.text(spx + 195, spy + 5,  'PERFECT WAVES', sS2);
      this.add.text(spx + 195, spy + 17, stats.perfectWaves.toString(), vS2);
      this.add.text(spx + 290, spy + 5,  'BONUS',         sS2);
      this.add.text(spx + 290, spy + 17, `+${stats.bonusScore}`, { fontSize: '12px', color: '#ffdd00', fontFamily: 'monospace', fontStyle: 'bold' });
    }

    // ── Buttons ──
    this.buildButton(W / 2 - 115, H / 2 + 142, 'PLAY AGAIN', 0x00ccff, () => {
      this.cameras.main.fadeOut(400, 0, 0, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
    });
    this.buildButton(W / 2 + 115, H / 2 + 142, 'MAIN MENU', 0x0088aa, () => {
      this.cameras.main.fadeOut(400, 0, 0, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });

    this.cameras.main.fadeIn(500, 0, 0, 8);
  }

  private buildButton(x: number, y: number, label: string, color: number, cb: () => void): void {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const bg  = this.add.rectangle(0, 0, 210, 44, color, 0.15).setStrokeStyle(1, color, 0.6);
    const txt = this.add.text(0, 0, label, {
      fontSize: '14px', color: hex, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    const btn = this.add.container(x, y, [bg, txt]).setSize(210, 44).setInteractive({ useHandCursor: true });
    btn.on('pointerover',  () => { bg.setFillStyle(color, 0.3); txt.setColor('#ffffff'); });
    btn.on('pointerout',   () => { bg.setFillStyle(color, 0.15); txt.setColor(hex); });
    btn.on('pointerdown',  cb);
  }

  private fmt(n: number): string { return n.toString().padStart(6, '0'); }
}
