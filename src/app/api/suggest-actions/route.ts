import { NextResponse } from "next/server";

type SuggestPayload = {
  clientName?: string;
  currentScore?: number | null;
  predictiveScore?: number | null;
  notes?: string;
};

function buildFallbackSuggestions(payload: SuggestPayload): string[] {
  const suggestions: string[] = [];
  const current = payload.currentScore ?? null;
  const predictive = payload.predictiveScore ?? null;
  const notes = (payload.notes ?? "").toLowerCase();

  if (predictive !== null && predictive <= 2) {
    suggestions.push("Schedule a 30-minute executive alignment call within 48 hours.");
    suggestions.push("Document top 3 risk drivers and assign one owner per item.");
  } else if (predictive !== null && predictive <= 3) {
    suggestions.push("Set a weekly checkpoint with clear outcomes and owner accountability.");
    suggestions.push("Agree on one visible quick win that can be delivered next week.");
  } else if (predictive !== null && predictive === 4) {
    suggestions.push("Confirm priorities for next week and lock scope with the client.");
  }

  if (current !== null && predictive !== null && predictive < current) {
    suggestions.push("Flag forecasted decline and share mitigation plan with leadership.");
  }

  if (notes.includes("timeline") || notes.includes("delay")) {
    suggestions.push("Rebaseline timeline and send a revised milestone plan by Monday.");
  }
  if (notes.includes("stakeholder") || notes.includes("alignment")) {
    suggestions.push("Run a stakeholder alignment session with decision-makers this week.");
  }
  if (notes.includes("quality") || notes.includes("bug")) {
    suggestions.push("Introduce a quality gate and daily QA status update until stable.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Share a concise weekly plan with owners, dates, and expected outcomes.");
    suggestions.push("Validate success criteria with the client before the next delivery.");
  }

  return suggestions.slice(0, 4);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as SuggestPayload;
  const fallback = buildFallbackSuggestions(payload);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      suggestions: fallback,
      source: "heuristic",
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are a client success strategist. Return up to 4 direct, actionable steps to improve predictive score to 5 by next week.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        suggestions: fallback,
        source: "heuristic",
      });
    }

    const data = (await response.json()) as { output_text?: string };
    const text = (data.output_text ?? "")
      .split("\n")
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 4);

    return NextResponse.json({
      suggestions: text.length > 0 ? text : fallback,
      source: "openai",
    });
  } catch {
    return NextResponse.json({
      suggestions: fallback,
      source: "heuristic",
    });
  }
}
