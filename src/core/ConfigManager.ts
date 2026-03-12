import yaml from 'js-yaml';

export interface EnemyConfig {
  speed: number;
  hp: number;
  score: number;
  fireRate: number;
  size: { width: number; height: number };
}

export interface GameConfig {
  game: { width: number; height: number; title: string };
  player: {
    speed: number;
    gravity: number;
    size: { width: number; height: number };
    fireRate: number;
    bulletSpeed: number;
    lives: number;
    invincibilityTime: number;
    gravityCooldown: number;
  };
  enemies: {
    scout: EnemyConfig;
    fighter: EnemyConfig;
    bomber: EnemyConfig;
    boss: EnemyConfig;
  };
  waves: { betweenWaveDelay: number };
}

const DEFAULT_CONFIG: GameConfig = {
  game: { width: 800, height: 600, title: 'NOVA GUARDIAN' },
  player: {
    speed: 280, gravity: 1400,
    size: { width: 80, height: 48 },
    fireRate: 180, bulletSpeed: 620,
    lives: 3, invincibilityTime: 2000, gravityCooldown: 5000,
  },
  enemies: {
    scout:   { speed: 260, hp: 1,  score: 100,  fireRate: 2200, size: { width: 50,  height: 36  } },
    fighter: { speed: 190, hp: 3,  score: 300,  fireRate: 1600, size: { width: 70,  height: 52  } },
    bomber:  { speed: 110, hp: 8,  score: 600,  fireRate: 1100, size: { width: 100, height: 80  } },
    boss:    { speed: 70,  hp: 60, score: 5000, fireRate: 700,  size: { width: 160, height: 120 } },
  },
  waves: { betweenWaveDelay: 3500 },
};

export class ConfigManager {
  private static instance: ConfigManager;
  private configData: GameConfig = DEFAULT_CONFIG;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) ConfigManager.instance = new ConfigManager();
    return ConfigManager.instance;
  }

  public loadFromText(text: string): void {
    try {
      const loaded = yaml.load(text) as Partial<GameConfig>;
      const base = { ...DEFAULT_CONFIG, ...loaded } as GameConfig;
      // Admin panel overrides stored in localStorage take priority
      const override = localStorage.getItem('nova_config_override');
      if (override) {
        const overrideData = yaml.load(override) as Partial<GameConfig>;
        this.configData = { ...base, ...overrideData } as GameConfig;
      } else {
        this.configData = base;
      }
    } catch {
      this.configData = DEFAULT_CONFIG;
    }
  }

  public resetOverride(): void {
    localStorage.removeItem('nova_config_override');
    this.configData = DEFAULT_CONFIG;
  }

  public get settings(): GameConfig { return this.configData; }
}
