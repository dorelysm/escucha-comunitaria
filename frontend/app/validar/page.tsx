"use client"

import { useState, useRef, useEffect } from "react"
import type { EventoStream, NombreDimension, Cita, Marca, FuerzaEvidencia, TipoProcedencia } from "@/types/dominio"
import { ETIQUETAS_DIMENSION } from "@/types/dominio"
import { BloquesFuerza } from "@/components/BloquesFuerza"
import { MarcaChip, MarcaContainer } from "@/components/MarcaVeredicto"
import { BarraTipo, ChipTipo } from "@/components/ChipTipo"

const PASOS = [
  "Normalizando propuesta…",
  "Descomponiendo en dimensiones…",
  "Buscando fragmentos relevantes…",
  "Evaluando respaldo comunitario…",
  "Generando síntesis…",
]

interface DimResult {
  nombre: NombreDimension
  enunciado: string | null
  marca: Marca | null
  justificacion: string | null
  citas: Cita[]
  fuerza: FuerzaEvidencia
}

function CitaRow({ cita }: { cita: Cita }) {
  const tipo = (cita as unknown as { tipo_procedencia?: TipoProcedencia }).tipo_procedencia ?? "publica"
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <BarraTipo tipo={tipo} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>"{cita.texto_literal}"</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <ChipTipo tipo={tipo} />
          {cita.referencia && (
            <span style={{ fontSize: 12, color: "var(--dc-muted)" }}>{cita.referencia}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function DimensionCard({ dim }: { dim: DimResult }) {
  const [abierta, setAbierta] = useState(true)

  const colorBanda: Record<NombreDimension, string> = {
    poblacion_objetivo:  "var(--dc-blue)",
    tipo_intervencion:   "var(--dc-ochre)",
    duracion_horizonte:  "var(--dc-muted)",
    resultado_esperado:  "var(--dc-green)",
  }

  if (!dim.enunciado) {
    return (
      <div style={{ border: "2px dashed var(--dc-border)", padding: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          {ETIQUETAS_DIMENSION[dim.nombre]}
        </div>
        <div style={{ fontSize: 15, color: "var(--dc-muted)", fontStyle: "italic" }}>
          Ningún joven habló de esto — la propuesta no especifica esta dimensión.
        </div>
      </div>
    )
  }

  return (
    <MarcaContainer marca={dim.marca ?? "no_respaldada"}>
      <div style={{ height: 14, background: colorBanda[dim.nombre] }} />
      <div style={{ padding: "20px 24px" }}>
        <div
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, cursor: "pointer" }}
          onClick={() => setAbierta((v) => !v)}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              {ETIQUETAS_DIMENSION[dim.nombre]}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>{dim.enunciado}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
            {dim.marca && <MarcaChip marca={dim.marca} />}
            <BloquesFuerza fuerza={dim.fuerza} />
          </div>
        </div>

        {abierta && (
          <>
            {dim.justificacion && (
              <p style={{ fontSize: 15, color: "var(--dc-muted)", marginTop: 16, lineHeight: 1.6, borderTop: "1px solid var(--dc-border)", paddingTop: 16 }}>
                {dim.justificacion}
              </p>
            )}
            {dim.citas.length > 0 && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                {dim.citas.map((c) => <CitaRow key={c.id} cita={c} />)}
              </div>
            )}
          </>
        )}
      </div>
    </MarcaContainer>
  )
}

const LEYENDA: { marca: Marca; simbolo: string; desc: string }[] = [
  { marca: "respaldada",   simbolo: "✓", desc: "Los fragmentos del corpus coinciden con esta dimensión de la propuesta." },
  { marca: "tensionada",   simbolo: "⇄", desc: "Hay voces comunitarias que apuntan en dirección distinta a lo que propone el programa." },
  { marca: "no_respaldada",simbolo: "◻", desc: "El corpus no contiene voces sobre esta dimensión — vacío, no error." },
]

const COLOR_MARCA_TEXT: Record<Marca, string> = {
  respaldada:    "var(--dc-green)",
  tensionada:    "var(--dc-ochre)",
  no_respaldada: "var(--dc-grey)",
}

const MUNICIPIOS = [
  { valor: "", label: "Todos los territorios" },
  { valor: "cartagena", label: "Cartagena" },
  { valor: "puerto_colombia", label: "Puerto Colombia" },
]

export default function ValidarPage() {
  const [propuesta, setPropuesta] = useState("")
  const [municipio, setMunicipio] = useState("")
  const [fase, setFase] = useState<"idle" | "procesando" | "listo" | "error">("idle")
  const [dims, setDims] = useState<DimResult[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const [pasoActivo, setPasoActivo] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const pasoTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { pasoTimer.current && clearInterval(pasoTimer.current) }, [])

  const iniciar = async () => {
    if (!propuesta.trim()) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setFase("procesando")
    setDims([])
    setErrorMsg("")
    setPasoActivo(0)

    pasoTimer.current && clearInterval(pasoTimer.current)
    pasoTimer.current = setInterval(() => {
      setPasoActivo((p) => (p < PASOS.length - 1 ? p + 1 : p))
    }, 2200)

    try {
      const res = await fetch("/api/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propuesta, municipio: municipio || undefined }),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) throw new Error("Error del servidor")

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          const ev = JSON.parse(line) as EventoStream
          if (ev.tipo === "dimension") {
            setDims((d) => [...d, ev as unknown as DimResult])
          } else if (ev.tipo === "fin") {
            setFase("listo")
            pasoTimer.current && clearInterval(pasoTimer.current)
          } else if (ev.tipo === "error") {
            throw new Error(ev.mensaje)
          }
        }
      }
      setFase("listo")
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      setErrorMsg((e as Error).message ?? "Error desconocido")
      setFase("error")
    } finally {
      pasoTimer.current && clearInterval(pasoTimer.current)
    }
  }

  const limpiar = () => {
    abortRef.current?.abort()
    setPropuesta("")
    setFase("idle")
    setDims([])
    setErrorMsg("")
    setPasoActivo(0)
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px" }}>
      <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 32 }}>Contrastar propuesta</h1>

      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {/* Panel izquierdo — 2/3 */}
        <div style={{ flex: 2, minWidth: 0 }}>
          {/* Filtro municipio */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {MUNICIPIOS.map(({ valor, label }) => (
              <button
                key={valor}
                onClick={() => setMunicipio(valor)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: municipio === valor ? 600 : 400,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: "1.5px solid var(--dc-border)",
                  background: municipio === valor ? "var(--dc-ink)" : "transparent",
                  color: municipio === valor ? "#fff" : "var(--dc-ink)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={propuesta}
            onChange={(e) => setPropuesta(e.target.value)}
            placeholder="Pega aquí la propuesta de programa o política pública que quieres contrastar con las voces de la comunidad cartagenera…"
            rows={6}
            style={{
              width: "100%",
              fontSize: 18,
              fontFamily: "inherit",
              fontWeight: 300,
              lineHeight: 1.6,
              border: "1.5px solid var(--dc-border)",
              background: "transparent",
              color: "var(--dc-ink)",
              padding: "16px 20px",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
            disabled={fase === "procesando"}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button
              onClick={iniciar}
              disabled={fase === "procesando" || !propuesta.trim()}
              style={{
                padding: "12px 28px",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: fase === "procesando" || !propuesta.trim() ? "not-allowed" : "pointer",
                background: "var(--dc-ink)",
                color: "#fff",
                border: "none",
                opacity: fase === "procesando" || !propuesta.trim() ? 0.4 : 1,
              }}
            >
              Contrastar
            </button>
            <button
              onClick={limpiar}
              style={{
                padding: "12px 20px",
                fontSize: 16,
                fontFamily: "inherit",
                cursor: "pointer",
                background: "transparent",
                color: "var(--dc-muted)",
                border: "1.5px solid var(--dc-border)",
              }}
            >
              Limpiar
            </button>
          </div>

          {/* Log de carga */}
          {fase === "procesando" && (
            <div style={{ marginTop: 32, borderTop: "1px solid var(--dc-border)", paddingTop: 24 }}>
              {PASOS.map((paso, i) => (
                <div key={paso} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", opacity: i > pasoActivo ? 0.3 : 1 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: i === pasoActivo ? "var(--dc-ink)" : "var(--dc-border)", flexShrink: 0, animation: i === pasoActivo ? "pulse 1.4s infinite" : "none" }} />
                  <span style={{ fontSize: 15, color: i === pasoActivo ? "var(--dc-ink)" : "var(--dc-muted)", fontWeight: i === pasoActivo ? 500 : 400 }}>{paso}</span>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {fase === "error" && (
            <div style={{ marginTop: 24, padding: "16px 20px", border: "1.5px solid var(--dc-ochre)", color: "var(--dc-ochre)", fontSize: 15 }}>
              {errorMsg}
            </div>
          )}

          {/* Resultados */}
          {dims.length > 0 && (
            <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 24 }}>
              {dims.map((d) => <DimensionCard key={d.nombre} dim={d} />)}
            </div>
          )}
        </div>

        {/* Panel derecho — 1/3 (leyenda) */}
        <div style={{ flex: 1, flexShrink: 0, maxWidth: 280, position: "sticky", top: 24 }}>
          <div style={{ borderTop: "2px solid var(--dc-border)", paddingTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
              Marcas posibles
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {LEYENDA.map(({ marca, simbolo, desc }) => (
                <div key={marca}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, color: COLOR_MARCA_TEXT[marca], fontWeight: 700 }}>{simbolo}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLOR_MARCA_TEXT[marca], textTransform: "capitalize" }}>
                      {marca.replace("_", " ")}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--dc-muted)", lineHeight: 1.5, margin: 0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32, borderTop: "1px solid var(--dc-border)", paddingTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              4 dimensiones
            </div>
            {(["poblacion_objetivo", "tipo_intervencion", "duracion_horizonte", "resultado_esperado"] as NombreDimension[]).map((n) => (
              <div key={n} style={{ fontSize: 13, color: "var(--dc-muted)", padding: "4px 0", borderBottom: "1px solid var(--dc-border)" }}>
                {ETIQUETAS_DIMENSION[n]}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }
      `}</style>
    </div>
  )
}
