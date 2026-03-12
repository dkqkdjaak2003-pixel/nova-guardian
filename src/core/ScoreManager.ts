export interface ScoreEntry {
  score: number;
  wave:  number;
  date:  string; // ISO string
}

const STORAGE_KEY = 'nova_scores_v1';
const MAX_ENTRIES = 10;

export class ScoreManager {
  /** Load all top scores (sorted descending). */
  static getAll(): ScoreEntry[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ScoreEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Add a new score.
   * Returns the 1-based rank if it made the top 10, otherwise null.
   */
  static add(score: number, wave: number): number | null {
    const entries = this.getAll();
    const entry: ScoreEntry = {
      score,
      wave,
      date: new Date().toLocaleDateString('ko-KR'),
    };

    entries.push(entry);
    entries.sort((a, b) => b.score - a.score);

    const rank = entries.findIndex(e => e === entry) + 1; // 1-based
    const trimmed = entries.slice(0, MAX_ENTRIES);
    const inTop = rank <= MAX_ENTRIES;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return inTop ? rank : null;
  }

  /** Best score ever recorded. */
  static best(): number {
    const all = this.getAll();
    return all.length ? all[0].score : 0;
  }

  /** Clear all scores (admin use). */
  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
