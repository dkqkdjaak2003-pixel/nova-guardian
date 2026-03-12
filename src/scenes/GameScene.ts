import Phaser from 'phaser';
import { Player, type ExternalInput } from '../entities/Player';
import { Enemy, EnemyType, type SpawnEdge } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Powerup, type PowerupType, POWERUP_LABELS } from '../entities/Powerup';
import { ConfigManager } from '../core/ConfigManager';
import { SoundManager } from '../core/SoundManager';

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
  private lives:    number  = 3;
  private paused:   boolean = false;
  private gameOver: boolean = false;

  // Combo / multiplier
  private killStreak:      number = 0;
  private scoreMultiplier: number = 1;
  private streakTimer?: Phaser.Time.TimerEvent;

  // Buff state (endTime in ms)
  private rapidFireUntil:  number = 0;
  private shieldUntil:     number = 0;
  private speedBoostUntil: number = 0;
  private scoreMultUntil:  number = 0;

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

  // Mobile virtual joystick
  private joystickBase!:   Phaser.GameObjects.Image;
  private joystickThumb!:  Phaser.GameObjects.Image;
  private joystickActive:  boolean = false;
  private joystickOriginX: number  = 0;
  private joystickOriginY: number  = 0;
  private joystickDeltaX:  number  = 0;
  private joystickDeltaY:  number  = 0;
  private readonly JS_RADIUS = 62;

  private specialBtnDown:     boolean = false;
  private specialBtnConsumed: boolean = false;

  constructor() { super('GameScene'); }

  // ── CREATE ────────────────────────────────────────────────────────────────

  create(): void {
    const { width: W, height: H } = this.scale;
    this.score = 0; this.lives = 3; this.waveIndex = 0;
    this.paused = false; this.gameOver = false;
    this.killStreak = 0; this.scoreMultiplier = 1;
    this.rapidFireUntil = this.shieldUntil = this.speedBoostUntil = this.scoreMultUntil = 0;

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
    this.buildMobileControls();

    this.input.keyboard!.on('keydown-ESC', () => this.togglePause());

    this.cameras.main.fadeIn(500, 0, 0, 8);
    this.time.delayedCall(1000, () => this.launchWave(0));

    SoundManager.resume();
    SoundManager.startBGM('game');
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    if (this.paused || this.gameOver) return;

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

  /** Procedurally generate a wave from a wave index (0-based). */
  private generateWave(idx: number): SpawnEntry[] {
    const waveNum = idx + 1;                           // 1-based
    const cycle   = Math.floor((waveNum - 1) / 10);   // 0, 1, 2, …
    const pos     = ((waveNum - 1) % 10) + 1;         // 1-10

    const isBoss    = pos === 10;
    const isMidBoss = pos === 5;

    // Count and delay helpers that scale per cycle
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

    // Regular waves — vary by position within the cycle
    switch (pos) {
      case 1: // Scout rush
        result.push({ type: EnemyType.SCOUT, count: cnt(5), delay: dly(800), edge: 'right' });
        if (cycle >= 2) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(3), delay: dly(600), edge: 'random' });
        break;

      case 2: // Scout + fighter intro
        result.push({ type: EnemyType.SCOUT,   count: cnt(4), delay: dly(750),  edge: 'right' });
        result.push({ type: EnemyType.FIGHTER,  count: cnt(2), delay: dly(1400), edge: 'random' });
        break;

      case 3: // Interceptor swarm (later cycles) / scout swarm
        if (cycle >= 1) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(7), delay: dly(480), edge: 'random' });
        result.push({ type: EnemyType.SCOUT, count: cnt(3), delay: dly(700), edge: 'right' });
        break;

      case 4: // Sniper + fighter
        if (cycle >= 1) result.push({ type: EnemyType.SNIPER,  count: cnt(2), delay: dly(2500), edge: 'random' });
        result.push({ type: EnemyType.FIGHTER, count: cnt(3), delay: dly(1200), edge: 'random' });
        break;

      case 6: // Bomber + fast support
        result.push({ type: EnemyType.BOMBER, count: cnt(2), delay: dly(2200), edge: 'right' });
        if (cycle >= 1) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(4), delay: dly(600),  edge: 'random' });
        else            result.push({ type: EnemyType.SCOUT,       count: cnt(4), delay: dly(750),  edge: 'random' });
        break;

      case 7: // All-sides assault
        result.push({ type: EnemyType.SCOUT,   count: cnt(5), delay: dly(640),  edge: 'random' });
        result.push({ type: EnemyType.FIGHTER,  count: cnt(3), delay: dly(1200), edge: 'random' });
        if (cycle >= 1) result.push({ type: EnemyType.SNIPER, count: cnt(2), delay: dly(2000), edge: 'random' });
        break;

      case 8: // Heavy combined
        result.push({ type: EnemyType.FIGHTER, count: cnt(4), delay: dly(1100), edge: 'random' });
        result.push({ type: EnemyType.BOMBER,  count: cnt(2), delay: dly(2000), edge: 'right'  });
        if (cycle >= 2) result.push({ type: EnemyType.INTERCEPTOR, count: cnt(3), delay: dly(600), edge: 'random' });
        break;

      case 9: // Pre-boss everything
        result.push({ type: EnemyType.SCOUT,   count: cnt(3), delay: dly(700),  edge: 'random' });
        result.push({ type: EnemyType.FIGHTER,  count: cnt(3), delay: dly(1000), edge: 'random' });
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

    const def    = this.generateWave(idx);
    const isBoss = def.some(e => e.type === EnemyType.BOSS);

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
    enemy.setSinOffset(time);
    this.enemies.add(enemy, true);
    enemy.setAlpha(0);
    this.tweens.add({ targets: enemy, alpha: 1, duration: 280 });
  }

  private scheduleNextWave(): void {
    const cfg = ConfigManager.getInstance().settings.waves;
    this.waveText.setText(`WAVE ${this.waveIndex + 1}  CLEAR`).setColor('#00ff88').setAlpha(1);
    this.tweens.add({ targets: this.waveText, alpha: 0, duration: 700, delay: 1800 });
    SoundManager.playWaveClear();
    this.time.delayedCall(cfg.betweenWaveDelay, () => this.launchWave(this.waveIndex + 1));
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
      // ── Scoring with combo multiplier ──
      const mult = this.time.now < this.scoreMultUntil ? this.scoreMultiplier * 2 : this.scoreMultiplier;
      this.score += enemy.score * mult;
      this.scoreText.setText(this.fmt(this.score));

      // ── Kill streak ──
      this.killStreak++;
      this.streakTimer?.destroy();
      this.streakTimer = this.time.delayedCall(4000, () => { this.killStreak = 0; this.scoreMultiplier = 1; });
      this.scoreMultiplier = this.killStreak >= 20 ? 5 :
                             this.killStreak >= 10 ? 3 :
                             this.killStreak >= 5  ? 2 : 1;

      this.explodeEnemy(enemy);

      // ── Power-up drop ──
      const cfg = ConfigManager.getInstance().settings.powerups;
      const dropChance = enemy.type === EnemyType.BOSS ? 1.0 :
                         enemy.type === EnemyType.BOMBER ? 0.25 : cfg.dropChance;
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
      // Shield absorbs hit
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
    const types: PowerupType[] = ['rapid', 'shield', 'nuke', 'speed', 'multi'];
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
        this.scene.start('GameOverScene', { score: this.score, wave: this.waveIndex + 1 });
      });
    });
  }

  // ── FX ────────────────────────────────────────────────────────────────────

  private explodeEnemy(e: Enemy | Phaser.Physics.Arcade.Sprite): void {
    const x = e.x, y = e.y;
    const type = (e as Enemy).type;
    const big = type === EnemyType.BOSS || type === EnemyType.BOMBER;
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

    this.joystickBase  = this.add.image(0, 0, 'joystick-base').setAlpha(0).setScrollFactor(0).setDepth(100);
    this.joystickThumb = this.add.image(0, 0, 'joystick-thumb').setAlpha(0).setScrollFactor(0).setDepth(101);

    const leftZone = this.add.zone(0, 0, W / 2, H).setOrigin(0, 0).setInteractive().setDepth(99);
    leftZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.joystickActive  = true;
      this.joystickOriginX = ptr.x;
      this.joystickOriginY = ptr.y;
      this.joystickDeltaX  = 0;
      this.joystickDeltaY  = 0;
      this.joystickBase.setPosition(ptr.x, ptr.y).setAlpha(0.7);
      this.joystickThumb.setPosition(ptr.x, ptr.y).setAlpha(0.9);
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.joystickActive) return;
      const dx = ptr.x - this.joystickOriginX;
      const dy = ptr.y - this.joystickOriginY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.JS_RADIUS);
      const nx = dist > 0 ? dx / dist : 0;
      const ny = dist > 0 ? dy / dist : 0;
      this.joystickDeltaX = nx * (clamped / this.JS_RADIUS);
      this.joystickDeltaY = ny * (clamped / this.JS_RADIUS);
      this.joystickThumb.setPosition(
        this.joystickOriginX + nx * clamped,
        this.joystickOriginY + ny * clamped,
      );
    });

    this.input.on('pointerup', () => {
      this.joystickActive = false;
      this.joystickDeltaX = 0;
      this.joystickDeltaY = 0;
      this.joystickBase.setAlpha(0);
      this.joystickThumb.setAlpha(0);
    });

    const btnX = W - 72, btnY = H - 72;
    const specialBtn = this.add.image(btnX, btnY, 'btn-special')
      .setAlpha(0.75).setScale(1.05).setDepth(100).setInteractive();
    specialBtn.on('pointerdown', () => {
      this.specialBtnDown = true;
      this.specialBtnConsumed = false;
      this.tweens.add({ targets: specialBtn, scale: 0.90, duration: 80, yoyo: true });
    });
    specialBtn.on('pointerup',  () => { this.specialBtnDown = false; });
    specialBtn.on('pointerout', () => { this.specialBtnDown = false; });

    this.add.text(btnX, btnY + 52, 'G-FLIP', {
      fontSize: '10px', color: '#4488aa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(100);

    const pauseBtn = this.add.text(W - 16, 14, '❚❚', {
      fontSize: '18px', color: '#224466', fontFamily: 'monospace',
    }).setOrigin(1, 0).setDepth(100).setInteractive();
    pauseBtn.on('pointerdown', () => this.togglePause());

    const muteBtn = this.add.text(W - 54, 14, '♪', {
      fontSize: '18px', color: '#224466', fontFamily: 'monospace',
    }).setOrigin(1, 0).setDepth(100).setInteractive();
    muteBtn.on('pointerdown', () => {
      const muted = SoundManager.toggleMute();
      muteBtn.setColor(muted ? '#553333' : '#224466');
    });
  }

  // ── UI BUILD ──────────────────────────────────────────────────────────────

  private buildUI(): void {
    const { width: W } = this.scale;

    const bar = this.add.graphics().setDepth(50);
    bar.fillStyle(0x000008, 0.72);
    bar.fillRect(0, 0, W, 44);
    bar.lineStyle(1, 0x002244, 0.7);
    bar.lineBetween(0, 44, W, 44);

    // Score
    this.add.text(16, 8, 'SCORE', { fontSize: '10px', color: '#4488aa', fontFamily: 'monospace' }).setDepth(51);
    this.scoreText = this.add.text(16, 20, '000000', {
      fontSize: '16px', color: '#00eeff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(51);

    // Wave
    this.waveText = this.add.text(W / 2, 13, '', {
      fontSize: '13px', color: '#aaddff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(51);

    // Gravity bar
    this.add.text(W - 206, 8, 'G-FLIP', { fontSize: '10px', color: '#4488aa', fontFamily: 'monospace' }).setDepth(51);
    this.gravIcon = this.add.image(W - 218, 28, 'gravity-icon').setScale(0.6).setDepth(51);
    this.gravBar  = this.add.graphics().setDepth(51);

    // Lives
    this.add.text(W - 90, 8, 'LIVES', { fontSize: '10px', color: '#4488aa', fontFamily: 'monospace' }).setDepth(51);
    this.livesGroup = this.add.group();
    this.updateLivesUI();

    // Streak
    this.streakText = this.add.text(16, 50, '', {
      fontSize: '11px', color: '#ffdd00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(52);

    // Buff icons container (bottom-left)
    this.buffIcons = this.add.container(8, this.scale.height - 40).setDepth(60);

    // Boss HP bar
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

    // Gravity bar
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

    // Streak
    if (this.killStreak >= 5) {
      const multLabel = this.scoreMultiplier > 1 ? ` ×${this.scoreMultiplier}` : '';
      this.streakText.setText(`STREAK ${this.killStreak}${multLabel}`);
      this.streakText.setAlpha(0.7 + Math.sin(time * 0.008) * 0.3);
    } else {
      this.streakText.setText('');
    }

    // Buff icons
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

    // Boss HP bar
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

  private updateLivesUI(): void {
    this.livesGroup.clear(true, true);
    const { width: W } = this.scale;
    const maxLives = ConfigManager.getInstance().settings.player.lives;
    for (let i = 0; i < maxLives; i++) {
      const img = this.add.image(W - 78 + i * 26, 26, i < this.lives ? 'heart' : 'heart-empty')
        .setScale(0.9).setDepth(51);
      this.livesGroup.add(img);
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

  private togglePause(): void {
    if (this.gameOver) return;
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
    } else {
      this.physics.resume();
      ['pauseBg', 'pauseTxt', 'pauseSub'].forEach(n => this.children.getByName(n)?.destroy());
    }
  }
}
