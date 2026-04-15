import { NextRequest, NextResponse } from "next/server";

// Maps our Spanish team names → football-data.org English names
const ES_TO_API: Record<string, string> = {
  "México": "Mexico",
  "Brasil": "Brazil",
  "Alemania": "Germany",
  "Francia": "France",
  "Argentina": "Argentina",
  "España": "Spain",
  "Inglaterra": "England",
  "Portugal": "Portugal",
  "Países Bajos": "Netherlands",
  "Bélgica": "Belgium",
  "Estados Unidos": "United States",
  "Canadá": "Canada",
  "Japón": "Japan",
  "Corea del Sur": "Korea Republic",
  "Australia": "Australia",
  "Marruecos": "Morocco",
  "Senegal": "Senegal",
  "Ghana": "Ghana",
  "Egipto": "Egypt",
  "Túnez": "Tunisia",
  "Costa de Marfil": "Côte d'Ivoire",
  "Argelia": "Algeria",
  "RD Congo": "DR Congo",
  "Sudáfrica": "South Africa",
  "Cabo Verde": "Cabo Verde",
  "Ecuador": "Ecuador",
  "Uruguay": "Uruguay",
  "Colombia": "Colombia",
  "Paraguay": "Paraguay",
  "Haití": "Haiti",
  "Irán": "Iran",
  "Arabia Saudita": "Saudi Arabia",
  "Irak": "Iraq",
  "Jordania": "Jordan",
  "Uzbekistán": "Uzbekistan",
  "Catar": "Qatar",
  "Turquía": "Türkiye",
  "Suiza": "Switzerland",
  "Austria": "Austria",
  "Noruega": "Norway",
  "Escocia": "Scotland",
  "Croacia": "Croatia",
  "Chequia": "Czechia",
  "Bosnia y Herzegovina": "Bosnia and Herzegovina",
  "Suecia": "Sweden",
  "Curazao": "Curaçao",
  "Nueva Zelanda": "New Zealand",
  "Panamá": "Panama",
};

// Reverse map: API English name → our Spanish name
const API_TO_ES: Record<string, string> = Object.fromEntries(
  Object.entries(ES_TO_API).map(([es, api]) => [api.toLowerCase(), es])
);

function resolveTeam(apiName: string): string {
  return API_TO_ES[apiName.toLowerCase()] ?? apiName;
}

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
