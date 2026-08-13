# Escucha Comunitaria

Herramienta de validación de propuestas de política pública contra un corpus de voces ciudadanas de Cartagena y Puerto Colombia. Construida para el hackathon CTW Cartagena 2026.

---

## El problema

Las voces comunitarias quedan archivadas en PDFs que nadie consulta. Los programas sociales se diseñan sin escucha sistemática. Cartagena registra 23% de desempleo juvenil (DANE, abr–jun 2026) mientras las mesas sectoriales producen actas que nunca se cruzan con las propuestas de intervención.

## La solución

Un corpus vivo de fragmentos ciudadanos — actas de mesas sectoriales, testimonios transcritos y encuesta de percepción — indexado semánticamente y consultable de tres formas:

- **`/validar`** — Pega una propuesta de programa. El sistema la descompone en 4 dimensiones (población, intervención, duración, resultado) y contrasta cada una contra el corpus, devolviendo una marca (respaldada / tensionada / sin datos) con citas literales.
- **`/explorar`** — Navega los 79 temas emergentes identificados por BERTopic, ordenados por volumen de evidencia, con distribución por tipo de fuente.
- **`/chat`** — Conversación en lenguaje natural con el corpus, con streaming y citas inline.

---

## Arquitectura

```
datos/
  textos/          ← actas PDF, transcripciones, encuesta JSONL
  preparar_corpus.py
  preparar_encuesta.py

codigo/
  pipeline/
    ingestar.py    ← segmenta, normaliza, embebe (Voyage voyage-4) → Supabase
    analizar.py    ← BERTopic clustering → etiqueta con LLM
    llm.py         ← Gemma 4 12B local con fallback a Claude Haiku
    prompts.py     ← todos los prompts del sistema

  frontend/        ← Next.js App Router
    app/
      page.tsx          ← home con contadores dinámicos
      validar/page.tsx  ← validación streaming NDJSON
      explorar/page.tsx ← clusters acordeón
      chat/page.tsx     ← RAG conversacional
      corpus/page.tsx   ← inventario de fuentes

  migraciones/     ← SQL: pgvector, RLS por consentimiento, match_unidades
```

**Stack:** Supabase (pgvector) · Voyage voyage-4 (embeddings 1024-dim) · BERTopic + UMAP + HDBSCAN · Gemma 4 12B / Claude Haiku · Next.js 15 · Anthropic SDK streaming · Vercel

---

## Protocolo de consentimiento

`consentimiento` nunca se infiere ni se completa automáticamente. Los testimonios se ingresan con `consentimiento = false` por defecto y quedan excluidos de toda exposición pública hasta confirmación humana explícita. La regla se aplica en la capa de datos (RLS de Supabase), no a criterio del operador.

Para menores: se requiere consentimiento del acudiente además del asentimiento del menor. Sin acudiente presente o disponible, no se recoge el testimonio.

---

## Instalación

### Variables de entorno

**`codigo/pipeline/.env`**
```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
VOYAGE_API_KEY=<voyage_key>
ANTHROPIC_API_KEY=<anthropic_key>
```

**`codigo/frontend/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon_key>
ANTHROPIC_API_KEY=<anthropic_key>
VOYAGE_API_KEY=<voyage_key>
```

### Pipeline Python

```bash
cd codigo/pipeline
pip install -r requirements.txt

# Ingestar corpus (testimonios con consentimiento confirmado)
python ingestar.py --carpeta ../../datos/textos/testimonios --consentimiento

# Ingestar actas públicas
python ingestar.py --carpeta ../../datos/textos

# Ingestar encuesta
python ingestar.py --jsonl ../../datos/textos/encuesta_cartagena_percepcion_2026.jsonl --consentimiento

# Clustering temático
python analizar.py

# Re-etiquetar clusters si es necesario
python re_etiquetar.py
```

### Frontend

```bash
cd codigo/frontend
npm install
npm run dev        # desarrollo en localhost:3000
npx vercel --prod  # deploy a producción
```

### Migraciones Supabase

Aplicar en orden desde `codigo/migraciones/`:
```
001_schema_inicial.sql
002_pgvector.sql
003_match_unidades.sql
004_clusters.sql
005_rls.sql
006_hablantes_rls_lectura_publica.sql
007_fuentes_municipio.sql
```

---

## Demo

[escucha-comunitaria.vercel.app](https://escucha-comunitaria.vercel.app)
