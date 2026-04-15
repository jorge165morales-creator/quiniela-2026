"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    localStorage.setItem("user_id", data.user_id);
    localStorage.setItem("player_name", data.name);
    localStorage.setItem("username", data.username);
    if (data.player_id) localStorage.setItem("player_id", data.player_id);
    if (data.league_id) localStorage.setItem("league_id", data.league_id);
    if (data.league_name) localStorage.setItem("league_name", data.league_name);
    window.dispatchEvent(new Event("quinielaauth"));

    router.push(data.player_id ? "/predictions" : "/join");
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-black mb-2">Usuario existente</h1>
      <p className="text-gray-400 mb-8">Ingresa tu usuario y contraseña.</p>

      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nombre de usuario</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
              placeholder="juanmorales"
              maxLength={30}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-fifa-gold text-gray-950 font-bold py-4 rounded-xl text-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="text-fifa-gold hover:underline">
            Nuevo usuario
          </Link>
        </p>
      </form>
    </div>
  );
}
