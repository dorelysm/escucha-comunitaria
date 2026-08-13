"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EjeCluster } from "@/types/dominio";
import { ETIQUETA_FUERZA } from "@/lib/fuerza";

export default function ExplorarPage() {
  const [ejes, setEjes] = useState<EjeCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [muestraInsuficiente, setMuestraInsuficiente] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/explorar")
      .then((r) => r.json())
      .then((d) => {
        setEjes(d.ejes ?? []);
        setMuestraInsuficiente(d.muestra_insuficiente ?? false);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-2">
          <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">← Inicio</Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Explorar el corpus</h1>
        <p className="text-slate-500 text-sm mb-6">
          Ejes temáticos que emergen del corpus, ordenados por número de fuentes distintas.
        </p>

        {muestraInsuficiente && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            La muestra actual es insuficiente para leer patrones con confianza. Los resultados son orientativos.
          </div>
        )}

        {loading && <p className="text-slate-400">Cargando clusters...</p>}

        {!loading && ejes.length === 0 && (
          <p className="text-slate-500">No hay clusters precomputados todavía. Ingestar corpus y correr <code>analizar.py</code>.</p>
        )}

        <div className="space-y-3">
          {ejes.map((eje) => (
            <div key={eje.cluster_id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                onClick={() => setAbierto(abierto === eje.cluster_id ? null : eje.cluster_id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{eje.etiqueta}</p>
                    <p className="text-sm text-slate-500 mt-1">{eje.descripcion}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <div className="font-medium">{eje.evidencia.n_fuentes_distintas} fuentes</div>
                    <div>{ETIQUETA_FUERZA[eje.evidencia.fuerza]}</div>
                  </div>
                </div>
                {eje.distribucion_territorio.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {eje.distribucion_territorio.map((t) => (
                      <span key={t.municipio} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {t.municipio} ({t.n_unidades})
                      </span>
                    ))}
                  </div>
                )}
              </button>

              {abierto === eje.cluster_id && (
                <div className="border-t border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-700 mb-2">Corpus dominante: {eje.corpus_dominante}</p>
                  <p className="text-slate-500 text-xs">
                    {eje.evidencia.n_unidades} fragmento{eje.evidencia.n_unidades !== 1 ? "s" : ""} · {eje.evidencia.n_fuentes_distintas} fuente{eje.evidencia.n_fuentes_distintas !== 1 ? "s" : ""} distintas
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
