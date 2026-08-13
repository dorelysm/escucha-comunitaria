"""
prompts.py
==========
Todos los prompts del sistema versionados como constantes.
Son código: si cambian, cambia el corpus. No pegarlos inline en otros scripts.
Ver contratos_v2.md §6 para la especificación y el razonamiento de cada uno.
"""

SEGMENTACION = """\
Recibes la transcripción de una conversación con una persona de la comunidad sobre \
su situación educativa, laboral y sus necesidades.

Divídela en fragmentos autocontenidos, cada uno con una sola idea o necesidad, \
comprensible sin leer el resto.

Reglas estrictas: usa exclusivamente las palabras de la persona, sin reescribir ni \
corregir; descarta saludos, muletillas y turnos sin contenido sustantivo; no fusiones \
ideas distintas ni partas una idea a la mitad.

Devuelve un arreglo JSON de cadenas, sin texto adicional."""

NORMALIZACION = """\
Recibes un fragmento sobre necesidades de una persona de la comunidad, que puede venir \
de un documento institucional o del habla cotidiana de esa persona.

Escribe en una o dos oraciones la necesidad o afirmación de fondo, en registro neutro \
y descriptivo: sin jerga institucional y sin coloquialismos.

Ejemplos:
"fortalecimiento de capacidades productivas para la inclusión socioeconómica" \
→ "Necesidad de desarrollar habilidades que permitan generar ingresos."
"quiero aprender algo rápido pa' poder trabajar" \
→ "Necesidad de formación de corta duración que habilite el ingreso al trabajo."

No añadas información ausente. No interpretes causas ni intenciones. \
Devuelve solo el texto normalizado."""

DESCOMPOSICION_PROPUESTA = """\
Recibes la descripción de un programa de política pública dirigido a la comunidad.

Extrae cuatro dimensiones: población objetivo, tipo de intervención, duración y \
horizonte de efecto, resultado esperado.

Para cada una, escribe un enunciado breve en registro neutro y descriptivo, con el \
mismo criterio de normalización. Si la propuesta no especifica una dimensión, \
escribe null.

Devuelve JSON con las claves poblacion_objetivo, tipo_intervencion, \
duracion_horizonte, resultado_esperado."""

EVALUACION_DIMENSION = """\
Recibes el enunciado de una dimensión de una propuesta y un conjunto de fragmentos \
recuperados de testimonios y documentos.

Determina si los fragmentos respaldan la dimensión, no dicen nada al respecto, o \
apuntan en dirección distinta.

Responde con una de tres marcas: respaldada, no_respaldada, tensionada.

Reglas: no uses conocimiento externo, solo los fragmentos entregados; si los \
fragmentos tratan un tema distinto aunque suenen parecido, la marca es no_respaldada; \
declarar un vacío es un resultado válido y preferible a forzar una lectura; en \
justificacion, una o dos oraciones sin afirmar nada que no esté en los fragmentos.

Devuelve JSON con marca, justificacion e ids_citas (los identificadores de los \
fragmentos que sostienen la marca)."""

ETIQUETADO_CLUSTER = """\
Recibes fragmentos que un algoritmo agrupó por proximidad semántica. Ningún tema fue \
definido de antemano.

Escribe una etiqueta de entre tres y ocho palabras que nombre lo que tienen en común, \
en lenguaje natural y no en palabras clave, y una descripción de una o dos oraciones.

Si el grupo no tiene un tema común identificable, dilo explícitamente en lugar de \
inventar uno.

Devuelve JSON con etiqueta y descripcion."""
