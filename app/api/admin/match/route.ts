import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { calculatePoints } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  const { secret, match_id, home_score, away_score } = await req.json();

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Update match result and mark as finished
  const { error: matchError } = await supabase
    .from("matches")
    .update({ home_score, away_score, status: "finished" })
    .eq("id", match_id);

  if (matchError) {
    return NextResponse.json({ error: "Error al guardar resultado." }, { status: 500 });
  }

  // Score all predictions for this match
  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, player_id, match_id, home_score, away_score")
    .eq("match_id", match_id);

  if (!predictions || predictions.length === 0) {
    return NextResponse.json({ ok: true, scored: 0 });
  }

  const updates = predictions.map((p) => ({
    id: p.id,
    player_id: p.player_id,
    match_id: p.match_id,
    home_score: p.home_score,
    away_score: p.away_score,
    points: calculatePoints(home_score, away_score, p.home_score, p.away_score),
  }));

  await supabase.from("predictions").upsert(updates, { onConflict: "player_id,match_id" });

  return NextResponse.json({ ok: true, scored: predictions.length });
}
