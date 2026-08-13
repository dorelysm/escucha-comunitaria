"use client"

import { useEffect, useState } from "react"
import { BloquesFuerza } from "@/components/BloquesFuerza"
import type { FuerzaEvidencia } from "@/types/dominio"

interface Unidad { id: string; texto_literal: string; fuentes: { titulo: string } | null }
interface Cluster { id: number; etiqueta: string | null; descripcion: string | null; n_unidades: number; unidades: Unidad[] }

function calcularFuerzaCluster(n: number): FuerzaEvidencia {
  if (n === 0) return "insuficiente"
  if (n < 3) return "baja"
  if (n < 8) return "media"
  return "alta"
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
  if (error) return <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px", fontSize: 15, color: "var(--dc-ochre)" }}>{error}</div>

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
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px" }}>
      <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 8 }}>Explorar temas</h1>
      <p style={{ fontSize: 16, color: "var(--dc-muted)", marginBottom: 40 }}>
        Temas emergentes identificados automáticamente en el corpus comunitario.
      </p>
      <div>
        {clusters.map((c, idx) => (
          <div key={c.id} style={{ borderTop: "1px solid var(--dc-border)" }}>
            <div
              onClick={() => toggle(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 24, padding: "20px 0", cursor: "pointer" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-border)", minWidth: 28 }}>
                {String(idx).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 32, fontWeight: 600, flex: 1 }}>
                {c.etiqueta ?? <em style={{ color: "var(--dc-muted)", fontStyle: "italic" }}>Tema sin etiquetar</em>}
              </span>
              <BloquesFuerza fuerza={calcularFuerzaCluster(c.n_unidades)} />
              <span style={{ fontSize: 13, color: "var(--dc-muted)", minWidth: 90, textAlign: "right" }}>
                {c.n_unidades} fragmentos
              </span>
              <span style={{ fontSize: 13, color: "var(--dc-muted)" }}>{abiertos.has(c.id) ? "▲" : "▼"}</span>
            </div>
            {abiertos.has(c.id) && (
              <div style={{ paddingBottom: 24, paddingLeft: 52 }}>
                {c.descripcion && (
                  <p style={{ fontSize: 15, color: "var(--dc-muted)", marginBottom: 20 }}>{c.descripcion}</p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {c.unidades.slice(0, 10).map((u) => (
                    <blockquote key={u.id} style={{ margin: 0, paddingLeft: 16, borderLeft: "3px solid var(--dc-border)" }}>
                      <p style={{ fontSize: 15, fontStyle: "italic", margin: 0 }}>"{u.texto_literal}"</p>
                      {u.fuentes && (
                        <cite style={{ fontSize: 13, color: "var(--dc-muted)", display: "block", marginTop: 4, fontStyle: "normal" }}>
                          {u.fuentes.titulo}
                        </cite>
                      )}
                    </blockquote>
                  ))}
                  {c.unidades.length > 10 && (
                    <p style={{ fontSize: 13, color: "var(--dc-muted)" }}>… y {c.unidades.length - 10} fragmentos más.</p>
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
