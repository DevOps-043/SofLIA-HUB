"""Barrera para instalaciones antiguas y concordancia del lector preparado."""
from importlib import metadata
from pathlib import Path
from datetime import date
import re
from document_errors import DocumentError

MIN_PDFMINER_RELEASE = 20251230


def incompatible() -> DocumentError:
    return DocumentError("DEPENDENCY_INCOMPATIBLE", "El lector local necesita dependencias verificadas actualizadas. Vuelve a preparar el runtime.")


def assert_pdf_dependency() -> None:
    """Consultar metadata antes de importar el parser; sin caché de concesiones."""
    try:
        value = metadata.version("pdfminer.six")
    except Exception as error:
        raise incompatible() from error
    if not isinstance(value, str) or len(value) > 64 or not re.fullmatch(r"[0-9]{8}(?:\.post[0-9]+)?", value) or int(value[:8]) < MIN_PDFMINER_RELEASE:
        raise incompatible()
    try:
        date(int(value[:4]), int(value[4:6]), int(value[6:8]))
    except ValueError as error:
        raise incompatible() from error


def locked_versions(file: Path | None = None, required: set[str] | None = None) -> dict[str, str]:
    """Gramática deliberadamente cerrada del lock generado; no interpreta comandos."""
    path = file or Path(__file__).with_name("requirements.lock")
    result = {}
    hashes = 0
    continued = False
    try:
        if path.stat().st_size > 128 * 1024:
            raise incompatible()
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            continuation = line.endswith(" " + chr(92))
            content = line[:-2] if continuation else line
            pin = re.fullmatch(r"([a-z0-9][a-z0-9_.-]*)==([0-9][a-zA-Z0-9_.+!-]*)", content) if continuation else None
            if pin:
                if continued:
                    raise incompatible()
                name = re.sub(r"[-_.]+", "-", pin[1]).lower()
                if name in result:
                    raise incompatible()
                result[name] = pin[2]
                if len(result) > 32:
                    raise incompatible()
                hashes = 0
                continued = True
            else:
                digest = re.fullmatch(r"--hash=sha256:([0-9a-f]{64})", content)
                if not continued or not digest:
                    raise incompatible()
                hashes += 1
                if hashes > 256:
                    raise incompatible()
                continued = continuation
        required = required if required is not None else {"pdfminer-six", "pdfplumber", "openpyxl", "python-docx", "python-pptx"}
        if continued or not required.issubset(result):
            raise incompatible()
        return result
    except DocumentError:
        raise
    except Exception as error:
        raise incompatible() from error


def _assert_versions(versions: dict[str, str]) -> None:
    for name, expected in versions.items():
        try:
            if metadata.version(name) != expected:
                raise incompatible()
        except DocumentError:
            raise
        except Exception as error:
            raise incompatible() from error


def assert_locked_reader_versions(file: Path | None = None) -> None:
    assert_pdf_dependency()
    _assert_versions(locked_versions(file))


def assert_bootstrap_versions(file: Path) -> None:
    _assert_versions(locked_versions(file, {"setuptools", "wheel", "packaging"}))
