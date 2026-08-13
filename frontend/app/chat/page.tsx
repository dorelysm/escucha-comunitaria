"use client"

import { useRef, useState } from "react"

export default function ChatPage() {
  const [pregunta, setPregunta] = useState("")
  const [respuesta, setRespuesta] = useState("")
  const [refs, setRefs] = useState<string[]>([])
  const [cargando, setCargando] = useState(false)
  const [refsAbiertas, setRefsAbiertas] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function preguntar() {
    if (!pregunta.trim() || cargando) return
    setCargando(true)
    setRespuesta("")
    setRefs([])
    setRefsAbiertas(false)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta }),
      })
      if (!res.body) throw new Error("Sin respuesta")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const refsIdx = buffer.indexOf("__REFS__")
        if (refsIdx !== -1) {
          const textoLimpio = buffer.slice(0, refsIdx)
          const refsJson = buffer.slice(refsIdx + 8)
          setRespuesta(textoLimpio.trim())
          try { setRefs(JSON.parse(refsJson)) } catch { /* noop */ }
          break
        }
        setRespuesta(buffer)
      }
    } catch (err) {
      setRespuesta(`[Error: ${err instanceof Error ? err.message : "Error interno"}]`)
    } finally {
      setCargando(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) preguntar()
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "48px 32px" }}>
      <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 8 }}>Consulta el corpus</h1>
      <p style={{ fontSize: 16, color: "var(--dc-muted)", marginBottom: 32, maxWidth: "60ch" }}>
        Haz una pregunta sobre las necesidades de la comunidad en Cartagena. Las respuestas citan
        únicamente fuentes del corpus: actas institucionales, encuesta de percepción y testimonios.
      </p>

      {/* Input */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          ref={textareaRef}
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ej: ¿Qué problemas mencionan los jóvenes de Cartagena?"
          rows={3}
          style={{
            width: "100%",
            fontSize: 16,
            fontFamily: "inherit",
            padding: "12px 16px",
            border: "1.5px solid var(--dc-border)",
            background: "transparent",
            color: "var(--dc-ink)",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button
            onClick={preguntar}
            disabled={cargando || !pregunta.trim()}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: cargando || !pregunta.trim() ? "not-allowed" : "pointer",
              border: "none",
              background: cargando || !pregunta.trim() ? "var(--dc-border)" : "var(--dc-ink)",
              color: cargando || !pregunta.trim() ? "var(--dc-muted)" : "#fff",
            }}
          >
            {cargando ? "Consultando…" : "Preguntar"}
          </button>
          <span style={{ fontSize: 12, color: "var(--dc-muted)" }}>Ctrl+Enter para enviar</span>
        </div>
      </div>

      {/* Respuesta */}
      {!respuesta && !cargando && (
        <div style={{
          border: "1.5px dashed var(--dc-border)",
          padding: "48px 32px",
          textAlign: "center",
          color: "var(--dc-muted)",
          fontSize: 15,
        }}>
          La respuesta aparecerá aquí, con citas de las fuentes del corpus.
        </div>
      )}

      {(respuesta || cargando) && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            fontSize: 16,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            borderLeft: "4px solid var(--dc-border)",
            paddingLeft: 20,
            color: "var(--dc-ink)",
          }}>
            {respuesta}
            {cargando && <span style={{ opacity: 0.4, animation: "pulse 1s infinite" }}>▌</span>}
          </div>

          {/* Fuentes consultadas */}
          {refs.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setRefsAbiertas(!refsAbiertas)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--dc-muted)",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {refsAbiertas ? "▾" : "▸"} Fuentes consultadas ({refs.length})
              </button>
              {refsAbiertas && (
                <ul style={{ marginTop: 8, paddingLeft: 16, listStyle: "none" }}>
                  {refs.map((r) => (
                    <li key={r} style={{
                      fontSize: 12,
                      color: "var(--dc-muted)",
                      fontFamily: "monospace",
                      padding: "4px 0",
                      borderBottom: "1px solid var(--dc-border)",
                    }}>
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
