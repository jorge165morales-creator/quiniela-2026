import Link from "next/link";
import HeroCTA from "@/components/HeroCTA";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      {/* Hero — keeps dark FIFA gradient for drama */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#001E62] via-[#003DA5] to-[#001040] px-8 py-16 text-center shadow-xl">
        {/* "26" background decoration */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[20rem] font-black text-white/5 leading-none">26</span>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/90 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
            🏆 FIFA World Cup 2026
          </div>

          {/* Host nations */}
          <div className="flex items-center gap-2 text-white/60 text-xs font-semibold tracking-widest uppercase">
            <img src="https://flagcdn.com/w40/us.png" alt="USA" className="h-3.5 rounded-sm" />
            <span>USA</span>
            <span className="text-white/30">·</span>
            <img src="https://flagcdn.com/w40/ca.png" alt="Canadá" className="h-3.5 rounded-sm" />
            <span>Canadá</span>
            <span className="text-white/30">·</span>
            <img src="https://flagcdn.com/w40/mx.png" alt="México" className="h-3.5 rounded-sm" />
            <span>México</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-black leading-none tracking-tight text-white">
            Quiniela<br />
            <span className="text-fifa-gold">Mundial</span>
          </h1>

          <p className="text-white/60 text-base max-w-sm">
            Predice los 72 partidos de la fase de grupos. El mejor marcador gana.
          </p>

          {/* CTAs */}
          <HeroCTA />
        </div>
      </div>

      {/* Scoring */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Sistema de puntuación</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-5 text-center border border-gray-200 shadow-sm">
            <div className="text-3xl font-black text-fifa-gold mb-1">6 pts</div>
            <div className="text-xs text-gray-500 leading-snug">Marcador exacto</div>
          </div>
          <div className="bg-white rounded-2xl p-5 text-center border border-gray-200 shadow-sm">
            <div className="text-3xl font-black text-blue-600 mb-1">3–4</div>
            <div className="text-xs text-gray-500 leading-snug">Resultado correcto</div>
          </div>
          <div className="bg-white rounded-2xl p-5 text-center border border-gray-200 shadow-sm">
            <div className="text-3xl font-black text-gray-300 mb-1">0–1</div>
            <div className="text-xs text-gray-500 leading-snug">Resultado incorrecto</div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Cómo funciona</p>
        <div className="flex flex-col gap-3">
          {[
            { step: "3", text: "Predice los 72 partidos antes del torneo", icon: "✏️" },
            { step: "4", text: "Sigue la tabla en tiempo real", icon: "📊" },
          ].map(({ step, text, icon }) => (
            <div key={step} className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 border border-gray-200 shadow-sm">
              <span className="text-2xl">{icon}</span>
              <span className="text-sm text-gray-700">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
