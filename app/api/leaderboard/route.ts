import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { calculatePoints } from "@/lib/scoring";

/**
 * POST /api/leaderboard/score
 * Admin route: score all predictions for a finished match.
 * Body: { match_id: string, admin_secret: string }
 */
export async function POST(req: NextRequest) {
  const { match_id, admin_secret } = await req.json();

  if (admin_secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get match result
  const { data: match } = await supabase
    .from("matches")
    .select("id, home_score, away_score, status")
    .eq("id", match_id)
    .single();

  if (!match || match.status !== "finished") {
    return NextResponse.json(
      { error: "Partido no encontrado o no terminado." },
      { status: 400 }
    );
  }

  if (match.home_score === null || match.away_score === null) {
    return NextResponse.json(
      { error: "Resultado del partido no ingresado." },
      { status: 400 }
    );
  }

  // Get all predictions for this match
  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, home_score, away_score")
    .eq("match_id", match_id);

  if (!predictions || predictions.length === 0) {
    return NextResponse.json({ ok: true, scored: 0 });
  }

  // Calculate points for each prediction
  const updates = predictions.map((p) => ({
    id: p.id,
    points: calculatePoints(
      match.home_score,
      match.away_score,
      p.home_score,
      p.away_score
    ),
  }));

  // Batch update
  const { error } = await supabase.from("predictions").upsert(updates);

  if (error) {
    return NextResponse.json({ error: "Error al puntuar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scored: updates.length });
}
