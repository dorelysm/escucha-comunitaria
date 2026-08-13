import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAnon } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const municipio = searchParams.get("municipio")

  const { data: clusters, error } = await getSupabaseAnon()
    .from("clusters")
    .select("id, etiqueta, descripcion")
    .order("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const resultado = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clusters ?? []).map(async (c: any) => {
      const { data: unidades } = await getSupabaseAnon()
        .from("unidades")
        .select("id, texto_literal, fuente_id, fuentes(referencia, titulo)")
        .eq("cluster_id", c.id)
        .limit(50)

      const us = (unidades ?? []) as unknown[]

      return {
        ...c,
        n_unidades: us.length,
        unidades: us,
      }
    })
  )

  return NextResponse.json({ clusters: resultado })
}
