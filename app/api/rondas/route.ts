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
    return NextResponse.json({ rounds: [] });
  }

  const playerIds = filteredPlayers.map((p) => p.id);

  // Fetch all matches for matchdays 1-3
  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("id, matchday, status")
    .in("matchday", [1, 2, 3]);

  if (matchError || !matchData) {
    return NextResponse.json({ error: "Error al obtener partidos." }, { status: 500 });
  }

  const matchMap: Record<string, number> = {};
  for (const m of matchData) matchMap[m.id] = m.matchday;

  // Fetch ALL predictions using service role — no row limit
  const { data: preds, error: predError } = await supabase
    .from("predictions")
    .select("player_id, match_id, points")
    .in("player_id", playerIds);

  if (predError) {
    return NextResponse.json({ error: "Error al obtener predicciones." }, { status: 500 });
  }

  const roundMap: Record<number, {
    pointsByPlayer: Record<string, number>;
    exactsByPlayer: Record<string, number>;
    finished: number;
    total: number;
  }> = {
    1: { pointsByPlayer: {}, exactsByPlayer: {}, finished: 0, total: 0 },
    2: { pointsByPlayer: {}, exactsByPlayer: {}, finished: 0, total: 0 },
    3: { pointsByPlayer: {}, exactsByPlayer: {}, finished: 0, total: 0 },
  };

  for (const pred of preds ?? []) {
    const md = matchMap[pred.match_id];
    if (!md || !roundMap[md]) continue;
    const r = roundMap[md];
    if (pred.points !== null) {
      const pid = pred.player_id;
      r.pointsByPlayer[pid] = (r.pointsByPlayer[pid] ?? 0) + pred.points;
      if (pred.points === 6) {
        r.exactsByPlayer[pid] = (r.exactsByPlayer[pid] ?? 0) + 1;
      }
    }
  }

  for (const m of matchData) {
    const md = m.matchday;
    if (!roundMap[md]) continue;
    roundMap[md].total++;
    if (m.status === "finished") roundMap[md].finished++;
  }

  const rounds = [1, 2, 3].map((md) => {
    const r = roundMap[md];
    const entries = filteredPlayers.map((p) => ({
      player_id: p.id,
      player_name: p.name,
      points: r.pointsByPlayer[p.id] ?? 0,
      exact_scores: r.exactsByPlayer[p.id] ?? 0,
    }));
    entries.sort((a, b) => b.points - a.points || b.exact_scores - a.exact_scores);
    return {
      matchday: md,
      entries,
      finished_matches: r.finished,
      total_matches: r.total,
    };
  });

  return NextResponse.json({ rounds });
}
