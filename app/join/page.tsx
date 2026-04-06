"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  useEffect(() => {
    setUsername(localStorage.getItem("username"));
    setPlayerName(localStorage.getItem("player_name"));
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const userId = localStorage.getItem("user_id");
    if (!userId) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_code: inviteCode.trim().toUpperCase(),
        user_id: userId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error al unirse a la liga.");
      setLoading(false);
      return;
    }

    localStorage.setItem("player_id", data.player_id);
    localStorage.setItem("league_id", data.league_id);
    localStorage.setItem("league_name", data.league_name);

    router.push("/predictions");
  }

  if (!username) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-3xl font-black mb-4">Unirse a una liga</h1>
        <p className="text-gray-400 mb-8">Necesitas una cuenta para unirte a una liga.</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/signup"
            className="w-full bg-fifa-gold text-gray-950 font-bold py-4 rounded-xl text-lg hover:bg-yellow-400 transition-colors text-center"
          >
            Nuevo usuario
          </Link>
          <Link
            href="/login"
            className="w-full bg-gray-800 text-white font-bold py-4 rounded-xl text-lg hover:bg-gray-700 transition-colors text-center"
          >
            Usuario existente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-black mb-2">Unirse a una liga</h1>
      <p className="text-gray-400 mb-2">
        Jugando como <span className="text-white font-semibold">{playerName}</span>{" "}
        <span className="text-gray-500 font-mono text-sm">@{username}</span>
      </p>
      <p className="text-gray-500 text-sm mb-8">
        ¿Otra cuenta?{" "}
        <Link href="/login" className="text-fifa-gold hover:underline">
          Cambiar usuario
        </Link>
      </p>

      <form onSubmit={handleJoin} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Código de liga
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="ej. AMIGOS2026"
            maxLength={20}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold font-mono text-lg tracking-widest"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-fifa-gold text-gray-950 font-bold py-4 rounded-xl text-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Entrando..." : "Entrar y predecir"}
        </button>
      </form>
    </div>
  );
}
