"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HeroCTA() {
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUsername(localStorage.getItem("username"));
    setReady(true);
    function handleAuth() { setUsername(localStorage.getItem("username")); }
    window.addEventListener("quinielaauth", handleAuth);
    return () => window.removeEventListener("quinielaauth", handleAuth);
  }, []);

  if (!ready) return null;

  if (username) {
    return (
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        <Link
          href="/predictions"
          className="px-8 py-4 bg-fifa-gold text-gray-900 font-black rounded-2xl text-base hover:opacity-90 transition-opacity shadow-lg"
        >
          Mis predicciones
        </Link>
        <Link
          href="/leaderboard"
          className="px-8 py-4 bg-white/10 text-white font-bold rounded-2xl text-base hover:bg-white/20 transition-colors border border-white/20"
        >
          Ver tabla
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
      <Link
        href="/signup"
        className="px-8 py-4 bg-fifa-gold text-gray-900 font-black rounded-2xl text-base hover:opacity-90 transition-opacity shadow-lg"
      >
        Registrarse
      </Link>
      <Link
        href="/login"
        className="px-8 py-4 bg-white/10 text-white font-bold rounded-2xl text-base hover:bg-white/20 transition-colors border border-white/20"
      >
        Iniciar sesión
      </Link>
    </div>
  );
}
