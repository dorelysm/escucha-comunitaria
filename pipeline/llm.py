"""
llm.py
======
Cliente LLM unificado. Intenta primero el LLM local (Gemma via LM Studio /
Cloudflare tunnel, OpenAI-compatible). Si no está disponible o no está configurado,
cae al fallback de Anthropic (Claude Haiku).

Interface publica:
    completar(system: str, user: str) -> str

El pipeline no necesita saber de cuál backend viene la respuesta.
"""

import logging
import os

import anthropic
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

log = logging.getLogger(__name__)

_LOCAL_ENDPOINT = os.getenv("LLM_LOCAL_ENDPOINT", "").strip()
_LOCAL_MODEL = os.getenv("LLM_LOCAL_MODEL", "google/gemma-4-12b-qat").strip()
_ANTHROPIC_MODEL = os.getenv("ANTHROPIC_FALLBACK_MODEL", "claude-haiku-4-5")


def _completar_local(system: str, user: str) -> str:
    client = OpenAI(base_url=f"{_LOCAL_ENDPOINT}/v1", api_key="lm-studio")
    response = client.chat.completions.create(
        model=_LOCAL_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=1024,
        temperature=0.0,
    )
    return response.choices[0].message.content.strip()


def _completar_anthropic(system: str, user: str) -> str:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model=_ANTHROPIC_MODEL,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text.strip()


def completar(system: str, user: str) -> str:
    """Completa un turno de chat. Usa LLM local si está disponible, Anthropic como fallback."""
    if _LOCAL_ENDPOINT:
        try:
            resultado = _completar_local(system, user)
            log.debug("LLM: local (%s)", _LOCAL_MODEL)
            return resultado
        except Exception as exc:
            log.warning("LLM local no disponible (%s), usando Anthropic fallback.", exc)

    resultado = _completar_anthropic(system, user)
    log.debug("LLM: Anthropic (%s)", _ANTHROPIC_MODEL)
    return resultado
