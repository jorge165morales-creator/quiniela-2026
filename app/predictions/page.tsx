"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Match, Prediction } from "@/types";
import FlagImg from "@/components/FlagImg";

type PredictionMap = Record<string, { home: string; away: string }>;
type GroupedMatches = Record<string, Match[]>;

export default function PredictionsPage() {
  const router = useRouter();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<PredictionMap>({});
  const [existingPredictions, setExistingPredictions] = useState<Prediction[]>([]);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [algoError, setAlgoError] = useState(false);
  const [paid, setPaid] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasAvatar, setHasAvatar] = useState<boolean | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = localStorage.getItem("player_id");
    const pname = localStorage.getItem("player_name");
    const lid = localStorage.getItem("league_id");
    if (!pid || !lid) {
      router.push("/join");
      return;
    }
    setPlayerId(pid);
    setPlayerName(pname);
    setLeagueId(lid);
  }, [router]);

  useEffect(() => {
    if (!playerId || !leagueId) return;

    async function load() {
      setLoading(true);

      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .eq("round", "group")
        .order("kickoff_at");

      const { data: leagueData } = await supabase
        .from("leagues")
        .select("predictions_locked")
        .eq("id", leagueId!)
        .single();

      const { data: predData } = await supabase
        .from("predictions")
        .select("*")
        .eq("player_id", playerId!);

      const { data: playerData } = await supabase
        .from("players")
        .select("paid")
        .eq("id", playerId!)
        .single();

      if (matchData) setMatches(matchData as Match[]);
      if (leagueData) setLocked(leagueData.predictions_locked);
      if (playerData) {
        setPaid(playerData.paid ?? false);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/Avatar/${playerId}?t=${Date.now()}`);
      }
      if (predData) {
        setExistingPredictions(predData as Prediction[]);
        const map: PredictionMap = {};
        for (const p of predData as Prediction[]) {
          map[p.match_id] = {
            home: String(p.home_score),
            away: String(p.away_score),
          };
        }
        setPredictions(map);
      }
      setLoading(false);
    }

    load();
  }, [playerId, leagueId]);

  function handleScore(matchId: string, side: "home" | "away", value: string) {
    if (locked) return;
    if (value !== "" && !/^\d{0,2}$/.test(value)) return;
    setPredictions((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value },
    }));
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !playerId) return;
    setUploadingAvatar(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("player_id", playerId);
    const res = await fetch("/api/avatar", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) {
      setAvatarUrl(`${data.url}?t=${Date.now()}`);
      setHasAvatar(true);
    } else {
      setError(`Error al subir foto: ${data.error ?? "desconocido"}`);
    }
    setUploadingAvatar(false);
  }

  async function handleSave() {
    if (!playerId) return;
    setSaving(true);
    setError("");

    const rows = matches
      .filter(
        (m) =>
          predictions[m.id]?.home !== undefined &&
          predictions[m.id]?.home !== "" &&
          predictions[m.id]?.away !== undefined &&
          predictions[m.id]?.away !== ""
      )
      .map((m) => ({
        player_id: playerId,
        match_id: m.id,
        home_score: parseInt(predictions[m.id].home, 10),
        away_score: parseInt(predictions[m.id].away, 10),
      }));

    if (rows.length === 0) {
      setError("No hay predicciones para guardar.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId, predictions: rows }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error al guardar.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleSubmit() {
    if (!playerId) return;
    if (completedCount < matches.length) return;
    setError("");

    const rows = matches.map((m) => ({
      player_id: playerId,
      match_id: m.id,
      home_score: parseInt(predictions[m.id].home, 10),
      away_score: parseInt(predictions[m.id].away, 10),
    }));

    const scorelineCounts: Record<string, number> = {};
    let drawCount = 0;
    for (const r of rows) {
      const [lo, hi] = [Math.min(r.home_score, r.away_score), Math.max(r.home_score, r.away_score)];
      const key = `${lo}-${hi}`;
      scorelineCounts[key] = (scorelineCounts[key] || 0) + 1;
      if (r.home_score === r.away_score) drawCount++;
    }
    const maxAllowed = 28;
    const topEntry = Object.entries(scorelineCounts).sort((a, b) => b[1] - a[1])[0];
    const totalDistinct = Object.keys(scorelineCounts).length;
    const distinctWithAtLeastTwo = Object.values(scorelineCounts).filter((c) => c >= 2).length;

    const flagAlgo = (msg: string) => { setError(msg); setAlgoError(true); };

    if (topEntry && topEntry[1] > maxAllowed) {
      flagAlgo(`El marcador ${topEntry[0]} aparece ${topEntry[1]} veces (máx. ${maxAllowed}).`);
      return;
    }
    if (totalDistinct < 7) {
      flagAlgo(`Tu quiniela tiene ${totalDistinct} marcadores distintos (mínimo 7).`);
      return;
    }
    if (distinctWithAtLeastTwo < 5) {
      const qualifying = Object.entries(scorelineCounts)
        .filter(([, c]) => c >= 2)
        .map(([k, c]) => `${k} (×${c})`)
        .join(", ");
      flagAlgo(`Solo ${distinctWithAtLeastTwo} de tus marcadores aparecen 2 o más veces (mínimo 5): ${qualifying || "ninguno"}.`);
      return;
    }
    if (drawCount < 5) {
      flagAlgo(`Tienes ${drawCount} empates (mínimo 5).`);
      return;
    }
    setAlgoError(false);

    setSaving(true);

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId, predictions: rows, submit: true }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error al enviar.");
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  const grouped: GroupedMatches = {};
  for (const m of matches) {
    const key = m.group || "?";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  function calcGroupStandings(groupMatches: Match[]) {
    const teams: Record<string, { pts: number; gf: number; ga: number; played: number }> = {};
    for (const m of groupMatches) {
      if (!teams[m.home_team]) teams[m.home_team] = { pts: 0, gf: 0, ga: 0, played: 0 };
      if (!teams[m.away_team]) teams[m.away_team] = { pts: 0, gf: 0, ga: 0, played: 0 };
    }
    for (const m of groupMatches) {
      const pred = predictions[m.id];
      if (!pred || pred.home === "" || pred.away === "") continue;
      const h = parseInt(pred.home, 10);
      const a = parseInt(pred.away, 10);
      if (isNaN(h) || isNaN(a)) continue;
      teams[m.home_team].gf += h;
      teams[m.home_team].ga += a;
      teams[m.home_team].played += 1;
      teams[m.away_team].gf += a;
      teams[m.away_team].ga += h;
      teams[m.away_team].played += 1;
      if (h > a) { teams[m.home_team].pts += 3; }
      else if (h === a) { teams[m.home_team].pts += 1; teams[m.away_team].pts += 1; }
      else { teams[m.away_team].pts += 3; }
    }
    return Object.entries(teams)
      .map(([name, s]) => ({ name, ...s, gd: s.gf - s.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  }

  const completedCount = matches.filter(
    (m) =>
      predictions[m.id]?.home !== undefined &&
      predictions[m.id]?.home !== "" &&
      predictions[m.id]?.away !== undefined &&
      predictions[m.id]?.away !== ""
  ).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-gray-400">Cargando partidos...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Mis predicciones</h1>
          <p className="text-gray-500 text-sm mt-1">
            Hola, <span className="text-gray-900 font-medium">{playerName}</span> —{" "}
            {completedCount}/{matches.length} partidos completados
          </p>
        </div>

        {/* Avatar upload */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 hover:border-fifa-blue transition-colors group shrink-0"
            title="Cambiar foto"
          >
            {avatarUrl && hasAvatar !== false ? (
              <img
                src={avatarUrl}
                alt="Tu foto"
                className="w-full h-full object-cover"
                onLoad={() => setHasAvatar(true)}
                onError={() => { setAvatarUrl(null); setHasAvatar(false); }}
              />
            ) : (
              <span className="w-full h-full bg-gray-100 flex items-center justify-center text-2xl font-black text-gray-400">
                {playerName?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold">
              {uploadingAvatar ? "..." : "📷"}
            </span>
          </button>
          <span className="text-xs text-gray-400">
            {avatarUrl ? "Cambiar foto" : "Añadir foto"}
          </span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      {locked && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 text-red-700 font-medium">
          Las predicciones están cerradas. El torneo ya comenzó.
        </div>
      )}

      {hasAvatar === false && !locked && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6">
          <p className="font-bold text-blue-800 mb-1">Falta tu foto</p>
          <p className="text-blue-700 text-sm">
            Debes subir una foto de perfil antes de enviar tu quiniela. Toca el círculo arriba a la derecha para añadirla.
          </p>
        </div>
      )}

      {paid === false && !locked && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 mb-6">
          <p className="font-bold text-amber-800 mb-1">Pago pendiente</p>
          <p className="text-amber-700 text-sm">
            Debes pagar <span className="font-bold">Q150 / $20 USD</span> para poder enviar tu quiniela.
            Puedes guardar tu progreso, pero no podrás enviarlo hasta que el organizador confirme tu pago.
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>{completedCount} de {matches.length} completados</span>
          <span>{Math.round((completedCount / matches.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-fifa-blue h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / matches.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Matches grouped by group */}
      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupMatches]) => (
          <div key={group} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 bg-fifa-blue rounded-lg flex items-center justify-center text-xs font-black text-white">
                {group}
              </span>
              <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Grupo {group}</span>
            </div>

            <div className="flex flex-col gap-2">
              {groupMatches.map((match) => {
                const pred = predictions[match.id];
                const hasHome = pred?.home !== undefined && pred?.home !== "";
                const hasAway = pred?.away !== undefined && pred?.away !== "";
                const complete = hasHome && hasAway;

                return (
                  <div
                    key={match.id}
                    className={`bg-white rounded-2xl px-4 py-3 border shadow-sm transition-all ${
                      complete
                        ? "border-[#001E62]/25"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Home team */}
                      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                        <span className="font-semibold text-sm text-gray-800 truncate text-right">{match.home_team}</span>
                        <FlagImg team={match.home_team} h={18} />
                      </div>

                      {/* Score inputs */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={pred?.home ?? ""}
                          onChange={(e) => handleScore(match.id, "home", e.target.value)}
                          disabled={locked}
                          placeholder="—"
                          className="w-11 h-11 bg-gray-50 border border-gray-300 rounded-xl text-center font-black text-lg focus:outline-none focus:border-fifa-blue focus:bg-white disabled:opacity-40 transition-colors text-gray-900"
                        />
                        <span className="text-gray-300 font-bold text-sm">:</span>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={pred?.away ?? ""}
                          onChange={(e) => handleScore(match.id, "away", e.target.value)}
                          disabled={locked}
                          placeholder="—"
                          className="w-11 h-11 bg-gray-50 border border-gray-300 rounded-xl text-center font-black text-lg focus:outline-none focus:border-fifa-blue focus:bg-white disabled:opacity-40 transition-colors text-gray-900"
                        />
                      </div>

                      {/* Away team */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <FlagImg team={match.away_team} h={18} />
                        <span className="font-semibold text-sm text-gray-800 truncate">{match.away_team}</span>
                      </div>
                    </div>

                    {/* Match date */}
                    <p className="text-center text-xs text-gray-400 mt-2">
                      {new Date(match.kickoff_at).toLocaleDateString("es-MX", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Projected group standings */}
            {(() => {
              const standings = calcGroupStandings(groupMatches);
              const anyPlayed = standings.some((s) => s.played > 0);
              if (!anyPlayed) return null;
              return (
                <div className="mt-3 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Clasificación proyectada</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        <th className="text-left px-4 py-1.5 font-medium w-6">#</th>
                        <th className="text-left px-2 py-1.5 font-medium">Equipo</th>
                        <th className="text-center px-2 py-1.5 font-medium w-8">PJ</th>
                        <th className="text-center px-2 py-1.5 font-medium w-8">GF</th>
                        <th className="text-center px-2 py-1.5 font-medium w-8">GC</th>
                        <th className="text-center px-2 py-1.5 font-medium w-8">DG</th>
                        <th className="text-center px-2 py-1.5 font-medium w-8 text-fifa-blue">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => (
                        <tr key={s.name} className={`border-t border-gray-50 ${i < 2 ? "bg-blue-50/40" : ""}`}>
                          <td className="px-4 py-2 text-xs text-gray-400 font-medium">{i + 1}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <FlagImg team={s.name} h={13} />
                              <span className="text-gray-800 font-medium text-xs truncate">{s.name}</span>
                            </div>
                          </td>
                          <td className="text-center px-2 py-2 text-xs text-gray-500">{s.played}</td>
                          <td className="text-center px-2 py-2 text-xs text-gray-500">{s.gf}</td>
                          <td className="text-center px-2 py-2 text-xs text-gray-500">{s.ga}</td>
                          <td className="text-center px-2 py-2 text-xs text-gray-500">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                          <td className="text-center px-2 py-2 text-xs font-black text-fifa-blue">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">
                    Fondo azul = clasifican a octavos (proyectado)
                  </p>
                </div>
              );
            })()}
          </div>
        ))}

      {/* Bottom buttons */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mt-8 text-red-700">
          <p className="font-semibold mb-1">{error}</p>
          {algoError && (
            <div className="mt-3 pt-3 border-t border-red-200 text-sm text-red-600 space-y-1">
              <p className="font-bold text-red-700 mb-2">No se permiten quinielas algorítmicas. Tu quiniela debe cumplir:</p>
              <p>• Al menos <strong>7 marcadores distintos</strong>, de los cuales al menos <strong>5 deben aparecer 2 o más veces</strong>.</p>
              <p>• Ningún marcador puede usarse en más de <strong>28 partidos</strong> de 72.</p>
              <p>• Al menos <strong>5 empates</strong> predichos.</p>
            </div>
          )}
        </div>
      )}
      {!locked && (
        <div className="sticky bottom-20 md:bottom-4 flex justify-center gap-3 mt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-3.5 bg-white text-gray-700 font-bold rounded-2xl text-sm shadow-lg hover:bg-gray-50 transition-colors disabled:opacity-50 border border-gray-200"
          >
            {saving ? "Guardando..." : `Guardar (${completedCount}/${matches.length})`}
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving || completedCount < matches.length || paid === false || hasAvatar === false}
            title={hasAvatar === false ? "Debes añadir una foto primero" : paid === false ? "Debes pagar antes de enviar" : undefined}
            className="px-8 py-3.5 bg-fifa-gold text-gray-900 font-black rounded-2xl text-sm shadow-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? "✓ Enviado" : hasAvatar === false ? "Falta tu foto" : paid === false ? "Pago pendiente" : "Enviar quiniela"}
          </button>
        </div>
      )}
    </div>
  );
}
