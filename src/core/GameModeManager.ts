export type GameMode = 'campaign' | 'survival';

export class GameModeManager {
  private static _mode: GameMode = 'campaign';

  static set(m: GameMode): void  { this._mode = m; }
  static get(): GameMode          { return this._mode; }
  static isSurvival(): boolean    { return this._mode === 'survival'; }
}
