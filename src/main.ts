import Phaser from 'phaser';
import { BootScene }      from './scenes/BootScene';
import { MenuScene }      from './scenes/MenuScene';
import { GameScene }      from './scenes/GameScene';
import { GameOverScene }  from './scenes/GameOverScene';
import { DisplayManager } from './core/DisplayManager';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#000008',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
  scale: DisplayManager.buildScaleConfig({ mode: 'fit', enableHiDPI: false }),
  render: {
    antialias: false,
    pixelArt: false,
    roundPixels: true,
  },
};

const game = new Phaser.Game(config);
DisplayManager.init(game);
