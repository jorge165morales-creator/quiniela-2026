"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Match } from "@/types";

type PredMap = Record<string, { home: number; away: number }>;
type GroupedMatches = Record<string, Match[]>;

function PrintContent() {
  const searchParams = useSearchParams();
  const targetPlayerId = searchParams.get("player_id");

  const [playerName, setPlayerName] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [preds, setPreds] = useState<PredMap>({});
  const [loading, setLoading] = useState(true);
  const [isOtherPlayer, setIsOtherPlayer] = useState(false);

  useEffect(() => {
    const myPlayerId = localStorage.getItem("player_id");
    const myPlayerName = localStorage.getItem("player_name");
    const pid = targetPlayerId ?? myPlayerId;

    if (!pid) { setLoading(false); return; }

    const isOther = !!targetPlayerId && targetPlayerId !== myPlayerId;
    setIsOtherPlayer(isOther);

    async function load() {
      const [{ data: matchData }, { data: predData }, { data: playerData }] = await Promise.all([
        supabase.from("matches").select("*").eq("round", "group").order("kickoff_at"),
        supabase.from("predictions").select("match_id, home_score, away_score").eq("player_id", pid!),
        isOther
          ? supabase.from("players").select("name").eq("id", pid!).single()
          : Promise.resolve({ data: null }),
      ]);

      if (matchData) setMatches(matchData as Match[]);
      if (predData) {
        const map: PredMap = {};
        for (const p of predData) map[p.match_id] = { home: p.home_score, away: p.away_score };
        setPreds(map);
      }
      setPlayerName(isOther ? (playerData as any)?.name ?? "Jugador" : myPlayerName);
      setLoading(false);
    }

    load();
  }, [targetPlayerId]);

  const grouped: GroupedMatches = {};
  for (const m of matches) {
    const key = m.group || "?";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }
  const groupEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">Cargando predicciones...</div>;
  }

  if (!playerName) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No se encontraron predicciones.</p>
        <a href="/leaderboard" className="text-fifa-blue font-semibold mt-2 inline-block">← Tabla</a>
      </div>
    );
  }

  const predCount = Object.keys(preds).length;

  return (
    <>
      <style>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          body { background: white; }
          .print-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Quiniela Mundial 2026</h1>
            <p className="text-gray-500 text-sm mt-0.5">Fase de Grupos · {playerName}</p>
          </div>
          <div className="text-right text-xs text-gray-400 mt-1 shrink-0 ml-4">
            <p>{new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</p>
            <p className="mt-0.5 font-semibold">{predCount} / {matches.length} predicciones</p>
          </div>
        </div>

        {/* Groups grid */}
        <div className="print-grid grid grid-cols-1 sm:grid-cols-2 gap-6">
          {groupEntries.map(([group, groupMatches]) => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-fifa-blue rounded flex items-center justify-center text-[10px] font-black text-white shrink-0">
                  {group}
                </span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grupo {group}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {groupMatches.map((m, i) => {
                  const pred = preds[m.id];
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center px-3 py-2 text-xs ${i > 0 ? "border-t border-gray-100" : ""}`}
                    >
                      <span className="flex-1 text-right text-gray-700 font-medium truncate pr-2">{m.home_team}</span>
                      <span className={`w-16 text-center font-black shrink-0 tabular-nums ${pred ? "text-gray-900" : "text-gray-300"}`}>
                        {pred ? `${pred.home} – ${pred.away}` : "– – –"}
                      </span>
                      <span className="flex-1 text-left text-gray-700 font-medium truncate pl-2">{m.away_team}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
          Quiniela Mundial 2026 — amigos2026.vercel.app
        </p>
      </div>

      {/* Action buttons — hidden when printing */}
      <div className="no-print fixed bottom-6 right-6 flex gap-3 z-50">
        <a
          href={isOtherPlayer ? "/leaderboard" : "/predictions"}
          className="px-5 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-lg hover:bg-gray-50 text-sm"
        >
          {isOtherPlayer ? "← Tabla" : "← Mis predicciones"}
        </a>
        <button
          onClick={() => window.print()}
          className="px-5 py-3 bg-fifa-blue text-white font-bold rounded-xl shadow-lg hover:opacity-90 text-sm"
        >
          Imprimir / PDF
        </button>
      </div>
    </>
  );
}

export default function PrintPredictions() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Cargando predicciones...</div>}>
      <PrintContent />
    </Suspense>
  );
}
