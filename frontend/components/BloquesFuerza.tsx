import type { FuerzaEvidencia } from "@/types/dominio"

const FUERZA_N: Record<FuerzaEvidencia, number> = {
  alta: 5,
  media: 3,
  baja: 1,
  insuficiente: 0,
}

const FUERZA_LABEL: Record<FuerzaEvidencia, string> = {
  alta: "patrón recurrente",
  media: "señal débil",
  baja: "fuente única",
  insuficiente: "sin datos",
}

export function BloquesFuerza({ fuerza }: { fuerza: FuerzaEvidencia }) {
  const n = FUERZA_N[fuerza]
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 20,
              height: 14,
              background: i < n ? "var(--dc-ink)" : "transparent",
              border: "1px solid",
              borderColor: i < n ? "var(--dc-ink)" : "var(--dc-border)",
            }}
          />
        ))}
      </span>
      <span style={{ fontSize: 13, color: "var(--dc-muted)" }}>{FUERZA_LABEL[fuerza]}</span>
    </span>
  )
}
