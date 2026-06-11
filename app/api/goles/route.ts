import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const league_id = req.nextUrl.searchParams.get("league_id");
  if (!league_id) {
    return NextResponse.json({ error: "league_id requerido." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Both RPCs do SQL GROUP BY — return at most N rows per player, no row-limit issues
  const [{ data: submitted, error: rpcErr1 }, { data: goles, error: rpcErr2 }] = await Promise.all([
    supabase.rpc("get_submitted_players", { p_league_id: league_id }),
    supabase.rpc("get_goles_data",        { p_league_id: league_id }),
  ]);

  if (rpcErr1 || rpcErr2) {
    return NextResponse.json({ error: "Error al obtener datos." }, { status: 500 });
  }

  const submittedIds = new Set<string>(
    (submitted ?? []).map((r: { player_id: string }) => r.player_id)
  );

  // Get actual finished-match goal totals (only 72 rows — always fine)
  const { data: matchData } = await supabase
    .from("matches")
    .select("home_score, away_score, status");

  let actualTotal = 0;
  let finished = 0;
  for (const m of matchData ?? []) {
    if (m.status === "finished" && m.home_score !== null && m.away_score !== null) {
      actualTotal += m.home_score + m.away_score;
      finished++;
    }
  }

  const entries = ((goles ?? []) as { player_id: string; player_name: string; predicted_current: number; predicted_total: number }[])
    .filter((row) => submittedIds.has(row.player_id))
    .map((row) => ({
      player_id: row.player_id,
      player_name: row.player_name,
      predicted_current: row.predicted_current,
      predicted_total: row.predicted_total,
      difference: row.predicted_current - actualTotal,
    }));

  entries.sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference));

  return NextResponse.json({
    entries,
    actualGoals: actualTotal,
    finishedMatches: finished,
    totalMatches: (matchData ?? []).length,
  });
}
