"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type GolesEntry = {
  player_id: string;
  player_name: string;
  predicted_goals: number;
  difference: number; // predicted - actual
};

export default function GolesPage() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [entries, setEntries] = useState<GolesEntry[]>([]);
  const [actualGoals, setActualGoals] = useState(0);
  const [finishedMatches, setFinishedMatches] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    const lid = localStorage.getItem("league_id");
    const lname = localStorage.getItem("league_name");
    const pid = localStorage.getItem("player_id");
    setLeagueId(lid);
    setLeagueName(lname);
    setMyPlayerId(pid);
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
      .eq("league_id", leagueId!);

    if (!playerData || playerData.length === 0) { setLoading(false); return; }

    const playerIds = playerData.map((p) => p.id);

    // Get all finished matches to compute actual goals
    const { data: matchData } = await supabase
      .from("matches")
      .select("id, home_score, away_score, status");

    let actualTotal = 0;
    let finished = 0;
    let total = 0;
    if (matchData) {
      for (const m of matchData as any[]) {
        total++;
        if (m.status === "finished" && m.home_score !== null && m.away_score !== null) {
          actualTotal += m.home_score + m.away_score;
          finished++;
        }
      }
    }
    setActualGoals(actualTotal);
    setFinishedMatches(finished);
    setTotalMatches(total);

    // Get all predictions for league players (sum predicted goals)
    const { data: predData } = await supabase
      .from("predictions")
      .select("player_id, home_score, away_score")
      .in("player_id", playerIds);

    const predictedByPlayer: Record<string, number> = {};
    if (predData) {
      for (const p of predData as any[]) {
        predictedByPlayer[p.player_id] = (predictedByPlayer[p.player_id] ?? 0) + p.home_score + p.away_score;
      }
    }

    const result: GolesEntry[] = playerData.map((p) => {
      const predicted = predictedByPlayer[p.id] ?? 0;
      return {
        player_id: p.id,
        player_name: p.name,
        predicted_goals: predicted,
        difference: predicted - actualTotal,
      };
    });

    // Sort by absolute difference (closest to 0 wins)
    result.sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference));

    setEntries(result);
    setLoading(false);
  }

  function Avatar({ name, playerId, isMe }: { name: string; playerId: string; isMe: boolean }) {
    const imgUrl = `${supabaseUrl}/storage/v1/object/public/Avatar/${playerId}`;
    const [imgFailed, setImgFailed] = useState(false);
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    if (!imgFailed) {
      return (
        <span className={`w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 ${isMe ? "border-fifa-gold" : "border-transparent"}`}>
          <img src={imgUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        </span>
      );
    }
    return (
      <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isMe ? "bg-fifa-gold text-gray-900" : "bg-gray-200 text-gray-600"}`}>
        {initials}
      </span>
    );
  }

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

  const tournamentDone = finishedMatches === totalMatches && totalMatches > 0;
  const tournamentStarted = finishedMatches > 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900">Goles del Torneo</h1>
        {leagueName && <p className="text-gray-500 text-sm mt-0.5">{leagueName}</p>}
      </div>

      {/* Prize banner */}
      <div className="bg-fifa-blue rounded-2xl px-5 py-3 mb-5 text-white flex items-center gap-3">
        <span className="text-2xl">⚽</span>
        <p className="text-sm"><strong>Premio: Q150 / $20</strong> — Quien prediga el total de goles del torneo más cercano a la realidad gana.</p>
      </div>

      {/* Scoreboard: actual vs predicted */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 mb-5 shadow-sm">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Goles del torneo</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-4xl font-black text-fifa-blue">{actualGoals}</p>
            <p className="text-xs text-gray-400 mt-1">Goles reales</p>
          </div>
          <div className="w-px h-12 bg-gray-200" />
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-gray-500">
              {finishedMatches} / {totalMatches}
            </p>
            <p className="text-xs text-gray-400 mt-1">Partidos jugados</p>
          </div>
        </div>
        {!tournamentDone && finishedMatches > 0 && (
          <p className="text-xs text-gray-400 text-center mt-3">
            La diferencia seguirá actualizándose conforme avance el torneo.
          </p>
        )}
      </div>

      {/* Rankings */}
      {!tournamentStarted ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-8 text-center shadow-sm">
          <p className="text-2xl mb-2">🔒</p>
          <p className="font-semibold text-gray-700 mb-1">Los pronósticos están ocultos</p>
          <p className="text-sm text-gray-400">Se revelarán cuando inicie el torneo.</p>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-gray-400 text-center mt-8">No hay predicciones aún.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => {
            const isMe = entry.player_id === myPlayerId;
            const isWinner = i === 0 && tournamentDone;
            const rank = i + 1;
            const diff = entry.difference;
            const absDiff = Math.abs(diff);

            return (
              <div
                key={entry.player_id}
                className={`bg-white rounded-2xl px-4 py-3 border shadow-sm flex items-center gap-3 ${
                  isWinner ? "border-fifa-gold/60" : isMe ? "border-fifa-blue/30" : "border-gray-200"
                }`}
              >
                {/* Rank */}
                <div className="w-7 flex items-center justify-center shrink-0">
                  {rank === 1 ? <span className="text-xl">🥇</span>
                  : rank === 2 ? <span className="text-xl">🥈</span>
                  : rank === 3 ? <span className="text-xl">🥉</span>
                  : <span className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{rank}</span>}
                </div>

                {/* Avatar */}
                <Avatar name={entry.player_name} playerId={entry.player_id} isMe={isMe} />

                {/* Name + predicted */}
                <div className="flex-1 min-w-0">
                  <span className={`font-bold text-sm truncate block ${isMe ? "text-fifa-blue" : "text-gray-900"}`}>
                    {entry.player_name}
                    {isMe && <span className="text-xs text-gray-400 font-normal ml-1">(tú)</span>}
                  </span>
                  <span className="text-xs text-gray-400">
                    {entry.predicted_goals} goles predichos
                    {isWinner && <span className="ml-2 font-bold text-yellow-600">⚽ Ganador</span>}
                  </span>
                </div>

                {/* Difference */}
                <div className="text-right shrink-0">
                  <span className={`text-xl font-black ${
                    absDiff === 0 ? "text-green-500"
                    : absDiff <= 5 ? "text-fifa-blue"
                    : absDiff <= 15 ? "text-gray-700"
                    : "text-gray-400"
                  }`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                  <p className="text-xs text-gray-400">diferencia</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tournamentStarted && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Diferencia = goles predichos − goles reales. El más cercano a 0 gana.
        </p>
      )}
    </div>
  );
}
