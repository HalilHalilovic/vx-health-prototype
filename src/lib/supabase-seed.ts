import type { SupabaseClient } from "@supabase/supabase-js";
import { seedClientAccounts } from "@/lib/seed-data";

type ClientInsert = {
  id: string;
  name: string;
  coach_team: string;
};

type WeeklyScoreInsert = {
  client_id: string;
  week_start: string;
  current_score: number | null;
  predictive_score: number | null;
  notes: string;
  actions: string;
};

export async function seedSupabaseIfEmpty(supabase: SupabaseClient) {
  const { count, error: countError } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw countError;
  }
  if ((count ?? 0) > 0) {
    return false;
  }

  const clientRows: ClientInsert[] = seedClientAccounts.map((client) => ({
    id: client.id,
    name: client.name,
    coach_team: client.coachTeam,
  }));

  const weeklyRows: WeeklyScoreInsert[] = seedClientAccounts.flatMap((client) =>
    client.healthHistory.map((week) => ({
      client_id: client.id,
      week_start: week.weekStart,
      current_score: week.currentScore,
      predictive_score: week.predictiveScore,
      notes: week.notes,
      actions: week.actions,
    })),
  );

  const { error: clientsError } = await supabase
    .from("clients")
    .upsert(clientRows, { onConflict: "id" });
  if (clientsError) {
    throw clientsError;
  }

  const { error: weeklyError } = await supabase
    .from("weekly_scores")
    .upsert(weeklyRows, { onConflict: "client_id,week_start" });
  if (weeklyError) {
    throw weeklyError;
  }

  return true;
}
