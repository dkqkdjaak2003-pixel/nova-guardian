import Phaser from 'phaser';
import { AssetGenerator } from '../core/AssetGenerator';
import { ConfigManager } from '../core/ConfigManager';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    this.load.text('gameConfig', 'config/settings.yaml');

    // Loading bar UI
    const { width: W, height: H } = this.scale;
    const barBg = this.add.rectangle(W / 2, H / 2, 420, 28, 0x111133);
    const bar   = this.add.rectangle(W / 2 - 208, H / 2, 4, 20, 0x00ccff);
    bar.setOrigin(0, 0.5);

    this.add.text(W / 2, H / 2 - 40, 'NOVA GUARDIAN', {
      fontSize: '28px', color: '#00ccff',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#003366', strokeThickness: 4,
    }).setOrigin(0.5);

    const label = this.add.text(W / 2, H / 2 + 28, 'INITIALIZING SYSTEMS...', {
      fontSize: '11px', color: '#4488aa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      bar.width = 4 + 412 * v;
      barBg.setStrokeStyle(1, 0x2244aa);
    });
    this.load.on('complete', () => {
      label.setText('SYSTEMS ONLINE');
      label.setColor('#00ffcc');
    });
  }

  create(): void {
    // Parse config
    const text = this.cache.text.get('gameConfig');
    ConfigManager.getInstance().loadFromText(text);

    // Generate all procedural textures
    AssetGenerator.generateAll(this);

    this.time.delayedCall(400, () => this.scene.start('MenuScene'));
  }
}
