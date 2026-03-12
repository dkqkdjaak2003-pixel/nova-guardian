import Phaser from 'phaser';
import { ConfigManager } from '../core/ConfigManager';
import { Bullet } from './Bullet';
import { SoundManager } from '../core/SoundManager';

/** External normalized movement input from virtual joystick (−1…1 per axis). */
export interface ExternalInput {
  jx: number;
  jy: number;
  special: boolean; // gravity-flip requested
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly baseSpeed: number;
  private readonly baseFireRate: number;
  private readonly bulletSpeed: number;
  private readonly gravCooldown: number;

  private speedMult: number     = 1;
  private fireRateMult: number  = 1;

  get speed(): number    { return this.baseSpeed    * this.speedMult; }
  get fireRate(): number { return this.baseFireRate / this.fireRateMult; }

  setSpeedMultiplier(m: number): void    { this.speedMult    = m; }
  setFireRateMultiplier(m: number): void { this.fireRateMult = m; }

  private lastFire: number = 0;
  private lastGrav: number = -99999;
  private invincibleUntil: number = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;

  private bullets!: Phaser.Physics.Arcade.Group;
  private thrustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shieldSprite!: Phaser.GameObjects.Image;

  // Current facing angle (radians, Phaser convention: 0=right, π/2=down)
  private faceAngle: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, bulletsGroup: Phaser.Physics.Arcade.Group) {
    super(scene, x, y, 'player-ship');
    this.bullets = bulletsGroup;

    const cfg = ConfigManager.getInstance().settings.player;
    this.baseSpeed    = cfg.speed;
    this.baseFireRate = cfg.fireRate;
    this.bulletSpeed  = cfg.bulletSpeed;
    this.gravCooldown = cfg.gravityCooldown;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setGravityY(0);
    this.setDisplaySize(cfg.size.width, cfg.size.height);

    // ── Keyboard ──
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── Engine thrust trail ──
    this.thrustEmitter = scene.add.particles(x, y, 'particle', {
      speed:    { min: 80, max: 150 },
      angle:    { min: 160, max: 200 },
      scale:    { start: 0.45, end: 0 },
      alpha:    { start: 0.8,  end: 0 },
      tint:     [0x0066ff, 0x0088ff, 0x00ccff],
      lifespan: { min: 100, max: 220 },
      frequency: 16,
      quantity:  2,
    });

    // ── Shield ring (shown during invincibility) ──
    this.shieldSprite = scene.add.image(x, y, 'shield-ring').setAlpha(0).setScale(1.1);
  }

  // ──────────────────────────────────────────────────────────────────────────

  update(
    time: number,
    _delta: number,
    enemies: Phaser.Physics.Arcade.Group,
    ext?: ExternalInput
  ): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    let vx = 0, vy = 0;

    // ── Keyboard input (arrow keys + WASD) ──
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    vy -= this.speed;
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  vy += this.speed;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  vx -= this.speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx += this.speed;

    // ── Virtual joystick input ──
    if (ext) {
      const DEAD = 0.15;
      if (Math.abs(ext.jx) > DEAD) vx = ext.jx * this.speed;
      if (Math.abs(ext.jy) > DEAD) vy = ext.jy * this.speed;
    }

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const INV_SQRT2 = 0.7071;
      vx *= INV_SQRT2;
      vy *= INV_SQRT2;
    }

    body.setVelocity(vx, vy);

    // ── Update facing angle ──
    if (vx !== 0 || vy !== 0) {
      this.faceAngle = Math.atan2(vy, vx);
      // Sprite faces right by default; setRotation(atan2) is correct in Phaser (Y-down)
      this.setRotation(this.faceAngle);
    }

    // ── Engine trail – emits from the back of the ship ──
    const backX = this.x - Math.cos(this.faceAngle) * this.displayWidth * 0.44;
    const backY = this.y - Math.sin(this.faceAngle) * this.displayWidth * 0.44;
    this.thrustEmitter.setPosition(backX, backY);
    // Aim trail opposite to facing direction (in degrees)
    // Dynamically aim thrust trail in opposite-to-facing direction
    const trailAngleDeg = Phaser.Math.RadToDeg(this.faceAngle) + 180;
    this.thrustEmitter.particleAngle = trailAngleDeg;

    // ── Shield ring ──
    this.shieldSprite.setPosition(this.x, this.y).setRotation(this.faceAngle);

    // ── Auto-fire toward nearest enemy ──
    if (time - this.lastFire >= this.fireRate) {
      this.shoot(enemies);
      this.lastFire = time;
    }

    // ── Gravity flip – keyboard ──
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      const gs = this.scene as { triggerGravityFlip?: (t: number) => void };
      if (gs.triggerGravityFlip) gs.triggerGravityFlip(time);
      else this.gravityFlip(time);
    }
    // ── Gravity flip – virtual button ──
    if (ext?.special) {
      const gs = this.scene as { triggerGravityFlip?: (t: number) => void };
      if (gs.triggerGravityFlip) gs.triggerGravityFlip(time);
      else this.gravityFlip(time);
    }

    // ── Invincibility blink ──
    if (time < this.invincibleUntil) {
      this.setAlpha(Math.sin(time * 0.022) > 0 ? 1 : 0.3);
    } else {
      this.setAlpha(1);
      if (time > this.invincibleUntil + 50) this.shieldSprite.setAlpha(0);
    }
  }

  // ── SHOOTING ──────────────────────────────────────────────────────────────

  private shoot(enemies: Phaser.Physics.Arcade.Group): void {
    // Find nearest enemy and aim toward it
    let fireAngle = this.faceAngle;
    let minDist = Infinity;

    enemies.getChildren().forEach(obj => {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d < minDist) {
        minDist = d;
        fireAngle = Math.atan2(e.y - this.y, e.x - this.x);
      }
    });

    const cosA = Math.cos(fireAngle);
    const sinA = Math.sin(fireAngle);
    // Perpendicular offset for dual cannons
    const perpX = -sinA * 9;
    const perpY =  cosA * 9;
    const spawnDist = this.displayWidth * 0.5;

    let fired = false;
    [-1, 1].forEach(side => {
      const sx = this.x + cosA * spawnDist + perpX * side;
      const sy = this.y + sinA * spawnDist + perpY * side;
      const b = this.bullets.get(sx, sy) as Bullet | null;
      if (b) { b.fire(sx, sy, cosA * this.bulletSpeed, sinA * this.bulletSpeed, 1, true); fired = true; }
    });
    if (fired) SoundManager.playShoot(true);
  }

  // ── GRAVITY FLIP ──────────────────────────────────────────────────────────

  gravityFlip(time: number): boolean {
    if (time - this.lastGrav < this.gravCooldown) return false;
    this.lastGrav = time;

    this.scene.tweens.add({
      targets: this, scaleX: 1.4, scaleY: 0.7,
      duration: 70, yoyo: true,
    });

    const burst = this.scene.add.particles(this.x, this.y, 'particle', {
      speed:    { min: 220, max: 520 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 0.9, end: 0 },
      alpha:    { start: 1, end: 0 },
      tint:     [0x00ffcc, 0x00ddff, 0x0088ff],
      lifespan: 480,
      quantity: 32,
      emitting: false,
    });
    burst.explode(32, this.x, this.y);
    this.scene.time.delayedCall(550, () => burst.destroy());
    SoundManager.playGravFlip();
    return true;
  }

  // ── HIT / INVINCIBILITY ───────────────────────────────────────────────────

  hit(time: number): boolean {
    if (time < this.invincibleUntil) return false;
    const invTime = ConfigManager.getInstance().settings.player.invincibilityTime;
    this.invincibleUntil = time + invTime;
    this.shieldSprite.setAlpha(0.75);
    this.scene.tweens.add({
      targets: this.shieldSprite, alpha: 0,
      duration: 350, delay: invTime - 350,
    });
    return true;
  }

  isInvincible(time: number): boolean { return time < this.invincibleUntil; }

  getGravCooldownPct(time: number): number {
    return Math.min(1, (time - this.lastGrav) / this.gravCooldown);
  }

  destroy(fromScene?: boolean): void {
    this.thrustEmitter?.destroy();
    this.shieldSprite?.destroy();
    super.destroy(fromScene);
  }
}
