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
  total_points: number;
  exact_scores: number;
  preds: Record<string, MatchPrediction>;
};

function shortName(name: string) {
  return name.split(" ")[0];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { weekday: "short", month: "short", day: "numeric" });
}

function livePoints(match: TodayMatch, pred: MatchPrediction): number | null {
  if (match.status === "finished") return pred.points;
  if (match.status === "live" && match.home_score !== null && match.away_score !== null) {
    return calculatePoints(match.home_score, match.away_score, pred.pred_home, pred.pred_away);
  }
  return null;
}

function ptsBg(pts: number | null, status: string): string {
  if (pts === null || (status !== "finished" && status !== "live")) return "";
  if (pts === 6) return "bg-yellow-100 text-yellow-900 font-black";
  if (pts === 4) return "bg-blue-100 text-blue-800 font-bold";
  if (pts === 3) return "bg-green-100 text-green-800 font-bold";
  if (pts === 1) return "bg-gray-100 text-gray-600";
  return "bg-red-50 text-red-400";
}

export default function HoyPage() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [leagueLocked, setLeagueLocked] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<TodayMatch[]>([]);
  const [players, setPlayers] = useState<SubmittedPlayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
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

  // Realtime: subscribe to match score changes for today's matches
  useEffect(() => {
    if (matches.length === 0) return;
    const ids = matches.map((m) => m.id);
    const channel = supabase
      .channel("hoy-matches-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const updated = payload.new as TodayMatch;
          if (ids.includes(updated.id)) {
            setMatches((prev) =>
              prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
            );
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matches.length]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/hoy?league_id=${leagueId}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();

    setLeagueLocked(data.leagueLocked ?? false);
    setIsToday(data.isToday ?? true);

    const matchList: TodayMatch[] = data.matches ?? [];
    setMatches(matchList);

    // Normalize preds shape from API
    const apiPlayers = (data.players ?? []) as {
      player_id: string;
      player_name: string;
      total_points: number;
      exact_scores: number;
      preds: Record<string, { pred_home: number; pred_away: number; points: number | null }>;
    }[];
    setPlayers(
      apiPlayers.map((p) => ({
        ...p,
        preds: Object.fromEntries(
          Object.entries(p.preds).map(([matchId, pred]) => [
            matchId,
            { match_id: matchId, pred_home: pred.pred_home, pred_away: pred.pred_away, points: pred.points },
          ])
        ),
      }))
    );

    // Auto-select: prefer live match, then first upcoming, then first
    const live = matchList.find((m) => m.status === "live");
    const upcoming = matchList.find((m) => m.status === "upcoming");
    setSelectedId((live ?? upcoming ?? matchList[0])?.id ?? null);

    setLoading(false);
  }

  const selectedMatch = matches.find((m) => m.id === selectedId) ?? null;
  const isLive = selectedMatch?.status === "live";
  const isFinished = selectedMatch?.status === "finished";
  const hasScore = selectedMatch && selectedMatch.home_score !== null;

  // Per-match scoreline counts — to detect unique (Único 6) predictions
  const scorelineCounts: Record<string, Record<string, number>> = {};
  for (const player of players) {
    for (const [matchId, pred] of Object.entries(player.preds)) {
      const key = `${pred.pred_home}-${pred.pred_away}`;
      if (!scorelineCounts[matchId]) scorelineCounts[matchId] = {};
      scorelineCounts[matchId][key] = (scorelineCounts[matchId][key] || 0) + 1;
    }
  }
  function isUnique(matchId: string, pred: MatchPrediction | undefined): boolean {
    if (!pred) return false;
    return (scorelineCounts[matchId]?.[`${pred.pred_home}-${pred.pred_away}`] ?? 0) === 1;
  }

  if (!leagueId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Debes unirte a una liga para ver los partidos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 py-4 pb-28">

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : !leagueLocked ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold text-gray-500 mb-1">Predicciones ocultas</p>
          <p className="text-sm">Las predicciones se mostrarán cuando la liga esté cerrada.</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay partidos programados.</div>
      ) : (
        <>
          {/* ── Main card ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Title bar */}
            <div className="px-4 pt-4 pb-2 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {isToday ? "Partidos de hoy" : `Próximos — ${selectedMatch ? formatDate(selectedMatch.kickoff_at) : ""}`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{leagueName}</p>
            </div>

            {/* Game selector buttons */}
            <div className="flex gap-2 px-3 py-3 overflow-x-auto border-b border-gray-100 scrollbar-hide">
              {matches.map((m, idx) => {
                const active = m.id === selectedId;
                const mLive = m.status === "live";
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-[10px] font-bold transition-colors ${
                      active
                        ? "bg-fifa-blue text-white border-fifa-blue"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <FlagImg team={m.home_team} h={12} />
                      <span className="text-[9px] opacity-60">vs</span>
                      <FlagImg team={m.away_team} h={12} />
                    </div>
                    <span className="whitespace-nowrap">
                      {mLive && <span className="mr-0.5">🟢</span>}
                      {m.home_score !== null
                        ? `${m.home_score}–${m.away_score}`
                        : isToday ? formatTime(m.kickoff_at) : `J${idx + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Match score header */}
            {selectedMatch && (
              <div className="grid grid-cols-2 border-b border-gray-100">
                {/* Home */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#003f7f]">
                  <FlagImg team={selectedMatch.home_team} h={22} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm leading-tight truncate">{selectedMatch.home_team}</p>
                    <p className="text-blue-200 text-[10px]">Local</p>
                  </div>
                  <span className="text-3xl font-black text-white tabular-nums ml-2">
                    {hasScore ? selectedMatch.home_score : "–"}
                  </span>
                </div>
                {/* Away */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-700 flex-row-reverse">
                  <FlagImg team={selectedMatch.away_team} h={22} />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-white font-black text-sm leading-tight truncate">{selectedMatch.away_team}</p>
                    <p className="text-gray-300 text-[10px]">
                      {isLive ? <span className="text-green-300 animate-pulse font-bold">EN VIVO 🟢</span>
                        : isFinished ? "Finalizado"
                        : formatTime(selectedMatch.kickoff_at)}
                    </p>
                  </div>
                  <span className="text-3xl font-black text-white tabular-nums mr-2">
                    {hasScore ? selectedMatch.away_score : "–"}
                  </span>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase w-8">Pos</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase">Nombre</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-[#003f7f] uppercase w-10">
                      {selectedMatch ? shortName(selectedMatch.home_team) : "L"}
                    </th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-600 uppercase w-10">
                      {selectedMatch ? shortName(selectedMatch.away_team) : "V"}
                    </th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase w-12">Pts</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase w-12">Acum</th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                        Sin participantes con quiniela completa
                      </td>
                    </tr>
                  ) : (
                    [...players]
                      .map((player) => {
                        const pred = selectedMatch ? player.preds[selectedMatch.id] : undefined;
                        const pts = pred && selectedMatch ? livePoints(selectedMatch, pred) : null;
                        const liveExtra = selectedMatch?.status === "live" ? (pts ?? 0) : 0;
                        return { ...player, pred, pts, liveTotal: player.total_points + liveExtra };
                      })
                      .sort((a, b) => b.liveTotal - a.liveTotal || b.exact_scores - a.exact_scores)
                      .map((player, i) => {
                      const isMe = player.player_id === myPlayerId;
                      const { pred, pts } = player;
                      const rowBg = isMe
                        ? "bg-blue-50"
                        : i % 2 === 0 ? "bg-white" : "bg-gray-50/60";

                      const isExpanded = expandedPlayerId === player.player_id;
                      return (
                        <>
                        <tr
                          key={player.player_id}
                          onClick={() => setExpandedPlayerId(isExpanded ? null : player.player_id)}
                          className={`border-b border-gray-100 last:border-0 cursor-pointer ${rowBg} ${isExpanded ? "border-b-0" : ""}`}
                        >
                          {/* Pos */}
                          <td className="text-center px-2 py-2">
                            <span className={`text-xs font-black ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-400"}`}>
                              {i + 1}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 overflow-hidden bg-gray-300">
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
                              <span className={`text-xs font-medium truncate max-w-[100px] ${isMe ? "text-fifa-blue font-bold" : "text-gray-800"}`}>
                                {player.player_name}
                              </span>
                            </div>
                          </td>

                          {/* Predicted home */}
                          {(() => {
                            const unique = selectedMatch ? isUnique(selectedMatch.id, pred) : false;
                            return (
                              <>
                                <td className={`text-center px-2 py-2 text-sm font-bold tabular-nums rounded-l ${unique ? "bg-yellow-100 text-yellow-800" : pred ? "text-[#003f7f]" : "text-gray-300"}`}>
                                  {pred ? pred.pred_home : "–"}
                                </td>
                                <td className={`text-center px-2 py-2 text-sm font-bold tabular-nums rounded-r ${unique ? "bg-yellow-100 text-yellow-800" : pred ? "text-gray-700" : "text-gray-300"}`}>
                                  {pred ? pred.pred_away : "–"}
                                  {unique && <span className="ml-0.5 text-[9px]">⭐</span>}
                                </td>
                              </>
                            );
                          })()}

                          {/* Match points */}
                          <td className="text-center px-2 py-2">
                            {pts !== null ? (
                              <span className={`text-xs font-black px-1.5 py-0.5 rounded ${ptsBg(pts, selectedMatch?.status ?? "")}`}>
                                {pts}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">–</span>
                            )}
                          </td>

                          {/* Acum + chevron */}
                          <td className="text-center px-2 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <span className={`text-xs font-black ${isMe ? "text-fifa-blue" : "text-gray-700"}`}>
                                {player.liveTotal}
                              </span>
                              <span className={`text-gray-400 text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded: all today's matches for this player */}
                        {isExpanded && (
                          <tr key={`${player.player_id}-detail`} className={`border-b border-gray-200 ${rowBg}`}>
                            <td colSpan={6} className="px-3 pb-3 pt-1">
                              <div className="flex flex-col gap-1">
                                {matches.map((m) => {
                                  const p = player.preds[m.id];
                                  const mPts = p ? livePoints(m, p) : null;
                                  const active = m.id === selectedId;
                                  return (
                                    <div
                                      key={m.id}
                                      onClick={(e) => { e.stopPropagation(); setSelectedId(m.id); }}
                                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs cursor-pointer ${active ? "bg-fifa-blue/10 border border-fifa-blue/20" : "bg-gray-100/60"}`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <FlagImg team={m.home_team} h={12} />
                                        <span className="text-gray-600 truncate max-w-[60px]">{shortName(m.home_team)}</span>
                                        <span className="text-gray-300">vs</span>
                                        <span className="text-gray-600 truncate max-w-[60px]">{shortName(m.away_team)}</span>
                                        <FlagImg team={m.away_team} h={12} />
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-2">
                                        {p ? (
                                          <span className={`font-black tabular-nums px-1.5 py-0.5 rounded ${isUnique(m.id, p) ? "bg-yellow-100 text-yellow-800" : "text-[#003f7f]"}`}>
                                            {p.pred_home}–{p.pred_away}{isUnique(m.id, p) && <span className="ml-0.5 text-[9px]">⭐</span>}
                                          </span>
                                        ) : (
                                          <span className="text-gray-300">–</span>
                                        )}
                                        {mPts !== null && (
                                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${ptsBg(mPts, m.status)}`}>
                                            {mPts}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <span className="flex items-center gap-1 text-[10px] text-yellow-700"><span className="w-2 h-2 rounded-full bg-yellow-300 inline-block" />Exacto (6)</span>
              <span className="flex items-center gap-1 text-[10px] text-blue-700"><span className="w-2 h-2 rounded-full bg-blue-200 inline-block" />Resultado (3–4)</span>
              <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-2 h-2 rounded-full bg-red-200 inline-block" />Fallo (0–1)</span>
              {isLive && <span className="text-[10px] text-green-600 font-semibold">🟢 Puntos en vivo</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
