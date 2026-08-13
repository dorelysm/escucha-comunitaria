import { NextResponse } from "next/server"
import { getSupabaseAnon } from "@/lib/supabase"

export async function GET() {
  const [fuentes, unidades, porProcedencia, porCorpus] = await Promise.all([
    getSupabaseAnon().from("fuentes").select("*", { count: "exact", head: true }),
    getSupabaseAnon().from("unidades").select("*", { count: "exact", head: true }),
    getSupabaseAnon().from("fuentes").select("tipo_procedencia"),
    getSupabaseAnon().from("fuentes").select("corpus"),
  ])

  const contarPor = (filas: { [k: string]: string }[] | null, campo: string) => {
    const acc: Record<string, number> = {}
    for (const fila of filas ?? []) {
      const v = fila[campo] ?? "desconocido"
      acc[v] = (acc[v] ?? 0) + 1
    }
    return acc
  }

  return NextResponse.json({
    total_fuentes: fuentes.count ?? 0,
    total_unidades: unidades.count ?? 0,
    por_procedencia: contarPor(porProcedencia.data as { tipo_procedencia: string }[], "tipo_procedencia"),
    por_corpus: contarPor(porCorpus.data as { corpus: string }[], "corpus"),
  })
}
