"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlayerStatus = {
  player_id: string;
  player_name: string;
  eliminated: boolean;
  first_zero_match: string | null; // "TeamA vs TeamB"
  first_zero_group: string | null;
  first_zero_matchday: number | null;
  first_zero_kickoff: string | null;
};

export default function UltimoCeroPage() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    const lid = localStorage.getItem("league_id");
    const lname = localStorage.getItem("league_name");
    setLeagueId(lid);
    setLeagueName(lname);
  }, []);

  useEffect(() => {
    if (!leagueId) return;
    load();
  }, [leagueId]);

  async function load() {
    setLoading(true);

    // Get all players in the league
    const { data: playerData } = await supabase
      .from("players")
      .select("id, name")
      .eq("league_id", leagueId!)
      .order("name");

    if (!playerData) { setLoading(false); return; }

    // Get all predictions with points=0 on finished matches, with match info
    const playerIds = playerData.map((p) => p.id);
    const { data: zeroPreds } = await supabase
      .from("predictions")
      .select(`
        player_id,
        matches (
          home_team,
          away_team,
          group,
          matchday,
          kickoff_at,
          status
        )
      `)
      .in("player_id", playerIds)
      .eq("points", 0);

    // Build a map: player_id -> earliest zero (by kickoff_at)
    const firstZero: Record<string, {
      match: string;
      group: string;
      matchday: number;
      kickoff: string;
    }> = {};

    if (zeroPreds) {
      for (const pred of zeroPreds as any[]) {
        const m = pred.matches;
        if (!m || m.status !== "finished") continue;
        const existing = firstZero[pred.player_id];
        if (!existing || m.kickoff_at < existing.kickoff) {
          firstZero[pred.player_id] = {
            match: `${m.home_team} vs ${m.away_team}`,
            group: m.group ?? "?",
            matchday: m.matchday,
            kickoff: m.kickoff_at,
          };
        }
      }
    }

    const statuses: PlayerStatus[] = playerData.map((p) => {
      const z = firstZero[p.id];
      return {
        player_id: p.id,
        player_name: p.name,
        eliminated: !!z,
        first_zero_match: z?.match ?? null,
        first_zero_group: z?.group ?? null,
        first_zero_matchday: z?.matchday ?? null,
        first_zero_kickoff: z?.kickoff ?? null,
      };
    });

    // Sort: alive first (alphabetical), then eliminated sorted by kickoff desc (lasted longest)
    statuses.sort((a, b) => {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if (a.eliminated && b.eliminated) {
        // Later kickoff = lasted longer = better
        return (b.first_zero_kickoff ?? "").localeCompare(a.first_zero_kickoff ?? "");
      }
      return a.player_name.localeCompare(b.player_name);
    });

    setPlayers(statuses);
    setLoading(false);
  }

  function Avatar({ name, playerId }: { name: string; playerId: string }) {
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const imgUrl = `${supabaseUrl}/storage/v1/object/public/Avatar/${playerId}`;
    const [imgFailed, setImgFailed] = useState(false);

    if (!imgFailed) {
      return (
        <span className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-transparent">
          <img src={imgUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        </span>
      );
    }
    return (
      <span className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shrink-0 bg-gray-200 text-gray-600">
        {initials}
      </span>
    );
  }

  const alive = players.filter((p) => !p.eliminated);
  const eliminated = players.filter((p) => p.eliminated);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (!leagueId) {
    return (
      <div className="text-center mt-20">
        <p className="text-gray-500 mb-4">No estás en ninguna liga.</p>
        <a href="/join" className="text-fifa-blue hover:underline font-medium">Unirse a una liga</a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Último 0</h1>
        {leagueName && <p className="text-gray-500 text-sm mt-0.5">{leagueName}</p>}
      </div>

      {/* Prize banner */}
      <div className="bg-fifa-blue rounded-2xl px-5 py-4 mb-6 text-white flex items-center gap-4">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="font-black text-lg leading-tight">Premio: Q150 / $20</p>
          <p className="text-blue-200 text-sm mt-0.5">El último jugador que no reciba un 0 en ningún partido gana.</p>
        </div>
      </div>

      {/* Alive players */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Vivos — {alive.length}
          </h2>
        </div>

        {alive.length === 0 ? (
          <p className="text-gray-400 text-sm px-1">Todos han recibido al menos un 0.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {alive.map((p) => (
              <div key={p.player_id} className="bg-white border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <Avatar name={p.player_name} playerId={p.player_id} />
                <span className="font-bold text-gray-900 flex-1">{p.player_name}</span>
                <span className="text-green-600 font-bold text-sm">Sin 0s</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Eliminated players */}
      {eliminated.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Eliminados — {eliminated.length}
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {eliminated.map((p, i) => (
              <div key={p.player_id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm opacity-60">
                <Avatar name={p.player_name} playerId={p.player_id} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-700">{p.player_name}</p>
                  {p.first_zero_match && (
                    <p className="text-xs text-gray-400 truncate">
                      Primer 0: {p.first_zero_match}
                      {p.first_zero_group && ` · Grupo ${p.first_zero_group}, J${p.first_zero_matchday}`}
                    </p>
                  )}
                </div>
                <span className="text-red-400 font-bold text-xs shrink-0">#{i + 1}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
