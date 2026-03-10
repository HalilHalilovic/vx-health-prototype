import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { seedClientAccounts } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const { error: delScores } = await supabase
    .from("weekly_scores")
    .delete()
    .neq("id", 0);

  if (delScores) {
    return NextResponse.json(
      { error: "Failed to delete weekly_scores.", details: delScores.message },
      { status: 500 },
    );
  }

  const { error: delClients } = await supabase
    .from("clients")
    .delete()
    .neq("id", "");

  if (delClients) {
    return NextResponse.json(
      { error: "Failed to delete clients.", details: delClients.message },
      { status: 500 },
    );
  }

  const clientRows = seedClientAccounts.map((c) => ({
    id: c.id,
    name: c.name,
    coach_team: c.coachTeam,
  }));

  const { error: insertClients } = await supabase
    .from("clients")
    .upsert(clientRows, { onConflict: "id" });
  if (insertClients) {
    return NextResponse.json(
      { error: "Failed to re-insert clients.", details: insertClients.message },
      { status: 500 },
    );
  }

  const weeklyRows = seedClientAccounts.flatMap((client) =>
    client.healthHistory.map((week) => ({
      client_id: client.id,
      week_start: week.weekStart,
      current_score: week.currentScore,
      predictive_score: week.predictiveScore,
      notes: week.notes,
      actions: week.actions,
    })),
  );

  const { error: insertScores } = await supabase
    .from("weekly_scores")
    .upsert(weeklyRows, { onConflict: "client_id,week_start" });
  if (insertScores) {
    return NextResponse.json(
      { error: "Failed to re-insert scores.", details: insertScores.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Reseeded ${clientRows.length} clients and ${weeklyRows.length} scores.`,
  });
}
