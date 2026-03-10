import { getSupabaseServerClient } from "@/lib/supabase-server";
import { seedClientAccounts } from "@/lib/seed-data";
import { seedSupabaseIfEmpty } from "@/lib/supabase-seed";
import type { ClientAccount, WeeklyHealthScore } from "@/lib/types";
import { toMondayWeekStart } from "@/lib/week-start";

type WeeklyScoreRow = {
  week_start: string;
  current_score: number | null;
  predictive_score: number | null;
  actions: string | null;
  notes: string | null;
};

type ClientRow = {
  id: string;
  name: string;
  coach_team: string;
  weekly_scores: WeeklyScoreRow[] | null;
};

function mapRowsToClients(rows: ClientRow[]): ClientAccount[] {
  return rows.map((row) => {
    const byWeekStart = new Map<string, WeeklyHealthScore>();

    for (const week of row.weekly_scores ?? []) {
      const normalizedWeekStart = toMondayWeekStart(week.week_start);
      const nextWeek: WeeklyHealthScore = {
        weekStart: normalizedWeekStart,
        currentScore: week.current_score as WeeklyHealthScore["currentScore"],
        predictiveScore:
          week.predictive_score as WeeklyHealthScore["predictiveScore"],
        actions: week.actions ?? "",
        notes: week.notes ?? "",
      };

      const existing = byWeekStart.get(normalizedWeekStart);
      if (!existing) {
        byWeekStart.set(normalizedWeekStart, nextWeek);
        continue;
      }

      const existingCompleteness =
        (existing.currentScore !== null ? 1 : 0) +
        (existing.predictiveScore !== null ? 1 : 0) +
        (existing.notes.trim().length > 0 ? 1 : 0) +
        (existing.actions.trim().length > 0 ? 1 : 0);
      const nextCompleteness =
        (nextWeek.currentScore !== null ? 1 : 0) +
        (nextWeek.predictiveScore !== null ? 1 : 0) +
        (nextWeek.notes.trim().length > 0 ? 1 : 0) +
        (nextWeek.actions.trim().length > 0 ? 1 : 0);

      if (nextCompleteness >= existingCompleteness) {
        byWeekStart.set(normalizedWeekStart, nextWeek);
      }
    }

    const healthHistory: WeeklyHealthScore[] = [
      ...byWeekStart.values(),
    ].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    return {
      id: row.id,
      name: row.name,
      coachTeam: row.coach_team,
      healthHistory,
    };
  });
}

export async function fetchClients(): Promise<{
  clients: ClientAccount[];
  source: "supabase" | "seed";
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { clients: seedClientAccounts, source: "seed" };
  }

  try {
    await seedSupabaseIfEmpty(supabase);
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, name, coach_team, weekly_scores(week_start, current_score, predictive_score, actions, notes)",
      )
      .order("name", { ascending: true });

    if (error) throw error;

    return {
      clients: mapRowsToClients((data ?? []) as ClientRow[]),
      source: "supabase",
    };
  } catch {
    return { clients: seedClientAccounts, source: "seed" };
  }
}
