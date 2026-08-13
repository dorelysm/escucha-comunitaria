import Link from "next/link";
import { supabase } from "@/lib/supabase";

async function getMeta() {
  const [fuentesRes, unidadesRes] = await Promise.all([
    supabase.from("fuentes").select("tipo_procedencia, hablantes(municipio, departamento)"),
    supabase.from("unidades").select("id", { count: "exact", head: true }),
  ]);
  return { fuentes: fuentesRes.data ?? [], totalUnidades: unidadesRes.count ?? 0 };
}

export default async function Home() {
  const { fuentes, totalUnidades } = await getMeta();

  const porTipo = fuentes.reduce((acc: Record<string, number>, f) => {
    acc[f.tipo_procedencia] = (acc[f.tipo_procedencia] ?? 0) + 1;
    return acc;
  }, {});

  const territorios = new Set(
    fuentes.flatMap((f) => {
      const hs = Array.isArray(f.hablantes) ? f.hablantes : f.hablantes ? [f.hablantes] : [];
      return hs.map((h: { municipio?: string }) => h.municipio).filter(Boolean);
    })
  );

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Herramienta de escucha comunitaria
        </h1>
        <p className="text-slate-600 text-lg mb-2">
          Las voces de la comunidad, consultables para quienes formulan política pública.
        </p>
        <p className="text-slate-500 text-sm mb-10">
          CTW Hackathon Cartagena 2026 · Track AI for Social Impact
        </p>

        {/* Contadores */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <Stat label="Fuentes" value={fuentes.length} />
          <Stat label="Fragmentos" value={totalUnidades} />
          <Stat label="Territorios" value={territorios.size} />
        </div>

        <div className="flex flex-wrap gap-2 mb-10 text-sm text-slate-500">
          {porTipo.testimonio ? <Tag>{porTipo.testimonio} testimonio{porTipo.testimonio > 1 ? "s" : ""}</Tag> : null}
          {porTipo.publica ? <Tag>{porTipo.publica} fuente{porTipo.publica > 1 ? "s" : ""} pública{porTipo.publica > 1 ? "s" : ""}</Tag> : null}
          {porTipo.sintetica ? <Tag>{porTipo.sintetica} marcador{porTipo.sintetica > 1 ? "es" : ""} sintético{porTipo.sintetica > 1 ? "s" : ""}</Tag> : null}
        </div>

        <p className="text-slate-600 mb-8 leading-relaxed">
          El corpus incluye memorias de mesas técnicas, informes públicos y testimonios
          directos de personas de la comunidad. Todo hallazgo cita su fuente literal
          y declara cuántas personas distintas lo respaldan.
        </p>

        {/* Bifurcación principal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ModeCard
            href="/validar"
            title="Validar una propuesta"
            description="Ingresá un programa en formulación y el sistema reporta, dimensión por dimensión, qué encuentras respaldo en las voces recogidas."
            accent="emerald"
          />
          <ModeCard
            href="/explorar"
            title="Explorar el corpus"
            description="Sin propuesta previa: los ejes temáticos que emergen del corpus, con su peso relativo y su distribución territorial."
            accent="blue"
          />
        </div>

        <div className="mt-6 text-center">
          <Link href="/corpus" className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
            Ver todas las fuentes →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">{children}</span>
  );
}

function ModeCard({
  href, title, description, accent,
}: {
  href: string; title: string; description: string; accent: "emerald" | "blue";
}) {
  const colors = accent === "emerald"
    ? "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50"
    : "border-blue-200 hover:border-blue-400 hover:bg-blue-50";

  return (
    <Link
      href={href}
      className={`block border-2 rounded-xl p-6 transition-colors ${colors}`}
    >
      <h2 className="font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </Link>
  );
}
