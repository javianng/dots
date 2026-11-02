export interface Habit {
  id: string;
  name: string;
  description: string;
  icon?: string;
  colorHex: string;
  streakGoal: number | null;
  /** Taps needed to finish a day. 1 = a simple check-off. */
  completionsPerDay: number;
  createdAt: number;
  /** 'YYYY-MM-DD' → completed (count reached the daily target). */
  history: Record<string, boolean>;
  /** 'YYYY-MM-DD' → taps logged that day (only days with at least one). */
  counts: Record<string, number>;
}

export interface HabitDraft {
  name: string;
  description: string;
  icon: string;
  colorHex: string;
  streakGoal: number | null;
  completionsPerDay: number;
}
