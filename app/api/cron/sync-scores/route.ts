import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { calculatePoints } from "@/lib/scoring";
import { resolveTeam } from "@/lib/team-map";

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer {CRON_SECRET}
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FOOTBALL_DATA_API_KEY no configurada." }, { status: 500 });
  }

  // 1. Fetch all finished WC matches from football-data.org
  let apiRes: Response;
  try {
    apiRes = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED",
      { headers: { "X-Auth-Token": apiKey }, cache: "no-store" }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con la API de fútbol." }, { status: 502 });
  }

  if (!apiRes.ok) {
    return NextResponse.json({ error: `API error ${apiRes.status}` }, { status: 502 });
  }

  const apiData = await apiRes.json();
  const finishedFromApi = (apiData.matches ?? []).filter(
    (m: any) => m.score?.fullTime?.home !== null && m.score?.fullTime?.away !== null
  );

  if (finishedFromApi.length === 0) {
    return NextResponse.json({ ok: true, scored: 0, message: "No finished matches yet." });
  }

  // 2. Fetch our DB matches that are NOT yet finished (group stage only)
  const supabase = createServiceClient();
  const { data: dbMatches, error: dbError } = await supabase
    .from("matches")
    .select("id, home_team, away_team, status")
    .eq("round", "group")
    .neq("status", "finished");

  if (dbError || !dbMatches) {
    return NextResponse.json({ error: "Error al leer partidos de la base de datos." }, { status: 500 });
  }

  // 3. Match API results to unfinished DB matches and score them
  let scored = 0;
  const errors: string[] = [];

  for (const apiMatch of finishedFromApi) {
    const homeEs = resolveTeam(apiMatch.homeTeam.name);
    const awayEs = resolveTeam(apiMatch.awayTeam.name);
    const homeScore = apiMatch.score.fullTime.home as number;
    const awayScore = apiMatch.score.fullTime.away as number;

    const dbMatch = dbMatches.find(
      (m) =>
        m.home_team.toLowerCase() === homeEs.toLowerCase() &&
        m.away_team.toLowerCase() === awayEs.toLowerCase()
    );

    if (!dbMatch) continue; // Already finished or not found

    // Update match result
    const { error: matchErr } = await supabase
      .from("matches")
      .update({ home_score: homeScore, away_score: awayScore, status: "finished" })
      .eq("id", dbMatch.id);

    if (matchErr) {
      errors.push(`Failed to update match ${dbMatch.id}: ${matchErr.message}`);
      continue;
    }

    // Score all predictions for this match
    const { data: predictions } = await supabase
      .from("predictions")
      .select("id, player_id, match_id, home_score, away_score")
      .eq("match_id", dbMatch.id);

    if (predictions && predictions.length > 0) {
      const updates = predictions.map((p) => ({
        id: p.id,
        player_id: p.player_id,
        match_id: p.match_id,
        home_score: p.home_score,
        away_score: p.away_score,
        points: calculatePoints(homeScore, awayScore, p.home_score, p.away_score),
      }));

      await supabase.from("predictions").upsert(updates, { onConflict: "player_id,match_id" });
    }

    scored++;
  }

  return NextResponse.json({
    ok: true,
    scored,
    errors: errors.length > 0 ? errors : undefined,
  });
}
