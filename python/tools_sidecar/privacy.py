# =============================================================================
# Pulse Hub - Deteccion y redaccion de datos personales (PII)
# =============================================================================
# Hoy Pulse envia a Gemini screenshots, texto OCR, documentos y correos SIN
# ningun filtrado (lo unico que existia era enmascarado de LOGS y un detector
# anti prompt-injection, que bloquea pero no redacta).
#
# Este modulo detecta PII y devuelve una version redactada para enviar a la nube.
# Reconocedores propios (sin dependencias) enfocados al caso real de Mexico:
# RFC, CURP, CLABE, tarjeta (validada con Luhn), telefono, email e IBAN.
#
# Presidio/spaCy quedan como mejora OPCIONAL futura para nombres y direcciones
# (requieren un modelo NER de ~50 MB): el contrato ya devuelve `engine` para que
# el consumidor sepa con que se analizo.
# =============================================================================
import re
from typing import Callable

ENGINE = "soflia-regex-mx"

# El orden importa: los patrones mas especificos van primero para que un CURP
# no se detecte parcialmente como RFC.
_PATTERNS: list = [
    # CURP: 18 caracteres con estructura fija (incluye fecha y sexo).
    ("CURP", re.compile(r"\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b", re.IGNORECASE)),
    # RFC persona fisica (13) o moral (12).
    ("RFC", re.compile(r"\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b", re.IGNORECASE)),
    # CLABE interbancaria: exactamente 18 digitos.
    ("CLABE", re.compile(r"\b\d{18}\b")),
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")),
    ("EMAIL", re.compile(r"\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b")),
    # Tarjeta: 13-19 digitos con separadores opcionales. Se valida con Luhn.
    ("TARJETA", re.compile(r"\b(?:\d[ -]?){12,18}\d\b")),
    # Telefono MX: 10 digitos con separadores opcionales y lada internacional.
    ("TELEFONO", re.compile(r"(?<!\d)(?:\+?52[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}(?!\d)")),
]

# Algunas categorias necesitan validacion extra para evitar falsos positivos
# (un numero de factura de 16 digitos no es una tarjeta).
_VALIDATORS: dict = {}


def _luhn_valid(value: str) -> bool:
    digits = [int(char) for char in value if char.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    checksum = 0
    for position, digit in enumerate(reversed(digits)):
        if position % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


def _phone_valid(value: str) -> bool:
    digits = [char for char in value if char.isdigit()]
    # Un telefono MX real tiene 10 digitos (12 con lada +52).
    return len(digits) in (10, 12)


_VALIDATORS["TARJETA"] = _luhn_valid
_VALIDATORS["TELEFONO"] = _phone_valid


def analyze(text: str) -> list:
    """Devuelve las entidades de PII encontradas, sin solaparse."""
    if not text:
        return []

    entities: list = []
    taken: list = []  # rangos ya ocupados por una deteccion previa

    for label, pattern in _PATTERNS:
        validator: Callable[[str], bool] | None = _VALIDATORS.get(label)
        for match in pattern.finditer(text):
            start, end = match.span()
            if any(start < other_end and end > other_start for other_start, other_end in taken):
                continue  # solapa con una deteccion mas especifica
            value = match.group()
            if validator and not validator(value):
                continue
            taken.append((start, end))
            entities.append({
                "type": label,
                "start": start,
                "end": end,
                "text": value,
            })

    entities.sort(key=lambda entity: entity["start"])
    return entities


def redact(text: str) -> dict:
    """Sustituye la PII por marcadores. Devuelve el texto seguro para la nube."""
    entities = analyze(text)
    if not entities:
        return {"redacted": text, "entities": [], "engine": ENGINE, "redactedCount": 0}

    pieces: list = []
    cursor = 0
    for entity in entities:
        pieces.append(text[cursor:entity["start"]])
        pieces.append(f"[{entity['type']}]")
        cursor = entity["end"]
    pieces.append(text[cursor:])

    # El texto original de cada entidad NO se devuelve: quien pide la redaccion
    # no debe recibir de vuelta el dato sensible (solo tipo y posicion).
    summary = [
        {"type": entity["type"], "start": entity["start"], "end": entity["end"]}
        for entity in entities
    ]
    return {
        "redacted": "".join(pieces),
        "entities": summary,
        "engine": ENGINE,
        "redactedCount": len(summary),
    }
