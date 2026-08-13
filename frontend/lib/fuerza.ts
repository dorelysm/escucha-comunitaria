// Lógica de fuerza de evidencia — contratos_v2.md §5
// Regla única aplicada igual en validación y exploración.

import type { FuerzaEvidencia } from "@/types/dominio";

export function calcularFuerza(n_fuentes_distintas: number): FuerzaEvidencia {
  if (n_fuentes_distintas >= 4) return "recurrente";
  if (n_fuentes_distintas >= 2) return "debil";
  return "aislado";
}

export function esMuestraInsuficiente(n_fuentes_distintas: number): boolean {
  return n_fuentes_distintas < 3;
}

export const ETIQUETA_FUERZA: Record<FuerzaEvidencia, string> = {
  recurrente: "Patrón recurrente",
  debil: "Señal débil — requiere validación",
  aislado: "Testimonio aislado",
};

export const ETIQUETA_MARCA = {
  respaldada: "Respaldada",
  no_respaldada: "Sin respaldo en el corpus",
  tensionada: "Tensionada",
} as const;

export const COLOR_MARCA = {
  respaldada: "text-emerald-700 bg-emerald-50 border-emerald-200",
  no_respaldada: "text-slate-600 bg-slate-50 border-slate-200",
  tensionada: "text-amber-700 bg-amber-50 border-amber-200",
} as const;
