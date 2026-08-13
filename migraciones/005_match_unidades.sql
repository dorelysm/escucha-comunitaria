create or replace function match_unidades(
  query_embedding extensions.vector(1024),
  match_count int default 8
)
returns table (
  id uuid,
  texto_literal text,
  fuente_id uuid,
  referencia text
)
language sql stable
as $$
  select
    u.id,
    u.texto_literal,
    u.fuente_id,
    f.referencia
  from unidades u
  join fuentes f on f.id = u.fuente_id
  where (f.tipo_procedencia <> 'testimonio' or f.consentimiento = true)
  order by u.embedding <=> query_embedding
  limit match_count;
$$;
