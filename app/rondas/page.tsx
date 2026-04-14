"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RoundEntry = {
  player_id: string;
  player_name: string;
  points: number;
  exact_scores: number;
};

type RoundData = {
  matchday: number;
  entries: RoundEntry[];
  finished_matches: number;
  total_matches: number;
};

export default function RondasPage() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [activeTab, setActiveTab] = useState(1);
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

    // Get all players in this league
    const { data: playerData } = await supabase
      .from("players")
      .select("id, name")
      .eq("league_id", leagueId!);

    if (!playerData || playerData.length === 0) { setLoading(false); return; }

    const playerIds = playerData.map((p) => p.id);
    const playerMap: Record<string, string> = {};
    for (const p of playerData) playerMap[p.id] = p.name;

    // Get all predictions with match info
    const { data: preds } = await supabase
      .from("predictions")
      .select("player_id, points, matches(matchday, status)")
      .in("player_id", playerIds);

    if (!preds) { setLoading(false); return; }

    // Group by matchday
    const roundMap: Record<number, {
      pointsByPlayer: Record<string, number>;
      exactsByPlayer: Record<string, number>;
      finished: number;
      total: number;
    }> = { 1: { pointsByPlayer: {}, exactsByPlayer: {}, finished: 0, total: 0 },
            2: { pointsByPlayer: {}, exactsByPlayer: {}, finished: 0, total: 0 },
            3: { pointsByPlayer: {}, exactsByPlayer: {}, finished: 0, total: 0 } };

    for (const pred of preds as any[]) {
      const md: number = pred.matches?.matchday;
      if (!md || !roundMap[md]) continue;
      const r = roundMap[md];

      // Count total and finished matches (use first player as reference to avoid double-counting)
      // We'll count matches separately below

      if (pred.points !== null) {
        const pid = pred.player_id;
        r.pointsByPlayer[pid] = (r.pointsByPlayer[pid] ?? 0) + pred.points;
        if (pred.points === 6) {
          r.exactsByPlayer[pid] = (r.exactsByPlayer[pid] ?? 0) + 1;
        }
      }
    }

    // Count finished and total matches per matchday
    const { data: matchData } = await supabase
      .from("matches")
      .select("matchday, status")
      .in("matchday", [1, 2, 3]);

    if (matchData) {
      for (const m of matchData as any[]) {
        const md = m.matchday;
        if (!roundMap[md]) continue;
        roundMap[md].total++;
        if (m.status === "finished") roundMap[md].finished++;
      }
    }

    // Build sorted entries per round
    const result: RoundData[] = [1, 2, 3].map((md) => {
      const r = roundMap[md];
      const entries: RoundEntry[] = playerData.map((p) => ({
        player_id: p.id,
        player_name: p.name,
        points: r.pointsByPlayer[p.id] ?? 0,
        exact_scores: r.exactsByPlayer[p.id] ?? 0,
      }));
      entries.sort((a, b) => b.points - a.points || b.exact_scores - a.exact_scores);
      return { matchday: md, entries, finished_matches: r.finished, total_matches: r.total };
    });

    setRounds(result);

    // Auto-select the active round (first non-finished, or last)
    const inProgress = result.find((r) => r.finished_matches > 0 && r.finished_matches < r.total_matches);
    const firstStarted = result.find((r) => r.finished_matches > 0);
    if (inProgress) setActiveTab(inProgress.matchday);
    else if (firstStarted) setActiveTab(firstStarted.matchday);

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
        <p className="text-gray-400">Cargando rondas...</p>
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

  const activeRound = rounds.find((r) => r.matchday === activeTab);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900">Rondas</h1>
        {leagueName && <p className="text-gray-500 text-sm mt-0.5">{leagueName}</p>}
      </div>

      {/* Prize banner */}
      <div className="bg-fifa-blue rounded-2xl px-5 py-3 mb-5 text-white flex items-center gap-3">
        <span className="text-2xl">🏅</span>
        <p className="text-sm"><strong>Premio por ronda: Q150 / $20</strong> — El jugador con más puntos al final de cada jornada gana.</p>
      </div>

      {/* Round tabs */}
      <div className="flex gap-2 mb-5">
        {rounds.map((r) => {
          const finished = r.finished_matches === r.total_matches && r.total_matches > 0;
          const started = r.finished_matches > 0;
          const isActive = activeTab === r.matchday;
          return (
            <button
              key={r.matchday}
              onClick={() => setActiveTab(r.matchday)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-colors border ${
                isActive
                  ? "bg-fifa-blue text-white border-fifa-blue"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <div>Jornada {r.matchday}</div>
              <div className={`text-xs font-normal mt-0.5 ${isActive ? "text-blue-200" : "text-gray-400"}`}>
                {finished ? "Finalizada" : started ? `${r.finished_matches}/${r.total_matches} partidos` : "Pendiente"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Leaderboard for active round */}
      {activeRound && (
        <>
          {activeRound.finished_matches === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-8 text-center text-gray-400">
              Los partidos de esta jornada aún no han comenzado.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeRound.entries.map((entry, i) => {
                const isMe = entry.player_id === myPlayerId;
                const isWinner = i === 0 && activeRound.finished_matches === activeRound.total_matches;
                const rank = i + 1;

                return (
                  <div
                    key={entry.player_id}
                    className={`bg-white rounded-2xl px-4 py-3 border shadow-sm flex items-center gap-3 ${
                      isWinner ? "border-fifa-gold/60" : isMe ? "border-fifa-blue/30" : "border-gray-200"
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-7 flex items-center justify-center shrink-0">
                      {rank === 1 && activeRound.finished_matches === activeRound.total_matches
                        ? <span className="text-xl">🥇</span>
                        : rank === 1 ? <span className="text-xl">🥇</span>
                        : rank === 2 ? <span className="text-xl">🥈</span>
                        : rank === 3 ? <span className="text-xl">🥉</span>
                        : <span className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{rank}</span>
                      }
                    </div>

                    {/* Avatar */}
                    <Avatar name={entry.player_name} playerId={entry.player_id} isMe={isMe} />

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-sm truncate block ${isMe ? "text-fifa-blue" : "text-gray-900"}`}>
                        {entry.player_name}
                        {isMe && <span className="text-xs text-gray-400 font-normal ml-1">(tú)</span>}
                      </span>
                      <span className="text-xs text-gray-400">{entry.exact_scores} exactos</span>
                      {isWinner && (
                        <span className="ml-2 text-xs font-bold text-yellow-600">🏅 Ganador</span>
                      )}
                    </div>

                    {/* Points */}
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-black text-fifa-blue">{entry.points}</span>
                      <span className="text-xs text-gray-400 ml-1">pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeRound.finished_matches > 0 && activeRound.finished_matches < activeRound.total_matches && (
            <p className="text-xs text-gray-400 text-center mt-3">
              {activeRound.total_matches - activeRound.finished_matches} partidos pendientes en esta jornada
            </p>
          )}
        </>
      )}
    </div>
  );
}
