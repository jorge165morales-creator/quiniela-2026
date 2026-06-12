import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Guatemala is UTC-6 with no DST — hardcoded for consistency across all users
const GT_OFFSET_MS = -6 * 60 * 60 * 1000;

function getGuatemalaDay(dateMs: number) {
  const gt = new Date(dateMs + GT_OFFSET_MS);
  return { y: gt.getUTCFullYear(), mo: gt.getUTCMonth() + 1, d: gt.getUTCDate() };
}

function dayBounds(y: number, mo: number, d: number) {
  // Guatemala midnight = UTC 06:00 (midnight + 6h)
  const start = new Date(Date.UTC(y, mo - 1, d, 6, 0, 0)).toISOString();
  const end   = new Date(Date.UTC(y, mo - 1, d + 1, 6, 0, 0)).toISOString();
  return { start, end };
}

export async function GET(req: NextRequest) {
  const league_id = req.nextUrl.searchParams.get("league_id");
  if (!league_id) {
    return NextResponse.json({ error: "league_id requerido." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const nowMs = Date.now();

  // Today's window in Guatemala time
  const today = getGuatemalaDay(nowMs);
  const todayBounds = dayBounds(today.y, today.mo, today.d);

  let { data: matchData } = await supabase
    .from("matches")
    .select("id, home_team, away_team, group, matchday, kickoff_at, home_score, away_score, status")
    .gte("kickoff_at", todayBounds.start)
    .lt("kickoff_at", todayBounds.end)
    .order("kickoff_at");

  let isToday = true;
  if (!matchData || matchData.length === 0) {
    isToday = false;
    // Only look at future matches (avoids past unscored matches appearing)
    const nowIso = new Date(nowMs).toISOString();
    const { data: next } = await supabase
      .from("matches")
      .select("kickoff_at")
      .gt("kickoff_at", nowIso)
      .neq("status", "finished")
      .order("kickoff_at")
      .limit(1)
      .single();

    if (next) {
      const { y, mo, d } = getGuatemalaDay(new Date(next.kickoff_at).getTime());
      const b = dayBounds(y, mo, d);
      const { data: upcoming } = await supabase
        .from("matches")
        .select("id, home_team, away_team, group, matchday, kickoff_at, home_score, away_score, status")
        .gte("kickoff_at", b.start)
        .lt("kickoff_at", b.end)
        .order("kickoff_at");
      matchData = upcoming ?? [];
    }
  }

  const matchList = matchData ?? [];

  // League locked status
  const { data: league } = await supabase
    .from("leagues")
    .select("predictions_locked")
    .eq("id", league_id)
    .single();
  const leagueLocked = league?.predictions_locked ?? false;

  if (matchList.length === 0 || !leagueLocked) {
    return NextResponse.json({ matches: matchList, isToday, leagueLocked, players: [] });
  }

  // Submitted players (paid + 72 predictions)
  const { data: submitted } = await supabase.rpc("get_submitted_players", { p_league_id: league_id });
  const submittedIds: string[] = (submitted ?? []).map((r: { player_id: string }) => r.player_id);

  if (submittedIds.length === 0) {
    return NextResponse.json({ matches: matchList, isToday, leagueLocked, players: [] });
  }

  // Leaderboard standings (1 row per player — no row-limit issues)
  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("player_id, player_name, total_points, exact_scores")
    .eq("league_id", league_id)
    .in("player_id", submittedIds)
    .order("total_points", { ascending: false })
    .order("exact_scores", { ascending: false });

  if (!leaderboard || leaderboard.length === 0) {
    return NextResponse.json({ matches: matchList, isToday, leagueLocked, players: [] });
  }

  // Predictions for today's matches (small: ≤8 matches × N players)
  const matchIds = matchList.map((m: { id: string }) => m.id);
  const playerIds = leaderboard.map((p: { player_id: string }) => p.player_id);

  const { data: preds } = await supabase
    .from("predictions")
    .select("player_id, match_id, home_score, away_score, points")
    .in("match_id", matchIds)
    .in("player_id", playerIds);

  const predsByPlayer: Record<string, Record<string, { pred_home: number; pred_away: number; points: number | null }>> = {};
  for (const pred of preds ?? []) {
    if (!predsByPlayer[pred.player_id]) predsByPlayer[pred.player_id] = {};
    predsByPlayer[pred.player_id][pred.match_id] = {
      pred_home: pred.home_score,
      pred_away: pred.away_score,
      points: pred.points,
    };
  }

  const players = leaderboard.map((p: { player_id: string; player_name: string; total_points: number; exact_scores: number }) => ({
    player_id: p.player_id,
    player_name: p.player_name,
    total_points: p.total_points,
    exact_scores: p.exact_scores,
    preds: predsByPlayer[p.player_id] ?? {},
  }));

  return NextResponse.json({ matches: matchList, isToday, leagueLocked, players });
}
