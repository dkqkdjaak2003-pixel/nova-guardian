import Phaser from 'phaser';
import { Bullet } from './Bullet';
import { ConfigManager } from '../core/ConfigManager';
import { SoundManager } from '../core/SoundManager';

let _lastEnemyShootSnd = 0; // global cooldown to prevent audio spam

export type EnemyType = 'scout' | 'fighter' | 'bomber' | 'boss' | 'interceptor' | 'sniper';
export const EnemyType = {
  SCOUT:       'scout'       as const,
  FIGHTER:     'fighter'     as const,
  BOMBER:      'bomber'      as const,
  BOSS:        'boss'        as const,
  INTERCEPTOR: 'interceptor' as const,
  SNIPER:      'sniper'      as const,
};

export type SpawnEdge = 'right' | 'left' | 'top' | 'bottom' | 'random';

interface EnemyDef {
  texture: string;
  speed: number;
  hp: number;
  score: number;
  fireRate: number;
  w: number;
  h: number;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  public type: EnemyType;
  public score: number;
  public maxHp: number;
  public hp: number;
  private speed: number;
  private fireRate: number;
  private lastFire: number = 0;
  private sinAmp: number = 0;
  private sinFreq: number = 0;
  private sinOffset: number = 0;
  private hpBar?: Phaser.GameObjects.Graphics;
  private phase: number = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType) {
    const def = Enemy.getDef(type);
    super(scene, x, y, def.texture);
    this.type    = type;
    this.score   = def.score;
    this.maxHp   = def.hp;
    this.hp      = def.hp;
    this.speed   = def.speed;
    this.fireRate = def.fireRate;

    if (type === EnemyType.SCOUT) {
      this.sinAmp  = Phaser.Math.Between(40, 80);
      this.sinFreq = Phaser.Math.FloatBetween(0.9, 2.0);
    } else if (type === EnemyType.FIGHTER) {
      this.sinAmp  = Phaser.Math.Between(30, 60);
      this.sinFreq = Phaser.Math.FloatBetween(0.5, 1.2);
    }

    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(false);
    this.setDisplaySize(def.w, def.h);

    if (type !== EnemyType.SCOUT) {
      this.hpBar = scene.add.graphics();
    }
  }

  private static getDef(type: EnemyType): EnemyDef {
    const cfg = ConfigManager.getInstance().settings.enemies;
    const map: Record<EnemyType, EnemyDef> = {
      scout:       { texture: 'enemy-scout',       ...cfg.scout,       w: cfg.scout.size.width,       h: cfg.scout.size.height       },
      fighter:     { texture: 'enemy-fighter',     ...cfg.fighter,     w: cfg.fighter.size.width,     h: cfg.fighter.size.height     },
      bomber:      { texture: 'enemy-bomber',      ...cfg.bomber,      w: cfg.bomber.size.width,      h: cfg.bomber.size.height      },
      boss:        { texture: 'enemy-boss',        ...cfg.boss,        w: cfg.boss.size.width,        h: cfg.boss.size.height        },
      interceptor: { texture: 'enemy-interceptor', ...cfg.interceptor, w: cfg.interceptor.size.width, h: cfg.interceptor.size.height },
      sniper:      { texture: 'enemy-sniper',      ...cfg.sniper,      w: cfg.sniper.size.width,      h: cfg.sniper.size.height      },
    };
    return map[type];
  }

  /** Scale HP, speed, fireRate based on wave number for infinite difficulty curve. */
  applyDifficulty(wave: number): void {
    if (wave <= 1) return;
    const w = wave - 1;
    const hpMult   = Math.min(1 + w * 0.040, 20);
    const spdMult  = Math.min(1 + w * 0.012, 4.5);
    const fireMult = Math.max(1 - w * 0.008, 0.22);
    this.hp       = Math.max(1, Math.round(this.hp       * hpMult));
    this.maxHp    = this.hp;
    this.speed    = Math.round(this.speed    * spdMult);
    this.fireRate = Math.round(this.fireRate * fireMult);
  }

  // ──────────────────────────────────────────────────────────────────────────

  update(time: number, bullets: Phaser.Physics.Arcade.Group, playerX: number, playerY: number): void {
    if (!this.active) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;

    // ── Movement: all enemies home toward player ──
    if (this.type === EnemyType.BOSS) {
      this.updateBoss(body, nx, ny, playerY);
    } else if (this.type === EnemyType.BOMBER) {
      body.setVelocity(nx * this.speed, ny * this.speed);
    } else if (this.type === EnemyType.INTERCEPTOR) {
      // Lightning-fast straight-line dash
      body.setVelocity(nx * this.speed, ny * this.speed);
    } else if (this.type === EnemyType.SNIPER) {
      // Maintain ideal distance and strafe
      const IDEAL = 320;
      const dist = Math.hypot(dx, dy);
      const strafeDir = Math.sin(time * 0.0009 + this.sinOffset) > 0 ? 1 : -1;
      if (dist > IDEAL + 90) {
        body.setVelocity(nx * this.speed, ny * this.speed);
      } else if (dist < IDEAL - 90) {
        body.setVelocity(-nx * this.speed * 0.8, -ny * this.speed * 0.8);
      } else {
        body.setVelocity(-ny * this.speed * strafeDir * 0.7, nx * this.speed * strafeDir * 0.7);
      }
    } else {
      // Scout / Fighter: homing + perpendicular sine wobble
      const elapsed = (time - this.sinOffset) / 1000;
      const wobble = Math.sin(elapsed * this.sinFreq * Math.PI * 2) * this.sinAmp;
      const px = -ny * wobble;
      const py =  nx * wobble;
      body.setVelocity(nx * this.speed + px, ny * this.speed + py);
    }

    // ── Sprite faces toward player ──
    // Enemy sprite drawn facing LEFT. Formula: setRotation(atan2(this.y-pY, this.x-pX))
    this.setRotation(Math.atan2(this.y - playerY, this.x - playerX));

    // ── HP bar ──
    if (this.hpBar) this.drawHpBar();

    // ── Fire toward player ──
    this.tryFire(time, bullets, playerX, playerY, nx, ny);
  }

  private updateBoss(
    body: Phaser.Physics.Arcade.Body,
    nx: number, _ny: number,
    playerY: number
  ): void {
    if (this.hp <= this.maxHp / 2 && this.phase === 1) {
      this.phase = 2;
      this.speed = Math.floor(this.speed * 1.35);
      this.fireRate = Math.floor(this.fireRate * 0.55);
      this.setTint(0xff3333);
    }
    const vspeed = this.phase === 2 ? 170 : 120;
    // Boss does slow X homing + faster Y homing
    body.setVelocity(
      Phaser.Math.Clamp(nx * this.speed, -vspeed, vspeed),
      Phaser.Math.Clamp((playerY - this.y) * 3, -vspeed, vspeed)
    );
  }

  private tryFire(
    time: number,
    bullets: Phaser.Physics.Arcade.Group,
    _playerX: number, _playerY: number,
    nx: number, ny: number
  ): void {
    if (time - this.lastFire < this.fireRate) return;
    this.lastFire = time + Phaser.Math.Between(-150, 200);
    if (time - _lastEnemyShootSnd > 110) { SoundManager.playShoot(false); _lastEnemyShootSnd = time; }

    const shoot = (vx: number, vy: number) => {
      const b = bullets.get(this.x, this.y) as Bullet | null;
      if (b) b.fire(this.x, this.y, vx, vy, 1, false);
    };

    const spd = 380;

    if (this.type === EnemyType.INTERCEPTOR) {
      // Fast burst shot
      shoot(nx * spd * 0.9, ny * spd * 0.9);

    } else if (this.type === EnemyType.SNIPER) {
      // Single precise high-velocity shot
      shoot(nx * 680, ny * 680);

    } else if (this.type === EnemyType.SCOUT) {
      shoot(nx * spd, ny * spd);

    } else if (this.type === EnemyType.FIGHTER) {
      shoot(nx * spd, ny * spd);
      // Small random spread shot
      const offset = Phaser.Math.FloatBetween(-0.25, 0.25);
      const baseAngle = Math.atan2(ny, nx) + offset;
      shoot(Math.cos(baseAngle) * 340, Math.sin(baseAngle) * 340);

    } else if (this.type === EnemyType.BOMBER) {
      // 3-way spread
      const baseAngle = Math.atan2(ny, nx);
      for (const spread of [-0.42, 0, 0.42]) {
        const a = baseAngle + spread;
        shoot(Math.cos(a) * 340, Math.sin(a) * 340);
      }

    } else if (this.type === EnemyType.BOSS) {
      // Aimed shot
      shoot(nx * 420, ny * 420);
      if (this.phase === 2) {
        // Phase 2: full radial burst
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 / 8) * i;
          shoot(Math.cos(a) * 340, Math.sin(a) * 340);
        }
      } else {
        // Phase 1: spread fan
        const base = Math.atan2(ny, nx);
        for (const spread of [-0.55, -0.28, 0.28, 0.55]) {
          shoot(Math.cos(base + spread) * 370, Math.sin(base + spread) * 370);
        }
      }
    }
  }

  private drawHpBar(): void {
    if (!this.hpBar) return;
    const pct = Math.max(0, this.hp / this.maxHp);
    const bw = this.displayWidth * 0.85;
    const bh = 5;
    const bx = this.x - bw / 2;
    const by = this.y - this.displayHeight / 2 - 10;

    this.hpBar.clear();
    this.hpBar.fillStyle(0x111111, 0.7);
    this.hpBar.fillRect(bx, by, bw, bh);
    const col = pct > 0.5 ? 0x00ff88 : pct > 0.25 ? 0xffcc00 : 0xff3300;
    this.hpBar.fillStyle(col, 1);
    this.hpBar.fillRect(bx, by, bw * pct, bh);
    this.hpBar.lineStyle(1, 0x334455, 0.5);
    this.hpBar.strokeRect(bx, by, bw, bh);
  }

  takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    this.setTint(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      this.clearTint();
      if (this.type === EnemyType.BOSS && this.phase === 2) this.setTint(0xff3333);
    });
    return this.hp <= 0;
  }

  kill(): void {
    this.hpBar?.destroy();
    this.disableBody(true, true);
  }

  setSinOffset(t: number): void { this.sinOffset = t; }
}
