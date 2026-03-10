export type ScoreValue = 1 | 2 | 3 | 4 | 5;

export type WeeklyHealthScore = {
  weekStart: string;
  currentScore: ScoreValue | null;
  predictiveScore: ScoreValue | null;
  actions: string;
  notes: string;
};

export type ClientAccount = {
  id: string;
  name: string;
  coachTeam: string;
  healthHistory: WeeklyHealthScore[];
};
