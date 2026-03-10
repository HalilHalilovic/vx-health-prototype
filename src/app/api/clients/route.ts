import { NextResponse } from "next/server";
import { seedClientAccounts } from "@/lib/seed-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { seedSupabaseIfEmpty } from "@/lib/supabase-seed";
import type { ClientAccount, WeeklyHealthScore } from "@/lib/types";
import { toMondayWeekStart } from "@/lib/week-start";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        predictiveScore: week.predictive_score as WeeklyHealthScore["predictiveScore"],
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

    const healthHistory: WeeklyHealthScore[] = [...byWeekStart.values()].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    );

    return {
      id: row.id,
      name: row.name,
      coachTeam: row.coach_team,
      healthHistory,
    };
  });
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      clients: seedClientAccounts,
      source: "seed",
      message:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    });
  }

  try {
    await seedSupabaseIfEmpty(supabase);
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, name, coach_team, weekly_scores(week_start, current_score, predictive_score, actions, notes)",
      )
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      clients: mapRowsToClients((data ?? []) as ClientRow[]),
      source: "supabase",
    });
  } catch {
    return NextResponse.json(
      {
        clients: seedClientAccounts,
        source: "seed",
        message: "Supabase query failed. Falling back to seed data.",
      },
      { status: 200 },
    );
  }
}

type CreateClientPayload = {
  name?: string;
  coachTeam?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateClientPayload;

  if (!payload.name || payload.name.trim().length === 0) {
    return NextResponse.json(
      { error: "Client name is required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const id = payload.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { error } = await supabase.from("clients").insert({
    id,
    name: payload.name.trim(),
    coach_team: payload.coachTeam?.trim() || "Unassigned",
  });

  if (error) {
    console.error("Supabase insert failed in POST /api/clients", error);
    return NextResponse.json(
      {
        error: error.code === "23505"
          ? "A client with that name already exists."
          : "Could not create client.",
        details: error.message,
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, id });
}
