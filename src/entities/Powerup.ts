import Phaser from 'phaser';

export type PowerupType = 'rapid' | 'shield' | 'nuke' | 'speed' | 'multi';

export const POWERUP_LABELS: Record<PowerupType, string> = {
  rapid:  'RAPID FIRE',
  shield: 'SHIELD',
  nuke:   'NUKE',
  speed:  'SPEED UP',
  multi:  '2× SCORE',
};

export class Powerup extends Phaser.Physics.Arcade.Sprite {
  public pType: PowerupType;

  constructor(scene: Phaser.Scene, x: number, y: number, type: PowerupType) {
    super(scene, x, y, `powerup-${type}`);
    this.pType = type;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(0.5);
    body.setDrag(60);
    body.setVelocity(
      Phaser.Math.Between(-100, 100),
      Phaser.Math.Between(-100, 100),
    );

    // Pulsing tween
    scene.tweens.add({
      targets: this,
      scaleX: 1.3, scaleY: 1.3,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Fade out and destroy after 12 s
    scene.time.delayedCall(10000, () => {
      if (!this.active) return;
      scene.tweens.add({
        targets: this, alpha: 0, duration: 2000,
        onComplete: () => { if (this.active) this.destroy(); },
      });
    });
  }
}
