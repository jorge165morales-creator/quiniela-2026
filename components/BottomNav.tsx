"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const tabs = [
  { href: "/", label: "Inicio", icon: "⌂" },
  { href: "/predictions", label: "Quiniela", icon: "✏" },
  { href: "/leaderboard", label: "Tabla", icon: "⊞" },
  { href: "/reglas", label: "Reglas", icon: "☰" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(localStorage.getItem("username"));
  }, [pathname]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg">
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                active ? "text-fifa-blue" : "text-gray-400"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </Link>
          );
        })}
        {/* Account tab */}
        <Link
          href={username ? "/predictions" : "/login"}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
            pathname === "/login" || pathname === "/signup" ? "text-fifa-blue" : "text-gray-400"
          }`}
        >
          <span className="text-lg leading-none">
            {username ? (
              <span className="w-6 h-6 rounded-full bg-fifa-blue flex items-center justify-center text-white text-xs font-bold inline-flex">
                {username[0].toUpperCase()}
              </span>
            ) : "○"}
          </span>
          <span className="font-medium">{username ? username : "Cuenta"}</span>
        </Link>
      </div>
    </nav>
  );
}
