import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const league_id = req.nextUrl.searchParams.get("league_id");
  if (!league_id) {
    return NextResponse.json({ error: "league_id requerido." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get submitted player IDs via RPC (aggregation — no row limit issue)
  const { data: submitted, error: rpcError } = await supabase.rpc("get_submitted_players", {
    p_league_id: league_id,
  });
  if (rpcError) {
    return NextResponse.json({ error: "Error al obtener jugadores." }, { status: 500 });
  }
  const submittedIds = new Set<string>(
    (submitted ?? []).map((r: { player_id: string }) => r.player_id)
  );

  // Get paid players in this league
  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("id, name")
    .eq("league_id", league_id)
    .eq("paid", true);

  if (playerError || !playerData) {
    return NextResponse.json({ error: "Error al obtener jugadores." }, { status: 500 });
  }

  const filteredPlayers = playerData.filter((p) => submittedIds.has(p.id));
  if (filteredPlayers.length === 0) {
    return NextResponse.json({ entries: [], actualGoals: 0, finishedMatches: 0, totalMatches: 0 });
  }

  const playerIds = filteredPlayers.map((p) => p.id);

  // Fetch all matches
  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("id, home_score, away_score, status");

  if (matchError || !matchData) {
    return NextResponse.json({ error: "Error al obtener partidos." }, { status: 500 });
  }

  let actualTotal = 0;
  let finished = 0;
  const finishedMatchIds = new Set<string>();

  for (const m of matchData) {
    if (m.status === "finished" && m.home_score !== null && m.away_score !== null) {
      actualTotal += m.home_score + m.away_score;
      finishedMatchIds.add(m.id);
      finished++;
    }
  }

  // Fetch ALL predictions using service role — no row limit
  const { data: predData, error: predError } = await supabase
    .from("predictions")
    .select("player_id, match_id, home_score, away_score")
    .in("player_id", playerIds);

  if (predError) {
    return NextResponse.json({ error: "Error al obtener predicciones." }, { status: 500 });
  }

  const currentByPlayer: Record<string, number> = {};
  const totalByPlayer: Record<string, number> = {};

  for (const p of predData ?? []) {
    const goals = p.home_score + p.away_score;
    totalByPlayer[p.player_id] = (totalByPlayer[p.player_id] ?? 0) + goals;
    if (finishedMatchIds.has(p.match_id)) {
      currentByPlayer[p.player_id] = (currentByPlayer[p.player_id] ?? 0) + goals;
    }
  }

  const entries = filteredPlayers.map((p) => {
    const predicted_current = currentByPlayer[p.id] ?? 0;
    const predicted_total = totalByPlayer[p.id] ?? 0;
    return {
      player_id: p.id,
      player_name: p.name,
      predicted_current,
      predicted_total,
      difference: predicted_current - actualTotal,
    };
  });

  entries.sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference));

  return NextResponse.json({
    entries,
    actualGoals: actualTotal,
    finishedMatches: finished,
    totalMatches: matchData.length,
  });
}
