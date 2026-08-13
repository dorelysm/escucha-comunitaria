"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { EventoStream, ResultadoDimension } from "@/types/dominio";
import { COLOR_MARCA, ETIQUETA_MARCA, ETIQUETA_FUERZA } from "@/lib/fuerza";

const ETIQUETA_DIMENSION: Record<string, string> = {
  poblacion_objetivo: "Población objetivo",
  tipo_intervencion: "Tipo de intervención",
  duracion_horizonte: "Duración y horizonte",
  resultado_esperado: "Resultado esperado",
};

export default function ValidarPage() {
  const [propuesta, setPropuesta] = useState("");
  const [estado, setEstado] = useState<string>("");
  const [dimensiones, setDimensiones] = useState<ResultadoDimension[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function validar() {
    if (!propuesta.trim() || cargando) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setDimensiones([]);
    setEstado("Iniciando análisis...");
    setError(null);
    setCargando(true);

    try {
      const resp = await fetch("/api/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propuesta }),
        signal: abortRef.current.signal,
      });

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lineas = buffer.split("\n");
        buffer = lineas.pop() ?? "";

        for (const linea of lineas) {
          if (!linea.trim()) continue;
          const evento: EventoStream = JSON.parse(linea);

          if (evento.tipo === "estado") {
            setEstado(evento.detalle);
          } else if (evento.tipo === "dimension") {
            setDimensiones((prev) => [...prev, evento]);
          } else if (evento.tipo === "fin") {
            setEstado("");
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setError("Error al conectar con el servidor. Verificar que las variables de entorno estén configuradas.");
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-2">
          <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">← Inicio</Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Validar una propuesta</h1>
        <p className="text-slate-500 text-sm mb-6">
          Describí un programa de política pública. El sistema reporta, dimensión por dimensión, qué encuentra respaldo en las voces del corpus.
        </p>

        <textarea
          className="w-full border border-slate-300 rounded-lg p-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          rows={4}
          placeholder="Ej: Crear 50 cupos de educación superior en medicina para jóvenes de la zona suroriental de Cartagena..."
          value={propuesta}
          onChange={(e) => setPropuesta(e.target.value)}
          disabled={cargando}
        />

        <button
          onClick={validar}
          disabled={cargando || !propuesta.trim()}
          className="mt-3 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {cargando ? "Analizando..." : "Analizar propuesta"}
        </button>

        {estado && (
          <p className="mt-4 text-sm text-slate-500 italic">{estado}</p>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        )}

        {dimensiones.length > 0 && (
          <div className="mt-8 space-y-6">
            {dimensiones.map((dim) => (
              <DimensionCard key={dim.dimension} dim={dim} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DimensionCard({ dim }: { dim: ResultadoDimension }) {
  return (
    <div className={`border rounded-xl p-5 ${COLOR_MARCA[dim.marca]}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="font-semibold text-slate-900">
          {ETIQUETA_DIMENSION[dim.dimension] ?? dim.dimension}
        </h2>
        <span className={`shrink-0 text-xs font-medium border rounded px-2 py-0.5 ${COLOR_MARCA[dim.marca]}`}>
          {ETIQUETA_MARCA[dim.marca]}
        </span>
      </div>

      {dim.enunciado && (
        <p className="text-sm text-slate-700 mb-2 italic">&quot;{dim.enunciado}&quot;</p>
      )}

      <p className="text-sm text-slate-700 mb-3">{dim.justificacion}</p>

      <div className="text-xs text-slate-500 mb-3">
        {dim.evidencia.n_fuentes_distintas} fuente{dim.evidencia.n_fuentes_distintas !== 1 ? "s" : ""} ·{" "}
        {ETIQUETA_FUERZA[dim.evidencia.fuerza]}
        {dim.muestra_insuficiente && " · ⚠ Muestra insuficiente para conclusiones"}
      </div>

      {dim.citas.length > 0 && (
        <div className="space-y-2 mt-3 pt-3 border-t border-current/10">
          {dim.citas.map((cita) => (
            <blockquote key={cita.unidad_id} className="text-sm text-slate-700 border-l-2 border-current/20 pl-3">
              <p>&quot;{cita.texto_literal}&quot;</p>
              <cite className="text-xs text-slate-500 not-italic block mt-1">
                {cita.tipo_procedencia === "testimonio" ? "Testimonio" : "Fuente pública"}
                {cita.municipio ? ` · ${cita.municipio}` : ""}
                {cita.rango_etario ? ` · ${cita.rango_etario}` : ""}
                {cita.referencia ? ` · ${cita.referencia}` : ""}
              </cite>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}
