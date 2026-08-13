"""
Re-etiqueta clusters cuya etiqueta sea NULL o 'Sin etiqueta' consultando el LLM.
Úsalo para corregir clusters generados antes del fix de los backticks de markdown.

Uso:
    python re_etiquetar.py
"""

import json
import logging
import os
import re
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from llm import completar
from prompts import ETIQUETADO_CLUSTER
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

_sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def limpiar_json(respuesta: str) -> dict:
    texto = respuesta.strip()
    if texto.startswith("```"):
        texto = texto.split("```", 2)[1]
        if texto.startswith("json"):
            texto = texto[4:]
        texto = texto.rsplit("```", 1)[0].strip()
    return json.loads(texto)


def etiquetar(cluster_id: int, unidades_texto: list[str]) -> dict:
    muestra = "\n---\n".join(unidades_texto[:20])
    respuesta = completar(ETIQUETADO_CLUSTER, muestra)
    try:
        return limpiar_json(respuesta)
    except json.JSONDecodeError:
        log.warning("  No se pudo parsear JSON para cluster %d: %s", cluster_id, respuesta[:120])
        return {}


def main():
    # Clusters sin etiqueta válida
    resp = _sb.table("clusters").select("id").or_("etiqueta.is.null,etiqueta.eq.Sin etiqueta").execute()
    ids_sin_etiqueta = [r["id"] for r in resp.data]
    log.info("%d clusters sin etiqueta válida.", len(ids_sin_etiqueta))

    for cluster_id in ids_sin_etiqueta:
        # Cargar textos del cluster
        resp_u = _sb.table("unidades").select("texto_normalizado").eq("cluster_id", cluster_id).limit(20).execute()
        textos = [r["texto_normalizado"] for r in resp_u.data if r.get("texto_normalizado")]
        if not textos:
            log.warning("  Cluster %d sin unidades — saltando.", cluster_id)
            continue

        log.info("  Etiquetando cluster %d (%d textos)…", cluster_id, len(textos))
        data = etiquetar(cluster_id, textos)
        if not data.get("etiqueta"):
            continue

        _sb.table("clusters").update({
            "etiqueta": data["etiqueta"],
            "descripcion": data.get("descripcion"),
        }).eq("id", cluster_id).execute()
        log.info("    → '%s'", data["etiqueta"])

    log.info("Listo.")


if __name__ == "__main__":
    main()
