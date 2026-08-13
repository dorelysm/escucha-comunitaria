"""
analizar.py
===========
Pipeline de análisis: BERTopic sobre los embeddings ya ingestados en Supabase.
Escribe resultados a la tabla clusters y actualiza unidades.cluster_id.

CUÁNDO CORRER: después de ingestar suficiente corpus (mínimo 20-30 unidades).
NO se corre en vivo durante el evento; los clusters son precomputados.

USO
---
  python analizar.py
  python analizar.py --min-cluster-size 3 --seed 42

PLAN B: si BERTopic da demasiado ruido con N pequeño, usar --aglomerativo
(clustering aglomerativo con corte por distancia, más predecible).
"""

import argparse
import json
import logging
import os
import sys

import numpy as np
from bertopic import BERTopic
from dotenv import load_dotenv
from hdbscan import HDBSCAN
from sklearn.feature_extraction.text import CountVectorizer
from supabase import create_client
from umap import UMAP

from llm import completar
from prompts import ETIQUETADO_CLUSTER

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# Stopwords en español — requeridas para que c-TF-IDF no muestre "que", "para", etc.
# (BERTopic no incluye stopwords en español por defecto)
STOPWORDS_ES = [
    "a", "al", "algo", "algunas", "algunos", "ante", "antes", "como", "con",
    "contra", "cual", "cuando", "de", "del", "desde", "donde", "durante",
    "e", "el", "ella", "ellas", "ellos", "en", "entre", "era", "es", "esa",
    "esas", "ese", "eso", "esos", "esta", "estas", "este", "esto", "estos",
    "fue", "ha", "han", "hay", "he", "la", "las", "le", "les", "lo", "los",
    "mas", "me", "mi", "mis", "muy", "no", "nos", "o", "para", "pero", "por",
    "que", "qu", "se", "si", "sin", "sobre", "su", "sus", "también", "te",
    "tiene", "un", "una", "unas", "uno", "unos", "ya", "y", "yo",
]


def _leer_unidades() -> tuple[list[str], list[list[float]], list[str]]:
    """Lee textos normalizados, embeddings e IDs de Supabase."""
    resp = _supabase.table("unidades").select("id, texto_normalizado, embedding").execute()
    ids = [r["id"] for r in resp.data]
    textos = [r["texto_normalizado"] for r in resp.data]
    vectores = [r["embedding"] for r in resp.data]
    return ids, textos, vectores


def _etiquetar_cluster(unidades_texto: list[str]) -> dict:
    muestra = "\n---\n".join(unidades_texto[:20])
    respuesta = completar(ETIQUETADO_CLUSTER, muestra)
    try:
        return json.loads(respuesta)
    except json.JSONDecodeError:
        return {"etiqueta": "Sin etiqueta", "descripcion": respuesta.strip()}


def correr_bertopic(
    ids: list[str],
    textos: list[str],
    vectores: list[list[float]],
    min_cluster_size: int,
    seed: int,
):
    log.info("Configurando BERTopic (UMAP random_state=%d, min_cluster_size=%d)...", seed, min_cluster_size)

    umap_model = UMAP(n_components=5, n_neighbors=15, min_dist=0.0, random_state=seed)
    hdbscan_model = HDBSCAN(min_cluster_size=min_cluster_size, prediction_data=True)
    vectorizer = CountVectorizer(stop_words=STOPWORDS_ES, ngram_range=(1, 2))

    topic_model = BERTopic(
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        vectorizer_model=vectorizer,
        calculate_probabilities=False,
        verbose=True,
    )

    embeddings = np.array(vectores)
    topics, _ = topic_model.fit_transform(textos, embeddings)

    topic_ids = [t for t in set(topics) if t != -1]
    log.info("%d clusters encontrados (%d ruido).", len(topic_ids), sum(1 for t in topics if t == -1))

    # Limpiar clusters anteriores
    _supabase.table("clusters").delete().neq("id", -999).execute()
    _supabase.table("unidades").update({"cluster_id": None}).neq("id", "00000000-0000-0000-0000-000000000000").execute()

    for topic_id in topic_ids:
        indices = [i for i, t in enumerate(topics) if t == topic_id]
        textos_cluster = [textos[i] for i in indices]

        # Contar fuentes distintas
        ids_cluster = [ids[i] for i in indices]
        resp_fuentes = (
            _supabase.table("unidades")
            .select("fuente_id")
            .in_("id", ids_cluster)
            .execute()
        )
        fuentes_distintas = len({r["fuente_id"] for r in resp_fuentes.data})

        # Corpus dominante
        resp_corpus = (
            _supabase.table("unidades")
            .select("fuentes(corpus)")
            .in_("id", ids_cluster)
            .execute()
        )
        corpora = [r["fuentes"]["corpus"] for r in resp_corpus.data if r.get("fuentes")]
        corpus_dominante = max(set(corpora), key=corpora.count) if corpora else None

        # Etiquetar con LLM
        etiqueta_data = _etiquetar_cluster(textos_cluster)

        _supabase.table("clusters").insert({
            "id": topic_id,
            "etiqueta": etiqueta_data.get("etiqueta"),
            "descripcion": etiqueta_data.get("descripcion"),
            "n_unidades": len(indices),
            "n_fuentes_distintas": fuentes_distintas,
            "corpus_dominante": corpus_dominante,
        }).execute()

        # Actualizar cluster_id en unidades
        _supabase.table("unidades").update({"cluster_id": topic_id}).in_("id", ids_cluster).execute()

        log.info("  Cluster %d: '%s' (%d unidades, %d fuentes)", topic_id, etiqueta_data.get("etiqueta"), len(indices), fuentes_distintas)

    log.info("Analisis completo.")


def main():
    parser = argparse.ArgumentParser(description="Corre BERTopic sobre el corpus ingestado.")
    parser.add_argument("--min-cluster-size", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    ids, textos, vectores = _leer_unidades()
    log.info("%d unidades leidas desde Supabase.", len(ids))

    if len(ids) < args.min_cluster_size * 2:
        log.error("Corpus insuficiente para clustering (%d unidades). Ingestar mas datos primero.", len(ids))
        sys.exit(1)

    correr_bertopic(ids, textos, vectores, args.min_cluster_size, args.seed)


if __name__ == "__main__":
    main()
