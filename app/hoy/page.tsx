"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import FlagImg from "@/components/FlagImg";
import { calculatePoints } from "@/lib/scoring";

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
  match_id: string;
  pred_home: number;
  pred_away: number;
  points: number | null;
};

type SubmittedPlayer = {
  player_id: string;
  player_name: string;
  preds: Record<string, MatchPrediction>;
};

export default function HoyPage() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [leagueLocked, setLeagueLocked] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<TodayMatch[]>([]);
  const [players, setPlayers] = useState<SubmittedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
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

    const { data: submitted } = await supabase
      .from("leaderboard")
      .select("player_id, player_name, total_points, exact_scores")
      .eq("league_id", leagueId!)
      .eq("predictions_count", 72)
      .order("total_points", { ascending: false })
      .order("exact_scores", { ascending: false });

    if (!submitted || submitted.length === 0) {
      setLoading(false);
      return;
    }

    const matchIds = todayMatches.map((m) => m.id);
    const playerIds = submitted.map((p) => p.player_id);

    const { data: preds } = await supabase
      .from("predictions")
      .select("player_id, match_id, home_score, away_score, points")
      .in("match_id", matchIds)
      .in("player_id", playerIds);

    const predsByPlayer: Record<string, Record<string, MatchPrediction>> = {};
    for (const pred of preds ?? []) {
      if (!predsByPlayer[pred.player_id]) predsByPlayer[pred.player_id] = {};
      predsByPlayer[pred.player_id][pred.match_id] = {
        match_id: pred.match_id,
        pred_home: pred.home_score,
        pred_away: pred.away_score,
        points: pred.points,
      };
    }

    const rows: SubmittedPlayer[] = submitted
      .map((p) => ({ player_id: p.player_id, player_name: p.player_name, preds: predsByPlayer[p.player_id] ?? {} }));

    setPlayers(rows);
    setLoading(false);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es", { month: "short", day: "numeric" });
  }

  function livePoints(match: TodayMatch, pred: MatchPrediction): number | null {
    if (match.status === "finished") return pred.points;
    if (match.status === "live" && match.home_score !== null && match.away_score !== null) {
      return calculatePoints(match.home_score, match.away_score, pred.pred_home, pred.pred_away);
    }
    return null;
  }

  function cellStyle(pts: number | null, status: string) {
    if ((status !== "finished" && status !== "live") || pts === null) return "";
    if (pts === 6) return "bg-yellow-50 text-yellow-800 font-black";
    if (pts >= 3) return "bg-blue-50 text-blue-700 font-bold";
    if (pts === 1) return "bg-gray-50 text-gray-500";
    return "bg-red-50 text-red-400";
  }

  function ptsBadge(pts: number | null) {
    if (pts === null) return null;
    const colors: Record<number, string> = {
      6: "bg-yellow-400 text-yellow-900",
      4: "bg-blue-100 text-blue-700",
      3: "bg-green-100 text-green-700",
      1: "bg-gray-200 text-gray-500",
      0: "bg-red-100 text-red-400",
    };
    return (
      <span className={`text-[9px] font-black px-1 py-0.5 rounded-full ml-1 ${colors[pts] ?? "bg-gray-100 text-gray-400"}`}>
        {pts}
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28">
      <h1 className="text-2xl font-black text-gray-900 mb-0.5">
        {isToday ? "Partidos de hoy" : "Próximos partidos"}
      </h1>
      <p className="text-sm text-gray-400 mb-5">{leagueName}</p>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay partidos programados.</div>
      ) : !leagueLocked ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-gray-500 text-sm">Las predicciones se revelan cuando la liga esté cerrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  {/* Player name column header */}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-white z-10 min-w-[140px]">
                    Participante
                  </th>

                  {/* One column per match */}
                  {matches.map((m) => (
                    <th key={m.id} className="px-3 py-2 text-center min-w-[110px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5 justify-center">
                          <FlagImg team={m.home_team} h={13} />
                          <span className="text-[10px] text-gray-400">vs</span>
                          <FlagImg team={m.away_team} h={13} />
                        </div>
                        <div className="text-[10px] font-semibold text-gray-700 leading-tight text-center">
                          {m.home_team.split(" ")[0]}
                          <span className="text-gray-400 mx-0.5">–</span>
                          {m.away_team.split(" ")[0]}
                        </div>
                        {(m.status === "finished" || m.status === "live") && m.home_score !== null ? (
                          <span className={`text-[12px] font-black px-2 py-0.5 rounded-full ${m.status === "live" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-900"}`}>
                            {m.home_score}–{m.away_score}
                            {m.status === "live" && <span className="text-[9px] ml-1 animate-pulse">🟢</span>}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            {isToday ? formatTime(m.kickoff_at) : formatDate(m.kickoff_at)}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={matches.length + 1} className="text-center py-10 text-gray-400 text-sm">
                      Sin participantes con quiniela completa
                    </td>
                  </tr>
                ) : (
                  players.map((player, i) => {
                    const isMe = player.player_id === myPlayerId;
                    return (
                      <tr
                        key={player.player_id}
                        className={`border-t border-gray-50 ${isMe ? "bg-fifa-blue/5" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                      >
                        {/* Player name */}
                        <td className={`px-4 py-2.5 sticky left-0 z-10 ${isMe ? "bg-fifa-blue/5" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden"
                              style={{ background: isMe ? "#003f7f" : "#9ca3af" }}
                            >
                              <img
                                src={`${supabaseUrl}/storage/v1/object/public/Avatar/${player.player_id}`}
                                onError={(e) => {
                                  const el = e.target as HTMLImageElement;
                                  el.style.display = "none";
                                  if (el.parentElement)
                                    el.parentElement.innerText = player.player_name[0].toUpperCase();
                                }}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            </div>
                            <span className={`text-sm font-medium truncate max-w-[100px] ${isMe ? "text-fifa-blue font-semibold" : "text-gray-800"}`}>
                              {player.player_name}
                            </span>
                          </div>
                        </td>

                        {/* Prediction per match */}
                        {matches.map((m) => {
                          const pred = player.preds[m.id];
                          const pts = pred ? livePoints(m, pred) : null;
                          return (
                            <td
                              key={m.id}
                              className={`px-3 py-2.5 text-center text-sm ${pred ? cellStyle(pts, m.status) : "text-gray-300"}`}
                            >
                              {pred ? (
                                <span className="inline-flex items-center justify-center">
                                  {pred.pred_home}–{pred.pred_away}
                                  {ptsBadge(pts)}
                                </span>
                              ) : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="flex items-center gap-1.5 text-[10px] text-yellow-800"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />Exacto (6pts)</span>
            <span className="flex items-center gap-1.5 text-[10px] text-blue-700"><span className="w-2.5 h-2.5 rounded-full bg-blue-200 inline-block" />Resultado (3–4pts)</span>
            <span className="flex items-center gap-1.5 text-[10px] text-red-400"><span className="w-2.5 h-2.5 rounded-full bg-red-200 inline-block" />Fallo (0–1pts)</span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">🟢 Puntos en vivo (no confirmados)</span>
          </div>
        </div>
      )}
    </div>
  );
}
