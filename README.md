# Código · Herramienta de escucha comunitaria

Aplicación web y pipelines que toman voces de la comunidad (testimonios, informes de consulta, memorias de mesas técnicas) y las hacen consultables para quienes formulan política pública. Dos modos de uso: **validar** una propuesta de programa (qué respaldo encuentra, dimensión por dimensión) y **explorar** los ejes temáticos que emergen del propio corpus.

CTW Hackathon Cartagena 2026 · Track: AI for Social Impact
Equipo: Alex (investigación social, pitch) · Dorelys (arquitectura y desarrollo)

Desplegada en Vercel: **https://escucha-comunitaria.vercel.app/**

## Repositorios del proyecto

Cada uno es un repositorio independiente en GitHub.

| Repositorio | Qué contiene |
|---|---|
| `codigo` | Este repo: frontend, pipeline, migraciones |
| [`datos`](https://github.com/dorelysm/escucha-comunitaria-datos) | Corpus: `bruto/`, `textos/`, `consentimiento/` y la herramienta de preparación |
| [`documentacion`](https://github.com/dorelysm/escucha-comunitaria-documentacion) | Requerimientos, contratos, diseño, infraestructura, pitch |

## Estructura

| Carpeta | Qué es |
|---|---|
| `frontend/` | Aplicación Next.js 16 (App Router) + React 19 + Tailwind CSS 4. Las cuatro pantallas (P1 entrada, P2 validación, P3 exploración, P4 corpus) y las rutas `/api/*`. |
| `pipeline/` | Scripts Python de ingesta y análisis: `ingestar.py`, `analizar.py`, `llm.py`, `prompts.py`. |
| `migraciones/` | Migraciones SQL aplicadas a Supabase. Solo la `004` (tabla `unidades`) vive acá; las `001`–`003` viven en `documentacion/infraestructura/migraciones`. |
| `frontend_src/` | Copia duplicada de `lib/` y `types/` del frontend (restos del andamio). No se usa por el build; ignorarla. |

### Frontend

- Páginas: `app/page.tsx` (P1), `app/validar/page.tsx` (P2), `app/explorar/page.tsx` (P3), `app/corpus/page.tsx` (P4).
- API (contratos_v2 §3): `GET /api/meta`, `POST /api/validar` (respuesta en streaming NDJSON), `GET /api/explorar`, `GET /api/corpus`.
- Tipos compartidos en `types/dominio.ts` (contratos_v2 §2); regla de fuerza de evidencia y marcas en `lib/fuerza.ts` (contratos_v2 §5); cliente Supabase en `lib/supabase.ts` (anon key, respeta RLS).

### Pipeline (Python)

- `ingestar.py` — segmenta, normaliza, embebe e inserta en Supabase. Modos: archivo, carpeta, JSONL. Idempotente. Regla no negociable: `--consentimiento` solo cuando hay consentimiento grabado verificado; nunca se infiere.
- `analizar.py` — clustering BERTopic (UMAP + HDBSCAN + stopwords en español + semilla fija) sobre los embeddings ya ingestados; escribe en `clusters` y actualiza `unidades.cluster_id`. Precomputado, no corre en vivo.
- `llm.py` — cliente LLM unificado: primero el LLM local (Gemma vía LM Studio/Cloudflare, OpenAI-compatible), con fallback a Anthropic (Claude Haiku). El pipeline no distingue el backend.
- `prompts.py` — los prompts versionados como constantes (contratos_v2 §6). Son código: si cambian, cambia el corpus.

## Arquitectura

```
Frontend Next.js (Vercel)
  └─ /api/*  →  Supabase (Postgres + pgvector)   ←  lee resultados y citas

Pipeline Python (por lotes)
  texto → segmentar → normalizar → embeber (voyage-4, 1024D) → insertar
  embeddings → BERTopic (UMAP + HDBSCAN) → etiquetado LLM → clusters
```

- **Almacenamiento:** Supabase, proyecto `escucha-comunitaria` (`wnqwuamyqjllkbkjmssy`).
- **Embeddings:** `voyage-4`, `DIM = 1024` (recomendación de trabajo; verificación empírica pendiente, requerimientos_v3 §5.3).
- **Clustering:** BERTopic (`umap-learn` + `hdbscan`), stopwords en español y semilla fija.
- **LLM:** local `google/gemma-4-12b-qat` con fallback `claude-haiku-4-5`.
- **Consentimiento:** los testimonios solo se exponen con `consentimiento = true`; la regla se aplica en la base (RLS), no a criterio de quien opera.

## Puesta en marcha

### Frontend

Requisitos: Node 20+.

```bash
cd frontend
npm install
```

Crear `frontend/.env.local` (plantilla en `frontend/.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://wnqwuamyqjllkbkjmssy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key del proyecto>
ANTHROPIC_API_KEY=<...>          # usado por /api/validar
ANTHROPIC_FALLBACK_MODEL=claude-haiku-4-5
VOYAGE_API_KEY=<...>             # usado por /api/validar (embedding de la propuesta)
```

```bash
npm run dev     # → http://localhost:3000
```

### Pipeline

Requisitos: Python 3.14.

```bash
cd pipeline
pip install -r requirements.txt
```

Copiar `pipeline/.env.example` a `pipeline/.env` y completar: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_LOCAL_ENDPOINT`, `LLM_LOCAL_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIM`.

```bash
# Ingesta de un corpus (carpeta con .txt + .meta.txt)
python ingestar.py --entrada ../datos/textos --tipo publica --corpus institucional

# Ingesta de la encuesta (JSONL, cada registro ya es una unidad)
python ingestar.py --entrada ../datos/textos/encuesta_cartagena_percepcion_2026.jsonl \
                   --tipo publica --corpus comunitario

# Ingesta de un testimonio con consentimiento grabado
python ingestar.py --entrada testimonio_cartagena_001_20260813.txt \
                   --tipo testimonio --corpus comunitario --consentimiento

# Clustering sobre lo ingestado (precomputado, no corre en vivo)
python analizar.py
```

### Migraciones

Aplicar en orden contra el proyecto Supabase: `001`–`003` en `documentacion/infraestructura/migraciones` y `004` en `migraciones/` (crea `unidades` con `embedding vector(1024)` y la política RLS de consentimiento).

## Estado vs. alcance del evento

Prioridades de las 8 horas (requerimientos_v3 §10):

| Alcance | Estado |
|---|---|
| Núcleo 1 · Ingesta con normalización y verificación de integridad | Implementado (`ingestar.py`) |
| Núcleo 2 · Modo validación por dimensiones con citas y procedencia | Implementado (P2 + `/api/validar`) |
| Núcleo 3 · Sitio desplegado con P1 + P2 | Implementado (P1 con contadores + P2) |
| Alto valor 4 · Modo exploración con clusters precomputados | Implementado (P3 + `/api/explorar` + `analizar.py`) |
| Alto valor 5 · Filtro por territorio en P2 y P3 | Implementado |
| Alto valor 6 · Pantalla de corpus (P4) | Implementado (`/api/corpus`) |
| Alto valor 7 · Ingesta en vivo durante el evento | Script soporta el modo; falta la operación del día |
| Opcional 8 · Detección de vacíos comunitario vs. institucional | Pendiente |
| Opcional 9 · Mapa de clusters | Pendiente |

**Pendientes bloqueantes** (no son código): verificación empírica de embeddings y de la normalización semántica con habla costeña real (requerimientos_v3 §5.3) y configuración de la VPN/Tailscale para el LLM local.

## Documentación relacionada

Vive en el repositorio `documentacion`:

- `requerimientos/requerimientos_v3.md` — problema, propuesta, arquitectura, esquema de datos, alcance del evento.
- `requerimientos/contratos_v2.md` — tipos compartidos, rutas de API, contrato del pipeline, prompts.
- `requerimientos/decision_embeddings_y_bertopic.md` — decisión de embeddings (`voyage-4`) y adopción de BERTopic.
- `brief_diseno_claude_design.md` — sistema visual de procedencia y fuerza de evidencia, las cuatro pantallas.
- `infraestructura/README.md` — estado de Supabase y migraciones aplicadas.