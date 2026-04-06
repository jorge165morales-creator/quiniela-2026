import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { player_id, predictions, submit } = await req.json();

  if (!player_id || !Array.isArray(predictions) || predictions.length === 0) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify player exists and get their league
  const { data: player } = await supabase
    .from("players")
    .select("id, league_id")
    .eq("id", player_id)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Jugador no encontrado." }, { status: 404 });
  }

  // Check if league predictions are locked
  const { data: league } = await supabase
    .from("leagues")
    .select("predictions_locked")
    .eq("id", player.league_id)
    .single();

  if (league?.predictions_locked) {
    return NextResponse.json(
      { error: "Las predicciones están cerradas." },
      { status: 403 }
    );
  }

  // Anti-algorithmic rules — only enforced on full submit (submit: true)
  if (submit) {
    const scorelineCounts: Record<string, number> = {};
    let drawCount = 0;
    for (const p of predictions) {
      const [lo, hi] = [Math.min(p.home_score, p.away_score), Math.max(p.home_score, p.away_score)];
      const key = `${lo}-${hi}`;
      scorelineCounts[key] = (scorelineCounts[key] || 0) + 1;
      if (p.home_score === p.away_score) drawCount++;
    }
    const maxAllowed = 28;
    const topCount = Math.max(...Object.values(scorelineCounts));
    const totalDistinct = Object.keys(scorelineCounts).length;
    const distinctWithAtLeastTwo = Object.values(scorelineCounts).filter((c) => c >= 2).length;

    if (topCount > maxAllowed) {
      return NextResponse.json({ error: `Ningún marcador puede usarse en más del 50% de los partidos (máx. ${maxAllowed}).` }, { status: 400 });
    }
    if (totalDistinct < 7) {
      return NextResponse.json({ error: `Se requieren al menos 7 marcadores distintos.` }, { status: 400 });
    }
    if (distinctWithAtLeastTwo < 5) {
      return NextResponse.json({ error: `Al menos 5 marcadores distintos deben aparecer 2 o más veces.` }, { status: 400 });
    }
    if (drawCount < 5) {
      return NextResponse.json({ error: `Se requieren al menos 5 empates en la quiniela.` }, { status: 400 });
    }
  }

  // Upsert all predictions
  const rows = predictions.map((p: { match_id: string; home_score: number; away_score: number }) => ({
    player_id,
    match_id: p.match_id,
    home_score: p.home_score,
    away_score: p.away_score,
    points: null, // scored after match ends
  }));

  const { error } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "player_id,match_id" });

  if (error) {
    return NextResponse.json({ error: "Error al guardar predicciones." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
