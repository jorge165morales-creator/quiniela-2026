"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Match, League } from "@/types";

type MatchWithEdit = Match & {
  editHome: string;
  editAway: string;
  saving: boolean;
  saved: boolean;
};

type PredictionRow = {
  player_name: string;
  home_score: number;
  away_score: number;
  points: number | null;
};

type UserRow = {
  id: string;
  name: string;
  username: string;
  failed_attempts: number;
  locked_until: string | null;
};

type PlayerRow = {
  id: string;
  name: string;
  paid: boolean;
  league_id: string;
  leagues: { name: string } | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchWithEdit[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "live" | "finished">("upcoming");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [matchPredictions, setMatchPredictions] = useState<Record<string, PredictionRow[]>>({});
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [togglingPaid, setTogglingPaid] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("admin_secret");
    if (!s) {
      router.push("/admin");
      return;
    }
    setSecret(s);
  }, [router]);

  useEffect(() => {
    if (!secret) return;
    loadData();
  }, [secret]);

  async function loadData() {
    setLoading(true);

    const [{ data: matchData }, { data: leagueData }] = await Promise.all([
      supabase.from("matches").select("*").eq("round", "group").order("kickoff_at"),
      supabase.from("leagues").select("*").order("created_at"),
    ]);

    const s = localStorage.getItem("admin_secret");
    const usersRes = await fetch(`/api/admin/user?secret=${encodeURIComponent(s ?? "")}`);
    if (usersRes.ok) setUsers(await usersRes.json());

    const { data: playerData } = await supabase
      .from("players")
      .select("id, name, paid, league_id, leagues(name)")
      .order("name");
    if (playerData) setPlayers(playerData as unknown as PlayerRow[]);

    if (matchData) {
      setMatches(
        (matchData as Match[]).map((m) => ({
          ...m,
          editHome: m.home_score !== null ? String(m.home_score) : "",
          editAway: m.away_score !== null ? String(m.away_score) : "",
          saving: false,
          saved: false,
        }))
      );
    }
    if (leagueData) setLeagues(leagueData as League[]);
    setLoading(false);
  }

  function updateMatchEdit(id: string, side: "editHome" | "editAway", value: string) {
    if (!/^\d{0,2}$/.test(value)) return;
    setMatches((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [side]: value } : m))
    );
  }

  async function saveResult(match: MatchWithEdit) {
    if (match.editHome === "" || match.editAway === "") return;

    setMatches((prev) =>
      prev.map((m) => (m.id === match.id ? { ...m, saving: true } : m))
    );

    const res = await fetch("/api/admin/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        match_id: match.id,
        home_score: parseInt(match.editHome),
        away_score: parseInt(match.editAway),
      }),
    });

    const body = await res.json();

    if (res.ok) {
      setSaveError(null);
      setMatches((prev) =>
        prev.map((m) =>
          m.id === match.id
            ? {
                ...m,
                home_score: parseInt(match.editHome),
                away_score: parseInt(match.editAway),
                status: "finished",
                saving: false,
                saved: true,
              }
            : m
        )
      );
      // Refresh predictions panel if open
      if (expandedMatch === match.id) {
        await loadPredictions(match.id);
      }
      setTimeout(() => {
        setMatches((prev) =>
          prev.map((m) => (m.id === match.id ? { ...m, saved: false } : m))
        );
      }, 3000);
    } else {
      setSaveError(`Error ${res.status}: ${body?.error ?? "Unknown error"}`);
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, saving: false } : m))
      );
    }
  }

  async function loadPredictions(matchId: string) {
    setLoadingPredictions(true);
    const { data } = await supabase
      .from("predictions")
      .select("home_score, away_score, points, players(name)")
      .eq("match_id", matchId)
      .order("points", { ascending: false, nullsFirst: false });

    if (data) {
      setMatchPredictions((prev) => ({
        ...prev,
        [matchId]: data.map((p: any) => ({
          player_name: p.players?.name ?? "—",
          home_score: p.home_score,
          away_score: p.away_score,
          points: p.points,
        })),
      }));
    }
    setLoadingPredictions(false);
  }

  async function toggleExpand(matchId: string) {
    if (expandedMatch === matchId) {
      setExpandedMatch(null);
      return;
    }
    setExpandedMatch(matchId);
    if (!matchPredictions[matchId]) {
      await loadPredictions(matchId);
    }
  }

  async function handleResetPassword() {
    if (!resetUserId || resetPassword.length < 6) return;
    setResetting(true);
    setResetMsg(null);

    const res = await fetch("/api/admin/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, user_id: resetUserId, new_password: resetPassword }),
    });

    if (res.ok) {
      setResetMsg({ type: "ok", text: "Contraseña actualizada." });
      setResetPassword("");
      setResetUserId(null);
    } else {
      const body = await res.json();
      setResetMsg({ type: "error", text: body.error ?? "Error al actualizar." });
    }
    setResetting(false);
  }

  async function togglePaid(player: PlayerRow) {
    setTogglingPaid(player.id);
    const res = await fetch("/api/admin/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, player_id: player.id, paid: !player.paid }),
    });
    if (res.ok) {
      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, paid: !player.paid } : p))
      );
    }
    setTogglingPaid(null);
  }

  async function toggleLock(league: League) {
    const res = await fetch("/api/admin/league", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        league_id: league.id,
        predictions_locked: !league.predictions_locked,
      }),
    });

    if (res.ok) {
      setLeagues((prev) =>
        prev.map((l) =>
          l.id === league.id
            ? { ...l, predictions_locked: !l.predictions_locked }
            : l
        )
      );
    }
  }

  async function syncScores() {
    setSyncing(true);
    setSyncMsg(null);

    const res = await fetch(
      `/api/admin/live-score?secret=${encodeURIComponent(secret ?? "")}`
    );
    const body = await res.json();

    if (!res.ok) {
      setSyncMsg({ type: "error", text: body.error ?? "Error al sincronizar." });
      setSyncing(false);
      return;
    }

    const { scores } = body as {
      scores: { homeTeam: string; awayTeam: string; home_score: number; away_score: number }[];
    };

    let matched = 0;
    setMatches((prev) =>
      prev.map((m) => {
        const found = scores.find(
          (s) =>
            s.homeTeam.toLowerCase() === m.home_team.toLowerCase() &&
            s.awayTeam.toLowerCase() === m.away_team.toLowerCase()
        );
        if (!found) return m;
        matched++;
        return {
          ...m,
          editHome: String(found.home_score),
          editAway: String(found.away_score),
        };
      })
    );

    setSyncMsg({
      type: "ok",
      text: matched > 0
        ? `${matched} partido${matched !== 1 ? "s" : ""} sincronizado${matched !== 1 ? "s" : ""}. Revisa y guarda.`
        : "No se encontraron partidos terminados todavía.",
    });
    setSyncing(false);
  }

  const filtered = matches.filter((m) =>
    filter === "all" ? true : m.status === filter
  );

  const statusColor = {
    upcoming: "text-gray-400",
    live: "text-green-400",
    finished: "text-blue-400",
  };

  function pointsColor(pts: number | null) {
    if (pts === null) return "text-gray-500";
    if (pts === 6) return "text-fifa-gold font-bold";
    if (pts >= 3) return "text-green-400";
    if (pts === 1) return "text-yellow-600";
    return "text-red-500";
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black">Panel Admin</h1>
        <button
          onClick={() => {
            localStorage.removeItem("admin_secret");
            router.push("/admin");
          }}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Salir
        </button>
      </div>

      {/* Leagues */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-fifa-gold mb-4">Ligas</h2>
        <div className="flex flex-col gap-3">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="bg-gray-900 rounded-xl px-5 py-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{league.name}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Código: {league.invite_code}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                    league.predictions_locked
                      ? "bg-red-950 text-red-300"
                      : "bg-green-950 text-green-300"
                  }`}
                >
                  {league.predictions_locked ? "Cerradas" : "Abiertas"}
                </span>
                <button
                  onClick={() => toggleLock(league)}
                  className="text-sm text-fifa-gold hover:underline"
                >
                  {league.predictions_locked ? "Abrir predicciones" : "Cerrar predicciones"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Payments */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-fifa-gold mb-4">
          Pagos{" "}
          <span className="text-sm font-normal text-gray-400">
            ({players.filter((p) => p.paid).length}/{players.length} pagados)
          </span>
        </h2>
        <div className="flex flex-col gap-2">
          {players.map((player) => (
            <div key={player.id} className="bg-gray-900 rounded-xl px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">{player.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{player.leagues?.name ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                  player.paid ? "bg-green-950 text-green-300" : "bg-red-950 text-red-300"
                }`}>
                  {player.paid ? "Pagado" : "Pendiente"}
                </span>
                <button
                  onClick={() => togglePaid(player)}
                  disabled={togglingPaid === player.id}
                  className="text-sm text-fifa-gold hover:underline disabled:opacity-40"
                >
                  {togglingPaid === player.id ? "..." : player.paid ? "Marcar pendiente" : "Marcar pagado"}
                </button>
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-gray-500 text-sm">No hay jugadores registrados.</p>
          )}
        </div>
      </section>

      {/* Users */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-fifa-gold mb-4">Usuarios</h2>
        {resetMsg && (
          <p className={`mb-3 text-sm px-4 py-2 rounded-lg ${resetMsg.type === "ok" ? "bg-green-950 text-green-300" : "bg-red-950 text-red-300"}`}>
            {resetMsg.text}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <div key={user.id} className="bg-gray-900 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">@{user.username}</p>
                  {user.locked_until && new Date(user.locked_until) > new Date() && (
                    <p className="text-xs text-red-400 mt-0.5">🔒 Bloqueado</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setResetUserId(resetUserId === user.id ? null : user.id);
                    setResetPassword("");
                    setResetMsg(null);
                  }}
                  className="text-sm text-fifa-gold hover:underline"
                >
                  {resetUserId === user.id ? "Cancelar" : "Cambiar contraseña"}
                </button>
              </div>
              {resetUserId === user.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Nueva contraseña (mín. 6 caracteres)"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
                  />
                  <button
                    onClick={handleResetPassword}
                    disabled={resetting || resetPassword.length < 6}
                    className="px-4 py-2 bg-fifa-gold text-gray-950 font-bold rounded-lg text-sm hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resetting ? "..." : "Guardar"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-gray-500 text-sm">No hay usuarios registrados.</p>
          )}
        </div>
      </section>

      {saveError && (
        <div className="mb-4 px-4 py-3 bg-red-950 border border-red-700 rounded-xl text-red-300 text-sm">
          {saveError}
        </div>
      )}

      {/* Matches */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-fifa-gold">Partidos</h2>
          <button
            onClick={syncScores}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-green-400 font-semibold rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-gray-700"
          >
            <span className={syncing ? "animate-spin inline-block" : ""}>🔄</span>
            {syncing ? "Sincronizando..." : "Sync scores"}
          </button>
        </div>
        {syncMsg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${syncMsg.type === "ok" ? "bg-green-950 border border-green-700 text-green-300" : "bg-red-950 border border-red-700 text-red-300"}`}>
            {syncMsg.text}
          </div>
        )}
        <div className="flex gap-2 text-sm mb-4">
          {(["all", "upcoming", "live", "finished"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === f
                  ? "bg-fifa-gold text-gray-950"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {f === "all" ? "Todos" : f === "upcoming" ? "Próximos" : f === "live" ? "En vivo" : "Terminados"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {filtered.map((match) => (
            <div key={match.id} className="bg-gray-900 text-white rounded-xl overflow-hidden">
              {/* Match row */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-4">
                  {/* Teams & score inputs */}
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm font-semibold text-right flex-1 truncate">
                      {match.home_team}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={match.editHome}
                      onChange={(e) => updateMatchEdit(match.id, "editHome", e.target.value)}
                      placeholder="–"
                      className="w-12 h-10 bg-gray-800 border border-gray-700 rounded-lg text-center font-bold text-lg text-white focus:outline-none focus:border-fifa-gold"
                    />
                    <span className="text-gray-500 font-bold">:</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={match.editAway}
                      onChange={(e) => updateMatchEdit(match.id, "editAway", e.target.value)}
                      placeholder="–"
                      className="w-12 h-10 bg-gray-800 border border-gray-700 rounded-lg text-center font-bold text-lg text-white focus:outline-none focus:border-fifa-gold"
                    />
                    <span className="text-sm font-semibold text-left flex-1 truncate">
                      {match.away_team}
                    </span>
                  </div>

                  {/* Status, save, expand */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${statusColor[match.status]}`}>
                      {match.status === "upcoming" ? "Próximo" : match.status === "live" ? "En vivo" : "Terminado"}
                    </span>
                    <button
                      onClick={() => saveResult(match)}
                      disabled={match.saving || match.editHome === "" || match.editAway === ""}
                      className="px-4 py-2 bg-fifa-gold text-gray-950 font-bold rounded-lg text-sm hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {match.saving ? "..." : match.saved ? "Guardado!" : "Guardar"}
                    </button>
                    <button
                      onClick={() => toggleExpand(match.id)}
                      className="px-3 py-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
                      title="Ver predicciones"
                    >
                      {expandedMatch === match.id ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mt-2">
                  Grupo {match.group} ·{" "}
                  {new Date(match.kickoff_at).toLocaleDateString("es-MX", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {/* Predictions panel */}
              {expandedMatch === match.id && (
                <div className="border-t border-gray-800 px-5 py-4 bg-gray-950">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Predicciones de los jugadores
                  </p>
                  {loadingPredictions && !matchPredictions[match.id] ? (
                    <p className="text-gray-500 text-sm">Cargando...</p>
                  ) : !matchPredictions[match.id]?.length ? (
                    <p className="text-gray-600 text-sm">Nadie ha predicho este partido.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_6rem_5rem] text-xs text-gray-600 font-medium mb-1">
                        <span>Jugador</span>
                        <span className="text-center">Predicción</span>
                        <span className="text-center">Pts</span>
                      </div>
                      {matchPredictions[match.id].map((p, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_6rem_5rem] items-center py-1.5 border-t border-gray-800 text-sm"
                        >
                          <span className="text-gray-300 truncate">{p.player_name}</span>
                          <span className="text-center font-mono font-semibold text-white">
                            {p.home_score} – {p.away_score}
                          </span>
                          <span className={`text-center text-sm ${pointsColor(p.points)}`}>
                            {p.points !== null ? `${p.points} pts` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
