"""Errores públicos compartidos por admisión y conversión documental."""


class DocumentError(Exception):
    def __init__(self, code: str, message: str, recoverable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.recoverable = recoverable


def resource_limit() -> DocumentError:
    return DocumentError("DOC_RESOURCE_LIMIT", "El documento supera el presupuesto de lectura local. Selecciona un documento menor.")
