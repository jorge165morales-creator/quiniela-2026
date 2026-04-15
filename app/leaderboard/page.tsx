"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LeaderboardEntry } from "@/types";
import FlagImg from "@/components/FlagImg";

type PlayerPrediction = {
  match_id: string;
  home_team: string;
  away_team: string;
  group: string;
  matchday: number;
  actual_home: number | null;
  actual_away: number | null;
  pred_home: number;
  pred_away: number;
  points: number | null;
  status: string;
};

type EntryWithDelta = LeaderboardEntry & { delta: number | null };

type UnicoSeis = {
  player_id: string;
  player_name: string;
  home_team: string;
  away_team: string;
  group: string;
  matchday: number;
  home_score: number;
  away_score: number;
};

export default function LeaderboardPage() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [leagueLocked, setLeagueLocked] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntryWithDelta[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [playerPredictions, setPlayerPredictions] = useState<Record<string, PlayerPrediction[]>>({});
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [unicoSeis, setUnicoSeis] = useState<UnicoSeis[]>([]);

  const prevRanks = useRef<Record<string, number>>({});

  useEffect(() => {
    const lid = localStorage.getItem("league_id");
    const lname = localStorage.getItem("league_name");
    const pid = localStorage.getItem("player_id");
    setLeagueId(lid);
    setLeagueName(lname);
    setMyPlayerId(pid);

    if (lid) {
      supabase.from("leagues").select("predictions_locked").eq("id", lid).single()
        .then(({ data }) => { if (data) setLeagueLocked(data.predictions_locked); });
    }
  }, []);

  useEffect(() => {
    if (!leagueId) return;

    async function load() {
      const { data } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("league_id", leagueId!)
        .order("total_points", { ascending: false })
        .order("exact_scores", { ascending: false });

      if (data) {
        const newEntries = (data as LeaderboardEntry[]).filter((e) => e.predictions_count >= 72);
        const newRanks: Record<string, number> = {};
        newEntries.forEach((e, i) => { newRanks[e.player_id] = i + 1; });

        const stored = localStorage.getItem("leaderboard_prev_ranks");
        const savedRanks: Record<string, number> = stored ? JSON.parse(stored) : prevRanks.current;

        const withDelta: EntryWithDelta[] = newEntries.map((e, i) => {
          const oldRank = savedRanks[e.player_id];
          const newRank = i + 1;
          const delta = oldRank != null ? oldRank - newRank : null;
          return { ...e, delta };
        });

        localStorage.setItem("leaderboard_prev_ranks", JSON.stringify(newRanks));
        prevRanks.current = newRanks;
        setEntries(withDelta);
        setLastUpdated(new Date());

        // Único 6: matches where exactly 1 player in this league scored 6 pts
        const playerIds = newEntries.map((e) => e.player_id);
        if (playerIds.length > 0) {
          const { data: sixPreds } = await supabase
            .from("predictions")
            .select("player_id, match_id, matches(home_team, away_team, group, matchday, home_score, away_score, status)")
            .in("player_id", playerIds)
            .eq("points", 6);

          if (sixPreds) {
            // Group by match_id
            const byMatch: Record<string, any[]> = {};
            for (const p of sixPreds as any[]) {
              if (p.matches?.status !== "finished") continue;
              if (!byMatch[p.match_id]) byMatch[p.match_id] = [];
              byMatch[p.match_id].push(p);
            }
            // Keep only matches with exactly 1 scorer
            const winners: UnicoSeis[] = [];
            for (const [, preds] of Object.entries(byMatch)) {
              if (preds.length === 1) {
                const p = preds[0];
                const entry = newEntries.find((e) => e.player_id === p.player_id);
                winners.push({
                  player_id: p.player_id,
                  player_name: entry?.player_name ?? "?",
                  home_team: p.matches.home_team,
                  away_team: p.matches.away_team,
                  group: p.matches.group ?? "?",
                  matchday: p.matches.matchday,
                  home_score: p.matches.home_score,
                  away_score: p.matches.away_score,
                });
              }
            }
            setUnicoSeis(winners);
          }
        }
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("leaderboard-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "predictions" },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leagueId]);

  async function loadPlayerPredictions(playerId: string) {
    setLoadingPlayer(true);
    const { data } = await supabase
      .from("predictions")
      .select(`
        match_id,
        home_score,
        away_score,
        points,
        matches (
          home_team,
          away_team,
          group,
          matchday,
          home_score,
          away_score,
          status
        )
      `)
      .eq("player_id", playerId);

    if (data) {
      const rows: PlayerPrediction[] = data.map((p: any) => ({
        match_id: p.match_id,
        home_team: p.matches?.home_team ?? "?",
        away_team: p.matches?.away_team ?? "?",
        group: p.matches?.group ?? "?",
        matchday: p.matches?.matchday ?? 0,
        actual_home: p.matches?.home_score ?? null,
        actual_away: p.matches?.away_score ?? null,
        pred_home: p.home_score,
        pred_away: p.away_score,
        points: p.points,
        status: p.matches?.status ?? "upcoming",
      }));

      rows.sort((a, b) => a.group.localeCompare(b.group) || a.matchday - b.matchday);
      setPlayerPredictions((prev) => ({ ...prev, [playerId]: rows }));
    }
    setLoadingPlayer(false);
  }

  async function togglePlayer(playerId: string) {
    if (expandedPlayer === playerId) {
      setExpandedPlayer(null);
      return;
    }
    if (!leagueLocked && playerId !== myPlayerId) return;
    setExpandedPlayer(playerId);
    if (!playerPredictions[playerId]) {
      await loadPlayerPredictions(playerId);
    }
  }

  function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return (
      <span className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
        {rank}
      </span>
    );
  }

  function Avatar({ name, isMe, playerId }: { name: string; isMe: boolean; playerId: string }) {
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const imgUrl = `${supabaseUrl}/storage/v1/object/public/Avatar/${playerId}`;
    const [imgFailed, setImgFailed] = useState(false);

    if (!imgFailed) {
      return (
        <span className={`w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 ${isMe ? "border-fifa-gold" : "border-transparent"}`}>
          <img
            src={imgUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        </span>
      );
    }

    return (
      <span className={`w-16 h-16 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
        isMe ? "bg-fifa-gold text-gray-900" : "bg-gray-200 text-gray-600"
      }`}>
        {initials}
      </span>
    );
  }

  function DeltaBadge({ delta }: { delta: number | null }) {
    if (delta === null || delta === 0) return null;
    const up = delta > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
        up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}>
        {up ? "↑" : "↓"}{Math.abs(delta)}
      </span>
    );
  }

  function pointsBadge(pts: number | null, status: string) {
    if (status !== "finished") return <span className="text-gray-300 text-xs">—</span>;
    if (pts === null) return <span className="text-gray-300 text-xs">—</span>;
    const color =
      pts === 6 ? "bg-yellow-400 text-gray-900" :
      pts >= 3  ? "bg-green-100 text-green-800" :
      pts === 1  ? "bg-orange-100 text-orange-700" :
                   "bg-gray-100 text-gray-400";
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>
        {pts} pts
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-gray-400">Cargando tabla...</p>
      </div>
    );
  }

  if (!leagueId) {
    return (
      <div className="text-center mt-20">
        <p className="text-gray-500 mb-4">No estás en ninguna liga.</p>
        <a href="/join" className="text-fifa-blue hover:underline font-medium">
          Unirse a una liga
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Tabla</h1>
          {leagueName && <p className="text-gray-500 text-sm mt-0.5">{leagueName}</p>}
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-400">
            {lastUpdated.toLocaleTimeString("es-MX")}
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-400 text-center mt-16">
          Aún no hay resultados. La tabla se actualiza conforme terminan los partidos.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => {
            const rank = i + 1;
            const isMe = entry.player_id === myPlayerId;
            const isExpanded = expandedPlayer === entry.player_id;
            const preds = playerPredictions[entry.player_id];

            const byGroup: Record<string, PlayerPrediction[]> = {};
            if (preds) {
              for (const p of preds) {
                if (!byGroup[p.group]) byGroup[p.group] = [];
                byGroup[p.group].push(p);
              }
            }

            return (
              <div key={entry.player_id} className={`rounded-2xl overflow-hidden border shadow-sm ${
                isMe ? "border-fifa-gold/50" : "border-gray-200"
              } bg-white`}>
                {/* Player row */}
                <button
                  onClick={() => togglePlayer(entry.player_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${
                    isExpanded ? "bg-gray-50" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center w-9 shrink-0">
                    <RankBadge rank={rank} />
                  </div>

                  {/* Avatar */}
                  <Avatar name={entry.player_name} isMe={isMe} playerId={entry.player_id} />

                  {/* Name + delta */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <span className={`font-bold text-sm truncate block ${isMe ? "text-fifa-blue" : "text-gray-900"}`}>
                        {entry.player_name}
                        {isMe && <span className="text-xs text-gray-400 font-normal ml-1">(tú)</span>}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">{entry.exact_scores} exactos</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{entry.correct_results} acertados</span>
                        <DeltaBadge delta={entry.delta} />
                      </div>
                    </div>
                  </div>

                  {/* Total points */}
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-black text-fifa-blue">{entry.total_points}</span>
                    <span className="text-xs text-gray-400 ml-1">pts</span>
                  </div>

                  {!leagueLocked && !isMe
                    ? <span className="text-gray-300 text-xs shrink-0">🔒</span>
                    : <span className="text-gray-300 text-xs shrink-0">{isExpanded ? "▲" : "▼"}</span>
                  }
                </button>

                {/* Predictions breakdown */}
                {isExpanded && (
                  <div className="bg-gray-50 px-4 py-4 border-t border-gray-100">
                    {loadingPlayer && !preds ? (
                      <p className="text-gray-400 text-sm">Cargando predicciones...</p>
                    ) : !preds?.length ? (
                      <p className="text-gray-400 text-sm">Este jugador no ha enviado predicciones.</p>
                    ) : (
                      <div className="flex flex-col gap-6">
                        {Object.keys(byGroup).sort().map((group) => (
                          <div key={group}>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                              Grupo {group}
                            </p>
                            <div className="flex flex-col gap-1">
                              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 text-xs text-gray-400 mb-1 px-1">
                                <span className="text-right">Local</span>
                                <span className="w-16 text-center">Predicción</span>
                                <span>Visitante</span>
                                <span className="w-16 text-center">Pts</span>
                              </div>
                              {byGroup[group].map((p) => (
                                <div
                                  key={p.match_id}
                                  className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 items-center py-1.5 border-t border-gray-100 px-1"
                                >
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="text-sm text-gray-700 text-right truncate">{p.home_team}</span>
                                    <FlagImg team={p.home_team} h={14} />
                                  </div>
                                  <div className="w-16 text-center">
                                    <span className="font-mono font-bold text-gray-900 text-sm">
                                      {p.pred_home} – {p.pred_away}
                                    </span>
                                    {p.status === "finished" && p.actual_home !== null && (
                                      <div className="text-xs text-gray-400 font-mono">
                                        ({p.actual_home} – {p.actual_away})
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <FlagImg team={p.away_team} h={14} />
                                    <span className="text-sm text-gray-700 truncate">{p.away_team}</span>
                                  </div>
                                  <div className="w-16 text-center">
                                    {pointsBadge(p.points, p.status)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex gap-4 text-xs text-gray-400 flex-wrap">
        <span><strong className="text-gray-500">Exactos</strong> = 6 pts</span>
        <span><strong className="text-gray-500">Acertados</strong> = 3–4 pts</span>
      </div>

      {/* Único 6 */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">⭐</span>
          <div>
            <h2 className="font-black text-gray-900">Único 6</h2>
            <p className="text-xs text-gray-400">Único jugador en adivinar el marcador exacto — Premio: Q150 / $20 por partido</p>
          </div>
        </div>

        {unicoSeis.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 text-gray-400 text-sm">
            Aún no hay ganadores de Único 6.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unicoSeis.map((w, i) => {
              const isMe = w.player_id === myPlayerId;
              return (
                <div key={i} className={`bg-white rounded-2xl px-4 py-3 border shadow-sm flex items-center gap-3 ${isMe ? "border-fifa-gold/60" : "border-gray-200"}`}>
                  <Avatar name={w.player_name} isMe={isMe} playerId={w.player_id} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${isMe ? "text-fifa-blue" : "text-gray-900"}`}>
                      {w.player_name}{isMe && <span className="text-xs text-gray-400 font-normal ml-1">(tú)</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {w.home_team} {w.home_score}–{w.away_score} {w.away_team} · Grupo {w.group}, J{w.matchday}
                    </p>
                  </div>
                  <span className="text-yellow-500 font-black text-sm shrink-0">6 pts ⭐</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
