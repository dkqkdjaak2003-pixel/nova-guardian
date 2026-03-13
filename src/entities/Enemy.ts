import Phaser from 'phaser';
import { Bullet } from './Bullet';
import { ConfigManager } from '../core/ConfigManager';
import { SoundManager } from '../core/SoundManager';

let _lastEnemyShootSnd = 0; // global cooldown to prevent audio spam

export type EnemyType = 'scout' | 'fighter' | 'bomber' | 'boss' | 'interceptor' | 'sniper' | 'carrier' | 'turret';
export const EnemyType = {
  SCOUT:       'scout'       as const,
  FIGHTER:     'fighter'     as const,
  BOMBER:      'bomber'      as const,
  BOSS:        'boss'        as const,
  INTERCEPTOR: 'interceptor' as const,
  SNIPER:      'sniper'      as const,
  CARRIER:     'carrier'     as const,
  TURRET:      'turret'      as const,
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
  private turretAngle: number = 0;
  private lastDroneSpawn: number = -99999;
  private readonly DRONE_INTERVAL = 3800;
  public  isElite: boolean = false;
  private eliteGlow?: Phaser.GameObjects.Graphics;

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
    if (type === EnemyType.TURRET) {
      this.turretAngle = Math.random() * Math.PI * 2;
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
      carrier:     { texture: 'enemy-carrier',     ...cfg.carrier,     w: cfg.carrier.size.width,     h: cfg.carrier.size.height     },
      turret:      { texture: 'enemy-turret',      ...cfg.turret,      w: cfg.turret.size.width,      h: cfg.turret.size.height      },
    };
    return map[type];
  }

  /** Apply global difficulty multipliers (EASY/NORMAL/HARD). */
  applyGlobalDifficulty(cfg: { enemyHpMult: number; enemySpeedMult: number; enemyFireRateMult: number }): void {
    this.hp        = Math.max(1, Math.round(this.hp    * cfg.enemyHpMult));
    this.maxHp     = this.hp;
    this.speed     = Math.round(this.speed             * cfg.enemySpeedMult);
    this.fireRate  = Math.round(this.fireRate           * cfg.enemyFireRateMult);
  }

  /** Upgrades this enemy to elite status (higher stats, gold visual). */
  makeElite(): void {
    this.isElite = true;
    this.hp    = Math.round(this.hp    * 2.0);
    this.maxHp = this.hp;
    this.speed = Math.round(this.speed * 1.25);
    this.score = Math.round(this.score * 2.5);
    this.setScale(this.scaleX * 1.18, this.scaleY * 1.18);
    this.setTint(0xffaa44);
    this.eliteGlow = this.scene.add.graphics();
  }

  /** Returns true when the carrier should spawn a drone (called once per frame). */
  shouldSpawnDrone(time: number): boolean {
    if (this.type !== EnemyType.CARRIER) return false;
    if (time - this.lastDroneSpawn < this.DRONE_INTERVAL) return false;
    this.lastDroneSpawn = time;
    return true;
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

    // Elite glow ring
    if (this.isElite && this.eliteGlow) {
      const r = this.displayWidth * 0.62;
      this.eliteGlow.clear();
      const pulse = 0.45 + Math.sin(Date.now() * 0.007) * 0.3;
      this.eliteGlow.lineStyle(2.5, 0xffaa44, pulse);
      this.eliteGlow.strokeCircle(this.x, this.y, r);
    }

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
    } else if (this.type === EnemyType.TURRET) {
      this.updateTurret(body, nx, ny);
    } else if (this.type === EnemyType.CARRIER) {
      this.updateCarrier(body, playerX, playerY);
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
    if (this.type !== EnemyType.TURRET) {
      this.setRotation(Math.atan2(this.y - playerY, this.x - playerX));
    }

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
    if (this.hp <= this.maxHp * 0.25 && this.phase === 2) {
      this.phase = 3;
      this.speed = Math.floor(this.speed * 1.2);
      this.fireRate = Math.floor(this.fireRate * 0.6);
      this.setTint(0xff0000);
      // 3페이즈 돌입 시 플래시 이벤트 emit
      this.scene.events.emit('boss-phase3', this.x, this.y);
    }
    if (this.hp <= this.maxHp / 2 && this.phase === 1) {
      this.phase = 2;
      this.speed = Math.floor(this.speed * 1.35);
      this.fireRate = Math.floor(this.fireRate * 0.55);
      this.setTint(0xff3333);
    }
    const vspeed = this.phase === 2 ? 170 : this.phase === 3 ? 200 : 120;
    // Boss does slow X homing + faster Y homing
    body.setVelocity(
      Phaser.Math.Clamp(nx * this.speed, -vspeed, vspeed),
      Phaser.Math.Clamp((playerY - this.y) * 3, -vspeed, vspeed)
    );
  }

  private updateTurret(
    body: Phaser.Physics.Arcade.Body,
    nx: number,
    ny: number,
  ): void {
    // 매우 느리게 플레이어 방향으로 이동하며 포탑 자체는 회전
    body.setVelocity(nx * this.speed * 0.4, ny * this.speed * 0.4);
    this.turretAngle += 0.022;
    this.setRotation(this.turretAngle);
  }

  private updateCarrier(
    body: Phaser.Physics.Arcade.Body,
    _playerX: number,
    playerY: number,
  ): void {
    const { width: W } = this.scene.scale;
    const targetX = W * 0.78;
    const dx = targetX - this.x;
    const dy = playerY - this.y;
    body.setVelocity(
      Phaser.Math.Clamp(dx * 1.2, -this.speed, this.speed),
      Phaser.Math.Clamp(dy * 1.8, -this.speed * 0.7, this.speed * 0.7),
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
      if (this.phase === 3) {
        // Phase 3: 전방향 + 나선형 발사
        const spiralOff = (Date.now() * 0.003) % (Math.PI * 2);
        for (let i = 0; i < 12; i++) {
          const a = spiralOff + (Math.PI * 2 / 12) * i;
          shoot(Math.cos(a) * 300, Math.sin(a) * 300);
        }
      } else if (this.phase === 2) {
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
    } else if (this.type === EnemyType.CARRIER) {
      // 3방향 발사 (아래, 앞쪽 대각, 위)
      const baseAngle = Math.atan2(ny, nx);
      for (const spread of [-0.5, 0, 0.5]) {
        const a = baseAngle + spread;
        shoot(Math.cos(a) * 320, Math.sin(a) * 320);
      }
    } else if (this.type === EnemyType.TURRET) {
      // 8방향 회전 연속 발사
      const numBullets = 8;
      for (let i = 0; i < numBullets; i++) {
        const a = this.turretAngle + (Math.PI * 2 / numBullets) * i;
        shoot(Math.cos(a) * 260, Math.sin(a) * 260);
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
      if      (this.type === EnemyType.BOSS && this.phase === 3) this.setTint(0xff0000);
      else if (this.type === EnemyType.BOSS && this.phase === 2) this.setTint(0xff3333);
      else if (this.isElite)                                      this.setTint(0xffaa44);
      else                                                        this.clearTint();
    });
    return this.hp <= 0;
  }

  kill(): void {
    this.hpBar?.destroy();
    this.eliteGlow?.destroy();
    this.disableBody(true, true);
  }

  setSinOffset(t: number): void { this.sinOffset = t; }
}
