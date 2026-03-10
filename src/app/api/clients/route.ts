import { NextResponse } from "next/server";
import { fetchClients } from "@/lib/data";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await fetchClients();

  if (result.source === "seed") {
    return NextResponse.json({
      ...result,
      message:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    });
  }

  return NextResponse.json(result);
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
        error:
          error.code === "23505"
            ? "A client with that name already exists."
            : "Could not create client.",
        details: error.message,
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, id });
}
