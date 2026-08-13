alter table fuentes add column if not exists municipio text;

update fuentes set municipio = 'puerto_colombia'
where titulo ilike '%puerto colombia%' or referencia ilike '%puerto colombia%';

update fuentes set municipio = 'cartagena'
where municipio is null;

create or replace function match_unidades(
  query_embedding extensions.vector(1024),
  match_count int default 50,
  p_municipio text default null
)
returns table (id uuid, texto_literal text, fuente_id uuid, referencia text)
language sql stable
as $$
  select u.id, u.texto_literal, u.fuente_id, f.referencia
  from unidades u
  join fuentes f on f.id = u.fuente_id
  where (f.tipo_procedencia <> 'testimonio' or f.consentimiento = true)
    and (p_municipio is null or f.municipio = p_municipio)
  order by u.embedding <=> query_embedding
  limit match_count;
$$;
