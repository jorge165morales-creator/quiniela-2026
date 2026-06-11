import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const league_id = req.nextUrl.searchParams.get("league_id");
  if (!league_id) {
    return NextResponse.json({ error: "league_id requerido." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Both RPCs do SQL GROUP BY — return at most players×3 rows, no row-limit issues
  const [{ data: submitted, error: rpcErr1 }, { data: rondas, error: rpcErr2 }] = await Promise.all([
    supabase.rpc("get_submitted_players", { p_league_id: league_id }),
    supabase.rpc("get_rondas_points",     { p_league_id: league_id }),
  ]);

  if (rpcErr1 || rpcErr2) {
    return NextResponse.json({ error: "Error al obtener datos." }, { status: 500 });
  }

  const submittedIds = new Set<string>(
    (submitted ?? []).map((r: { player_id: string }) => r.player_id)
  );

  // Get match counts per matchday (only 72 rows — always fine)
  const { data: matchData } = await supabase
    .from("matches")
    .select("matchday, status")
    .in("matchday", [1, 2, 3]);

  const matchCounts: Record<number, { finished: number; total: number }> = {
    1: { finished: 0, total: 0 },
    2: { finished: 0, total: 0 },
    3: { finished: 0, total: 0 },
  };
  for (const m of matchData ?? []) {
    const md = m.matchday as number;
    if (!matchCounts[md]) continue;
    matchCounts[md].total++;
    if (m.status === "finished") matchCounts[md].finished++;
  }

  // Build a map: player_id → { name, matchday → { points, exact_scores } }
  type PlayerRound = { name: string; rounds: Record<number, { points: number; exact_scores: number }> };
  const playerMap = new Map<string, PlayerRound>();

  for (const row of (rondas ?? []) as { player_id: string; player_name: string; matchday: number; points: number; exact_scores: number }[]) {
    if (!submittedIds.has(row.player_id)) continue;
    if (!playerMap.has(row.player_id)) {
      playerMap.set(row.player_id, { name: row.player_name, rounds: {} });
    }
    playerMap.get(row.player_id)!.rounds[row.matchday] = {
      points: row.points,
      exact_scores: row.exact_scores,
    };
  }

  const rounds = [1, 2, 3].map((md) => {
    const entries = Array.from(playerMap.entries()).map(([player_id, p]) => ({
      player_id,
      player_name: p.name,
      points: p.rounds[md]?.points ?? 0,
      exact_scores: p.rounds[md]?.exact_scores ?? 0,
    }));
    entries.sort((a, b) => b.points - a.points || b.exact_scores - a.exact_scores);
    return {
      matchday: md,
      entries,
      finished_matches: matchCounts[md].finished,
      total_matches: matchCounts[md].total,
    };
  });

  return NextResponse.json({ rounds });
}
