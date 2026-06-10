import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { calculatePoints } from "@/lib/scoring";

/**
 * GET /api/leaderboard?league_id=...
 * Returns player IDs that have >= 72 predictions (i.e. have submitted their full bracket).
 * Uses service role key to bypass RLS and avoid client-side row-count limits.
 */
export async function GET(req: NextRequest) {
  const league_id = req.nextUrl.searchParams.get("league_id");
  if (!league_id) {
    return NextResponse.json({ error: "league_id requerido." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Use SQL GROUP BY to count per player — avoids PostgREST row-limit entirely
  const { data: submitted, error: rpcError } = await supabase.rpc("get_submitted_players", {
    p_league_id: league_id,
  });

  if (rpcError) {
    return NextResponse.json({ error: "Error al contar predicciones." }, { status: 500 });
  }

  const submittedIds = (submitted ?? []).map((r: { player_id: string }) => r.player_id);
  return NextResponse.json({ submitted: submittedIds });
}

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
