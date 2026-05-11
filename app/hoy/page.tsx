"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import FlagImg from "@/components/FlagImg";

type TodayMatch = {
  id: string;
  home_team: string;
  away_team: string;
  group: string | null;
  matchday: number;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type MatchPrediction = {
  player_id: string;
  player_name: string;
  pred_home: number;
  pred_away: number;
  points: number | null;
};

export default function HoyPage() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [leagueLocked, setLeagueLocked] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<TodayMatch[]>([]);
  const [predictions, setPredictions] = useState<Record<string, MatchPrediction[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeMatch, setActiveMatch] = useState<string | null>(null);
  const [isToday, setIsToday] = useState(true);
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

    const { data: league } = await supabase
      .from("leagues")
      .select("predictions_locked")
      .eq("id", leagueId!)
      .single();
    setLeagueLocked(league?.predictions_locked ?? false);

    // Today's date range in UTC
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

    let { data: todayMatches } = await supabase
      .from("matches")
      .select("id, home_team, away_team, group, matchday, kickoff_at, home_score, away_score, status")
      .gte("kickoff_at", `${todayStr}T00:00:00`)
      .lt("kickoff_at", `${tomorrowStr}T00:00:00`)
      .order("kickoff_at");

    let foundToday = true;
    if (!todayMatches || todayMatches.length === 0) {
      foundToday = false;
      const { data: upcoming } = await supabase
        .from("matches")
        .select("id, home_team, away_team, group, matchday, kickoff_at, home_score, away_score, status")
        .neq("status", "finished")
        .order("kickoff_at")
        .limit(8);
      todayMatches = upcoming ?? [];
    }

    setIsToday(foundToday);
    setMatches(todayMatches ?? []);

    if (!todayMatches || todayMatches.length === 0) {
      setLoading(false);
      return;
    }

    setActiveMatch(todayMatches[0].id);

    // Submitted players only (predictions_count = 72)
    const { data: submitted } = await supabase
      .from("leaderboard")
      .select("player_id, player_name")
      .eq("league_id", leagueId!)
      .eq("predictions_count", 72);

    if (!submitted || submitted.length === 0) {
      setLoading(false);
      return;
    }

    const matchIds = todayMatches.map((m) => m.id);
    const playerIds = submitted.map((p) => p.player_id);
    const playerMap: Record<string, string> = {};
    for (const p of submitted) playerMap[p.player_id] = p.player_name;

    const { data: preds } = await supabase
      .from("predictions")
      .select("player_id, match_id, home_score, away_score, points")
      .in("match_id", matchIds)
      .in("player_id", playerIds);

    const grouped: Record<string, MatchPrediction[]> = {};
    for (const pred of preds ?? []) {
      if (!grouped[pred.match_id]) grouped[pred.match_id] = [];
      grouped[pred.match_id].push({
        player_id: pred.player_id,
        player_name: playerMap[pred.player_id] ?? "?",
        pred_home: pred.home_score,
        pred_away: pred.away_score,
        points: pred.points,
      });
    }
    for (const mid of Object.keys(grouped)) {
      grouped[mid].sort((a, b) => a.player_name.localeCompare(b.player_name));
    }

    setPredictions(grouped);
    setLoading(false);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es", { weekday: "long", month: "long", day: "numeric" });
  }

  function pointsBadge(points: number | null, status: string) {
    if (status !== "finished" || points === null) return null;
    const colors: Record<number, string> = {
      6: "bg-yellow-400 text-yellow-900",
      4: "bg-blue-100 text-blue-700",
      3: "bg-green-100 text-green-700",
      1: "bg-gray-100 text-gray-500",
      0: "bg-red-100 text-red-400",
    };
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${colors[points] ?? "bg-gray-100 text-gray-400"}`}>
        {points}pts
      </span>
    );
  }

  if (!leagueId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Debes unirte a una liga para ver los partidos.</p>
      </div>
    );
  }

  const activeMatchData = matches.find((m) => m.id === activeMatch);
  const activePreds = activeMatch ? (predictions[activeMatch] ?? []) : [];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28">
      <h1 className="text-2xl font-black text-gray-900 mb-0.5">
        {isToday ? "Partidos de hoy" : "Próximos partidos"}
      </h1>
      <p className="text-sm text-gray-400 mb-5">{leagueName}</p>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay partidos programados.</div>
      ) : (
        <>
          {/* Match selector tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMatch(m.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  activeMatch === m.id
                    ? "bg-fifa-blue text-white border-fifa-blue shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                <FlagImg team={m.home_team} h={14} />
                <span className="text-[10px] opacity-60">vs</span>
                <FlagImg team={m.away_team} h={14} />
              </button>
            ))}
          </div>

          {/* Active match card */}
          {activeMatchData && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Match header */}
              <div className="bg-gray-50 border-b border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-400 font-medium">
                    {activeMatchData.group
                      ? `Grupo ${activeMatchData.group} · Jornada ${activeMatchData.matchday}`
                      : `Jornada ${activeMatchData.matchday}`}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeMatchData.status === "finished"
                      ? "bg-gray-100 text-gray-500"
                      : activeMatchData.status === "live"
                      ? "bg-green-100 text-green-600 animate-pulse"
                      : "bg-blue-50 text-blue-500"
                  }`}>
                    {activeMatchData.status === "finished"
                      ? "Finalizado"
                      : activeMatchData.status === "live"
                      ? "En vivo"
                      : formatTime(activeMatchData.kickoff_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <FlagImg team={activeMatchData.home_team} h={28} />
                    <span className="text-sm font-bold text-gray-900 text-center leading-tight">
                      {activeMatchData.home_team}
                    </span>
                  </div>

                  <div className="flex flex-col items-center px-4">
                    {activeMatchData.status === "finished" && activeMatchData.home_score !== null ? (
                      <span className="text-3xl font-black text-gray-900">
                        {activeMatchData.home_score}–{activeMatchData.away_score}
                      </span>
                    ) : (
                      <>
                        <span className="text-xl font-black text-gray-300">vs</span>
                        {!isToday && (
                          <span className="text-[10px] text-gray-400 mt-1 text-center">
                            {formatDate(activeMatchData.kickoff_at)}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <FlagImg team={activeMatchData.away_team} h={28} />
                    <span className="text-sm font-bold text-gray-900 text-center leading-tight">
                      {activeMatchData.away_team}
                    </span>
                  </div>
                </div>
              </div>

              {/* Predictions list */}
              <div className="p-4">
                {!leagueLocked ? (
                  <p className="text-center text-sm text-gray-400 py-6">
                    🔒 Las predicciones se revelan cuando la liga esté cerrada
                  </p>
                ) : activePreds.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">
                    Sin predicciones registradas
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Predicciones · {activePreds.length} participante{activePreds.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-col gap-2">
                      {activePreds.map((pred) => {
                        const isMe = pred.player_id === myPlayerId;
                        return (
                          <div
                            key={pred.player_id}
                            className={`flex items-center gap-3 py-2 px-3 rounded-xl ${
                              isMe
                                ? "bg-fifa-blue/5 border border-fifa-blue/20"
                                : "bg-gray-50"
                            }`}
                          >
                            {/* Avatar */}
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 overflow-hidden"
                              style={{ background: isMe ? "#003f7f" : "#9ca3af" }}
                            >
                              <img
                                src={`${supabaseUrl}/storage/v1/object/public/Avatar/${pred.player_id}`}
                                onError={(e) => {
                                  const el = e.target as HTMLImageElement;
                                  el.style.display = "none";
                                  if (el.parentElement)
                                    el.parentElement.innerText = pred.player_name[0].toUpperCase();
                                }}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            </div>

                            {/* Name */}
                            <span className={`flex-1 text-sm font-medium truncate ${isMe ? "text-fifa-blue font-semibold" : "text-gray-700"}`}>
                              {pred.player_name}
                              {isMe && <span className="text-[10px] text-fifa-blue/50 ml-1">(tú)</span>}
                            </span>

                            {/* Predicted score */}
                            <span className="text-sm font-black text-gray-900 shrink-0">
                              {pred.pred_home}–{pred.pred_away}
                            </span>

                            {/* Points badge */}
                            {pointsBadge(pred.points, activeMatchData.status)}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
