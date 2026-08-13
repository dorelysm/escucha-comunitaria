import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAnon } from "@/lib/supabase"

type TipoProcedencia = "publica" | "testimonio" | "sintetica"

export async function GET(_req: NextRequest) {
  const sb = getSupabaseAnon()

  // Query 1: todos los clusters con sus columnas reales
  const { data: clusters, error: errClusters } = await sb
    .from("clusters")
    .select("id, etiqueta, descripcion, n_unidades, n_fuentes_distintas, corpus_dominante")
    .order("n_unidades", { ascending: false })

  if (errClusters) return NextResponse.json({ error: errClusters.message }, { status: 500 })
  if (!clusters || clusters.length === 0) return NextResponse.json({ clusters: [] })

  const ids = clusters.map((c) => c.id)

  // Query 2: top 20 unidades por cluster en una sola query
  const { data: unidades } = await sb
    .from("unidades")
    .select("id, texto_literal, cluster_id, fuentes(referencia, titulo, tipo_procedencia)")
    .in("cluster_id", ids)

  // Agrupar unidades por cluster_id (primeras 20)
  const porCluster: Record<number, typeof unidades> = {}
  for (const u of unidades ?? []) {
    const cid = (u as { cluster_id: number }).cluster_id
    if (!porCluster[cid]) porCluster[cid] = []
    if (porCluster[cid]!.length < 20) porCluster[cid]!.push(u)
  }

  // Calcular distribución de tipo de fuente por cluster
  const distribucionTipo = (us: typeof unidades): Record<TipoProcedencia, number> => {
    const acc: Record<TipoProcedencia, number> = { publica: 0, testimonio: 0, sintetica: 0 }
    for (const u of us ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tipo = ((u as any).fuentes?.tipo_procedencia ?? "publica") as TipoProcedencia
      acc[tipo] = (acc[tipo] ?? 0) + 1
    }
    return acc
  }

  const resultado = clusters.map((c) => {
    const us = porCluster[c.id] ?? []
    return {
      ...c,
      por_tipo: distribucionTipo(us),
      unidades: us,
    }
  })

  return NextResponse.json({ clusters: resultado })
}
