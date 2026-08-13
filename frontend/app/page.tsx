import Link from "next/link"
import { getSupabaseAnon } from "@/lib/supabase"

async function getMeta() {
  try {
    const sb = getSupabaseAnon()
    const [fuentes, unidades, porProcedencia] = await Promise.all([
      sb.from("fuentes").select("*", { count: "exact", head: true }),
      sb.from("unidades").select("*", { count: "exact", head: true }),
      sb.from("fuentes").select("tipo_procedencia"),
    ])
    const por_procedencia: Record<string, number> = {}
    for (const f of porProcedencia.data ?? []) {
      const t = (f as { tipo_procedencia: string }).tipo_procedencia ?? "desconocido"
      por_procedencia[t] = (por_procedencia[t] ?? 0) + 1
    }
    return {
      total_fuentes: fuentes.count ?? 0,
      total_unidades: unidades.count ?? 0,
      por_procedencia,
    }
  } catch {
    return null
  }
}

const TIPO_CONFIG: Record<string, { glifo: string; label: string; color: string }> = {
  testimonio: { glifo: "■", label: "Testimonios directos", color: "var(--dc-ink)" },
  publica:    { glifo: "□", label: "Documentos públicos",  color: "var(--dc-blue)" },
  sintetica:  { glifo: "⋯", label: "Síntesis temática",   color: "var(--dc-grey)" },
}

export default async function HomePage() {
  const meta = await getMeta()
  const totalFuentes = meta?.total_fuentes ?? 0
  const totalUnidades = meta?.total_unidades ?? 0

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px 32px" }}>

      {/* Hero */}
      <div style={{ marginBottom: 64 }}>
        <h1 style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.0, maxWidth: "20ch", marginBottom: 24, letterSpacing: -2 }}>
          Lo que la comunidad ya dijo
        </h1>
        <p style={{ fontSize: 26, fontWeight: 300, maxWidth: "46ch", lineHeight: 1.5, color: "var(--dc-muted)", marginBottom: 40 }}>
          Contrasta tu propuesta de programa social contra testimonios, actas y encuestas
          ciudadanas de Cartagena — antes de diseñar sin escuchar.
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/validar" style={{
            display: "inline-block",
            background: "var(--dc-ink)", color: "#fff",
            padding: "14px 28px", fontSize: 17, fontWeight: 600,
            textDecoration: "none",
          }}>
            Contrastar propuesta
          </Link>
          <Link href="/explorar" style={{
            display: "inline-block",
            background: "transparent", color: "var(--dc-ink)",
            border: "1.5px solid var(--dc-border)",
            padding: "14px 28px", fontSize: 17, fontWeight: 500,
            textDecoration: "none",
          }}>
            Explorar corpus
          </Link>
        </div>
      </div>

      {/* Contadores */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, marginBottom: 64, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        {[
          { n: totalUnidades.toLocaleString("es"), label: "fragmentos de voz" },
          { n: totalFuentes.toLocaleString("es"),  label: "fuentes en corpus" },
          { n: "11",     label: "territorios" },
          { n: "2023–26", label: "período" },
        ].map(({ n, label }) => (
          <div key={label} style={{ paddingRight: 24 }}>
            <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 15, color: "var(--dc-muted)", marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tipos de fuente */}
      {meta && (
        <div style={{ marginBottom: 64 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
            Composición del corpus
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {Object.entries(meta.por_procedencia).map(([tipo, count]) => {
              const cfg = TIPO_CONFIG[tipo]
              if (!cfg) return null
              return (
                <div key={tipo} style={{ borderTop: "3px solid var(--dc-border)", paddingTop: 16 }}>
                  <div style={{ fontSize: 22, marginBottom: 8, color: cfg.color }}>{cfg.glifo}</div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>{count}</div>
                  <div style={{ fontSize: 15, color: "var(--dc-muted)", marginTop: 4 }}>{cfg.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cómo funciona */}
      <div style={{ borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
          Cómo funciona
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {[
            { n: "01", texto: "Escribes o pegas una propuesta de programa social." },
            { n: "02", texto: "El sistema la descompone en 4 dimensiones: población, intervención, duración, resultado." },
            { n: "03", texto: "Cada dimensión se contrasta con el corpus y recibe una marca: respaldada, tensionada o sin datos." },
          ].map(({ n, texto }) => (
            <div key={n}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--dc-border)", marginBottom: 12 }}>{n}</div>
              <div style={{ fontSize: 16, lineHeight: 1.6, color: "var(--dc-muted)" }}>{texto}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
