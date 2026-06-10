"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FLAG_ISO } from "@/lib/flags";
import type { Match } from "@/types";

type PredMap = Record<string, { home: number; away: number }>;

function flagImg(team: string) {
  const iso = FLAG_ISO[team];
  if (!iso) return null;
  return (
    <img
      src={`https://flagcdn.com/w20/${iso}.png`}
      width={16}
      height={11}
      className="inline-block object-cover border border-gray-100 align-middle"
      alt={team}
    />
  );
}

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

  useEffect(() => {
    if (!loading && playerName) {
      setTimeout(() => window.print(), 400);
    }
  }, [loading, playerName]);

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
  const half = Math.ceil(matches.length / 2);
  const col1 = matches.slice(0, half);
  const col2 = matches.slice(half);

  function MatchRow({ m }: { m: Match }) {
    const pred = preds[m.id];
    const hasPred = pred != null;
    return (
      <div className="flex items-center px-2 py-1 border-b border-gray-100 last:border-0 text-[10px]">
        <span className="flex-1 flex items-center justify-end gap-1 text-gray-700 font-medium truncate">
          <span className="truncate">{m.home_team}</span>
          {flagImg(m.home_team)}
        </span>
        <span className={`w-14 text-center font-black shrink-0 tabular-nums mx-1 ${hasPred ? "text-fifa-blue" : "text-gray-300"}`}>
          {hasPred ? `${pred.home}–${pred.away}` : "–"}
        </span>
        <span className="flex-1 flex items-center gap-1 text-gray-700 font-medium truncate">
          {flagImg(m.away_team)}
          <span className="truncate">{m.away_team}</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @page { margin: 8mm; size: A4 portrait; }
        @media print {
          header, nav, .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-3 py-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 pb-2 border-b border-gray-200">
          <div>
            <h1 className="text-lg font-black text-gray-900">Quiniela Mundial 2026</h1>
            <p className="text-gray-500 text-xs mt-0.5">Fase de Grupos · {playerName}</p>
          </div>
          <div className="text-right text-xs text-gray-400 mt-0.5 shrink-0 ml-4">
            <p>{new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</p>
            <p className="mt-0.5 font-semibold">{predCount} / {matches.length} predicciones</p>
          </div>
        </div>

        {/* Two-column flat list */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {col1.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {col2.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
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
