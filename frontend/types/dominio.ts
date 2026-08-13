// Tipos compartidos — contratos_v2.md §2
// Se copian a frontend/types/dominio.ts cuando el scaffold termine.

export type TipoProcedencia = "testimonio" | "publica" | "sintetica";
export type Corpus = "comunitario" | "institucional";
export type Marca = "respaldada" | "no_respaldada" | "tensionada";
export type FuerzaEvidencia = "aislado" | "debil" | "recurrente";

export interface Cita {
  unidad_id: string;
  texto_literal: string; // nunca el normalizado
  tipo_procedencia: TipoProcedencia;
  referencia: string | null;
  municipio: string | null;
  departamento: string | null;
  rango_etario: string | null;
  situacion_ocupacional: string | null;
  similitud: number; // 0..1, para ordenar; no se muestra al usuario
}

export interface Evidencia {
  n_unidades: number;
  n_fuentes_distintas: number;
  fuerza: FuerzaEvidencia;
}

export interface ResultadoDimension {
  tipo: "dimension";
  dimension: "poblacion_objetivo" | "tipo_intervencion" | "duracion_horizonte" | "resultado_esperado";
  etiqueta: string;
  enunciado: string;
  marca: Marca;
  justificacion: string;
  evidencia: Evidencia;
  citas: Cita[];
  muestra_insuficiente: boolean;
}

export interface EventoEstado {
  tipo: "estado";
  fase: "normalizando" | "descomponiendo" | "buscando" | "evaluando";
  detalle: string;
}

export interface EventoFin {
  tipo: "fin";
  n_dimensiones: number;
}

export type EventoStream = EventoEstado | ResultadoDimension | EventoFin;

// GET /api/meta
export interface MetaResponse {
  total_fuentes: number;
  total_unidades: number;
  por_procedencia: Record<TipoProcedencia, number>;
  por_territorio: Array<{
    municipio: string;
    departamento: string;
    n_fuentes: number;
    n_unidades: number;
  }>;
  actualizado: string;
}

// GET /api/explorar
export interface EjeCluster {
  cluster_id: number;
  etiqueta: string;
  descripcion: string;
  evidencia: Evidencia;
  corpus_dominante: Corpus;
  distribucion_territorio: Array<{ municipio: string; n_unidades: number }>;
  distribucion_perfil: Array<{ situacion_ocupacional: string; n_unidades: number }>;
}

export interface ExplorarResponse {
  ejes: EjeCluster[];
  muestra_insuficiente: boolean;
}

// GET /api/corpus
export interface FuenteResumen {
  id: string;
  titulo: string;
  tipo_procedencia: TipoProcedencia;
  referencia: string | null;
  municipio: string | null;
  departamento: string | null;
  fecha_recoleccion: string | null;
  n_unidades: number;
}

export interface CorpusResponse {
  fuentes: FuenteResumen[];
}
