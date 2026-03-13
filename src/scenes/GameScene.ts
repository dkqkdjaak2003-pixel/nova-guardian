import Phaser from 'phaser';
import { Player, type ExternalInput, type UpgradeId } from '../entities/Player';
import { Enemy, EnemyType, type SpawnEdge } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Powerup, type PowerupType, POWERUP_LABELS } from '../entities/Powerup';
import { ConfigManager } from '../core/ConfigManager';
import { SoundManager } from '../core/SoundManager';
import { DifficultyManager } from '../core/DifficultyManager';

// ── Upgrade definitions ────────────────────────────────────────────────────

interface UpgradeOption {
  id: UpgradeId;
  label: string;
  desc: string;
  icon: string;
  color: number;
}

const ALL_UPGRADES: UpgradeOption[] = [
  { id: 'speed',        label: 'AFTERBURNER',   desc: 'Move speed +20%',              icon: '⚡', color: 0x00ff88 },
  { id: 'fireRate',     label: 'RAPID CANNON',  desc: 'Fire rate +30%',               icon: '🔥', color: 0xff8800 },
  { id: 'tripleShot',   label: 'TRIPLE SHOT',   desc: 'Fire 3 shots simultaneously',  icon: '⬡', color: 0x00ffcc },
  { id: 'damage',       label: 'OVERCHARGE',    desc: 'Bullet damage ×1.5',           icon: '💥', color: 0xff4400 },
  { id: 'invincibility',label: 'ARMOR PLATING', desc: 'Invincibility time +0.6s',     icon: '🛡', color: 0x00ccff },
  { id: 'cooldown',     label: 'FLUX DRIVE',    desc: 'G-Flip cooldown -30%',         icon: '↕', color: 0x8800ff },
  { id: 'wideSpread',   label: 'WIDE SPREAD',   desc: 'Wider cannon spread',          icon: '↔', color: 0xffdd00 },
];

// ── Wave entry ────────────────────────────────────────────────────────────────

interface SpawnEntry {
  type: EnemyType;
  count: number;
  delay: number;
  edge: SpawnEdge;
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  // BG
  private nebula!:    Phaser.GameObjects.TileSprite;
  private starsFar!:  Phaser.GameObjects.TileSprite;
  private starsNear!: Phaser.GameObjects.TileSprite;
  private planet!:    Phaser.GameObjects.Image;

  // Entities
  private player!:        Player;
  private enemies!:       Phaser.Physics.Arcade.Group;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!:  Phaser.Physics.Arcade.Group;
  private powerups!:      Phaser.Physics.Arcade.Group;

  // Wave state
  private waveIndex:       number = 0;
  private spawnQueue:      { type: EnemyType; edge: SpawnEdge; t: number }[] = [];
  private waveActive:      boolean = false;
  private waveEnemyTotal:  number = 0;
  private waveEnemyKilled: number = 0;

  // Game state
  private score:    number  = 0;
  private coins:    number  = 0;
  private lives:    number  = 3;
  private paused:   boolean = false;
  private gameOver: boolean = false;

  // Game statistics
  private statKills:        number = 0;
  private statMaxCombo:     number = 0;
  private statPerfectWaves: number = 0;
  private statBonusScore:   number = 0;
  private waveStartLives:   number = 3;

  // Combo / multiplier
  private killStreak:      number = 0;
  private scoreMultiplier: number = 1;
  private streakTimer?: Phaser.Time.TimerEvent;

  // Buff state (endTime in ms)
  private rapidFireUntil:  number = 0;
  private shieldUntil:     number = 0;
  private speedBoostUntil: number = 0;
  private scoreMultUntil:  number = 0;

  // Upgrade
  private upgradeScreenOpen: boolean = false;

  // Achievements
  private unlockedAchievements: Set<string> = new Set();

  // UI
  private scoreText!:       Phaser.GameObjects.Text;
  private waveText!:        Phaser.GameObjects.Text;
  private livesGroup!:      Phaser.GameObjects.Group;
  private gravBar!:         Phaser.GameObjects.Graphics;
  private gravIcon!:        Phaser.GameObjects.Image;
  private bossHpContainer!: Phaser.GameObjects.Container;
  private bossHpFill!:      Phaser.GameObjects.Graphics;
  private streakText!:      Phaser.GameObjects.Text;
  private buffIcons!:       Phaser.GameObjects.Container;
  private enemyArrows!:     Phaser.GameObjects.Graphics;
  private coinsText!:       Phaser.GameObjects.Text;

  // Mobile virtual joystick
  private joystickBase!:    Phaser.GameObjects.Image;
  private joystickThumb!:   Phaser.GameObjects.Image;
  private joystickActive:   boolean = false;
  private joystickPointerId: number = -1;
  private joystickOriginX:  number  = 0;
  private joystickOriginY:  number  = 0;
  private joystickDeltaX:   number  = 0;
  private joystickDeltaY:   number  = 0;
  private readonly JS_RADIUS = 62;
  private isMobileDevice: boolean = false;

  private specialBtnDown:     boolean = false;
  private specialBtnConsumed: boolean = false;

  constructor() { super('GameScene'); }

  // ── CREATE ────────────────────────────────────────────────────────────────

  create(): void {
    const { width: W, height: H } = this.scale;
    this.score = 0; this.coins = 0; this.lives = DifficultyManager.config().startLives; this.waveIndex = 0;
    this.paused = false; this.gameOver = false;
    this.killStreak = 0; this.scoreMultiplier = 1;
    this.rapidFireUntil = this.shieldUntil = this.speedBoostUntil = this.scoreMultUntil = 0;
    this.upgradeScreenOpen = false;
    this.statKills = 0; this.statMaxCombo = 0; this.statPerfectWaves = 0; this.statBonusScore = 0;
    this.waveStartLives = DifficultyManager.config().startLives;

    const saved = JSON.parse(localStorage.getItem('nova_achievements') ?? '[]') as string[];
    this.unlockedAchievements = new Set(saved);

    // 모바일 감지
    const dev = this.sys.game.device;
    this.isMobileDevice = dev.os.android || dev.os.iOS || dev.input.touch;

    // ── Backgrounds ──
    this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, 'arena-grid').setDisplaySize(W, H).setAlpha(0.6);
    this.nebula    = this.add.tileSprite(W / 2, H / 2, W, H, 'nebula').setAlpha(0.45);
    this.starsFar  = this.add.tileSprite(W / 2, H / 2, W, H, 'stars-far');
    this.starsNear = this.add.tileSprite(W / 2, H / 2, W, H, 'stars-near').setAlpha(0.8);
    this.planet    = this.add.image(680, 340, 'planet').setAlpha(0.35).setScale(0.75);

    // ── Physics groups ──
    this.playerBullets = this.physics.add.group({
      classType: Bullet, maxSize: 80, runChildUpdate: true,
      defaultKey: 'bullet-player',
    });
    this.enemyBullets = this.physics.add.group({
      classType: Bullet, maxSize: 120, runChildUpdate: true,
      defaultKey: 'bullet-enemy',
    });
    this.enemies  = this.physics.add.group({ runChildUpdate: false });
    this.powerups = this.physics.add.group();

    // ── Player ──
    this.player = new Player(this, W / 2, H / 2, this.playerBullets);

