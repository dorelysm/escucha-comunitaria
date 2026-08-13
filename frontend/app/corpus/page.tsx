"use client"

import { useEffect, useState } from "react"
import type { Fuente, TipoProcedencia } from "@/types/dominio"
import { ChipTipo } from "@/components/ChipTipo"

const FILTROS: { valor: string; label: string }[] = [
  { valor: "", label: "Todo" },
  { valor: "testimonio", label: "Testimonio" },
  { valor: "publica", label: "Público" },
  { valor: "sintetica", label: "Sintético" },
]

export default function CorpusPage() {
  const [fuentes, setFuentes] = useState<Fuente[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState("")

  useEffect(() => {
    const params = new URLSearchParams()
    if (filtroTipo) params.set("tipo", filtroTipo)
    setCargando(true)
    fetch(`/api/corpus?${params}`)
      .then((r) => r.json())
      .then((d) => { setFuentes(d.fuentes ?? []); setCargando(false) })
      .catch(() => setCargando(false))
  }, [filtroTipo])

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px" }}>
      <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 8 }}>Corpus de fuentes</h1>
      <p style={{ fontSize: 16, color: "var(--dc-muted)", marginBottom: 32, maxWidth: "60ch" }}>
        Documentos e insumos del corpus. Los testimonios individuales solo aparecen con consentimiento explícito registrado.
      </p>

      {/* Filtros como botones */}
      <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
        {FILTROS.map(({ valor, label }) => (
          <button
            key={valor}
            onClick={() => setFiltroTipo(valor)}
            style={{
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: filtroTipo === valor ? 600 : 400,
              fontFamily: "inherit",
              cursor: "pointer",
              border: "1.5px solid var(--dc-border)",
              background: filtroTipo === valor ? "var(--dc-ink)" : "transparent",
              color: filtroTipo === valor ? "#fff" : "var(--dc-ink)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ fontSize: 15, color: "var(--dc-muted)" }}>Cargando fuentes…</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--dc-border)" }}>
              {["Tipo", "Fuente", "Corpus", "Fecha"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px 8px 0", fontSize: 13, fontWeight: 600, color: "var(--dc-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fuentes.map((f) => (
              <tr key={f.id} style={{ borderBottom: "1px solid var(--dc-border)" }}>
                <td style={{ padding: "12px 12px 12px 0", verticalAlign: "top" }}>
                  <ChipTipo tipo={f.tipo_procedencia as TipoProcedencia} />
                </td>
                <td style={{ padding: "12px 12px 12px 0", verticalAlign: "top" }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{f.titulo}</div>
                  <div style={{ fontSize: 12, color: "var(--dc-muted)", fontFamily: "monospace", marginTop: 2 }}>{f.referencia}</div>
                </td>
                <td style={{ padding: "12px 12px 12px 0", verticalAlign: "top", fontSize: 14, color: "var(--dc-muted)", textTransform: "capitalize" }}>
                  {f.corpus}
                </td>
                <td style={{ padding: "12px 0", verticalAlign: "top", fontSize: 13, color: "var(--dc-muted)", whiteSpace: "nowrap" }}>
                  {f.fecha_recoleccion ?? "—"}
                </td>
              </tr>
            ))}
            {fuentes.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "48px 0", textAlign: "center", fontSize: 15, color: "var(--dc-muted)" }}>
                  No hay fuentes con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
