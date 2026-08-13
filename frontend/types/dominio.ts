export type TipoProcedencia = "testimonio" | "publica" | "sintetica"
export type Corpus = "comunitario" | "institucional"
export type Marca = "respaldada" | "no_respaldada" | "tensionada"
export type FuerzaEvidencia = "alta" | "media" | "baja" | "insuficiente"

export type NombreDimension =
  | "poblacion_objetivo"
  | "tipo_intervencion"
  | "duracion_horizonte"
  | "resultado_esperado"

export const ETIQUETAS_DIMENSION: Record<NombreDimension, string> = {
  poblacion_objetivo: "Población objetivo",
  tipo_intervencion: "Tipo de intervención",
  duracion_horizonte: "Duración y horizonte",
  resultado_esperado: "Resultado esperado",
}

export interface Cita {
  id: string
  texto_literal: string
  texto_normalizado: string
  fuente_id: string
  referencia: string
}

export interface Dimension {
  nombre: NombreDimension
  enunciado: string | null
  marca: Marca | null
  justificacion: string | null
  citas: Cita[]
  fuerza: FuerzaEvidencia
}

export interface EventoDimension {
  tipo: "dimension"
  nombre: NombreDimension
  enunciado: string | null
  marca: Marca | null
  justificacion: string | null
  citas: Cita[]
  fuerza: FuerzaEvidencia
}

export interface EventoFin {
  tipo: "fin"
  total_dimensiones: number
}

export interface EventoError {
  tipo: "error"
  mensaje: string
}

export type EventoStream = EventoDimension | EventoFin | EventoError

export interface MetaStats {
  total_fuentes: number
  total_unidades: number
  por_procedencia: Record<string, number>
  por_corpus: Record<string, number>
}

export interface Fuente {
  id: string
  tipo_procedencia: TipoProcedencia
  corpus: Corpus
  titulo: string
  referencia: string
  fecha_recoleccion: string | null
  hablante?: {
    municipio: string | null
    rango_etario: string | null
    sexo: string | null
    localidad: string | null
    ocupacion: string | null
    nivel_educativo: string | null
    estrato: number | null
  }
}

export interface Cluster {
  id: number
  etiqueta: string | null
  descripcion: string | null
  n_unidades: number
  municipios: string[]
}
