// Maps our Spanish team names → football-data.org English names
export const ES_TO_API: Record<string, string> = {
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

// Reverse map: API English name (lowercase) → our Spanish name
export const API_TO_ES: Record<string, string> = Object.fromEntries(
  Object.entries(ES_TO_API).map(([es, api]) => [api.toLowerCase(), es])
);

export function resolveTeam(apiName: string): string {
  return API_TO_ES[apiName.toLowerCase()] ?? apiName;
}
