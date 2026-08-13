import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Publishable key (reemplaza a la anon key en proyectos nuevos); se acepta la
// anon key como fallback por compatibilidad. Respeta RLS: los testimonios solo
// se exponen con consentimiento = true.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ver frontend/.env.example)");
}

export const supabase = createClient(url, key);
