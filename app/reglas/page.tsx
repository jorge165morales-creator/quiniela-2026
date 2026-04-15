export default function ReglasPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-black mb-2 text-gray-900">Reglas</h1>
      <p className="text-gray-500 mb-8">Quiniela Mundial 2026 — Fase de Grupos</p>

      {/* Costo */}
      <section className="bg-white rounded-2xl p-6 mb-4 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-fifa-blue mb-3">Costo de inscripción</h2>
        <p className="text-3xl font-black text-gray-900 mb-1">Q150 <span className="text-gray-400 text-lg font-normal">/ persona</span></p>
        <p className="text-gray-500 text-sm mb-4">Equivalente aproximado: $20 USD</p>
        <p className="text-sm font-semibold text-gray-700 mb-2">Pagar a: Ana Ruth Morales Caceres</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
            <span className="text-sm font-medium text-gray-500 shrink-0">BI Monetaria</span>
            <span className="font-mono font-bold text-gray-900 tracking-wider">1940048836</span>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
            <span className="text-sm font-medium text-gray-500 shrink-0">Venmo</span>
            <span className="font-mono font-bold text-gray-900">@anaruthm</span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Enviar comprobante de pago por WhatsApp al{" "}
          <a href="https://wa.me/18578679473" target="_blank" rel="noopener noreferrer" className="font-semibold text-green-600 hover:underline">
            +1 (857) 867-9473
          </a>
        </p>
      </section>

      {/* Predicciones */}
      <section className="bg-white rounded-2xl p-6 mb-4 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-fifa-blue mb-3">Predicciones</h2>
        <ul className="text-gray-600 space-y-2 text-sm">
          <li className="flex gap-2"><span className="text-fifa-gold shrink-0 font-bold">•</span>Cada participante predice el marcador exacto de los <strong className="text-gray-900">72 partidos</strong> de la fase de grupos.</li>
          <li className="flex gap-2"><span className="text-fifa-gold shrink-0 font-bold">•</span><span>Las predicciones deben enviarse antes de que inicie el torneo. Una vez cerradas, no se pueden modificar.</span></li>
          <li className="flex gap-2"><span className="text-fifa-gold shrink-0 font-bold">•</span>Puedes guardar tu progreso y regresar a completarlas antes del cierre.</li>
        </ul>
        <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-red-500 font-bold shrink-0">⚠️</span>
          <p className="text-red-700 text-sm font-semibold">No aceptaremos quinielas algorítmicas.</p>
        </div>

      </section>

      {/* Puntuación */}
      <section className="bg-white rounded-2xl p-6 mb-4 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-fifa-blue mb-4">Sistema de puntuación</h2>
        <div className="flex flex-col gap-0">
          {[
            { label: "Marcador exacto", desc: "Adivinaste el resultado y los goles de ambos equipos", pts: "6 pts", color: "text-fifa-gold" },
            { label: "Resultado correcto + 1 gol exacto", desc: "Acertaste quién gana/empata y un marcador individual", pts: "4 pts", color: "text-blue-600" },
            { label: "Empate correcto (marcador incorrecto)", desc: "Predijiste empate y fue empate, pero diferente marcador", pts: "4 pts", color: "text-blue-600" },
            { label: "Resultado correcto + 0 goles exactos", desc: "Acertaste quién gana/empata pero ningún marcador", pts: "3 pts", color: "text-green-600" },
            { label: "Resultado incorrecto + 1 gol exacto", desc: "No acertaste el resultado pero sí un marcador individual", pts: "1 pt", color: "text-orange-500" },
            { label: "Resultado incorrecto + 0 goles exactos", desc: "Sin aciertos", pts: "0 pts", color: "text-gray-300" },
          ].map((row, i, arr) => (
            <div key={i} className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{row.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{row.desc}</p>
              </div>
              <span className={`text-2xl font-black ml-4 shrink-0 ${row.color}`}>{row.pts}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Desempate */}
      <section className="bg-white rounded-2xl p-6 mb-4 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-fifa-blue mb-3">Desempate</h2>
        <p className="text-gray-600 text-sm">
          En caso de empate en puntos totales, gana quien tenga más <strong className="text-gray-900">marcadores exactos (6 pts)</strong>.
          Si persiste el empate, el premio se divide en partes iguales.
        </p>
      </section>

      {/* Premios */}
      <section className="bg-white rounded-2xl p-6 mb-4 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-fifa-blue mb-1">Premios especiales</h2>
        <p className="text-sm text-gray-500 mb-4">Todos los premios especiales se premiarán con <strong className="text-gray-700">Q150 / $20</strong>.</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">⭐</span>
            <div>
              <p className="font-bold text-gray-900">Único 6</p>
              <p className="text-gray-500 text-sm mt-0.5">Si eres el único jugador en adivinar el marcador exacto de un partido, ganas el premio por ese partido.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🏅</span>
            <div>
              <p className="font-bold text-gray-900">Mejor Ronda</p>
              <p className="text-gray-500 text-sm mt-0.5">El jugador con más puntos al finalizar cada jornada de la fase de grupos gana. Hay 3 jornadas.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">⚽</span>
            <div>
              <p className="font-bold text-gray-900">Goles del Torneo</p>
              <p className="text-gray-500 text-sm mt-0.5">Quien prediga el total de goles del torneo más cercano al real gana. La diferencia se calcula como goles predichos menos goles reales; el más cercano a 0 gana.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🏆</span>
            <div>
              <p className="font-bold text-gray-900">Último 0</p>
              <p className="text-gray-500 text-sm mt-0.5">El último jugador que no reciba un 0 en ningún partido gana.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Premiación */}
      <section className="bg-white rounded-2xl p-6 mb-4 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-fifa-blue mb-1">Premiación</h2>
        <p className="text-sm text-gray-500 mb-4">Distribución del pozo acumulado al finalizar la fase de grupos.</p>
        <div className="flex flex-col gap-0">
          {[
            { label: "Administración", desc: "Gastos operativos", pct: "4%", color: "text-gray-400" },
            { label: "Premios especiales", desc: "Único 6 · Mejor Ronda (×3) · Goles · Último 0", pct: "Q150/$20 c/u", color: "text-gray-500" },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{row.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{row.desc}</p>
              </div>
              <span className={`text-sm font-bold ml-4 shrink-0 ${row.color}`}>{row.pct}</span>
            </div>
          ))}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">Saldo restante</p>
          {[
            { label: "1er lugar", emoji: "🥇", pct: "60%", color: "text-fifa-gold" },
            { label: "2do lugar", emoji: "🥈", pct: "30%", color: "text-gray-500" },
            { label: "3er lugar", emoji: "🥉", pct: "10%", color: "text-orange-500" },
          ].map((row, i, arr) => (
            <div key={i} className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{row.emoji}</span>
                <p className="font-semibold text-gray-900 text-sm">{row.label}</p>
              </div>
              <span className={`text-2xl font-black ml-4 shrink-0 ${row.color}`}>{row.pct}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
