import Link from "next/link"
import { getSupabaseAnon } from "@/lib/supabase"

/**
 * Los conteos se piden con head:true para que Supabase devuelva solo el total.
 * Traer las filas y contarlas en memoria toparía con el límite de 1000 filas
 * y perdería categorías enteras (los 7 testimonios quedaban fuera).
 */
async function getMeta() {
  try {
    const sb = getSupabaseAnon()
    const contar = (tabla: string) => sb.from(tabla).select("*", { count: "exact", head: true })

    // tipo_procedencia por sí solo no separa la encuesta de las actas —
    // ambas son 'publica'. La columna 'corpus' es la que distingue.
    const fuentesDe = (col: string, val: string) =>
      sb.from("fuentes").select("*", { count: "exact", head: true }).eq(col, val)
    const unidadesDe = (col: string, val: string) =>
      sb.from("unidades")
        .select("*, fuentes!inner(corpus, tipo_procedencia)", { count: "exact", head: true })
        .eq(`fuentes.${col}`, val)

    const [
      fuentes, unidades, clusters,
      fInstitucional, uInstitucional,
      fTestimonio, uTestimonio,
      fTotalPublica, uTotalPublica,
    ] = await Promise.all([
      contar("fuentes"), contar("unidades"), contar("clusters"),
      fuentesDe("corpus", "institucional"),      unidadesDe("corpus", "institucional"),
      fuentesDe("tipo_procedencia", "testimonio"), unidadesDe("tipo_procedencia", "testimonio"),
      fuentesDe("tipo_procedencia", "publica"),  unidadesDe("tipo_procedencia", "publica"),
    ])

    // La encuesta es lo público que no es institucional.
    const fEncuesta = (fTotalPublica.count ?? 0) - (fInstitucional.count ?? 0)
    const uEncuesta = (uTotalPublica.count ?? 0) - (uInstitucional.count ?? 0)

    return {
      total_fuentes:  fuentes.count ?? 0,
      total_unidades: unidades.count ?? 0,
      total_clusters: clusters.count ?? 0,
      categorias: [
        { clave: "encuesta",    fuentes: fEncuesta,                  unidades: uEncuesta },
        { clave: "actas",       fuentes: fInstitucional.count ?? 0,  unidades: uInstitucional.count ?? 0 },
        { clave: "testimonios", fuentes: fTestimonio.count ?? 0,     unidades: uTestimonio.count ?? 0 },
      ],
    }
  } catch {
    return null
  }
}

const CATEGORIA_CONFIG: Record<string, { glifo: string; label: string; lugar: string; desc: string; color: string }> = {
  encuesta: {
    glifo: "⋯",
    label: "Encuesta ciudadana",
    lugar: "Cartagena",
    desc: "Respuestas abiertas de la Encuesta de Percepción Ciudadana 2026. La voz estadística del territorio.",
    color: "var(--dc-grey)",
  },
  actas: {
    glifo: "□",
    label: "Actas de mesas sectoriales",
    lugar: "Puerto Colombia",
    desc: "Participación ciudadana institucionalizada que quedó archivada en PDF y nadie volvió a consultar.",
    color: "var(--dc-blue)",
  },
  testimonios: {
    glifo: "■",
    label: "Testimonios directos",
    lugar: "Cartagena",
    desc: "Grabados en campo y transcritos con Whisper. Solo visibles con consentimiento explícito registrado.",
    color: "var(--dc-ink)",
  },
}

const HERRAMIENTAS = [
  {
    href: "/validar",
    glifo: "⇄",
    nombre: "Contrastar propuesta",
    desc: "Pega cualquier propuesta de programa social. El sistema la descompone en cuatro dimensiones —población, intervención, duración, resultado— y contrasta cada una contra el corpus con citas literales.",
    color: "var(--dc-ochre)",
  },
  {
    href: "/explorar",
    glifo: "◈",
    nombre: "Explorar temas",
    desc: "Los temas que emergen del corpus sin que nadie los definiera de antemano, ordenados por volumen de evidencia y con su distribución por tipo de fuente.",
    color: "var(--dc-blue)",
  },
  {
    href: "/chat",
    glifo: "◻",
    nombre: "Consultar en conversación",
    desc: "Pregunta en lenguaje natural. El sistema recupera los fragmentos más relevantes del corpus y responde citando cada fuente. Filtrable por municipio.",
    color: "var(--dc-green)",
  },
]

