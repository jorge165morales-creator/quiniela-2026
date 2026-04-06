"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });

    if (!res.ok) {
      setError("Clave incorrecta.");
      setLoading(false);
      return;
    }

    localStorage.setItem("admin_secret", secret);
    router.push("/admin/dashboard");
  }

  return (
    <div className="max-w-sm mx-auto mt-24">
      <h1 className="text-3xl font-black mb-2">Panel Admin</h1>
      <p className="text-gray-400 mb-8">Ingresa la clave de administrador.</p>

      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Clave admin"
          required
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
        />

        {error && (
          <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-fifa-gold text-gray-950 font-bold py-4 rounded-xl text-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