    // ── Physics overlaps ──
    this.physics.add.overlap(
      this.playerBullets,
      this.enemies as unknown as Phaser.GameObjects.GameObject,
      this.onPlayerBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );
    this.physics.add.overlap(
      this.enemyBullets,
      this.player,
      this.onEnemyBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );
    this.physics.add.overlap(
      this.player,
      this.enemies as unknown as Phaser.GameObjects.GameObject,
      this.onPlayerTouchEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );
    this.physics.add.overlap(
      this.player,
      this.powerups as unknown as Phaser.GameObjects.GameObject,
      this.onPowerupCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // ── UI ──
    this.buildUI();
    const diffCfg = DifficultyManager.config();
    const diffColor = '#' + diffCfg.color.toString(16).padStart(6, '0');
    this.add.text(W / 2 + 60, 13, diffCfg.label, {
      fontSize: '10px', color: diffColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0).setDepth(51);
    this.buildMobileControls();

    this.input.keyboard!.on('keydown-ESC', () => this.togglePause());

    this.cameras.main.fadeIn(500, 0, 0, 8);
    this.time.delayedCall(1000, () => this.launchWave(0));

    SoundManager.resume();
    SoundManager.startBGM('game');

    this.events.on('boss-phase3', (bx: number, by: number) => {
      this.cameras.main.flash(400, 255, 0, 0, false);
      this.cameras.main.shake(600, 0.025);
      const { width: W, height: H } = this.scale;
      const warn = this.add.text(W / 2, H / 2 - 60, '⚠  CRITICAL  ⚠', {
        fontSize: '28px', color: '#ff0000', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#ffffff', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setDepth(70);
      this.tweens.add({
        targets: warn, alpha: 1, duration: 200, hold: 1000, yoyo: true,
        onComplete: () => warn.destroy(),
      });
      void bx; void by;
    });
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    if (this.paused || this.gameOver || this.upgradeScreenOpen) return;

    // Scroll BG
    this.starsFar.tilePositionX  += 0.2;
    this.starsNear.tilePositionX += 0.45;
    this.nebula.tilePositionX    += 0.07;
    this.planet.x -= 0.03;
    if (this.planet.x < -100) this.planet.x = this.scale.width + 100;

    // Apply / expire buff effects
    const now = time;
    this.player.setFireRateMultiplier(now < this.rapidFireUntil  ? 3   : 1);
    this.player.setSpeedMultiplier   (now < this.speedBoostUntil ? 1.6 : 1);

    // Build external input
    const ext: ExternalInput = {
      jx: this.joystickDeltaX,
      jy: this.joystickDeltaY,
      special: this.specialBtnDown && !this.specialBtnConsumed,
    };
    if (ext.special) this.specialBtnConsumed = true;

    this.player.update(time, delta, this.enemies, ext);

    const { width: W, height: H } = this.scale;
    const OFF = 280;
    this.enemies.getChildren().forEach(obj => {
      const en = obj as Enemy;
      if (!en.active) return;
      en.update(time, this.enemyBullets, this.player.x, this.player.y);
      // CARRIER 드론 스폰
      if (en.shouldSpawnDrone(time)) {
        for (let d = 0; d < 2; d++) {
          this.spawnDroneFrom(en, time);
        }
      }
      if (en.x < -OFF || en.x > W + OFF || en.y < -OFF || en.y > H + OFF) {
        this.explodeEnemy(en);
        en.kill();
        this.waveEnemyKilled++;
      }
    });

    this.processSpawnQueue(time);

    if (this.waveActive
      && this.waveEnemyKilled >= this.waveEnemyTotal
      && this.enemies.countActive() === 0) {
      this.waveActive = false;
      this.scheduleNextWave();
    }

    this.updateUI(time);
  }

  // ── WAVE SYSTEM ───────────────────────────────────────────────────────────

  private generateWave(idx: number): SpawnEntry[] {
    const waveNum = idx + 1;
    const cycle   = Math.floor((waveNum - 1) / 10);
    const pos     = ((waveNum - 1) % 10) + 1;

    const isBoss    = pos === 10;
    const isMidBoss = pos === 5;

    const cnt = (base: number) =>
      Math.max(1, Math.floor(base * (1 + cycle * 0.28)));
    const dly = (base: number) =>
      Math.max(280, Math.floor(base * Math.max(0.45, 1 - cycle * 0.055)));

    const result: SpawnEntry[] = [];

    if (isBoss) {
      result.push({ type: EnemyType.BOSS,        count: 1,        delay: 1000,       edge: 'right'  });
      result.push({ type: EnemyType.FIGHTER,     count: cnt(3),   delay: dly(1000),  edge: 'random' });
      if (cycle >= 1) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(4), delay: dly(600),  edge: 'random' });
      if (cycle >= 2) result.push({ type: EnemyType.SNIPER,      count: cnt(2), delay: dly(2200), edge: 'random' });
      if (cycle >= 2) result.push({ type: EnemyType.CARRIER,     count: 1,      delay: 2500,       edge: 'right'  });
      if (cycle >= 2) result.push({ type: EnemyType.TURRET,      count: 1,      delay: 3500,       edge: 'right'  });
      if (cycle >= 3) result.push({ type: EnemyType.BOMBER,      count: cnt(2), delay: dly(2000), edge: 'random' });
      return result;
    }

    if (isMidBoss) {
      result.push({ type: EnemyType.BOMBER, count: cnt(2), delay: dly(2000), edge: 'right' });
      if (cycle >= 1) result.push({ type: EnemyType.SNIPER,      count: cnt(2), delay: dly(2500), edge: 'random' });
      else            result.push({ type: EnemyType.FIGHTER,     count: cnt(3), delay: dly(1200), edge: 'random' });
      if (cycle >= 2) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(3), delay: dly(600),  edge: 'random' });
      return result;
    }

