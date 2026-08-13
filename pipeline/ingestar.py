"""
ingestar.py
===========
Pipeline de ingesta: segmenta, normaliza, embebe e inserta en Supabase.

Modos de entrada:
  --entrada archivo.txt   un solo archivo de texto
  --entrada carpeta/      procesa todos los .txt con su .meta.txt asociado
  --entrada archivo.jsonl cada registro ya es una unidad (texto + metadatos)

USO
---
  python ingestar.py --entrada ../datos/textos --tipo publica --corpus institucional
  python ingestar.py --entrada ../datos/textos/encuesta_cartagena_percepcion_2026.jsonl \\
                     --tipo publica --corpus comunitario
  python ingestar.py --entrada testimonio_cartagena_001_20260813.txt \\
                     --tipo testimonio --corpus comunitario --consentimiento

Idempotente: si la fuente ya existe (misma referencia), se salta salvo --force.

REGLA NO NEGOCIABLE: --consentimiento es un flag explícito que el operador
activa solo cuando hay consentimiento grabado verificado. Nunca se infiere
del contenido ni del nombre del archivo.
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Literal

import voyageai
from dotenv import load_dotenv
from supabase import create_client

from llm import completar
from prompts import NORMALIZACION, SEGMENTACION

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
_voyage = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "voyage-4")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))


# ── Funciones del contrato (contratos_v2 §4) ────────────────────────────────

def _parsear_json_llm(texto: str):
    """Extrae JSON de una respuesta que puede venir con markdown fences."""
    texto = texto.strip()
    # Quitar fences ```json ... ``` o ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", texto)
    if match:
        texto = match.group(1).strip()
    return json.loads(texto)


def segmentar(texto: str) -> list[str]:
    """Fragmentos de idea autocontenidos. Preserva palabras originales."""
    respuesta = completar(SEGMENTACION, texto)
    try:
        fragmentos = _parsear_json_llm(respuesta)
        if isinstance(fragmentos, list) and all(isinstance(f, str) for f in fragmentos):
            return [f.strip() for f in fragmentos if f.strip()]
    except (json.JSONDecodeError, AttributeError):
        pass
    log.warning("LLM no devolvio JSON valido para segmentacion; usando texto completo como una unidad.")
    return [texto.strip()] if texto.strip() else []


def normalizar(fragmento: str) -> str:
    """Necesidad subyacente en registro neutro."""
    return completar(NORMALIZACION, fragmento).strip()


def embeber(textos: list[str]) -> list[list[float]]:
    """Por lotes. Devuelve lista de vectores DIM=1024. Reintenta si hay rate limit."""
    if not textos:
        return []
    for intento in range(5):
        try:
            resultado = _voyage.embed(textos, model=EMBEDDING_MODEL, input_type="document")
            return resultado.embeddings
        except Exception as exc:
            if "rate" in str(exc).lower() and intento < 4:
                espera = 22 * (intento + 1)  # 22s, 44s, 66s... (3 RPM = 20s entre requests)
                log.warning("Voyage rate limit — esperando %ds antes de reintentar...", espera)
                time.sleep(espera)
            else:
                raise
    return []


def _meta_desde_archivo(ruta_meta: Path) -> dict:
    """Lee un .meta.txt y devuelve un dict de campos clave:valor."""
    meta = {}
    if not ruta_meta.exists():
        return meta
    for linea in ruta_meta.read_text(encoding="utf-8").splitlines():
        if ":" in linea and not linea.startswith("#"):
            clave, _, valor = linea.partition(":")
            meta[clave.strip()] = valor.strip()
    return meta


def _fuente_existente(referencia: str) -> str | None:
    """Devuelve fuente_id si ya existe en la base, None si no."""
    resp = _supabase.table("fuentes").select("id").eq("referencia", referencia).execute()
    if resp.data:
        return resp.data[0]["id"]
    return None


def ingestar_fuente(
    texto: str,
    referencia: str,
    tipo_procedencia: Literal["testimonio", "publica", "sintetica"],
    corpus: Literal["comunitario", "institucional"],
    titulo: str | None = None,
    metadatos_hablante: dict | None = None,
    consentimiento: bool = False,
    consentimiento_modo: str | None = None,
    fecha_recoleccion: str | None = None,
    force: bool = False,
) -> str:
    """Segmenta, normaliza, embebe e inserta. Devuelve fuente_id."""

    # Idempotencia
    existente = _fuente_existente(referencia)
    if existente and not force:
        log.info("  Fuente ya existe (%s), saltando. Usa --force para reingestar.", referencia)
        return existente

    # Insertar fuente
    fuente_data = {
        "tipo_procedencia": tipo_procedencia,
        "corpus": corpus,
        "titulo": titulo or referencia,
        "referencia": referencia,
        "consentimiento": consentimiento,
        "consentimiento_modo": consentimiento_modo or None,
        "fecha_recoleccion": fecha_recoleccion if fecha_recoleccion and fecha_recoleccion != "None" else None,
    }
    resp = _supabase.table("fuentes").insert(fuente_data).execute()
    fuente_id = resp.data[0]["id"]
    log.info("  Fuente creada: %s (%s)", fuente_id, referencia)

    # Insertar hablante si hay metadatos
    if metadatos_hablante:
        hablante_data = {"fuente_id": fuente_id, **metadatos_hablante}
        _supabase.table("hablantes").insert(hablante_data).execute()

    # Segmentar
    fragmentos = segmentar(texto)
    if not fragmentos:
        log.warning("  Sin fragmentos para %s; fuente creada pero sin unidades.", referencia)
        return fuente_id
    log.info("  %d fragmentos identificados.", len(fragmentos))

    # Normalizar (en lote secuencial — el LLM local es rápido pero no paralelizable fácil)
    normalizados = [normalizar(f) for f in fragmentos]

    # Embeber normalizados en lote
    vectores = embeber(normalizados)

    # Insertar unidades
    unidades = [
        {
            "fuente_id": fuente_id,
            "texto_literal": fragmentos[i],
            "texto_normalizado": normalizados[i],
            "orden": i,
            "embedding": vectores[i],
            "cluster_id": None,
        }
        for i in range(len(fragmentos))
    ]
    _supabase.table("unidades").insert(unidades).execute()
    log.info("  %d unidades insertadas.", len(unidades))

    return fuente_id


def _procesar_txt(
    ruta: Path,
    tipo_procedencia: Literal["testimonio", "publica", "sintetica"],
    corpus: Literal["comunitario", "institucional"],
    consentimiento: bool,
    force: bool,
):
    ruta_meta = ruta.with_suffix("").with_suffix(".meta.txt") if ruta.suffix == ".txt" else None
    if ruta_meta is None:
        ruta_meta = ruta.parent / (ruta.stem + ".meta.txt")

    meta = _meta_desde_archivo(ruta_meta)
    texto = ruta.read_text(encoding="utf-8").strip()
    if not texto:
        log.warning("  Archivo vacio, saltando: %s", ruta.name)
        return

    metadatos_hablante = {
        k: meta.get(k) for k in
        ["municipio", "departamento", "rango_etario", "situacion_ocupacional", "nivel_educativo"]
        if meta.get(k)
    }

    ingestar_fuente(
        texto=texto,
        referencia=ruta.name,
        tipo_procedencia=tipo_procedencia,
        corpus=corpus,
        titulo=meta.get("titulo") or ruta.stem,
        metadatos_hablante=metadatos_hablante or None,
        consentimiento=consentimiento,
        consentimiento_modo="verbal_grabado" if consentimiento else None,
        fecha_recoleccion=meta.get("fecha") or None,
        force=force,
    )


def _procesar_jsonl(
    ruta: Path,
    tipo_procedencia: Literal["testimonio", "publica", "sintetica"],
    corpus: Literal["comunitario", "institucional"],
    consentimiento: bool,
    force: bool,
):
    """
    Para el JSONL de la encuesta: cada registro ya es una unidad pre-segmentada.
    Se normaliza pero no se resegmenta.
    """
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    total = 0
    for linea in lineas:
        linea = linea.strip()
        if not linea:
            continue
        registro = json.loads(linea)
        texto = registro.get("texto", "").strip()
        if not texto:
            continue

        referencia = registro.get("id") or registro.get("referencia") or f"{ruta.stem}_{total}"

        metadatos_hablante = {
            k: registro.get(k)
            for k in ["municipio", "rango_etario", "sexo", "localidad", "ocupacion", "nivel_educativo", "estrato"]
            if registro.get(k) is not None
        }
        if "estrato" in metadatos_hablante:
            try:
                metadatos_hablante["estrato"] = int(float(metadatos_hablante["estrato"]))
            except (ValueError, TypeError):
                del metadatos_hablante["estrato"]
        # Mapear campos de la encuesta al esquema de hablantes
        if "localidad" in metadatos_hablante:
            metadatos_hablante["municipio"] = metadatos_hablante.get("municipio") or "cartagena"

        # Para la encuesta: cada registro ya es una unidad — normalizar directamente
        normalizado = normalizar(texto)
        vector = embeber([normalizado])[0]

        existente = _fuente_existente(referencia)
        if existente and not force:
            total += 1
            continue

        fuente_data = {
            "tipo_procedencia": tipo_procedencia,
            "corpus": corpus,
            "titulo": referencia,
            "referencia": referencia,
            "consentimiento": registro.get("consentimiento", consentimiento),
            "consentimiento_modo": registro.get("consentimiento_modo"),
            "fecha_recoleccion": None,
        }
        resp = _supabase.table("fuentes").insert(fuente_data).execute()
        fuente_id = resp.data[0]["id"]

        if metadatos_hablante:
            _supabase.table("hablantes").insert({"fuente_id": fuente_id, **metadatos_hablante}).execute()

        _supabase.table("unidades").insert({
            "fuente_id": fuente_id,
            "texto_literal": texto,
            "texto_normalizado": normalizado,
            "orden": 0,
            "embedding": vector,
            "cluster_id": None,
        }).execute()

        total += 1
        if total % 50 == 0:
            log.info("  %d registros procesados...", total)

    log.info("  JSONL completo: %d registros ingestados.", total)


def main():
    parser = argparse.ArgumentParser(description="Ingesta corpus al pipeline RAG.")
    parser.add_argument("--entrada", "-e", required=True, type=Path)
    parser.add_argument(
        "--tipo", required=True,
        choices=["testimonio", "publica", "sintetica"],
        help="Tipo de procedencia de la fuente."
    )
    parser.add_argument(
        "--corpus", required=True,
        choices=["comunitario", "institucional"],
    )
    parser.add_argument(
        "--consentimiento", action="store_true", default=False,
        help="Activar solo cuando hay consentimiento grabado verificado. Nunca se infiere automaticamente."
    )
    parser.add_argument("--force", action="store_true", default=False,
                        help="Reingestar aunque la fuente ya exista.")
    args = parser.parse_args()

    entrada = args.entrada
    if not entrada.exists():
        log.error("No existe: %s", entrada)
        sys.exit(1)

    if entrada.is_file() and entrada.suffix == ".jsonl":
        log.info("Modo JSONL: %s", entrada)
        _procesar_jsonl(entrada, args.tipo, args.corpus, args.consentimiento, args.force)

    elif entrada.is_file() and entrada.suffix == ".txt":
        log.info("Modo archivo: %s", entrada)
        _procesar_txt(entrada, args.tipo, args.corpus, args.consentimiento, args.force)

    elif entrada.is_dir():
        archivos = sorted(f for f in entrada.glob("*.txt") if not f.name.endswith(".meta.txt"))
        log.info("Modo carpeta: %d archivos .txt en %s", len(archivos), entrada)
        for i, ruta in enumerate(archivos, 1):
            log.info("[%d/%d] %s", i, len(archivos), ruta.name)
            _procesar_txt(ruta, args.tipo, args.corpus, args.consentimiento, args.force)
    else:
        log.error("Entrada no reconocida: %s", entrada)
        sys.exit(1)


if __name__ == "__main__":
    main()
