import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { VoyageAIClient } from "voyageai"
import { getSupabaseAnon } from "@/lib/supabase"
import { calcularFuerza } from "@/lib/fuerza"
import type { NombreDimension, Cita, Marca } from "@/types/dominio"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })

const MODELO = process.env.ANTHROPIC_FALLBACK_MODEL ?? "claude-haiku-4-5"

async function completar(system: string, user: string): Promise<string> {
  // Intentar LLM local si está configurado
  const endpoint = process.env.LLM_LOCAL_ENDPOINT?.trim()
  if (endpoint) {
    try {
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer lm-studio" },
        body: JSON.stringify({
          model: process.env.LLM_LOCAL_MODEL ?? "google/gemma-4-12b-qat",
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          max_tokens: 1024,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const json = await res.json()
        return json.choices[0].message.content.trim()
      }
    } catch {
      // fall through to Anthropic
    }
  }
  const msg = await anthropic.messages.create({
    model: MODELO,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  })
  return (msg.content[0] as { text: string }).text.trim()
}

function parsearJSON(texto: string) {
  const texto2 = texto.trim()
  const m = texto2.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
  return JSON.parse(m ? m[1] : texto2)
}

const NORMALIZACION = `Recibes un fragmento sobre necesidades de una persona de la comunidad, que puede venir \
de un documento institucional o del habla cotidiana de esa persona.

Escribe en una o dos oraciones la necesidad o afirmación de fondo, en registro neutro \
y descriptivo: sin jerga institucional y sin coloquialismos.

No añadas información ausente. No interpretes causas ni intenciones. \
Devuelve solo el texto normalizado.`

const DESCOMPOSICION = `Recibes la descripción de un programa de política pública dirigido a la comunidad.

Extrae cuatro dimensiones: población objetivo, tipo de intervención, duración y \
horizonte de efecto, resultado esperado.

Para cada una, escribe un enunciado breve en registro neutro y descriptivo. Si la propuesta no especifica una dimensión, escribe null.

Devuelve JSON con las claves poblacion_objetivo, tipo_intervencion, duracion_horizonte, resultado_esperado.`

const EVALUACION = `Recibes el enunciado de una dimensión de una propuesta y un conjunto de fragmentos \
recuperados de testimonios y documentos.

Determina si los fragmentos respaldan la dimensión, no dicen nada al respecto, o \
apuntan en dirección distinta.

Responde con una de tres marcas: respaldada, no_respaldada, tensionada.

Reglas: no uses conocimiento externo, solo los fragmentos entregados; si los \
fragmentos tratan un tema distinto aunque suenen parecido, la marca es no_respaldada; \
declarar un vacío es un resultado válido y preferible a forzar una lectura; en \
justificacion, una o dos oraciones sin afirmar nada que no esté en los fragmentos.

Devuelve JSON con marca, justificacion e ids_citas (los identificadores de los \
fragmentos que sostienen la marca).`

async function buscarUnidades(vector: number[], limite = 8): Promise<Cita[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseAnon() as any).rpc("match_unidades", {
    query_embedding: vector,
    match_count: limite,
  })

  if (error || !data) return []

  return (data as Array<{
    id: string
    texto_literal: string
    fuente_id: string
    referencia: string
  }>).map((r) => ({
    id: r.id,
    texto_literal: r.texto_literal,
    texto_normalizado: r.texto_literal,
    fuente_id: r.fuente_id,
    referencia: r.referencia,
  }))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const propuesta: string = body.propuesta ?? ""
  if (!propuesta.trim()) {
    return new Response(JSON.stringify({ tipo: "error", mensaje: "Propuesta vacía" }) + "\n", {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson" },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
      }

      try {
        // 1. Normalizar propuesta
        const normalizada = await completar(NORMALIZACION, propuesta)

        // 2. Descomponer en 4 dimensiones
        const descomposicion = parsearJSON(await completar(DESCOMPOSICION, normalizada)) as Record<string, string | null>

        const orden: NombreDimension[] = [
          "poblacion_objetivo",
          "tipo_intervencion",
          "duracion_horizonte",
          "resultado_esperado",
        ]

        for (const nombre of orden) {
          const enunciado = descomposicion[nombre] ?? null

          if (!enunciado) {
            emit({ tipo: "dimension", nombre, enunciado: null, marca: null, justificacion: null, citas: [], fuerza: "insuficiente" })
            continue
          }

          // 3. Embeber y recuperar fragmentos
          const embResult = await voyage.embed({ input: [enunciado], model: "voyage-4", inputType: "query" })
          const vector = embResult.data?.[0]?.embedding as number[]
          const citas = await buscarUnidades(vector)

          // 4. Evaluar dimensión con LLM
          const citasTexto = citas.map((c, i) => `[${c.id}] ${c.texto_normalizado}`).join("\n")
          const evaluacionRaw = await completar(
            EVALUACION,
            `Dimensión: ${enunciado}\n\nFragmentos:\n${citasTexto || "(sin fragmentos recuperados)"}`
          )
          let evaluacion: { marca: Marca; justificacion: string; ids_citas: string[] }
          try {
            evaluacion = parsearJSON(evaluacionRaw)
          } catch {
            evaluacion = { marca: "no_respaldada", justificacion: evaluacionRaw.slice(0, 200), ids_citas: [] }
          }

          const citasRelevantes = citas.filter((c) => (evaluacion.ids_citas ?? []).includes(c.id))
          const nFuentes = new Set(citasRelevantes.map((c) => c.fuente_id)).size

          emit({
            tipo: "dimension",
            nombre,
            enunciado,
            marca: evaluacion.marca,
            justificacion: evaluacion.justificacion,
            citas: citasRelevantes,
            fuerza: calcularFuerza(nFuentes),
          })
        }

        emit({ tipo: "fin", total_dimensiones: 4 })
      } catch (err) {
        emit({ tipo: "error", mensaje: err instanceof Error ? err.message : "Error interno" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "X-Content-Type-Options": "nosniff" },
  })
}
