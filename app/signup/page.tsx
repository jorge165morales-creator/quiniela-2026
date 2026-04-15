"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), username: username.trim().toLowerCase(), password }),
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
    window.dispatchEvent(new Event("quinielaauth"));

    router.push("/join");
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-black mb-2">Nuevo usuario</h1>
      <p className="text-gray-400 mb-8">Crea tu cuenta para participar en la quiniela.</p>

      <form onSubmit={handleSignup} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nombre completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Juan Morales"
            maxLength={40}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ej. juan@gmail.com"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
          />
          <p className="text-xs text-gray-600 mt-1">Para recuperar tu contraseña si la olvidas.</p>
        </div>

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
          <p className="text-xs text-gray-600 mt-1">Solo letras, números, puntos y guiones bajos.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            minLength={6}
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
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-fifa-gold hover:underline">
            Usuario existente
          </Link>
        </p>
      </form>
    </div>
  );
}