    switch (pos) {
      case 1:
        result.push({ type: EnemyType.SCOUT, count: cnt(5), delay: dly(800), edge: 'right' });
        if (cycle >= 2) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(3), delay: dly(600), edge: 'random' });
        break;
      case 2:
        result.push({ type: EnemyType.SCOUT,   count: cnt(4), delay: dly(750),  edge: 'right' });
        result.push({ type: EnemyType.FIGHTER,  count: cnt(2), delay: dly(1400), edge: 'random' });
        break;
      case 3:
        if (cycle >= 1) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(7), delay: dly(480), edge: 'random' });
        result.push({ type: EnemyType.SCOUT, count: cnt(3), delay: dly(700), edge: 'right' });
        break;
      case 4:
        if (cycle >= 1) result.push({ type: EnemyType.SNIPER,  count: cnt(2), delay: dly(2500), edge: 'random' });
        result.push({ type: EnemyType.FIGHTER, count: cnt(3), delay: dly(1200), edge: 'random' });
        if (cycle >= 2) result.push({ type: EnemyType.TURRET, count: 1, delay: 2200, edge: 'right' });
        break;
      case 6:
        result.push({ type: EnemyType.BOMBER, count: cnt(2), delay: dly(2200), edge: 'right' });
        if (cycle >= 1) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(4), delay: dly(600),  edge: 'random' });
        else            result.push({ type: EnemyType.SCOUT,       count: cnt(4), delay: dly(750),  edge: 'random' });
        break;
      case 7:
        result.push({ type: EnemyType.SCOUT,   count: cnt(5), delay: dly(640),  edge: 'random' });
        result.push({ type: EnemyType.FIGHTER,  count: cnt(3), delay: dly(1200), edge: 'random' });
        if (cycle >= 1) result.push({ type: EnemyType.SNIPER, count: cnt(2), delay: dly(2000), edge: 'random' });
        if (cycle >= 2) result.push({ type: EnemyType.CARRIER, count: 1, delay: 3000, edge: 'right' });
        break;
      case 8:
        result.push({ type: EnemyType.FIGHTER, count: cnt(4), delay: dly(1100), edge: 'random' });
        result.push({ type: EnemyType.BOMBER,  count: cnt(2), delay: dly(2000), edge: 'right'  });
        if (cycle >= 1) result.push({ type: EnemyType.CARRIER, count: 1, delay: 2800, edge: 'right' });
        if (cycle >= 2) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(3), delay: dly(600), edge: 'random' });
        break;
      case 9:
        result.push({ type: EnemyType.SCOUT,   count: cnt(3), delay: dly(700),  edge: 'random' });
        result.push({ type: EnemyType.FIGHTER, count: cnt(3), delay: dly(1000), edge: 'random' });
        if (cycle >= 1) result.push({ type: EnemyType.TURRET,      count: 1,      delay: 2000,      edge: 'right'  });
        if (cycle >= 1) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(3), delay: dly(550),  edge: 'random' });
        if (cycle >= 1) result.push({ type: EnemyType.SNIPER,      count: cnt(2), delay: dly(2000), edge: 'random' });
        break;
      default:
        result.push({ type: EnemyType.SCOUT, count: cnt(4), delay: dly(800), edge: 'right' });
    }

    return result;
  }

  private launchWave(idx: number): void {
    if (this.gameOver) return;
    this.waveIndex        = idx;
    this.waveEnemyKilled  = 0;
    this.waveEnemyTotal   = 0;
    this.waveActive       = true;
    this.spawnQueue       = [];
    this.waveStartLives   = this.lives;

    const def    = this.generateWave(idx);
    const isBoss = def.some(e => e.type === EnemyType.BOSS);

    this.updateAtmosphere(idx + 1, isBoss);
    this.showWaveAnnouncement(idx + 1, isBoss);
    this.bossHpContainer.setVisible(isBoss);

    let baseTime = this.time.now + 2200;
    def.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ type: group.type, edge: group.edge, t: baseTime + i * group.delay });
        this.waveEnemyTotal++;
      }
      baseTime += group.count * group.delay + 500;
    });
  }

  private processSpawnQueue(time: number): void {
    while (this.spawnQueue.length && this.spawnQueue[0].t <= time) {
      const { type, edge } = this.spawnQueue.shift()!;
      this.spawnEnemy(type, edge, time);
    }
  }

  private spawnEnemy(type: EnemyType, edge: SpawnEdge, time: number): void {
    const { width: W, height: H } = this.scale;
    const PAD = type === EnemyType.BOSS ? 90 : 55;

    const resolvedEdge: Exclude<SpawnEdge, 'random'> = edge === 'random'
      ? (['right', 'left', 'top', 'bottom'] as const)[Phaser.Math.Between(0, 3)]
      : edge;

    let x: number, y: number;
    switch (resolvedEdge) {
      case 'right':  x = W + PAD; y = Phaser.Math.Between(60, H - 60); break;
      case 'left':   x = -PAD;    y = Phaser.Math.Between(60, H - 60); break;
      case 'top':    x = Phaser.Math.Between(60, W - 60); y = -PAD;    break;
      case 'bottom': x = Phaser.Math.Between(60, W - 60); y = H + PAD; break;
    }

    const enemy = new Enemy(this, x!, y!, type);
    enemy.applyDifficulty(this.waveIndex + 1);
    enemy.applyGlobalDifficulty(DifficultyManager.config());
    enemy.setSinOffset(time);
    this.enemies.add(enemy, true);
    enemy.setAlpha(0);
    this.tweens.add({ targets: enemy, alpha: 1, duration: 280 });
  }

  private spawnDroneFrom(carrier: Enemy, time: number): void {
    const offsetY = Phaser.Math.Between(-30, 30);
    const drone = new Enemy(this, carrier.x - 20, carrier.y + offsetY, EnemyType.SCOUT);
    drone.applyDifficulty(this.waveIndex + 1);
    drone.applyGlobalDifficulty(DifficultyManager.config());
    drone.setSinOffset(time);
    this.enemies.add(drone, true);
    this.waveEnemyTotal++;
    drone.setAlpha(0);
    this.tweens.add({ targets: drone, alpha: 1, duration: 180 });
  }

  private scheduleNextWave(): void {
    this.waveText.setText(`WAVE ${this.waveIndex + 1}  CLEAR`).setColor('#00ff88').setAlpha(1);
    this.tweens.add({ targets: this.waveText, alpha: 0, duration: 700, delay: 1800 });
    SoundManager.playWaveClear();

    // 퍼펙트 클리어 보너스 (웨이브 중 피격 없음)
    if (this.lives >= this.waveStartLives) {
      const bonus = 300 * (this.waveIndex + 1) * Math.ceil(DifficultyManager.config().scoreMult);
      this.statPerfectWaves++;
      this.statBonusScore += bonus;
      this.score += bonus;
      this.scoreText.setText(this.fmt(this.score));
      this.showBonusBanner(`PERFECT CLEAR  +${bonus}`);
      if (this.statPerfectWaves === 1)  this.unlockAchievement('perfect1',  'FLAWLESS',     'Cleared a wave without damage');
      if (this.statPerfectWaves === 5)  this.unlockAchievement('perfect5',  'UNTOUCHABLE',  '5 perfect waves cleared');
    }
    if (this.waveIndex + 1 === 10) this.unlockAchievement('wave10', 'VETERAN', 'Survived to wave 10');
    if (this.waveIndex + 1 === 30) this.unlockAchievement('wave30', 'ELITE',   'Survived to wave 30');

    this.time.delayedCall(2200, () => this.showShopScreen());
  }

  private updateAtmosphere(waveNum: number, isBoss: boolean): void {
    const cycle = Math.floor((waveNum - 1) / 10);

    // 사이클별 네뷸라 색조 + 알파
    const themes = [
      { tint: 0xffffff, alpha: 0.45 }, // cycle 0: 기본 파랑
      { tint: 0xddaaff, alpha: 0.52 }, // cycle 1: 보라
      { tint: 0xffcc99, alpha: 0.50 }, // cycle 2: 오렌지
      { tint: 0xff9999, alpha: 0.58 }, // cycle 3+: 레드
    ];
    const theme = themes[Math.min(cycle, themes.length - 1)];

    if (isBoss) {
      // 보스 웨이브: 강렬한 분위기
      this.tweens.add({ targets: this.nebula, alpha: 0.72, duration: 1200 });
      this.nebula.setTint(0xff8888);
      this.starsFar.setTint(0xff6666);
    } else {
      this.tweens.add({ targets: this.nebula, alpha: theme.alpha, duration: 2000 });
      this.nebula.setTint(theme.tint);
      this.starsFar.setTint(0xffffff);
    }
  }

  private showBonusBanner(label: string): void {
    const { width: W, height: H } = this.scale;
    const txt = this.add.text(W / 2, H / 2 - 30, label, {
      fontSize: '16px', color: '#ffdd00',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(65);
    this.tweens.add({
      targets: txt, alpha: 0, y: txt.y - 50,
      duration: 1800, ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private showCoinPop(x: number, y: number, amount: number): void {
    const txt = this.add.text(x, y - 16, `+${amount}¢`, {
      fontSize: '11px', color: '#ffcc00',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(66);
    this.tweens.add({
      targets: txt, y: y - 48, alpha: 0,
      duration: 900, ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private showShopScreen(): void {
    if (this.gameOver) return;
    const { width: W, height: H } = this.scale;
    this.upgradeScreenOpen = true;
    this.physics.pause();

    interface ShopItem {
      icon: string; label: string; desc: string; cost: number; color: number;
      action: () => void;
    }

    const cfg = ConfigManager.getInstance().settings.powerups;
    const now  = this.time.now;

    const items: ShopItem[] = [
      {
        icon: '♥', label: 'REPAIR KIT', desc: '+1 life', cost: 25, color: 0xff4488,
        action: () => {
          this.lives = Math.min(this.lives + 1, 9);
          this.updateLivesUI();
        },
      },
      {
        icon: '🛡', label: 'SHIELD BOOST', desc: '+4s shield', cost: 30, color: 0x00ccff,
        action: () => { this.shieldUntil = Math.max(this.shieldUntil, now + cfg.duration.shield + 1000); },
      },
      {
        icon: '⚡', label: 'RAPID BOOST', desc: '+5s rapid fire', cost: 20, color: 0xff8800,
        action: () => { this.rapidFireUntil = Math.max(this.rapidFireUntil, now + cfg.duration.rapid + 2000); },
      },
      {
        icon: '💥', label: 'BOMB', desc: 'Clear all enemies', cost: 40, color: 0xff4400,
        action: () => { this.nukeAllEnemies(); },
      },
      {
        icon: '×2', label: 'SCORE AMP', desc: '+8s ×2 score mult', cost: 35, color: 0xffdd00,
        action: () => {
          this.scoreMultUntil  = Math.max(this.scoreMultUntil, now + cfg.duration.multi + 5000);
          this.scoreMultiplier = Math.min(this.scoreMultiplier * 2, 8);
        },
      },
    ];

    const objs: Phaser.GameObjects.GameObject[] = [];
    const DEPTH = 300;

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000011, 0.90).setDepth(DEPTH);
    objs.push(overlay);

    const panelW = Math.min(W - 40, 660);
    const panelH = 300;
    const panel = this.add.graphics().setDepth(DEPTH);
    panel.fillStyle(0x000a0a, 0.97);
    panel.fillRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 38, panelW, panelH + 76);
    panel.lineStyle(1, 0x006644, 0.9);
    panel.strokeRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 38, panelW, panelH + 76);
    objs.push(panel);

    // Title
    const titleTxt = this.add.text(W / 2 - 60, H / 2 - panelH / 2 - 20, `WAVE ${this.waveIndex + 1} CLEAR`, {
      fontSize: this.isMobileDevice ? '13px' : '15px',
      color: '#00ffaa', fontFamily: 'monospace', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH + 1);
    objs.push(titleTxt);

    const shopLabel = this.add.text(W / 2 + 90, H / 2 - panelH / 2 - 20, '·  SHOP', {
      fontSize: '13px', color: '#ffcc00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(DEPTH + 1);
    objs.push(shopLabel);

    // Coins display
    const coinIcon = this.add.image(W / 2 - panelW / 2 + 20, H / 2 - panelH / 2 + 10, 'coin')
      .setScale(1.1).setDepth(DEPTH + 1);
    objs.push(coinIcon);
    const coinBalText = this.add.text(W / 2 - panelW / 2 + 36, H / 2 - panelH / 2 + 4, `${this.coins}¢  available`, {
      fontSize: '13px', color: '#ffcc00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(DEPTH + 1);
    objs.push(coinBalText);

    // Items grid (5 items in a row)
    const COLS = 5;
    const itemW = Math.min((panelW - 40) / COLS, 118);
    const itemH = 175;
    const gridStartX = W / 2 - (itemW * COLS + (COLS - 1) * 6) / 2 + itemW / 2;
    const gridY = H / 2 + 20;

    const buyBtns: Phaser.GameObjects.Rectangle[] = [];

    const refreshBuyBtns = () => {
      buyBtns.forEach((btn, idx) => {
        const item = items[idx];
        const canAfford = this.coins >= item.cost;
        const col = canAfford ? item.color : 0x334455;
        (btn as Phaser.GameObjects.Rectangle & { _label?: Phaser.GameObjects.Text })._label?.setColor(canAfford ? '#ffffff' : '#445566');
        btn.setStrokeStyle(1, col, canAfford ? 0.9 : 0.35);
        btn.setFillStyle(col, canAfford ? 0.25 : 0.06);
      });
    };

    items.forEach((item, idx) => {
      const bx = gridStartX + idx * (itemW + 6);
      const by = gridY;
      const colorHex = '#' + item.color.toString(16).padStart(6, '0');
      const canAfford = () => this.coins >= item.cost;

      const bg = this.add.graphics().setDepth(DEPTH + 1);
      bg.fillStyle(item.color, 0.1);
      bg.fillRect(bx - itemW / 2, by - itemH / 2, itemW, itemH);
      bg.lineStyle(1, item.color, canAfford() ? 0.8 : 0.3);
      bg.strokeRect(bx - itemW / 2, by - itemH / 2, itemW, itemH);
      objs.push(bg);

      const iconTxt = this.add.text(bx, by - 58, item.icon, {
        fontSize: '26px', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      objs.push(iconTxt);

      const nameTxt = this.add.text(bx, by - 18, item.label, {
        fontSize: this.isMobileDevice ? '9px' : '10px',
        color: colorHex, fontFamily: 'monospace', fontStyle: 'bold',
        wordWrap: { width: itemW - 8 }, align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      objs.push(nameTxt);

      const descTxt = this.add.text(bx, by + 12, item.desc, {
        fontSize: '9px', color: '#778899', fontFamily: 'monospace',
        wordWrap: { width: itemW - 8 }, align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      objs.push(descTxt);

      // BUY button
      const btnBg = this.add.rectangle(bx, by + 58, itemW - 16, 26, item.color, canAfford() ? 0.25 : 0.06)
        .setStrokeStyle(1, item.color, canAfford() ? 0.9 : 0.35)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH + 3);
      (btnBg as Phaser.GameObjects.Rectangle & { _label?: Phaser.GameObjects.Text })._label = undefined;
      buyBtns.push(btnBg);
      objs.push(btnBg);

      const btnLbl = this.add.text(bx, by + 58, `BUY  ${item.cost}¢`, {
        fontSize: '10px', color: canAfford() ? '#ffffff' : '#445566',
        fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(DEPTH + 4);
      (btnBg as Phaser.GameObjects.Rectangle & { _label?: Phaser.GameObjects.Text })._label = btnLbl;
      objs.push(btnLbl);

      btnBg.on('pointerover', () => {
        if (this.coins >= item.cost) btnBg.setFillStyle(item.color, 0.45);
      });
      btnBg.on('pointerout',  () => {
        btnBg.setFillStyle(item.color, this.coins >= item.cost ? 0.25 : 0.06);
      });
      btnBg.on('pointerdown', () => {
        if (this.coins < item.cost) return;
        this.coins -= item.cost;
        this.coinsText.setText('¢ ' + this.coins);
        coinBalText.setText(`${this.coins}¢  available`);
        SoundManager.playPowerup();
        this.cameras.main.flash(80, 255, 220, 0, false);
        item.action();
        refreshBuyBtns();
      });
    });

    refreshBuyBtns();

    // CONTINUE button
    const contBtn = this.add.rectangle(W / 2, H / 2 + panelH / 2 + 22, 220, 38, 0x00ccff, 0.18)
      .setStrokeStyle(1, 0x00ccff, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH + 3);
    const contLbl = this.add.text(W / 2, H / 2 + panelH / 2 + 22, 'CONTINUE  →', {
      fontSize: '14px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTH + 4);
    objs.push(contBtn, contLbl);

    contBtn.on('pointerover', () => { contBtn.setFillStyle(0x00ccff, 0.35); contLbl.setColor('#ffffff'); });
    contBtn.on('pointerout',  () => { contBtn.setFillStyle(0x00ccff, 0.18); contLbl.setColor('#00eeff'); });
    contBtn.on('pointerdown', () => {
      SoundManager.playButtonClick();
      objs.forEach(o => o.destroy());
      this.upgradeScreenOpen = false;
      this.physics.resume();
      this.showUpgradeScreen();
    });

    const hint = this.add.text(W / 2, H / 2 + panelH / 2 + 52, 'BUY ITEMS  ·  THEN  CONTINUE', {
      fontSize: '9px', color: '#224433', fontFamily: 'monospace', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(DEPTH + 1);
    objs.push(hint);
  }

  // ── UPGRADE SCREEN ────────────────────────────────────────────────────────

  private showUpgradeScreen(): void {
    if (this.gameOver) return;
    const { width: W, height: H } = this.scale;
    this.upgradeScreenOpen = true;
    this.physics.pause();

    // 3개 랜덤 업그레이드 선택
    const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
    const options  = shuffled.slice(0, 3);

    const objs: Phaser.GameObjects.GameObject[] = [];
    const DEPTH = 300;

    // 어두운 오버레이
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000011, 0.88).setDepth(DEPTH);
    objs.push(overlay);

    // 패널 테두리
    const panelW = Math.min(W - 40, 640);
    const panelH = 260;
    const panel = this.add.graphics().setDepth(DEPTH);
    panel.fillStyle(0x00000e, 0.95);
    panel.fillRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 30, panelW, panelH + 60);
    panel.lineStyle(1, 0x003366, 0.9);
    panel.strokeRect(W / 2 - panelW / 2, H / 2 - panelH / 2 - 30, panelW, panelH + 60);
    objs.push(panel);

    // 제목
    const title = this.add.text(W / 2, H / 2 - panelH / 2 - 12, `WAVE ${this.waveIndex + 1} CLEAR  —  CHOOSE UPGRADE`, {
      fontSize: this.isMobileDevice ? '14px' : '16px',
      color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH + 1);
    objs.push(title);

    // 버튼 3개 가로 배치
    const btnW   = Math.min((panelW - 60) / 3, 185);
    const btnH   = 180;
    const startX = W / 2 - btnW - (btnW / 2) - 10;

    options.forEach((opt, i) => {
      const bx = startX + i * (btnW + 10);
      const by = H / 2 + 20;
      const colorHex = '#' + opt.color.toString(16).padStart(6, '0');

      // 버튼 배경
      const btnBg = this.add.graphics().setDepth(DEPTH + 1);
      btnBg.fillStyle(opt.color, 0.12);
      btnBg.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
      btnBg.lineStyle(2, opt.color, 0.7);
      btnBg.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
      objs.push(btnBg);

      // 아이콘
      const iconTxt = this.add.text(bx, by - 55, opt.icon, {
        fontSize: '28px', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      objs.push(iconTxt);

      // 라벨
      const lbl = this.add.text(bx, by - 15, opt.label, {
        fontSize: this.isMobileDevice ? '11px' : '12px',
        color: colorHex, fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      objs.push(lbl);

      // 설명
      const desc = this.add.text(bx, by + 20, opt.desc, {
        fontSize: this.isMobileDevice ? '10px' : '11px',
        color: '#aaaaaa', fontFamily: 'monospace',
        wordWrap: { width: btnW - 16 }, align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      objs.push(desc);

      // 클릭 인터랙션 영역
      const hitZone = this.add.rectangle(bx, by, btnW, btnH, 0xffffff, 0)
        .setInteractive().setDepth(DEPTH + 3);
      objs.push(hitZone);

      hitZone.on('pointerover', () => {
        btnBg.clear();
        btnBg.fillStyle(opt.color, 0.28);
        btnBg.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        btnBg.lineStyle(2, opt.color, 1);
        btnBg.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        this.tweens.add({ targets: [iconTxt, lbl, desc], scaleX: 1.06, scaleY: 1.06, duration: 80 });
      });
      hitZone.on('pointerout', () => {
        btnBg.clear();
        btnBg.fillStyle(opt.color, 0.12);
        btnBg.fillRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        btnBg.lineStyle(2, opt.color, 0.7);
        btnBg.strokeRect(bx - btnW / 2, by - btnH / 2, btnW, btnH);
        this.tweens.add({ targets: [iconTxt, lbl, desc], scaleX: 1, scaleY: 1, duration: 80 });
      });
      hitZone.on('pointerdown', () => {
        this.player.applyUpgrade(opt.id);
        if (opt.id === 'tripleShot') this.unlockAchievement('triple_shot', 'TRIPLE THREAT', 'Unlocked triple shot');

        // 선택 플래시
        this.cameras.main.flash(120, 0, 200, 255, false);

        // 화면 닫기
        objs.forEach(o => o.destroy());
        this.upgradeScreenOpen = false;
        this.physics.resume();

        const cfg = ConfigManager.getInstance().settings.waves;
        this.time.delayedCall(cfg.betweenWaveDelay - 1000, () => this.launchWave(this.waveIndex + 1));
      });
    });

    // 힌트 텍스트
    const hint = this.add.text(W / 2, H / 2 + panelH / 2 + 18, 'TAP  /  CLICK  TO  CHOOSE', {
      fontSize: '10px', color: '#224466', fontFamily: 'monospace', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(DEPTH + 1);
    objs.push(hint);
  }

  // ── COLLISION HANDLERS ────────────────────────────────────────────────────

  private onPlayerBulletHitEnemy(
    bulletObj: Phaser.GameObjects.GameObject,
    enemyObj:  Phaser.GameObjects.GameObject,
  ): void {
    const bullet = bulletObj as Bullet;
    const enemy  = enemyObj  as Enemy;
    if (!bullet.active || !enemy.active) return;

    bullet.disableBody(true, true);
    this.spawnHitSpark(bullet.x, bullet.y, 0x00ffcc);

    if (enemy.takeDamage(bullet.damage)) {
      const mult = this.time.now < this.scoreMultUntil ? this.scoreMultiplier * 2 : this.scoreMultiplier;
      this.score += Math.round(enemy.score * mult * DifficultyManager.config().scoreMult);
      this.scoreText.setText(this.fmt(this.score));

      this.statKills++;
      this.killStreak++;

      // Earn coins
      const coinDrop = Math.floor(enemy.score / 50) + Phaser.Math.Between(2, 5);
      this.coins += coinDrop;
      this.coinsText.setText('¢ ' + this.coins);
      this.showCoinPop(enemy.x, enemy.y, coinDrop);

      // Achievement checks
      if (this.statKills === 1)   this.unlockAchievement('first_blood',    'FIRST BLOOD',   'First enemy destroyed');
      if (this.statKills === 10)  this.unlockAchievement('decimator',      'DECIMATOR',     '10 enemies eliminated');
      if (this.statKills === 50)  this.unlockAchievement('hunter',         'HUNTER',        '50 enemies destroyed');
      if (this.statKills === 100) this.unlockAchievement('annihilator',    'ANNIHILATOR',   '100 enemies annihilated');
      if (this.killStreak === 10) this.unlockAchievement('combo10',        'COMBO ×10',     'Hit a 10× kill streak');
      if (this.killStreak === 20) this.unlockAchievement('combo20',        'COMBO KING',    'Incredible 20× streak!');
      if (enemy.type === EnemyType.BOSS)    this.unlockAchievement('boss_slayer',    'BOSS SLAYER',   'Command ship destroyed');
      if (enemy.type === EnemyType.CARRIER) this.unlockAchievement('carrier_killer', 'CARRIER KILLER', 'Enemy carrier eliminated');
      if (enemy.type === EnemyType.TURRET)  this.unlockAchievement('turret_buster',  'TURRET BUSTER', 'Destroyed enemy turret');

      this.streakTimer?.destroy();
      this.streakTimer = this.time.delayedCall(4000, () => { this.killStreak = 0; this.scoreMultiplier = 1; });
      this.scoreMultiplier = this.killStreak >= 20 ? 5 :
                             this.killStreak >= 10 ? 3 :
                             this.killStreak >= 5  ? 2 : 1;
      this.statMaxCombo = Math.max(this.statMaxCombo, this.killStreak);

      this.explodeEnemy(enemy);

      const cfg = ConfigManager.getInstance().settings.powerups;
      const baseChance = enemy.type === EnemyType.BOSS ? 1.0 :
                         enemy.type === EnemyType.BOMBER ? 0.25 : cfg.dropChance;
      const dropChance = Math.min(1, baseChance * DifficultyManager.config().powerupDropMult);
      if (Math.random() < dropChance) this.dropPowerup(enemy.x, enemy.y);

      enemy.kill();
      this.waveEnemyKilled++;
    }
  }

  private onEnemyBulletHitPlayer(
    _playerObj: Phaser.GameObjects.GameObject,
    bulletObj:  Phaser.GameObjects.GameObject,
  ): void {
    const bullet = bulletObj as Bullet;
    if (!bullet.active || bullet.isPlayer) return;
    if (this.time.now < this.shieldUntil) {
      bullet.disableBody(true, true);
      this.spawnHitSpark(bullet.x, bullet.y, 0x00ccff);
      return;
    }
    if (this.player.hit(this.time.now)) {
      bullet.disableBody(true, true);
      this.spawnHitSpark(this.player.x, this.player.y, 0xff4444);
      this.cameras.main.shake(180, 0.011);
      this.cameras.main.flash(120, 255, 40, 40, false);
      SoundManager.playHit();
      this.loseLife();
    }
  }

  private onPlayerTouchEnemy(
    _playerObj: Phaser.GameObjects.GameObject,
    enemyObj:   Phaser.GameObjects.GameObject,
  ): void {
    const enemy = enemyObj as Enemy;
    if (!enemy.active) return;
    if (this.time.now < this.shieldUntil) return;
    if (!this.player.hit(this.time.now)) return;
    this.cameras.main.shake(240, 0.016);
    this.cameras.main.flash(180, 255, 60, 0, false);
    SoundManager.playHit();
    this.explodeEnemy(enemy);
    enemy.kill();
    this.waveEnemyKilled++;
    this.loseLife();
  }

  private onPowerupCollect(
    _playerObj:  Phaser.GameObjects.GameObject,
    powerupObj: Phaser.GameObjects.GameObject,
  ): void {
    const pu = powerupObj as Powerup;
    if (!pu.active) return;
    pu.disableBody(true, true);
    SoundManager.playPowerup();
    this.applyPowerup(pu.pType);
  }

  // ── POWER-UP ──────────────────────────────────────────────────────────────

  private dropPowerup(x: number, y: number): void {
    const types: PowerupType[] = ['rapid', 'shield', 'nuke', 'speed', 'multi', 'life'];
    const type = types[Phaser.Math.Between(0, types.length - 1)];
    const pu = new Powerup(this, x, y, type);
    this.powerups.add(pu, true);
  }

  private applyPowerup(type: PowerupType): void {
    const cfg = ConfigManager.getInstance().settings.powerups.duration;
    const now = this.time.now;
    const label = POWERUP_LABELS[type];

    this.cameras.main.flash(80, 255, 255, 255, false);
    this.showPowerupBanner(label);

    switch (type) {
      case 'rapid':
        this.rapidFireUntil = now + cfg.rapid;
        break;
      case 'shield':
        this.shieldUntil = now + cfg.shield;
        break;
      case 'speed':
        this.speedBoostUntil = now + cfg.speed;
        break;
      case 'multi':
        this.scoreMultUntil = now + cfg.multi;
        this.scoreMultiplier = Math.min(this.scoreMultiplier * 2, 8);
        break;
      case 'nuke':
        this.nukeAllEnemies();
        break;
      case 'life':
        this.lives = Math.min(this.lives + 1, 9);
        this.updateLivesUI();
        break;
    }
  }

  private nukeAllEnemies(): void {
    this.cameras.main.flash(350, 255, 255, 0, false);
    this.cameras.main.shake(400, 0.018);
    SoundManager.playNuke();
    this.enemies.getChildren().forEach(obj => {
      const en = obj as Enemy;
      if (!en.active) return;
      this.score += en.score * this.scoreMultiplier;
      this.explodeEnemy(en);
      en.kill();
      this.waveEnemyKilled++;
    });
    this.scoreText.setText(this.fmt(this.score));
  }

  private showPowerupBanner(label: string): void {
    const { width: W, height: H } = this.scale;
    const txt = this.add.text(W / 2, H / 2 + 60, `⬡ ${label} ⬡`, {
      fontSize: '18px', color: '#ffdd00',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(65);
    this.tweens.add({
      targets: txt, alpha: 0, y: txt.y - 40,
      duration: 1400, ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ── GRAVITY FLIP ──────────────────────────────────────────────────────────

  triggerGravityFlip(time: number): void {
    if (!this.player.gravityFlip(time)) return;
    const px = this.player.x, py = this.player.y;
    const pulse = this.add.image(px, py, 'wave-pulse').setScale(0.08).setAlpha(0.9);
    this.tweens.add({
      targets: pulse, scale: 4.2, alpha: 0,
      duration: 550, ease: 'Quad.easeOut',
      onComplete: () => pulse.destroy(),
    });
    this.cameras.main.flash(180, 0, 160, 255, false);
    this.cameras.main.shake(100, 0.005);
    SoundManager.playGravFlip();
    const RADIUS = 340;
    this.enemyBullets.getChildren().forEach(obj => {
      const b = obj as Bullet;
      if (b.active && Phaser.Math.Distance.Between(px, py, b.x, b.y) < RADIUS) b.reflect();
    });
  }

  // ── LIFE / GAME OVER ──────────────────────────────────────────────────────

  private loseLife(): void {
    this.killStreak = 0;
    this.scoreMultiplier = 1;
    this.lives = Math.max(0, this.lives - 1);
    this.updateLivesUI();
    if (this.lives <= 0) this.triggerGameOver();
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.explodeEnemy(this.player as unknown as Enemy);
    this.player.setActive(false).setVisible(false);
    this.cameras.main.shake(550, 0.022);
    this.cameras.main.flash(350, 255, 50, 50, false);
    SoundManager.stopBGM();
    SoundManager.playGameOver();
    this.time.delayedCall(1100, () => {
      this.cameras.main.fadeOut(650, 0, 0, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOverScene', {
          score: this.score,
          wave: this.waveIndex + 1,
          stats: {
            totalKills: this.statKills,
            maxCombo: this.statMaxCombo,
            perfectWaves: this.statPerfectWaves,
            bonusScore: this.statBonusScore,
            difficulty: DifficultyManager.config().label,
            diffColor: DifficultyManager.config().color,
          },
        });
      });
    });
  }

  // ── FX ────────────────────────────────────────────────────────────────────

  private explodeEnemy(e: Enemy | Phaser.Physics.Arcade.Sprite): void {
    const x = e.x, y = e.y;
    const type = (e as Enemy).type;
    const big = type === EnemyType.BOSS || type === EnemyType.BOMBER || type === EnemyType.TURRET;
    SoundManager.playExplosion(big);
    const em = this.add.particles(x, y, 'particle-explode', {
      speed: { min: 80, max: 300 }, angle: { min: 0, max: 360 },
      scale: { start: 1.3, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xff8800, 0xffcc00, 0xff4400, 0xffffff],
      lifespan: { min: 280, max: 580 }, quantity: 22, emitting: false,
    });
    em.explode(22, x, y);
    this.time.delayedCall(650, () => em.destroy());

    if (big) {
      this.cameras.main.shake(300, 0.016);
      this.cameras.main.flash(180, 255, 100, 0, false);
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 110, () => {
          const ox = x + Phaser.Math.Between(-45, 45);
          const oy = y + Phaser.Math.Between(-35, 35);
          const e2 = this.add.particles(ox, oy, 'particle-explode', {
            speed: { min: 50, max: 180 }, angle: { min: 0, max: 360 },
            scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
            tint: [0xff6600, 0xffaa00], lifespan: 380, quantity: 8, emitting: false,
          });
          e2.explode(8, ox, oy);
          this.time.delayedCall(450, () => e2.destroy());
        });
      }
    }
  }

  private spawnHitSpark(x: number, y: number, tint: number): void {
    const e = this.add.particles(x, y, 'particle', {
      speed: { min: 60, max: 140 }, angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 },
      tint, lifespan: 200, quantity: 8, emitting: false,
    });
    e.explode(8, x, y);
    this.time.delayedCall(260, () => e.destroy());
  }

  // ── MOBILE CONTROLS ───────────────────────────────────────────────────────

  private buildMobileControls(): void {
    const { width: W, height: H } = this.scale;
    const mobile = this.isMobileDevice;

    // ── 조이스틱 비주얼 ──
    this.joystickBase  = this.add.image(0, 0, 'joystick-base').setScrollFactor(0).setDepth(100);
    this.joystickThumb = this.add.image(0, 0, 'joystick-thumb').setScrollFactor(0).setDepth(101);

    // 모바일: 왼쪽 하단에 힌트용 반투명 표시, PC: 숨김
    const hintX = W * 0.15, hintY = H * 0.78;
    if (mobile) {
      this.joystickBase.setPosition(hintX, hintY).setAlpha(0.22);
      this.joystickThumb.setPosition(hintX, hintY).setAlpha(0.26);
    } else {
      this.joystickBase.setAlpha(0);
      this.joystickThumb.setAlpha(0);
    }

    // ── 조이스틱 활성화 함수 ──
    const activateJoystick = (ptr: Phaser.Input.Pointer) => {
      if (this.joystickActive) return;
      if (ptr.y < 48) return; // HUD 바 영역 제외
      this.joystickPointerId = ptr.id;
      this.joystickActive    = true;
      this.joystickOriginX   = ptr.x;
      this.joystickOriginY   = ptr.y;
      this.joystickDeltaX    = 0;
      this.joystickDeltaY    = 0;
      this.joystickBase.setPosition(ptr.x, ptr.y).setAlpha(0.72);
      this.joystickThumb.setPosition(ptr.x, ptr.y).setAlpha(0.92);
    };

    // ── 씬 레벨 pointerdown: 버튼이 히트되지 않은 곳이면 어디든 조이스틱 시작 ──
    // Phaser가 gameObjectsHit 배열을 두 번째 인자로 전달함
    // G-FLIP·일시정지·뮤트 등 interactive 오브젝트 터치 시 → 배열에 오브젝트 있음 → 조이스틱 미활성
    this.input.on('pointerdown',
      (ptr: Phaser.Input.Pointer, gameObjectsHit: Phaser.GameObjects.GameObject[]) => {
        if (gameObjectsHit.length > 0) return; // 버튼 터치 → 무시
        activateJoystick(ptr);
      },
    );

    // ── pointermove: 조이스틱 포인터만 추적 ──
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.joystickActive || ptr.id !== this.joystickPointerId) return;
      const dx = ptr.x - this.joystickOriginX;
      const dy = ptr.y - this.joystickOriginY;
      const dist    = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.JS_RADIUS);
      const nx = dist > 1 ? dx / dist : 0;
      const ny = dist > 1 ? dy / dist : 0;

      // 비선형 응답: 작은 입력은 더 정밀하게
      const ratio    = clamped / this.JS_RADIUS;
      const response = ratio < 0.4 ? ratio * 0.7 : ratio;
      this.joystickDeltaX = nx * response;
      this.joystickDeltaY = ny * response;

      this.joystickThumb.setPosition(
        this.joystickOriginX + nx * clamped,
        this.joystickOriginY + ny * clamped,
      );
    });

    // ── pointerup: 조이스틱 해제 ──
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.joystickPointerId) return;
      this.joystickActive    = false;
      this.joystickPointerId = -1;
      this.joystickDeltaX    = 0;
      this.joystickDeltaY    = 0;

      if (mobile) {
        this.tweens.add({
          targets: this.joystickBase,
          x: hintX, y: hintY, alpha: 0.22, duration: 220, ease: 'Quad.easeOut',
        });
        this.tweens.add({
          targets: this.joystickThumb,
          x: hintX, y: hintY, alpha: 0.26, duration: 220, ease: 'Quad.easeOut',
        });
      } else {
        this.joystickBase.setAlpha(0);
        this.joystickThumb.setAlpha(0);
      }
    });

    // ── G-FLIP 버튼 (우측 하단, depth 110) ──
    const btnX = W - 80, btnY = H - 80;
    const specialBtn = this.add.image(btnX, btnY, 'btn-special')
      .setAlpha(mobile ? 0.85 : 0.55)
      .setScale(mobile ? 1.15 : 1.0)
      .setDepth(110).setScrollFactor(0).setInteractive();

    specialBtn.on('pointerdown', () => {
      this.specialBtnDown = true;
      this.specialBtnConsumed = false;
      this.tweens.add({ targets: specialBtn, scale: 0.92, duration: 80, yoyo: true });
    });
    specialBtn.on('pointerup',  () => { this.specialBtnDown = false; });
    specialBtn.on('pointerout', () => { this.specialBtnDown = false; });

    this.add.text(btnX, btnY + (mobile ? 60 : 52), 'G-FLIP', {
      fontSize: mobile ? '12px' : '10px', color: '#4488aa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(110).setScrollFactor(0);

    // ── 일시정지 버튼 ──
    const pauseBtn = this.add.text(W - 16, 14, '❚❚', {
      fontSize: mobile ? '22px' : '18px', color: '#224466', fontFamily: 'monospace',
    }).setOrigin(1, 0).setDepth(110).setScrollFactor(0).setInteractive();
    pauseBtn.on('pointerdown', () => this.togglePause());

    // ── 뮤트 버튼 ──
    const muteBtn = this.add.text(W - (mobile ? 62 : 56), 14, '♪', {
      fontSize: mobile ? '22px' : '18px', color: '#224466', fontFamily: 'monospace',
    }).setOrigin(1, 0).setDepth(110).setScrollFactor(0).setInteractive();
    muteBtn.on('pointerdown', () => {
      const muted = SoundManager.toggleMute();
      muteBtn.setColor(muted ? '#553333' : '#224466');
    });

    // ── 모바일 조작 힌트 (3초 후 페이드아웃) ──
    if (mobile) {
      const mobileHint = this.add.text(W / 2, H - 16,
        'TOUCH ANYWHERE → MOVE   |   RIGHT BTN → G-FLIP', {
          fontSize: '9px', color: '#224466', fontFamily: 'monospace', letterSpacing: 1,
        }).setOrigin(0.5).setDepth(110).setScrollFactor(0);
      this.tweens.add({
        targets: mobileHint, alpha: 0,
        duration: 800, delay: 3000,
        onComplete: () => mobileHint.destroy(),
      });
    }
  }

  // ── UI BUILD ──────────────────────────────────────────────────────────────

  private buildUI(): void {
    const { width: W } = this.scale;

    const bar = this.add.graphics().setDepth(50);
    bar.fillStyle(0x000008, 0.72);
    bar.fillRect(0, 0, W, 44);
    bar.lineStyle(1, 0x002244, 0.7);
    bar.lineBetween(0, 44, W, 44);

    this.add.text(16, 8, 'SCORE', { fontSize: '10px', color: '#4488aa', fontFamily: 'monospace' }).setDepth(51);
    this.scoreText = this.add.text(16, 20, '000000', {
      fontSize: '16px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(51);

    this.add.text(145, 8, 'COINS', { fontSize: '10px', color: '#aa8800', fontFamily: 'monospace' }).setDepth(51);
    this.coinsText = this.add.text(145, 20, '¢ 0', {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(51);

    this.waveText = this.add.text(W / 2, 13, '', {
      fontSize: '13px', color: '#aaddff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(51);

    this.add.text(W - 206, 8, 'G-FLIP', { fontSize: '10px', color: '#4488aa', fontFamily: 'monospace' }).setDepth(51);
    this.gravIcon = this.add.image(W - 218, 28, 'gravity-icon').setScale(0.6).setDepth(51);
    this.gravBar  = this.add.graphics().setDepth(51);

    this.add.text(W - 90, 8, 'LIVES', { fontSize: '10px', color: '#4488aa', fontFamily: 'monospace' }).setDepth(51);
    this.livesGroup = this.add.group();
    this.updateLivesUI();

    this.streakText = this.add.text(16, 50, '', {
      fontSize: '11px', color: '#ffdd00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(52);

    this.buffIcons    = this.add.container(8, this.scale.height - 40).setDepth(60);
    this.enemyArrows  = this.add.graphics().setDepth(42).setScrollFactor(0);

    const bossBarGfx = this.add.graphics().setDepth(51);
    this.bossHpFill  = this.add.graphics().setDepth(52);
    const bossLbl    = this.add.text(W / 2, 68, 'COMMAND SHIP', {
      fontSize: '11px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(52);
    bossBarGfx.fillStyle(0x110000, 0.8);
    bossBarGfx.fillRect(W / 2 - 255, 54, 510, 24);
    this.bossHpContainer = this.add.container(0, 0, [bossBarGfx, this.bossHpFill, bossLbl]).setDepth(51);
    this.bossHpContainer.setVisible(false);
  }

  private updateUI(time: number): void {
    const { width: W } = this.scale;

    const pct = this.player.getGravCooldownPct(time);
    const bx = W - 200, by = 22, bw = 110, bh = 10;
    this.gravBar.clear();
    this.gravBar.fillStyle(0x001122, 0.8);
    this.gravBar.fillRect(bx, by, bw, bh);
    const col = pct >= 1 ? 0x00ffcc : pct > 0.5 ? 0x0088ff : 0x334466;
    this.gravBar.fillStyle(col, 1);
    this.gravBar.fillRect(bx, by, bw * pct, bh);
    this.gravBar.lineStyle(1, 0x002244, 0.7);
    this.gravBar.strokeRect(bx, by, bw, bh);
    this.gravIcon.setAlpha(pct >= 1 ? 0.5 + Math.sin(time * 0.006) * 0.35 : 0.35);

    if (this.killStreak >= 5) {
      const multLabel = this.scoreMultiplier > 1 ? ` ×${this.scoreMultiplier}` : '';
      this.streakText.setText(`STREAK ${this.killStreak}${multLabel}`);
      this.streakText.setAlpha(0.7 + Math.sin(time * 0.008) * 0.3);
    } else {
      this.streakText.setText('');
    }

    this.buffIcons.removeAll(true);
    const buffs: Array<{ key: string; until: number; color: string }> = [
      { key: '⚡', until: this.rapidFireUntil,  color: '#ff8800' },
      { key: '🛡', until: this.shieldUntil,     color: '#00ccff' },
      { key: '💨', until: this.speedBoostUntil, color: '#00ff88' },
      { key: '×2', until: this.scoreMultUntil,  color: '#ffdd00' },
    ];
    let bxi = 0;
    buffs.forEach(b => {
      if (time < b.until) {
        const remain = ((b.until - time) / 1000).toFixed(1);
        const t = this.add.text(bxi, 0, `${b.key}${remain}s`, {
          fontSize: '11px', color: b.color, fontFamily: 'monospace', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        });
        this.buffIcons.add(t);
        bxi += 80;
      }
    });

    this.drawEnemyArrows();

    const boss = this.enemies.getChildren().find(
      e => (e as Enemy).type === EnemyType.BOSS && (e as Enemy).active,
    ) as Enemy | undefined;

    if (boss) {
      this.bossHpContainer.setVisible(true);
      const bossBarW = 500;
      const bp = Math.max(0, boss.hp / boss.maxHp);
      const bx2 = W / 2 - bossBarW / 2;
      this.bossHpFill.clear();
      const hcol = bp > 0.5 ? 0xcc0000 : bp > 0.25 ? 0xff4400 : 0xff0044;
      this.bossHpFill.fillStyle(hcol, 1);
      this.bossHpFill.fillRect(bx2, 56, bossBarW * bp, 20);
      this.bossHpFill.fillStyle(0xffffff, 0.1);
      this.bossHpFill.fillRect(bx2, 56, bossBarW * bp, 8);
      this.bossHpFill.lineStyle(2, 0xff2200, 0.6);
      this.bossHpFill.strokeRect(bx2, 56, bossBarW, 20);
    } else if (!this.waveActive) {
      this.bossHpContainer.setVisible(false);
    }
  }

  private drawEnemyArrows(): void {
    this.enemyArrows.clear();
    const { width: W, height: H } = this.scale;
    const MARGIN   = 18;
    const HUD_TOP  = 48; // leave room for HUD bar
    const ARR      = 11; // arrow half-size

    this.enemies.getChildren().forEach(obj => {
      const en = obj as Enemy;
      if (!en.active) return;
      if (en.x >= 0 && en.x <= W && en.y >= HUD_TOP && en.y <= H) return; // on screen

      const dx = en.x - W / 2;
      const dy = en.y - H / 2;
      const ang = Math.atan2(dy, dx);
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);

      // Intersection with screen border
      const hw = W / 2 - MARGIN;
      const hh = (H - HUD_TOP) / 2 - MARGIN;
      let ax: number, ay: number;
      if (Math.abs(cos) * hh > Math.abs(sin) * hw) {
        const t = hw / Math.abs(cos);
        ax = W / 2 + Math.sign(cos) * hw;
        ay = H / 2 + sin * t;
      } else {
        const t = hh / Math.abs(sin);
        ax = W / 2 + cos * t;
        ay = H / 2 + Math.sign(sin) * hh;
      }
      ax = Phaser.Math.Clamp(ax, MARGIN, W - MARGIN);
      ay = Phaser.Math.Clamp(ay, HUD_TOP + MARGIN, H - MARGIN);

      // Triangle pointing toward enemy
      const col = en.type === EnemyType.BOSS ? 0xff2244 : 0xff8800;
      const alpha = en.type === EnemyType.BOSS ? 0.95 : 0.72;
      this.enemyArrows.fillStyle(col, alpha);
      const tip  = { x: ax + cos * ARR,        y: ay + sin * ARR };
      const b1   = { x: ax - sin * ARR * 0.55 - cos * ARR * 0.45,
                     y: ay + cos * ARR * 0.55 - sin * ARR * 0.45 };
      const b2   = { x: ax + sin * ARR * 0.55 - cos * ARR * 0.45,
                     y: ay - cos * ARR * 0.55 - sin * ARR * 0.45 };
      this.enemyArrows.fillTriangle(tip.x, tip.y, b1.x, b1.y, b2.x, b2.y);

      // Outline
      this.enemyArrows.lineStyle(1, 0x000000, 0.5);
      this.enemyArrows.strokeTriangle(tip.x, tip.y, b1.x, b1.y, b2.x, b2.y);
    });
  }

  private updateLivesUI(): void {
    this.livesGroup.clear(true, true);
    const { width: W } = this.scale;

    if (this.lives <= 6) {
      // 생명 아이콘을 오른쪽부터 채워서 표시
      const displayMax = Math.max(this.lives, ConfigManager.getInstance().settings.player.lives);
      const step = 20;
      for (let i = 0; i < displayMax; i++) {
        const img = this.add.image(W - 88 + i * step, 26, i < this.lives ? 'heart' : 'heart-empty')
          .setScale(0.78).setDepth(51);
        this.livesGroup.add(img);
      }
    } else {
      // 7개 이상은 아이콘 + 숫자로 표시
      const heart = this.add.image(W - 78, 26, 'heart').setScale(0.88).setDepth(51);
      const cnt   = this.add.text(W - 60, 18, `×${this.lives}`, {
        fontSize: '14px', color: '#ff4466', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setDepth(51);
      this.livesGroup.add(heart);
      this.livesGroup.add(cnt);
    }
  }

  private showWaveAnnouncement(num: number, isBoss: boolean): void {
    const { width: W, height: H } = this.scale;
    const cycle = Math.floor((num - 1) / 10);
    const txt  = isBoss
      ? (cycle >= 3 ? '⚠  OMEGA FLEET INCOMING  ⚠' : '⚠  COMMAND SHIP INCOMING  ⚠')
      : `WAVE  ${num}`;
    const sub  = isBoss ? 'ALL HANDS TO BATTLE STATIONS' : `CYCLE ${cycle + 1}  —  PREPARE FOR CONTACT`;
    const col  = isBoss ? '#ff2244' : '#00eeff';
    const col2 = isBoss ? '#ff8888' : '#4488aa';

    this.waveText.setText(`WAVE ${num}`).setColor(col).setAlpha(1);

    const ann = this.add.text(W / 2, H / 2 - 44, txt, {
      fontSize: isBoss ? '24px' : '30px', color: col,
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(60);

    const subT = this.add.text(W / 2, H / 2 + 2, sub, {
      fontSize: '13px', color: col2, fontFamily: 'monospace', letterSpacing: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(60);

    this.tweens.add({
      targets: [ann, subT], alpha: 1, duration: 280, hold: 1300,
      yoyo: true, onComplete: () => { ann.destroy(); subT.destroy(); },
    });
  }

  private fmt(n: number): string { return n.toString().padStart(6, '0'); }

  private unlockAchievement(id: string, title: string, desc: string): void {
    if (this.unlockedAchievements.has(id)) return;
    this.unlockedAchievements.add(id);
    const saved = JSON.parse(localStorage.getItem('nova_achievements') ?? '[]') as string[];
    saved.push(id);
    localStorage.setItem('nova_achievements', JSON.stringify(saved));
    this.showAchievementToast(title, desc);
  }

  private showAchievementToast(title: string, desc: string): void {
    const { width: W } = this.scale;
    const BW = 230, BH = 56;

    const bg = this.add.graphics().setDepth(500).setScrollFactor(0);
    bg.fillStyle(0x000a18, 0.95);
    bg.fillRect(0, 0, BW, BH);
    bg.lineStyle(1, 0xffdd00, 0.75);
    bg.strokeRect(0, 0, BW, BH);
    bg.lineStyle(1, 0xffdd00, 0.3);
    bg.strokeRect(2, 2, BW - 4, BH - 4);

    const star  = this.add.text(10, 8,  '★', { fontSize: '14px', color: '#ffdd00', fontFamily: 'monospace' }).setDepth(501).setScrollFactor(0);
    const badge = this.add.text(28, 6,  'ACHIEVEMENT', { fontSize: '7px', color: '#665500', fontFamily: 'monospace', letterSpacing: 1 }).setDepth(501).setScrollFactor(0);
    const ttl   = this.add.text(28, 18, title, { fontSize: '12px', color: '#ffdd00', fontFamily: 'monospace', fontStyle: 'bold' }).setDepth(501).setScrollFactor(0);
    const dsc   = this.add.text(28, 34, desc,  { fontSize: '9px',  color: '#7799aa', fontFamily: 'monospace' }).setDepth(501).setScrollFactor(0);

    const container = this.add.container(W + 10, 65, [bg, star, badge, ttl, dsc]).setDepth(500).setScrollFactor(0);

    this.tweens.add({ targets: container, x: W - BW - 12, duration: 380, ease: 'Back.easeOut' });
    this.time.delayedCall(3200, () => {
      if (!container.active) return;
      this.tweens.add({
        targets: container, x: W + 10, duration: 320, ease: 'Quad.easeIn',
        onComplete: () => container.destroy(),
      });
    });
  }

  private togglePause(): void {
    if (this.gameOver || this.upgradeScreenOpen) return;
    this.paused = !this.paused;
    const { width: W, height: H } = this.scale;
    if (this.paused) {
      this.physics.pause();
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setName('pauseBg').setDepth(200);
      this.add.text(W / 2, H / 2 - 30, 'PAUSED', {
        fontSize: '38px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setName('pauseTxt').setDepth(201);
      this.add.text(W / 2, H / 2 + 22, 'ESC  /  TAP TO RESUME', {
        fontSize: '13px', color: '#4488aa', fontFamily: 'monospace',
      }).setOrigin(0.5).setName('pauseSub').setDepth(201).setInteractive()
        .on('pointerdown', () => this.togglePause());
      this.add.text(W / 2, H / 2 + 56, 'UPGRADES: check next wave screen', {
        fontSize: '10px', color: '#335566', fontFamily: 'monospace',
      }).setOrigin(0.5).setName('pauseUpgrade').setDepth(201);
    } else {
      this.physics.resume();
      ['pauseBg', 'pauseTxt', 'pauseSub', 'pauseUpgrade'].forEach(n => this.children.getByName(n)?.destroy());
    }
  }
}
