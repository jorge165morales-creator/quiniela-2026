import { NextRequest, NextResponse } from "next/server";
import { resolveTeam } from "@/lib/team-map";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FOOTBALL_DATA_API_KEY no configurada en las variables de entorno." },
      { status: 500 }
    );
  }

  let res: Response;
  try {
    res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED",
      {
        headers: { "X-Auth-Token": apiKey },
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con la API de fútbol." }, { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Error de la API externa (${res.status}): ${text}` },
      { status: 502 }
    );
  }

  const data = await res.json();

  const scores = (data.matches ?? [])
    .filter((m: any) => m.score?.fullTime?.home !== null && m.score?.fullTime?.away !== null)
    .map((m: any) => ({
      homeTeam: resolveTeam(m.homeTeam.name),
      awayTeam: resolveTeam(m.awayTeam.name),
      home_score: m.score.fullTime.home as number,
      away_score: m.score.fullTime.away as number,
      utcDate: m.utcDate as string,
    }));

  return NextResponse.json({ scores });
}
