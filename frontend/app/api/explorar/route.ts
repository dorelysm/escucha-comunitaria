import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calcularFuerza, esMuestraInsuficiente } from "@/lib/fuerza";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const municipio = searchParams.get("municipio");
  const departamento = searchParams.get("departamento");

  const { data: clusters, error } = await supabase
    .from("clusters")
    .select("id, etiqueta, descripcion, n_unidades, n_fuentes_distintas, corpus_dominante")
    .order("n_fuentes_distintas", { ascending: false });

  if (error) {
    return NextResponse.json({ error: { codigo: "ERROR_INTERNO", mensaje: error.message } }, { status: 500 });
  }

  const ejes = await Promise.all(
    (clusters ?? []).map(async (c) => {
      // Distribución territorial
      const { data: unidades } = await supabase
        .from("unidades")
        .select("fuentes(hablantes(municipio, departamento))")
        .eq("cluster_id", c.id);

      const territorioCount: Record<string, number> = {};
      const perfilCount: Record<string, number> = {};

      for (const u of unidades ?? []) {
        const fuente = Array.isArray(u.fuentes) ? u.fuentes[0] : u.fuentes;
        const hablante = fuente && (Array.isArray(fuente.hablantes) ? fuente.hablantes[0] : fuente.hablantes);
        if (hablante?.municipio) {
          if (municipio && hablante.municipio.toLowerCase() !== municipio.toLowerCase()) continue;
          if (departamento && hablante.departamento?.toLowerCase() !== departamento.toLowerCase()) continue;
          territorioCount[hablante.municipio] = (territorioCount[hablante.municipio] ?? 0) + 1;
        }
      }

      const distribucion_territorio = Object.entries(territorioCount)
        .map(([municipio, n_unidades]) => ({ municipio, n_unidades }))
        .sort((a, b) => b.n_unidades - a.n_unidades);

      if (municipio && distribucion_territorio.length === 0) return null;

      const n_fuentes = c.n_fuentes_distintas ?? 0;

      return {
        cluster_id: c.id,
        etiqueta: c.etiqueta,
        descripcion: c.descripcion,
        evidencia: {
          n_unidades: c.n_unidades,
          n_fuentes_distintas: n_fuentes,
          fuerza: calcularFuerza(n_fuentes),
        },
        corpus_dominante: c.corpus_dominante,
        distribucion_territorio,
        distribucion_perfil: Object.entries(perfilCount).map(([situacion_ocupacional, n_unidades]) => ({ situacion_ocupacional, n_unidades })),
      };
    })
  );

  const ejesFiltrados = ejes.filter(Boolean);
  const n_fuentes_total = ejesFiltrados.reduce((acc, e) => acc + (e?.evidencia.n_fuentes_distintas ?? 0), 0);

  return NextResponse.json({
    ejes: ejesFiltrados,
    muestra_insuficiente: esMuestraInsuficiente(n_fuentes_total),
  });
}
