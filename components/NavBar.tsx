"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(localStorage.getItem("username"));
    function handleAuth() { setUsername(localStorage.getItem("username")); }
    window.addEventListener("quinielaauth", handleAuth);
    return () => window.removeEventListener("quinielaauth", handleAuth);
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem("player_id");
    localStorage.removeItem("player_name");
    localStorage.removeItem("username");
    localStorage.removeItem("league_id");
    localStorage.removeItem("league_name");
    setUsername(null);
    router.push("/");
  }

  return (
    <header className="bg-white/95 backdrop-blur sticky top-0 z-40 border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <span className="text-xl font-black tracking-tight text-gray-900">
            Quiniela <span className="text-fifa-blue">2026</span>
          </span>
        </Link>

        {/* Desktop nav only */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
          <Link href="/" className="hover:text-gray-900 transition-colors">Inicio</Link>
          <Link href="/leaderboard" className="hover:text-gray-900 transition-colors">Tabla</Link>
          <Link href="/rondas" className="hover:text-gray-900 transition-colors">Rondas</Link>
          <Link href="/ultimo-cero" className="hover:text-gray-900 transition-colors">Último 0</Link>
          <Link href="/goles" className="hover:text-gray-900 transition-colors">Goles</Link>
          <Link href="/reglas" className="hover:text-gray-900 transition-colors">Reglas</Link>

          {username ? (
            <>
              <Link href="/predictions" className="hover:text-gray-900 transition-colors">
                Mis predicciones
              </Link>
              <div className="flex items-center gap-3 ml-2">
                <span className="text-gray-700 font-mono text-xs bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                  @{username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-red-500 transition-colors text-xs"
                >
                  Salir
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 ml-2">
              <Link href="/login" className="hover:text-gray-900 transition-colors">
                Iniciar sesión
              </Link>
              <Link
                href="/signup"
                className="bg-fifa-blue text-white font-bold px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity text-xs"
              >
                Registrarse
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile: show username or login button */}
        <div className="md:hidden">
          {username ? (
            <span className="text-gray-700 font-mono text-xs bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
              @{username}
            </span>
          ) : (
            <Link
              href="/login"
              className="bg-fifa-blue text-white font-bold px-4 py-1.5 rounded-full text-xs"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
