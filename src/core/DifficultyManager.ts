export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  enemyHpMult: number;
  enemySpeedMult: number;
  enemyFireRateMult: number; // >1 = slower fire (easier), <1 = faster fire (harder)
  powerupDropMult: number;
  scoreMult: number;
  startLives: number;
  label: string;
  color: number;
  desc: string;
}

const CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    enemyHpMult: 0.72, enemySpeedMult: 0.75, enemyFireRateMult: 1.4,
    powerupDropMult: 2.0, scoreMult: 0.65, startLives: 5,
    label: 'EASY', color: 0x00ff88,
    desc: '5 lives  ·  weaker enemies\n×0.65 score',
  },
  normal: {
    enemyHpMult: 1.0, enemySpeedMult: 1.0, enemyFireRateMult: 1.0,
    powerupDropMult: 1.0, scoreMult: 1.0, startLives: 3,
    label: 'NORMAL', color: 0x00ccff,
    desc: 'Standard challenge\n×1.0 score',
  },
  hard: {
    enemyHpMult: 1.45, enemySpeedMult: 1.25, enemyFireRateMult: 0.68,
    powerupDropMult: 0.5, scoreMult: 2.0, startLives: 2,
    label: 'HARD', color: 0xff4400,
    desc: '2 lives  ·  faster enemies\n×2.0 score',
  },
};

export class DifficultyManager {
  private static current: Difficulty = 'normal';

  static set(d: Difficulty): void { this.current = d; }
  static get(): Difficulty { return this.current; }
  static config(): DifficultyConfig { return CONFIGS[this.current]; }
  static allOptions(): Array<{ id: Difficulty } & DifficultyConfig> {
    return (['easy', 'normal', 'hard'] as Difficulty[]).map(id => ({ id, ...CONFIGS[id] }));
  }
}
