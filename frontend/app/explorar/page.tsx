"use client"

import { useEffect, useState } from "react"
import { BloquesFuerza } from "@/components/BloquesFuerza"
import { ChipTipo, BarraTipo } from "@/components/ChipTipo"
import type { FuerzaEvidencia, TipoProcedencia } from "@/types/dominio"

interface Unidad {
  id: string
  texto_literal: string
  fuentes: { titulo: string | null; referencia: string | null; tipo_procedencia: TipoProcedencia } | null
}

interface Cluster {
  id: number
  etiqueta: string | null
  descripcion: string | null
  n_unidades: number
  n_fuentes_distintas: number
  corpus_dominante: string | null
  por_tipo: Record<TipoProcedencia, number>
  unidades: Unidad[]
}

function calcularFuerza(n: number): FuerzaEvidencia {
  if (n === 0) return "insuficiente"
  if (n < 3)  return "baja"
  if (n < 8)  return "media"
  return "alta"
}

const TIPO_LABELS: Record<TipoProcedencia, string> = {
  testimonio: "testimonios",
  publica:    "públicas",
  sintetica:  "sintéticas",
}

export default function ExplorarPage() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch("/api/explorar")
      .then((r) => r.json())
      .then((d) => { setClusters(d.clusters ?? []); setCargando(false) })
      .catch(() => { setError("Error al cargar los temas."); setCargando(false) })
  }, [])

  const toggle = (id: number) =>
    setAbiertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (cargando) return <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px", fontSize: 15, color: "var(--dc-muted)" }}>Cargando temas…</div>
  if (error)    return <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px", fontSize: 15, color: "var(--dc-ochre)" }}>{error}</div>

  if (clusters.length === 0) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px" }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 32 }}>Explorar temas</h1>
        <div style={{ border: "2px dashed var(--dc-border)", padding: 48, textAlign: "center", fontSize: 15, color: "var(--dc-muted)" }}>
          El análisis de temas (BERTopic) aún no se ha ejecutado.<br />
          Los temas aparecerán aquí después de correr <code style={{ fontFamily: "monospace", fontSize: 13 }}>analizar.py</code>.
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 32px" }}>
      <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 8 }}>Explorar temas</h1>
      <p style={{ fontSize: 16, color: "var(--dc-muted)", marginBottom: 40 }}>
        {clusters.length} temas emergentes identificados en el corpus · ordenados por volumen de evidencia.
      </p>

      <div>
        {clusters.map((c, idx) => (
          <div key={c.id} style={{ borderTop: "1px solid var(--dc-border)" }}>
            {/* Fila del cluster */}
            <div
              onClick={() => toggle(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 0", cursor: "pointer" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-border)", minWidth: 28, flexShrink: 0 }}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 24, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>
                {c.etiqueta ?? <em style={{ color: "var(--dc-muted)", fontWeight: 400 }}>Tema sin etiquetar</em>}
              </span>
              <BloquesFuerza fuerza={calcularFuerza(c.n_unidades)} />
              <span style={{ fontSize: 13, color: "var(--dc-muted)", minWidth: 80, textAlign: "right", flexShrink: 0 }}>
                {c.n_unidades} fragmentos
              </span>
              <span style={{ fontSize: 12, color: "var(--dc-muted)", flexShrink: 0 }}>
                {abiertos.has(c.id) ? "▲" : "▼"}
              </span>
            </div>

            {/* Detalle expandido */}
            {abiertos.has(c.id) && (
              <div style={{ paddingBottom: 32, paddingLeft: 48 }}>
                {c.descripcion && (
                  <p style={{ fontSize: 15, color: "var(--dc-muted)", marginBottom: 20, lineHeight: 1.6 }}>
                    {c.descripcion}
                  </p>
                )}

                {/* Distribución por tipo de fuente */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                  {(["testimonio", "publica", "sintetica"] as TipoProcedencia[]).map((tipo) => {
                    const n = c.por_tipo?.[tipo] ?? 0
                    if (n === 0) return null
                    return (
                      <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ChipTipo tipo={tipo} />
                        <span style={{ fontSize: 13, color: "var(--dc-muted)" }}>
                          {n} {TIPO_LABELS[tipo]}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Fragmentos literales */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {c.unidades.slice(0, 10).map((u) => {
                    const tipo = u.fuentes?.tipo_procedencia ?? "publica"
                    return (
                      <div key={u.id} style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                        <BarraTipo tipo={tipo} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 15, fontStyle: "italic", margin: "0 0 4px", lineHeight: 1.5 }}>
                            "{u.texto_literal}"
                          </p>
                          {u.fuentes?.referencia && (
                            <span style={{ fontSize: 12, color: "var(--dc-muted)", fontFamily: "monospace" }}>
                              {u.fuentes.referencia}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {c.n_unidades > 10 && (
                    <p style={{ fontSize: 13, color: "var(--dc-muted)", margin: 0 }}>
                      … y {c.n_unidades - 10} fragmentos más en este tema.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--dc-border)" }} />
      </div>
    </div>
  )
}
