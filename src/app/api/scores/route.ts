import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { toMondayWeekStart } from "@/lib/week-start";

type SaveScorePayload = {
  clientId?: string;
  weekStart?: string;
  currentScore?: number | null;
  predictiveScore?: number | null;
  notes?: string;
  actions?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as SaveScorePayload;

  if (!payload.clientId || !payload.weekStart) {
    return NextResponse.json(
      { error: "clientId and weekStart are required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
      },
      { status: 503 },
    );
  }

  const normalizedWeekStart = toMondayWeekStart(payload.weekStart);

  const { error } = await supabase.from("weekly_scores").upsert(
    {
      client_id: payload.clientId,
      week_start: normalizedWeekStart,
      current_score: payload.currentScore ?? null,
      predictive_score: payload.predictiveScore ?? null,
      notes: payload.notes?.trim() ?? "",
      actions: payload.actions?.trim() ?? "",
    },
    { onConflict: "client_id,week_start" },
  );

  if (error) {
    console.error("Supabase upsert failed in /api/scores", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return NextResponse.json(
      {
        error: "Could not save score to Supabase.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
