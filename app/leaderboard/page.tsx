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

type EntryWithDelta = LeaderboardEntry & { delta: number | null; not_submitted?: boolean };

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

const ZONES = [
  { key: "green",  label: "El Congreso",     headerCls: "bg-green-500",  borderCls: "border-green-400",  textCls: "text-green-700",  countCls: "text-green-100" },
  { key: "yellow", label: "La Cañada",       headerCls: "bg-yellow-400", borderCls: "border-yellow-400", textCls: "text-yellow-700", countCls: "text-yellow-900" },
  { key: "orange", label: "Ciudad Satélite", headerCls: "bg-orange-500", borderCls: "border-orange-400", textCls: "text-orange-700", countCls: "text-orange-100" },
  { key: "red",    label: "Pasandola Mal",   headerCls: "bg-red-500",    borderCls: "border-red-400",    textCls: "text-red-700",    countCls: "text-red-100" },
  { key: "black",  label: "🔥 La Favela ⚡", headerCls: "bg-gray-900",   borderCls: "border-gray-700",   textCls: "text-gray-400",   countCls: "text-gray-500" },
] as const;

type ZoneKey = typeof ZONES[number]["key"];

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
  const [activeZone, setActiveZone] = useState<ZoneKey>("green");

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
      const [{ data: leaderboardData }, submittedRes] = await Promise.all([
        supabase
          .from("leaderboard")
          .select("*")
          .eq("league_id", leagueId!)
          .order("total_points", { ascending: false })
          .order("exact_scores", { ascending: false }),
        fetch(`/api/leaderboard?league_id=${leagueId}`).then((r) => r.json()),
      ]);

      const submittedSet = new Set<string>((submittedRes?.submitted ?? []) as string[]);

      const leaderboardMap: Record<string, LeaderboardEntry> = {};
      for (const e of ((leaderboardData as LeaderboardEntry[]) ?? [])) {
        leaderboardMap[e.player_id] = e;
      }

      const rankedEntries = Array.from(submittedSet)
        .map((id) => leaderboardMap[id] ?? null)
        .filter((e): e is LeaderboardEntry => e !== null)
        .sort((a, b) => b.total_points - a.total_points || b.exact_scores - a.exact_scores);

      const newRanks: Record<string, number> = {};
      rankedEntries.forEach((e, i) => { newRanks[e.player_id] = i + 1; });

      const stored = localStorage.getItem("leaderboard_prev_ranks");
      const savedRanks: Record<string, number> = stored ? JSON.parse(stored) : prevRanks.current;

      const withDelta: EntryWithDelta[] = rankedEntries.map((e, i) => {
        const oldRank = savedRanks[e.player_id];
        const newRank = i + 1;
        const delta = oldRank != null ? oldRank - newRank : null;
        return { ...e, delta };
      });

      localStorage.setItem("leaderboard_prev_ranks", JSON.stringify(newRanks));
      prevRanks.current = newRanks;
      setEntries(withDelta);
      setLastUpdated(new Date());

      const playerIds = rankedEntries.map((e) => e.player_id);
      if (playerIds.length > 0) {
        const { data: sixPreds } = await supabase
          .from("predictions")
          .select("player_id, match_id, matches(home_team, away_team, group, matchday, home_score, away_score, status)")
          .in("player_id", playerIds)
          .eq("points", 6);

        if (sixPreds) {
          const byMatch: Record<string, any[]> = {};
          for (const p of sixPreds as any[]) {
            if (p.matches?.status !== "finished") continue;
            if (!byMatch[p.match_id]) byMatch[p.match_id] = [];
            byMatch[p.match_id].push(p);
          }
          const winners: UnicoSeis[] = [];
          for (const [, preds] of Object.entries(byMatch)) {
            if (preds.length === 1) {
              const p = preds[0];
              const entry = rankedEntries.find((e) => e.player_id === p.player_id);
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
      setLoading(false);
    }

    load();
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

  function SmallAvatar({ name, isMe, playerId }: { name: string; isMe: boolean; playerId: string }) {
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const imgUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/Avatar/${playerId}`;
    const [imgFailed, setImgFailed] = useState(false);
    if (!imgFailed) {
      return (
        <span className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border-2 ${isMe ? "border-fifa-gold" : "border-transparent"}`}>
          <img src={imgUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        </span>
      );
    }
    return (
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isMe ? "bg-fifa-gold text-gray-900" : "bg-gray-200 text-gray-600"}`}>
        {initials}
      </span>
    );
  }

  function LargeAvatar({ name, isMe, playerId }: { name: string; isMe: boolean; playerId: string }) {
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const imgUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/Avatar/${playerId}`;
    const [imgFailed, setImgFailed] = useState(false);
    if (!imgFailed) {
      return (
        <span className={`w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 ${isMe ? "border-fifa-gold" : "border-gray-200"}`}>
          <img src={imgUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        </span>
      );
    }
    return (
      <span className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${isMe ? "bg-fifa-gold text-gray-900" : "bg-gray-200 text-gray-600"}`}>
        {initials}
      </span>
    );
  }

  function DeltaBadge({ delta }: { delta: number | null }) {
    if (delta === null || delta === 0) return null;
    const up = delta > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded-full ${up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
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
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>{pts} pts</span>;
  }

  // Quintile zone assignment (5 equal groups)
  const submittedEntries = entries.filter((e) => !e.not_submitted);
  const total = submittedEntries.length;
  const q1 = Math.ceil(total / 5);
  const q2 = Math.ceil((2 * total) / 5);
  const q3 = Math.ceil((3 * total) / 5);
  const q4 = Math.ceil((4 * total) / 5);

  function getZone(rank: number): ZoneKey {
    if (rank <= q1) return "green";
    if (rank <= q2) return "yellow";
    if (rank <= q3) return "orange";
    if (rank <= q4) return "red";
    return "black";
  }

  const zoneEntries: Record<ZoneKey, EntryWithDelta[]> = {
    green: [], yellow: [], orange: [], red: [], black: [],
  };
  submittedEntries.forEach((e, i) => {
    zoneEntries[getZone(i + 1)].push(e);
  });

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
        <a href="/join" className="text-fifa-blue hover:underline font-medium">Unirse a una liga</a>
      </div>
    );
  }

  const expandedEntry = expandedPlayer ? entries.find((e) => e.player_id === expandedPlayer) : null;
  const expandedPreds = expandedPlayer ? playerPredictions[expandedPlayer] : null;
  const byGroup: Record<string, PlayerPrediction[]> = {};
  if (expandedPreds) {
    for (const p of expandedPreds) {
      if (!byGroup[p.group]) byGroup[p.group] = [];
      byGroup[p.group].push(p);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Tabla</h1>
          {leagueName && <p className="text-gray-500 text-sm mt-0.5">{leagueName}</p>}
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-400">{lastUpdated.toLocaleTimeString("es-MX")}</p>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-400 text-center mt-16">
          Aún no hay resultados. La tabla se actualiza conforme terminan los partidos.
        </p>
      ) : (
        <>
          {/* Mobile: zone tabs */}
          <div className="md:hidden mb-3 flex gap-1 overflow-x-auto pb-1">
            {ZONES.map((zone) => (
              <button
                key={zone.key}
                onClick={() => setActiveZone(zone.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  activeZone === zone.key
                    ? `${zone.headerCls} text-white`
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {zone.label}
              </button>
            ))}
          </div>

          {/* Mobile: single-column list for active zone */}
          <div className="md:hidden">
            {(() => {
              const zone = ZONES.find((z) => z.key === activeZone)!;
              const zEntries = zoneEntries[zone.key];
              const startRank = submittedEntries.findIndex((e) => e.player_id === zEntries[0]?.player_id) + 1;
              return (
                <div className={`bg-white border ${zone.borderCls} rounded-xl overflow-hidden`}>
                  <div className={`${zone.headerCls} text-white flex items-center justify-between px-4 py-2`}>
                    <p className="font-black text-sm">{zone.label}</p>
                    <p className={`text-xs ${zone.countCls}`}>{zEntries.length} jugadores</p>
                  </div>
                  {zEntries.length === 0 ? (
                    <p className="text-sm text-gray-300 text-center py-6">—</p>
                  ) : (
                    zEntries.map((entry, idx) => {
                      const rank = startRank + idx;
                      const isMe = entry.player_id === myPlayerId;
                      const isExpanded = expandedPlayer === entry.player_id;
                      const isLast = rank === total;
                      return (
                        <div key={entry.player_id}>
                          {rank === 1 && (
                            <div className="text-center py-1.5 bg-yellow-400 text-gray-900 text-[10px] font-bold uppercase tracking-widest border-b border-yellow-300">
                              Donald J. Trump
                            </div>
                          )}
                          {isLast && total > 1 && (
                            <div className="text-center py-1.5 bg-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest border-b border-gray-700">
                              Dono do moro
                            </div>
                          )}
                          <div
                            onClick={() => togglePlayer(entry.player_id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && togglePlayer(entry.player_id)}
                            className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                              isLast ? "bg-gray-900 hover:bg-gray-800" :
                              isExpanded ? "bg-blue-50" : isMe ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"
                            }`}
                          >
                            <span className="text-xs text-gray-400 w-5 text-center shrink-0 font-bold">{rank === 1 ? "👑" : rank}</span>
                            <SmallAvatar name={entry.player_name} isMe={isMe} playerId={entry.player_id} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate leading-tight ${isLast ? "text-white" : isMe ? "text-fifa-blue" : "text-gray-800"}`}>
                                {entry.player_name}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-black ${isLast ? "text-gray-400" : "text-fifa-blue"}`}>{entry.total_points}p</span>
                                <DeltaBadge delta={entry.delta} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>

          {/* Desktop: 5-column zone grid */}
          <div className="hidden md:block">
            <div className="grid grid-cols-5 gap-2">
              {ZONES.map((zone) => {
                const zEntries = zoneEntries[zone.key];
                const startRank = submittedEntries.findIndex((e) => e.player_id === zEntries[0]?.player_id) + 1;
                return (
                  <div key={zone.key} className="flex flex-col">
                    <div className={`${zone.headerCls} text-white text-center py-2 px-1 rounded-t-xl`}>
                      <p className="font-black text-[11px] uppercase tracking-wide leading-tight">{zone.label}</p>
                      <p className={`text-[10px] ${zone.countCls} mt-0.5`}>{zEntries.length} jugadores</p>
                    </div>
                    <div className={`bg-white border-x border-b ${zone.borderCls} rounded-b-xl overflow-hidden flex-1`}>
                      {zEntries.length === 0 ? (
                        <p className="text-xs text-gray-300 text-center py-4">—</p>
                      ) : (
                        zEntries.map((entry, idx) => {
                          const rank = startRank + idx;
                          const isMe = entry.player_id === myPlayerId;
                          const isExpanded = expandedPlayer === entry.player_id;
                          const isLast = rank === total;
                          return (
                            <div key={entry.player_id}>
                              {rank === 1 && (
                                <div className="text-center py-1 bg-yellow-400 text-gray-900 text-[9px] font-bold uppercase tracking-widest border-b border-yellow-300">
                                  Donald J. Trump
                                </div>
                              )}
                              {isLast && total > 1 && (
                                <div className="text-center py-1 bg-gray-800 text-gray-300 text-[9px] font-bold uppercase tracking-widest border-b border-gray-700">
                                  Dono do moro
                                </div>
                              )}
                              <div
                                onClick={() => togglePlayer(entry.player_id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === "Enter" && togglePlayer(entry.player_id)}
                                className={`flex items-center gap-1.5 px-2 py-2 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                                  isLast ? "bg-gray-900 hover:bg-gray-800" :
                                  isExpanded ? "bg-blue-50" : isMe ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"
                                }`}
                              >
                                <span className="text-[10px] text-gray-400 w-4 text-center shrink-0 font-bold">{rank === 1 ? "👑" : rank}</span>
                                <SmallAvatar name={entry.player_name} isMe={isMe} playerId={entry.player_id} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[11px] font-bold truncate leading-tight ${isLast ? "text-white" : isMe ? "text-fifa-blue" : "text-gray-800"}`}>
                                    {entry.player_name}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[10px] font-black ${isLast ? "text-gray-400" : "text-fifa-blue"}`}>{entry.total_points}p</span>
                                    <DeltaBadge delta={entry.delta} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expanded player predictions — full width below columns */}
          {expandedEntry && (
            <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <LargeAvatar name={expandedEntry.player_name} isMe={expandedEntry.player_id === myPlayerId} playerId={expandedEntry.player_id} />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900">{expandedEntry.player_name}</p>
                  <p className="text-xs text-gray-400">{expandedEntry.exact_scores} exactos · {expandedEntry.total_points} pts totales</p>
                </div>
                {leagueLocked && (
                  <a
                    href={`/predictions/print?player_id=${expandedEntry.player_id}`}
                    target="_blank"
                    title="Ver PDF"
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >
                    📄
                  </a>
                )}
                <button onClick={() => setExpandedPlayer(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-1">✕</button>
              </div>
              <div className="px-4 py-4">
                {loadingPlayer && !expandedPreds ? (
                  <p className="text-gray-400 text-sm">Cargando predicciones...</p>
                ) : !expandedPreds?.length ? (
                  <p className="text-gray-400 text-sm">Sin predicciones.</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {Object.keys(byGroup).sort().map((group) => (
                      <div key={group}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Grupo {group}</p>
                        <div className="flex flex-col gap-1">
                          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 text-xs text-gray-400 mb-1 px-1">
                            <span className="text-right">Local</span>
                            <span className="w-16 text-center">Predicción</span>
                            <span>Visitante</span>
                            <span className="w-16 text-center">Pts</span>
                          </div>
                          {byGroup[group].map((p) => (
                            <div key={p.match_id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 items-center py-1.5 border-t border-gray-100 px-1">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-sm text-gray-700 text-right truncate">{p.home_team}</span>
                                <FlagImg team={p.home_team} h={14} />
                              </div>
                              <div className="w-16 text-center">
                                <span className="font-mono font-bold text-gray-900 text-sm">{p.pred_home} – {p.pred_away}</span>
                                {p.status === "finished" && p.actual_home !== null && (
                                  <div className="text-xs text-gray-400 font-mono">({p.actual_home} – {p.actual_away})</div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <FlagImg team={p.away_team} h={14} />
                                <span className="text-sm text-gray-700 truncate">{p.away_team}</span>
                              </div>
                              <div className="w-16 text-center">{pointsBadge(p.points, p.status)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-4 text-xs text-gray-400 flex-wrap">
            <span><strong className="text-gray-500">Exactos</strong> = 6 pts</span>
            <span><strong className="text-gray-500">Acertados</strong> = 3–4 pts</span>
          </div>
        </>
      )}

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
                  <LargeAvatar name={w.player_name} isMe={isMe} playerId={w.player_id} />
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
