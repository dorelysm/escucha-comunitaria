import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { calcularFuerza, esMuestraInsuficiente } from "@/lib/fuerza";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIMENSIONES = [
  { key: "poblacion_objetivo", etiqueta: "Población objetivo" },
  { key: "tipo_intervencion", etiqueta: "Tipo de intervención" },
  { key: "duracion_horizonte", etiqueta: "Duración y horizonte" },
  { key: "resultado_esperado", etiqueta: "Resultado esperado" },
] as const;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_FALLBACK_MODEL ?? "claude-haiku-4-5";

async function llm(system: string, user: string): Promise<string> {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  return (resp.content[0] as { text: string }).text.trim();
}

function emit(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n"));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const propuesta: string = body.propuesta ?? "";
  const territorio: { municipio?: string; departamento?: string } = body.territorio ?? {};

  if (!propuesta.trim()) {
    return new Response(JSON.stringify({ error: { codigo: "PROPUESTA_INVALIDA", mensaje: "La propuesta no puede estar vacía." } }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Normalizar propuesta
        emit(controller, { tipo: "estado", fase: "normalizando", detalle: "Normalizando propuesta" });
        const propuestaNorm = await llm(
          "Recibes la descripción de un programa de política pública. Reescríbela en registro neutro y descriptivo, sin jerga técnica ni coloquialismos. Devuelve solo el texto normalizado.",
          propuesta
        );

        // 2. Descomponer en dimensiones
        emit(controller, { tipo: "estado", fase: "descomponiendo", detalle: "Identificando dimensiones" });
        const descomposicionRaw = await llm(
          `Recibes la descripción de un programa de política pública dirigido a la comunidad.
Extrae cuatro dimensiones: población objetivo, tipo de intervención, duración y horizonte de efecto, resultado esperado.
Para cada una, escribe un enunciado breve en registro neutro y descriptivo. Si la propuesta no especifica una dimensión, escribe null.
Devuelve JSON con las claves poblacion_objetivo, tipo_intervencion, duracion_horizonte, resultado_esperado.`,
          propuestaNorm
        );

        let dimensionesEnunciados: Record<string, string | null> = {};
        try {
          dimensionesEnunciados = JSON.parse(descomposicionRaw);
        } catch {
          dimensionesEnunciados = {};
        }

        // 3. Buscar en corpus (una sola query de unidades, filtrar por territorio en memoria)
        emit(controller, { tipo: "estado", fase: "buscando", detalle: "Buscando en el corpus" });

        // Embeber propuesta normalizada via Voyage
        const voyageResp = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: [propuestaNorm], model: "voyage-4", input_type: "query" }),
        });
        const voyageData = await voyageResp.json();
        const embedding: number[] = voyageData.data?.[0]?.embedding ?? [];

        // Búsqueda vectorial en Supabase (RPC)
        const matchQuery = supabase.rpc("match_unidades", {
          query_embedding: embedding,
          match_count: 20,
        });

        const { data: matches } = await matchQuery;

        // Filtrar por territorio si se especificó
        let candidatos = matches ?? [];
        if (territorio.municipio || territorio.departamento) {
          const ids = candidatos.map((m: { id: string }) => m.id);
          if (ids.length > 0) {
            const { data: conTerritorio } = await supabase
              .from("unidades")
              .select("id, fuentes(hablantes(municipio, departamento))")
              .in("id", ids);

            const idsFiltrados = new Set(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (conTerritorio ?? []).filter((u: any) => {
                const fuente = Array.isArray(u.fuentes) ? u.fuentes[0] : u.fuentes;
                const hablante = fuente && (Array.isArray(fuente.hablantes) ? fuente.hablantes[0] : fuente.hablantes);
                if (territorio.municipio && hablante?.municipio?.toLowerCase() !== territorio.municipio.toLowerCase()) return false;
                if (territorio.departamento && hablante?.departamento?.toLowerCase() !== territorio.departamento.toLowerCase()) return false;
                return true;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }).map((u: any) => u.id)
            );
            candidatos = candidatos.filter((m: { id: string }) => idsFiltrados.has(m.id));
          }
        }

        const n_fuentes_distintas_total = new Set(candidatos.map((m: { fuente_id: string }) => m.fuente_id)).size;

        // 4. Evaluar cada dimensión
        for (const dim of DIMENSIONES) {
          const enunciado = dimensionesEnunciados[dim.key];
          emit(controller, { tipo: "estado", fase: "evaluando", detalle: `Evaluando: ${dim.etiqueta}` });

          if (!enunciado) {
            emit(controller, {
              tipo: "dimension",
              dimension: dim.key,
              etiqueta: dim.etiqueta,
              enunciado: null,
              marca: "no_respaldada",
              justificacion: "La propuesta no especifica esta dimensión.",
              evidencia: { n_unidades: 0, n_fuentes_distintas: 0, fuerza: "aislado" },
              citas: [],
              muestra_insuficiente: false,
            });
            continue;
          }

          // Top-8 para esta dimensión (ya están ordenados por similitud)
          const top = candidatos.slice(0, 8);
          const fragmentosTexto = top.map((m: { id: string; texto_literal: string }, i: number) => `[${i}] (id: ${m.id}) ${m.texto_literal}`).join("\n\n");

          const evalRaw = await llm(
            `Recibes el enunciado de una dimensión de una propuesta y un conjunto de fragmentos recuperados de testimonios y documentos.
Determina si los fragmentos respaldan la dimensión, no dicen nada al respecto, o apuntan en dirección distinta.
Responde con una de tres marcas: respaldada, no_respaldada, tensionada.
Reglas: no uses conocimiento externo, solo los fragmentos entregados; si los fragmentos tratan un tema distinto aunque suenen parecido, la marca es no_respaldada; declarar un vacío es un resultado válido y preferible a forzar una lectura; en justificacion, una o dos oraciones sin afirmar nada que no esté en los fragmentos.
Devuelve JSON con marca, justificacion e ids_citas (los identificadores de los fragmentos que sostienen la marca, como lista de strings con los ids entre paréntesis).`,
            `Dimensión: ${enunciado}\n\nFragmentos:\n${fragmentosTexto || "(sin fragmentos recuperados)"}`
          );

          let evalData: { marca: string; justificacion: string; ids_citas: string[] } = {
            marca: "no_respaldada",
            justificacion: "Sin fragmentos suficientes para evaluar.",
            ids_citas: [],
          };
          try { evalData = JSON.parse(evalRaw); } catch { /* fallback */ }

          const citasIds = new Set(evalData.ids_citas ?? []);
          const citas = top
            .filter((m: { id: string }) => citasIds.has(m.id))
            .map((m: { id: string; texto_literal: string; tipo_procedencia: string; referencia: string; municipio: string; departamento: string; rango_etario: string; situacion_ocupacional: string; similitud: number }) => ({
              unidad_id: m.id,
              texto_literal: m.texto_literal,
              tipo_procedencia: m.tipo_procedencia,
              referencia: m.referencia ?? null,
              municipio: m.municipio ?? null,
              departamento: m.departamento ?? null,
              rango_etario: m.rango_etario ?? null,
              situacion_ocupacional: m.situacion_ocupacional ?? null,
              similitud: m.similitud ?? 0,
            }));

          const n_fuentes_citas = new Set(citas.map((c: { fuente_id?: string }) => c.fuente_id).filter(Boolean)).size || citas.length;
          const fuerza = calcularFuerza(n_fuentes_citas);

          emit(controller, {
            tipo: "dimension",
            dimension: dim.key,
            etiqueta: dim.etiqueta,
            enunciado,
            marca: evalData.marca,
            justificacion: evalData.justificacion,
            evidencia: { n_unidades: citas.length, n_fuentes_distintas: n_fuentes_citas, fuerza },
            citas,
            muestra_insuficiente: esMuestraInsuficiente(n_fuentes_distintas_total),
          });
        }

        emit(controller, { tipo: "fin", n_dimensiones: DIMENSIONES.length });
      } catch (err) {
        emit(controller, { tipo: "error", mensaje: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
