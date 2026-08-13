import type { Marca } from "@/types/dominio"

const CONFIG: Record<Marca, { simbolo: string; label: string; style: React.CSSProperties; bodyStyle?: React.CSSProperties }> = {
  respaldada: {
    simbolo: "✓",
    label: "Respaldada",
    style: {
      border: "1.5px solid var(--dc-green)",
      color: "var(--dc-green)",
      background: "#fff",
    },
  },
  no_respaldada: {
    simbolo: "◻",
    label: "No respaldada",
    style: {
      border: "1.5px dashed var(--dc-grey)",
      color: "var(--dc-grey)",
      background: "#fff",
    },
  },
  tensionada: {
    simbolo: "⇄",
    label: "Tensionada",
    style: {
      border: "1.5px solid var(--dc-ochre)",
      color: "var(--dc-ochre)",
      background: "#fff",
      boxShadow: "0 0 0 3px rgba(180,82,30,0.08)",
    },
    bodyStyle: {
      backgroundImage: "repeating-linear-gradient(135deg, rgba(180,82,30,0.04) 0px, rgba(180,82,30,0.04) 1px, transparent 1px, transparent 8px)",
    },
  },
}

export function MarcaChip({ marca }: { marca: Marca }) {
  const c = CONFIG[marca]
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", fontSize: 14, fontWeight: 500, ...c.style }}>
      <span>{c.simbolo}</span>
      {c.label}
    </span>
  )
}

export function MarcaContainer({ marca, children }: { marca: Marca; children: React.ReactNode }) {
  const c = CONFIG[marca]
  return (
    <div style={{ border: c.style.border, boxShadow: c.style.boxShadow, ...c.bodyStyle }}>
      {children}
    </div>
  )
}
