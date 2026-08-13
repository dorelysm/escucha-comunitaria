import type { TipoProcedencia } from "@/types/dominio"

const CONFIG: Record<TipoProcedencia, { label: string; glifo: string; chipStyle: React.CSSProperties; barStyle: React.CSSProperties }> = {
  testimonio: {
    label: "Testimonio",
    glifo: "■",
    chipStyle: { background: "var(--dc-ink)", color: "#fff", border: "1.5px solid var(--dc-ink)" },
    barStyle: { background: "var(--dc-ink)" },
  },
  publica: {
    label: "Público",
    glifo: "□",
    chipStyle: { background: "transparent", color: "var(--dc-blue)", border: "1.5px solid var(--dc-blue)" },
    barStyle: {
      backgroundImage: "repeating-linear-gradient(135deg, var(--dc-blue) 0px, var(--dc-blue) 3px, transparent 3px, transparent 7px)",
    },
  },
  sintetica: {
    label: "Sintético",
    glifo: "⋯",
    chipStyle: { background: "transparent", color: "var(--dc-grey)", border: "1.5px dashed var(--dc-grey)", fontStyle: "italic" },
    barStyle: {
      backgroundImage: "repeating-linear-gradient(to bottom, var(--dc-grey) 0px, var(--dc-grey) 3px, transparent 3px, transparent 6px)",
    },
  },
}

export function ChipTipo({ tipo }: { tipo: TipoProcedencia }) {
  const c = CONFIG[tipo]
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 500, padding: "2px 8px", ...c.chipStyle }}>
      <span style={{ fontSize: 10 }}>{c.glifo}</span>
      {c.label}
    </span>
  )
}

export function BarraTipo({ tipo }: { tipo: TipoProcedencia }) {
  const c = CONFIG[tipo]
  return (
    <span
      style={{
        display: "inline-block",
        width: 4,
        alignSelf: "stretch",
        minHeight: 40,
        flexShrink: 0,
        ...c.barStyle,
      }}
    />
  )
}
