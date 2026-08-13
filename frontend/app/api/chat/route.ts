import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { VoyageAIClient } from "voyageai"
import { getSupabaseAnon } from "@/lib/supabase"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })
const MODELO = process.env.ANTHROPIC_FALLBACK_MODEL ?? "claude-haiku-4-5"

const SISTEMA = `Eres un asistente de escucha comunitaria. Respondes EXCLUSIVAMENTE con información \
del corpus de participación ciudadana de Cartagena (actas institucionales, encuesta de percepción \
y testimonios orales con consentimiento).

Cada afirmación debe ir seguida de su fuente entre corchetes: [Fuente: nombre_del_archivo].
Si el corpus no contiene información suficiente para responder, dilo explícitamente: \
"No tengo datos en el corpus sobre esto."

No uses conocimiento externo. No inventes fuentes. No interpretes más allá de lo que dicen los fragmentos.`

type Fragmento = { id: string; texto_literal: string; fuente_id: string; referencia: string }

async function buscarFragmentos(vector: number[]): Promise<Fragmento[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseAnon() as any).rpc("match_unidades", {
    query_embedding: vector,
    match_count: 8,
  })
  if (error || !data) return []
  return data as Fragmento[]
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const pregunta: string = (body.pregunta ?? "").trim()

  if (!pregunta) {
    return new Response("Pregunta vacía", { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (text: string) => controller.enqueue(encoder.encode(text))

      try {
        // 1. Embeber la pregunta
        const embResult = await voyage.embed({ input: [pregunta], model: "voyage-4", inputType: "query" })
        const vector = embResult.data?.[0]?.embedding as number[]

        // 2. Recuperar fragmentos del corpus
        const fragmentos = await buscarFragmentos(vector)

        // 3. Construir prompt con fragmentos
        let userPrompt: string
        if (fragmentos.length === 0) {
          userPrompt = `Pregunta: ${pregunta}\n\n(No se encontraron fragmentos relevantes en el corpus.)`
        } else {
          const contexto = fragmentos
            .map((f, i) => `[${i + 1}] ${f.texto_literal}\n    Fuente: ${f.referencia}`)
            .join("\n\n")
          userPrompt = `Pregunta: ${pregunta}\n\nFragmentos del corpus:\n${contexto}`
        }

        // 4. Llamar Claude con streaming
        const antropicStream = await anthropic.messages.stream({
          model: MODELO,
          max_tokens: 1024,
          system: SISTEMA,
          messages: [{ role: "user", content: userPrompt }],
        })

        for await (const chunk of antropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            emit(chunk.delta.text)
          }
        }

        // 5. Emitir referencias al final como marcador especial
        const refs = fragmentos.map((f) => f.referencia)
        emit(`\n\n__REFS__${JSON.stringify([...new Set(refs)])}`)
      } catch (err) {
        emit(`\n\n[Error: ${err instanceof Error ? err.message : "Error interno"}]`)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  })
}
