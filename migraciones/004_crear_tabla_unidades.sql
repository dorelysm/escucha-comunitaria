-- Migracion: crear_tabla_unidades
-- Proyecto Supabase "escucha-comunitaria" (wnqwuamyqjllkbkjmssy)
-- DIM = 1024 (voyage-4, Matryoshka). Si la verificacion de §5.3 cambia el modelo,
-- DROP TABLE unidades + replicar con nuevo DIM — barato mientras no hay datos ingestados.

create table unidades (
  id uuid primary key default gen_random_uuid(),
  fuente_id uuid references fuentes(id) not null,
  texto_literal text not null,       -- se muestra, nunca se altera
  texto_normalizado text not null,   -- se embebe; nunca sale de la capa de datos
  orden int,
  embedding extensions.vector(1024),
  cluster_id int,
  created_at timestamptz default now()
);

create index on unidades using hnsw (embedding extensions.vector_cosine_ops);

alter table unidades enable row level security;

-- Misma regla que fuentes/hablantes: testimonios solo si consentimiento = true.
-- Se aplica en la base, no a criterio de quien opera (contratos_v2 §3.4).
create policy "lectura publica de unidades con consentimiento"
  on unidades for select
  to anon, authenticated
  using (
    exists (
      select 1 from fuentes f
      where f.id = unidades.fuente_id
        and (f.tipo_procedencia <> 'testimonio' or f.consentimiento = true)
    )
  );

-- Sin politicas de insert/update/delete para anon/authenticated:
-- la ingesta corre con service_role_key, que evade RLS.
