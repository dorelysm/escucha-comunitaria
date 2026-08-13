import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const [fuentesResp, unidadesResp] = await Promise.all([
    supabase.from("fuentes").select("tipo_procedencia, hablantes(municipio, departamento)"),
    supabase.from("unidades").select("id", { count: "exact", head: true }),
  ]);

  if (fuentesResp.error) {
    return NextResponse.json({ error: { codigo: "ERROR_INTERNO", mensaje: fuentesResp.error.message } }, { status: 500 });
  }

  const fuentes = fuentesResp.data ?? [];
  const total_fuentes = fuentes.length;
  const total_unidades = unidadesResp.count ?? 0;

  const por_procedencia: Record<string, number> = { testimonio: 0, publica: 0, sintetica: 0 };
  const territorioMap: Record<string, { municipio: string; departamento: string; n_fuentes: number; n_unidades: number }> = {};

  for (const f of fuentes) {
    por_procedencia[f.tipo_procedencia] = (por_procedencia[f.tipo_procedencia] ?? 0) + 1;

    const hablantes = Array.isArray(f.hablantes) ? f.hablantes : f.hablantes ? [f.hablantes] : [];
    for (const h of hablantes) {
      if (!h.municipio) continue;
      const key = `${h.municipio}|${h.departamento ?? ""}`;
      if (!territorioMap[key]) {
        territorioMap[key] = { municipio: h.municipio, departamento: h.departamento ?? "", n_fuentes: 0, n_unidades: 0 };
      }
      territorioMap[key].n_fuentes += 1;
    }
  }

  const por_territorio = Object.values(territorioMap).sort((a, b) => b.n_fuentes - a.n_fuentes);

  return NextResponse.json({
    total_fuentes,
    total_unidades,
    por_procedencia,
    por_territorio,
    actualizado: new Date().toISOString(),
  });
}