const PIPELINE = [
  {
    n: "01",
    tec: "Whisper",
    titulo: "Transcripción de campo",
    desc: "Los testimonios grabados en audio se transcriben automáticamente. Horas de trabajo manual se vuelven segundos.",
  },
  {
    n: "02",
    tec: "Gemma 4 12B · Claude Haiku",
    titulo: "Segmentación y normalización",
    desc: "Cada documento se parte en unidades temáticas mínimas. Modelo local primero, API como respaldo.",
  },
  {
    n: "03",
    tec: "Voyage voyage-4",
    titulo: "Indexación semántica",
    desc: "Cada fragmento se convierte en un vector de 1024 dimensiones. Búsqueda por significado, no por palabra clave.",
  },
  {
    n: "04",
    tec: "BERTopic · UMAP · HDBSCAN",
    titulo: "Descubrimiento de temas",
    desc: "Los fragmentos se agrupan por proximidad semántica. Ningún tema fue definido de antemano.",
  },
]

const ETIQUETA_SECCION: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--dc-muted)",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 20,
}

export default async function HomePage() {
  const meta = await getMeta()
  const totalFuentes = meta?.total_fuentes ?? 0
  const totalUnidades = meta?.total_unidades ?? 0
  const totalClusters = meta?.total_clusters ?? 0
  const totalActas = meta?.categorias.find((c) => c.clave === "actas")?.fuentes ?? 0

  return (
    <div className="home" style={{ maxWidth: 960, margin: "0 auto", padding: "64px 32px" }}>

      {/* Las grillas son de columna fija en desktop; estas reglas las
          colapsan en pantallas angostas para que el cuerpo no scrollee lateral. */}
      <style>{`
        .home h1 { font-size: clamp(40px, 9vw, 76px); }
        .home h2 { font-size: clamp(28px, 6vw, 44px); }
        .stat-n { font-size: clamp(30px, 6.5vw, 48px); }
        .g-4 { display: grid; grid-template-columns: repeat(4, 1fr); }
        .g-3 { display: grid; grid-template-columns: repeat(3, 1fr); }
        .g-2 { display: grid; grid-template-columns: 1.1fr 1fr; }
        @media (max-width: 900px) {
          .g-4 { grid-template-columns: repeat(2, 1fr); row-gap: 28px; }
          .g-2 { grid-template-columns: 1fr; row-gap: 32px; }
        }
        @media (max-width: 700px) {
          .home { padding: 40px 20px !important; }
          .g-3 { grid-template-columns: 1fr; row-gap: 28px; }
        }
      `}</style>

      {/* ── Hero ─────────────────────────────────────── */}
      <div style={{ marginBottom: 64 }}>
        <h1 style={{ fontWeight: 700, lineHeight: 1.0, maxWidth: "20ch", marginBottom: 24, letterSpacing: -2, textWrap: "balance" }}>
          Lo que la comunidad ya dijo
        </h1>
        <p style={{ fontSize: 26, fontWeight: 300, maxWidth: "46ch", lineHeight: 1.5, color: "var(--dc-muted)", marginBottom: 40 }}>
          Contrasta tu propuesta de programa social contra testimonios, actas y encuestas
          ciudadanas de Cartagena — antes de diseñar sin escuchar.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
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

      {/* ── Contadores ───────────────────────────────── */}
      <div className="g-4" style={{ gap: 2, marginBottom: 80, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        {[
          { n: totalUnidades.toLocaleString("es"), label: "fragmentos de voz" },
          { n: totalFuentes.toLocaleString("es"),  label: "fuentes en corpus" },
          { n: totalClusters.toLocaleString("es"), label: "temas emergentes" },
          { n: "2023–26", label: "período" },
        ].map(({ n, label }) => (
          <div key={label} style={{ paddingRight: 24 }}>
            <div className="stat-n" style={{ fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
            <div style={{ fontSize: 15, color: "var(--dc-muted)", marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── El problema ──────────────────────────────── */}
      <div style={{ marginBottom: 80, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        <div style={ETIQUETA_SECCION}>El problema</div>
        <div className="g-2" style={{ gap: 56, alignItems: "start" }}>
          <div>
            <h2 style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, marginBottom: 20 }}>
              Las voces existen.<br />Nadie las consulta.
            </h2>
            <p style={{ fontSize: 17, color: "var(--dc-muted)", lineHeight: 1.7 }}>
              Mesas sectoriales, encuestas de percepción, testimonios de campo. Decenas de documentos
              que describen con precisión qué necesita la comunidad. Ninguno se cruza sistemáticamente
              con las propuestas de intervención que llegan al escritorio de quien formula la política.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {[
              { n: "23%", desc: "Desempleo juvenil en Cartagena · DANE, abril–junio 2026" },
              { n: totalActas.toLocaleString("es"), desc: "Actas de mesas sectoriales que nunca se cruzaron con una propuesta de programa" },
              { n: "0", desc: "Herramientas que permitan contrastar una propuesta contra estas fuentes en tiempo real" },
            ].map(({ n, desc }, i, arr) => (
              <div key={n + desc} style={{
                paddingBottom: i < arr.length - 1 ? 28 : 0,
                borderBottom: i < arr.length - 1 ? "1px solid var(--dc-border)" : "none",
              }}>
                <div className="stat-n" style={{ fontWeight: 700, lineHeight: 1, color: "var(--dc-ochre)", fontVariantNumeric: "tabular-nums" }}>{n}</div>
                <div style={{ fontSize: 15, color: "var(--dc-muted)", marginTop: 8, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tres formas de consultar ─────────────────── */}
      <div style={{ marginBottom: 80, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        <div style={ETIQUETA_SECCION}>Tres formas de consultar el corpus</div>
        <div className="g-3" style={{ gap: 32 }}>
          {HERRAMIENTAS.map(({ href, glifo, nombre, desc, color }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                borderTop: `3px solid ${color}`,
                paddingTop: 16,
              }}
            >
              <div style={{ fontSize: 24, color, marginBottom: 10, lineHeight: 1 }}>{glifo}</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, lineHeight: 1.25 }}>{nombre}</div>
              <p style={{ fontSize: 15, color: "var(--dc-muted)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color }}>Abrir →</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Composición del corpus ───────────────────── */}
      {meta && (
        <div style={{ marginBottom: 80, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
          <div style={ETIQUETA_SECCION}>Composición del corpus</div>
          <div className="g-3" style={{ gap: 32 }}>
            {meta.categorias.map(({ clave, fuentes, unidades }) => {
              const cfg = CATEGORIA_CONFIG[clave]
              if (!cfg || fuentes <= 0) return null
              return (
                <div key={clave} style={{ borderTop: `3px solid ${cfg.color}`, paddingTop: 16 }}>
                  <div style={{ fontSize: 22, marginBottom: 8, color: cfg.color, lineHeight: 1 }}>{cfg.glifo}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {unidades.toLocaleString("es")}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--dc-muted)", marginTop: 4 }}>
                    fragmentos · {fuentes.toLocaleString("es")} {fuentes === 1 ? "fuente" : "fuentes"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12, lineHeight: 1.3 }}>{cfg.label}</div>
                  <div style={{ fontSize: 13, color: cfg.color, fontWeight: 500, marginTop: 2 }}>{cfg.lugar}</div>
                  <p style={{ fontSize: 14, color: "var(--dc-muted)", lineHeight: 1.6, marginTop: 8 }}>{cfg.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Dónde aporta la IA ───────────────────────── */}
      <div style={{ marginBottom: 80, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        <div style={ETIQUETA_SECCION}>Dónde aporta la inteligencia artificial</div>
        <p style={{ fontSize: 20, fontWeight: 300, color: "var(--dc-muted)", lineHeight: 1.6, maxWidth: "58ch", marginBottom: 32 }}>
          Cuatro pasos convierten documentos dispersos en un corpus consultable. La IA hace el trabajo
          de volumen; las conclusiones siempre remiten a una cita literal.
        </p>
        <div className="g-4" style={{ gap: 28 }}>
          {PIPELINE.map(({ n, tec, titulo, desc }) => (
            <div key={n} style={{ borderTop: "1px solid var(--dc-border)", paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--dc-border)", letterSpacing: 1, marginBottom: 12 }}>{n}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dc-blue)", marginBottom: 8, lineHeight: 1.4 }}>{tec}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>{titulo}</div>
              <p style={{ fontSize: 14, color: "var(--dc-muted)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cómo se lee un resultado ─────────────────── */}
      <div style={{ marginBottom: 80, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        <div style={ETIQUETA_SECCION}>Cómo se lee un resultado</div>
        <div className="g-3" style={{ gap: 32 }}>
          {[
            { sim: "✓", marca: "Respaldada", color: "var(--dc-green)", desc: "El corpus contiene fragmentos que coinciden con esta dimensión de la propuesta." },
            { sim: "⇄", marca: "Tensionada", color: "var(--dc-ochre)", desc: "Hay voces comunitarias que apuntan en dirección distinta a lo que propone el programa." },
            { sim: "◻", marca: "Sin datos", color: "var(--dc-grey)", desc: "El corpus no contiene voces sobre esta dimensión. Declarar un vacío es un resultado válido, no un error." },
          ].map(({ sim, marca, color, desc }) => (
            <div key={marca} style={{ borderTop: `3px solid ${color}`, paddingTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color }}>{sim}</span>
                <span style={{ fontSize: 18, fontWeight: 600, color }}>{marca}</span>
              </div>
              <p style={{ fontSize: 15, color: "var(--dc-muted)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Consentimiento ───────────────────────────── */}
      <div style={{ marginBottom: 80, borderTop: "1px solid var(--dc-border)", paddingTop: 32 }}>
        <div style={ETIQUETA_SECCION}>Consentimiento</div>
        <div className="g-2" style={{ gap: 56, alignItems: "start" }}>
          <div>
            <h2 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 16 }}>
              Ningún testimonio se publica sin permiso explícito
            </h2>
            <p style={{ fontSize: 17, color: "var(--dc-muted)", lineHeight: 1.7 }}>
              El consentimiento nunca se infiere ni se completa con un modelo. Un testimonio sin
              consentimiento registrado se ingesta marcado como privado y queda excluido de toda
              exposición pública. La regla se aplica en la capa de datos, no a criterio de quien opera
              la herramienta.
            </p>
          </div>
          <div style={{ borderLeft: "3px solid var(--dc-border)", paddingLeft: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Por defecto, privado</div>
              <p style={{ fontSize: 14, color: "var(--dc-muted)", lineHeight: 1.6, margin: 0 }}>
                Solo una confirmación humana explícita puede hacer público un testimonio.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Protocolo con menores</div>
              <p style={{ fontSize: 14, color: "var(--dc-muted)", lineHeight: 1.6, margin: 0 }}>
                Se requiere el consentimiento del acudiente además del asentimiento del menor. Sin
                acudiente presente o disponible, no se recoge el testimonio.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cierre ───────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--dc-border)", paddingTop: 40 }}>
        <h2 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, maxWidth: "22ch", marginBottom: 16 }}>
          Escuchar primero cuesta menos que corregir después
        </h2>
        <p style={{ fontSize: 18, fontWeight: 300, color: "var(--dc-muted)", lineHeight: 1.6, maxWidth: "52ch", marginBottom: 28 }}>
          Contrasta cualquier propuesta contra {totalUnidades.toLocaleString("es")} fragmentos de voz
          ciudadana en segundos — con la cita literal de dónde salió cada conclusión.
        </p>
        <Link href="/validar" style={{
          display: "inline-block",
          background: "var(--dc-ink)", color: "#fff",
          padding: "14px 28px", fontSize: 17, fontWeight: 600,
          textDecoration: "none",
        }}>
          Contrastar una propuesta
        </Link>
      </div>

    </div>
  )
}
