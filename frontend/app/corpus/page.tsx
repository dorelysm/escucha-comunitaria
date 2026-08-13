"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FuenteResumen, TipoProcedencia } from "@/types/dominio";

const ETIQUETA_TIPO: Record<TipoProcedencia, string> = {
  testimonio: "Testimonio",
  publica: "Fuente pública",
  sintetica: "Sintético",
};

const COLOR_TIPO: Record<TipoProcedencia, string> = {
  testimonio: "bg-blue-50 text-blue-700 border-blue-200",
  publica: "bg-slate-50 text-slate-700 border-slate-200",
  sintetica: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function CorpusPage() {
  const [fuentes, setFuentes] = useState<FuenteResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/corpus")
      .then((r) => r.json())
      .then((d) => setFuentes(d.fuentes ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">← Inicio</Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Corpus de fuentes</h1>
        <p className="text-slate-500 text-sm mb-8">
          Listado de todas las fuentes que integran el corpus. Los testimonios sin consentimiento registrado no aparecen.
        </p>

        {loading && <p className="text-slate-400">Cargando...</p>}

        {!loading && fuentes.length === 0 && (
          <p className="text-slate-500">No hay fuentes ingestadas todavía.</p>
        )}

        <div className="space-y-3">
          {fuentes.map((f) => (
            <div key={f.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{f.titulo}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                    {f.municipio && <span>{f.municipio}{f.departamento ? `, ${f.departamento}` : ""}</span>}
                    {f.fecha_recoleccion && <span>· {f.fecha_recoleccion}</span>}
                    <span>· {f.n_unidades} fragmento{f.n_unidades !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <span className={`shrink-0 text-xs border rounded px-2 py-0.5 ${COLOR_TIPO[f.tipo_procedencia]}`}>
                  {ETIQUETA_TIPO[f.tipo_procedencia]}
                </span>
              </div>
              {f.referencia && f.referencia !== f.titulo && (
                <p className="text-xs text-slate-400 mt-1 truncate">{f.referencia}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
