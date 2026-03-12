import Phaser from 'phaser';

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  public damage: number = 1;
  public isPlayer: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  fire(x: number, y: number, vx: number, vy: number, dmg: number, fromPlayer: boolean): void {
    this.damage = dmg;
    this.isPlayer = fromPlayer;
    this.enableBody(true, x, y, true, true);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
    if (!fromPlayer) this.setFlipX(true);
  }

  /** Reverse bullet direction (gravity flip effect). */
  reflect(): void {
    const b = this.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(-b.velocity.x * 1.4, -b.velocity.y * 0.5);
    this.isPlayer = true;
    this.setTint(0x00ffcc);
    this.damage = 2;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const { width: W, height: H } = this.scene.scale;
    if (this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) {
      this.disableBody(true, true);
    }
  }
}
