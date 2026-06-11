import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { calculatePoints } from "@/lib/scoring";
import { resolveTeam } from "@/lib/team-map";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FOOTBALL_DATA_API_KEY no configurada." }, { status: 500 });
  }

  // Fetch all WC matches — handle both IN_PLAY and FINISHED
  let apiRes: Response;
  try {
    apiRes = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      { headers: { "X-Auth-Token": apiKey }, cache: "no-store" }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con la API de fútbol." }, { status: 502 });
  }

  if (!apiRes.ok) {
    return NextResponse.json({ error: `API error ${apiRes.status}` }, { status: 502 });
  }

  const apiData = await apiRes.json();
  const allMatches: any[] = apiData.matches ?? [];

  const liveFromApi = allMatches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  );
  const finishedFromApi = allMatches.filter(
    (m) => m.status === "FINISHED" &&
      m.score?.fullTime?.home !== null &&
      m.score?.fullTime?.away !== null
  );

  if (liveFromApi.length === 0 && finishedFromApi.length === 0) {
    return NextResponse.json({ ok: true, scored: 0, liveUpdated: 0, message: "No active or finished matches." });
  }

  // DB matches not yet finished (includes upcoming + live)
  const supabase = createServiceClient();
  const { data: dbMatches, error: dbError } = await supabase
    .from("matches")
    .select("id, home_team, away_team, status")
    .eq("round", "group")
    .neq("status", "finished");

  if (dbError || !dbMatches) {
    return NextResponse.json({ error: "Error al leer partidos de la base de datos." }, { status: 500 });
  }

  let scored = 0;
  let liveUpdated = 0;
  const errors: string[] = [];

  // Live matches — update score + mark live, no points calculation
  for (const apiMatch of liveFromApi) {
    const homeEs = resolveTeam(apiMatch.homeTeam.name);
    const awayEs = resolveTeam(apiMatch.awayTeam.name);
    const homeScore = apiMatch.score?.fullTime?.home ?? 0;
    const awayScore = apiMatch.score?.fullTime?.away ?? 0;

    const dbMatch = dbMatches.find(
      (m) =>
        m.home_team.toLowerCase() === homeEs.toLowerCase() &&
        m.away_team.toLowerCase() === awayEs.toLowerCase()
    );
    if (!dbMatch) continue;

    const { error } = await supabase
      .from("matches")
      .update({ home_score: homeScore, away_score: awayScore, status: "live" })
      .eq("id", dbMatch.id);

    if (error) errors.push(`Live update ${dbMatch.id}: ${error.message}`);
    else liveUpdated++;
  }

  // Finished matches — update score + calculate points
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
    if (!dbMatch) continue;

    const { error: matchErr } = await supabase
      .from("matches")
      .update({ home_score: homeScore, away_score: awayScore, status: "finished" })
      .eq("id", dbMatch.id);

    if (matchErr) {
      errors.push(`Failed to update match ${dbMatch.id}: ${matchErr.message}`);
      continue;
    }

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
    liveUpdated,
    errors: errors.length > 0 ? errors : undefined,
  });
}
