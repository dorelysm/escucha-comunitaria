import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const municipio = searchParams.get("municipio");
  const departamento = searchParams.get("departamento");
  const tipo_procedencia = searchParams.get("tipo_procedencia");

  let query = supabase
    .from("fuentes")
    .select("id, titulo, tipo_procedencia, referencia, fecha_recoleccion, hablantes(municipio, departamento)")
    .order("fecha_recoleccion", { ascending: false });

  if (tipo_procedencia) query = query.eq("tipo_procedencia", tipo_procedencia);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: { codigo: "ERROR_INTERNO", mensaje: error.message } }, { status: 500 });
  }

  // Contar unidades por fuente y filtrar por territorio si se pide
  const fuentes = await Promise.all(
    (data ?? []).map(async (f) => {
      const hablante = Array.isArray(f.hablantes) ? f.hablantes[0] : f.hablantes;

      if (municipio && hablante?.municipio?.toLowerCase() !== municipio.toLowerCase()) return null;
      if (departamento && hablante?.departamento?.toLowerCase() !== departamento.toLowerCase()) return null;

      const { count } = await supabase
        .from("unidades")
        .select("id", { count: "exact", head: true })
        .eq("fuente_id", f.id);

      return {
        id: f.id,
        titulo: f.titulo,
        tipo_procedencia: f.tipo_procedencia,
        referencia: f.referencia,
        municipio: hablante?.municipio ?? null,
        departamento: hablante?.departamento ?? null,
        fecha_recoleccion: f.fecha_recoleccion,
        n_unidades: count ?? 0,
      };
    })
  );

  return NextResponse.json({ fuentes: fuentes.filter(Boolean) });
}
