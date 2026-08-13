import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAnon } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo")
  const corpus = searchParams.get("corpus")
  const municipio = searchParams.get("municipio")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "env_missing", url: !!url, key: !!key }, { status: 500 })
  }

  let q = getSupabaseAnon()
    .from("fuentes")
    .select(`id, tipo_procedencia, corpus, titulo, referencia, fecha_recoleccion, consentimiento`)
    .order("id", { ascending: false })
    .limit(200)

  if (tipo) q = q.eq("tipo_procedencia", tipo)
  if (corpus) q = q.eq("corpus", corpus)

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fuentes: any[] = data ?? []

  if (municipio) {
    fuentes = fuentes.filter((f) => {
      const h = Array.isArray(f.hablantes) ? f.hablantes[0] : f.hablantes
      return h?.municipio?.toLowerCase().includes(municipio.toLowerCase())
    })
  }

  return NextResponse.json({ fuentes })
}
