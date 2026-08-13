import type { FuerzaEvidencia } from "@/types/dominio"

export function calcularFuerza(nFuentesDistintas: number): FuerzaEvidencia {
  if (nFuentesDistintas === 0) return "insuficiente"
  if (nFuentesDistintas < 3) return "baja"
  if (nFuentesDistintas < 6) return "media"
  return "alta"
}

export function esMuestraInsuficiente(n: number): boolean {
  return n < 3
}

export const COLOR_MARCA: Record<string, string> = {
  respaldada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  no_respaldada: "bg-slate-100 text-slate-600 border-slate-200",
  tensionada: "bg-amber-100 text-amber-800 border-amber-200",
}

export const COLOR_FUERZA: Record<string, string> = {
  alta: "text-emerald-700",
  media: "text-amber-700",
  baja: "text-orange-600",
  insuficiente: "text-slate-400",
}

export const ETIQUETA_MARCA: Record<string, string> = {
  respaldada: "Respaldada",
  no_respaldada: "Sin respaldo",
  tensionada: "En tensión",
}
