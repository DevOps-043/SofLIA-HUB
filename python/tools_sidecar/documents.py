# =============================================================================
# Pulse Hub - Lectura local de documentos (PDF, XLSX, PPTX, DOCX)
# =============================================================================
# Antes de este modulo, SofLIA NO podia leer un PDF localmente: la unica via era
# subir el archivo entero a Gemini (coste, latencia, limite de 15 MB y el
# documento completo saliendo a la nube). Ademas, ningun formato permitia
# extraer TABLAS de forma estructurada.
#
# Salida: Markdown (lo que mejor entiende un LLM) + tablas como matrices.
# =============================================================================
import os
from typing import Any

# Limites defensivos: un documento gigante no debe agotar la memoria ni colgar
# la herramienta. Se informa al usuario cuando se trunca.
MAX_FILE_BYTES = 50 * 1024 * 1024   # 50 MB
MAX_PDF_PAGES = 200
MAX_SHEET_ROWS = 2000
MAX_MARKDOWN_CHARS = 400_000

SUPPORTED_EXTENSIONS = {".pdf", ".xlsx", ".xlsm", ".pptx", ".docx"}


class DocumentError(Exception):
    """Error de negocio con codigo estable para el contrato del sidecar."""

    def __init__(self, code: str, message: str, recoverable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.recoverable = recoverable


def parse_document(file_path: str, max_pages: int = MAX_PDF_PAGES) -> dict:
    """Convierte un documento a Markdown + tablas estructuradas."""
    if not os.path.isfile(file_path):
        raise DocumentError("DOC_NOT_FOUND", f"No existe el archivo: {file_path}")

    size = os.path.getsize(file_path)
    if size > MAX_FILE_BYTES:
        raise DocumentError(
            "DOC_TOO_LARGE",
            f"El documento pesa {size // (1024 * 1024)} MB; el limite es {MAX_FILE_BYTES // (1024 * 1024)} MB.",
        )

    extension = os.path.splitext(file_path)[1].lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise DocumentError(
            "DOC_UNSUPPORTED",
            f"Formato no soportado: '{extension}'. Soportados: {', '.join(sorted(SUPPORTED_EXTENSIONS))}.",
        )

    if extension == ".pdf":
        result = _parse_pdf(file_path, max_pages)
    elif extension in (".xlsx", ".xlsm"):
        result = _parse_xlsx(file_path)
    elif extension == ".pptx":
        result = _parse_pptx(file_path)
    else:
        result = _parse_docx(file_path)

    markdown = result["markdown"]
    if len(markdown) > MAX_MARKDOWN_CHARS:
        result["markdown"] = markdown[:MAX_MARKDOWN_CHARS] + "\n\n_[Documento truncado por longitud]_"
        result["metadata"]["truncated"] = True

    result["metadata"]["format"] = extension.lstrip(".")
    result["metadata"]["sizeBytes"] = size
    return result


# ── PDF ──────────────────────────────────────────────────────────────────────

def _parse_pdf(file_path: str, max_pages: int) -> dict:
    import pdfplumber

    lines: list = []
    tables: list = []
    pages_with_text = 0

    try:
        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            for index, page in enumerate(pdf.pages[:max_pages], start=1):
                lines.append(f"## Pagina {index}")
                text = (page.extract_text() or "").strip()
                if text:
                    pages_with_text += 1
                    lines.append(text)

                for table_index, raw_table in enumerate(page.extract_tables() or [], start=1):
                    matrix = _clean_table(raw_table)
                    if not matrix:
                        continue
                    tables.append({"page": index, "index": table_index, "rows": matrix})
                    lines.append(_table_to_markdown(matrix))
                lines.append("")
    except DocumentError:
        raise
    except Exception as exc:  # pdfplumber lanza excepciones variadas (cifrado, corrupto)
        message = str(exc).lower()
        if "password" in message or "encrypt" in message:
            raise DocumentError("DOC_ENCRYPTED", "El PDF esta protegido con contraseña.") from exc
        raise DocumentError("DOC_PARSE_FAILED", f"No se pudo leer el PDF: {exc}") from exc

    # Un PDF escaneado es solo imagenes: no tiene capa de texto. Se informa en
    # vez de devolver un resultado vacio que confundiria al agente.
    if pages_with_text == 0 and not tables:
        raise DocumentError(
            "DOC_SCANNED",
            "El PDF no tiene texto seleccionable (parece escaneado). Requiere OCR.",
            recoverable=True,
        )

    return {
        "markdown": "\n".join(lines).strip(),
        "tables": tables,
        "metadata": {"pages": total_pages, "pagesParsed": min(total_pages, max_pages)},
    }


# ── Excel ────────────────────────────────────────────────────────────────────

def _parse_xlsx(file_path: str) -> dict:
    from openpyxl import load_workbook

    try:
        # read_only + data_only: no carga formulas ni estilos (mucho mas rapido
        # y devuelve el VALOR calculado, que es lo que le interesa al agente).
        workbook = load_workbook(file_path, read_only=True, data_only=True)
    except Exception as exc:
        raise DocumentError("DOC_PARSE_FAILED", f"No se pudo leer el Excel: {exc}") from exc

    lines: list = []
    tables: list = []
    for sheet in workbook.worksheets:
        lines.append(f"## Hoja: {sheet.title}")
        matrix = []
        for row in sheet.iter_rows(max_row=MAX_SHEET_ROWS, values_only=True):
            cells = ["" if value is None else str(value).strip() for value in row]
            if any(cells):
                matrix.append(cells)
        if matrix:
            matrix = _trim_empty_columns(matrix)
            tables.append({"sheet": sheet.title, "rows": matrix})
            lines.append(_table_to_markdown(matrix))
        else:
            lines.append("_(hoja vacia)_")
        lines.append("")
    workbook.close()

    return {
        "markdown": "\n".join(lines).strip(),
        "tables": tables,
        "metadata": {"sheets": len(tables)},
    }


# ── PowerPoint ───────────────────────────────────────────────────────────────

def _parse_pptx(file_path: str) -> dict:
    from pptx import Presentation

    try:
        presentation = Presentation(file_path)
    except Exception as exc:
        raise DocumentError("DOC_PARSE_FAILED", f"No se pudo leer la presentacion: {exc}") from exc

    lines: list = []
    tables: list = []
    for index, slide in enumerate(presentation.slides, start=1):
        lines.append(f"## Diapositiva {index}")
        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text:
                    lines.append(text)
            if getattr(shape, "has_table", False):
                matrix = [[cell.text.strip() for cell in row.cells] for row in shape.table.rows]
                matrix = _clean_table(matrix)
                if matrix:
                    tables.append({"slide": index, "rows": matrix})
                    lines.append(_table_to_markdown(matrix))
        lines.append("")

    return {
        "markdown": "\n".join(lines).strip(),
        "tables": tables,
        "metadata": {"slides": len(presentation.slides._sldIdLst)},  # noqa: SLF001
    }


# ── Word ─────────────────────────────────────────────────────────────────────

def _parse_docx(file_path: str) -> dict:
    # mammoth (TypeScript) ya extrae el texto, pero APLANA las tablas.
    # Aqui se conservan como estructura.
    from docx import Document

    try:
        document = Document(file_path)
    except Exception as exc:
        raise DocumentError("DOC_PARSE_FAILED", f"No se pudo leer el documento Word: {exc}") from exc

    lines: list = []
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        # Los encabezados se conservan como Markdown para dar estructura al LLM.
        style = (paragraph.style.name or "").lower()
        if style.startswith("heading"):
            level = "".join(char for char in style if char.isdigit()) or "1"
            lines.append(f"{'#' * min(int(level) + 1, 6)} {text}")
        else:
            lines.append(text)

    tables: list = []
    for index, table in enumerate(document.tables, start=1):
        matrix = _clean_table([[cell.text.strip() for cell in row.cells] for row in table.rows])
        if not matrix:
            continue
        tables.append({"index": index, "rows": matrix})
        lines.append(_table_to_markdown(matrix))

    return {
        "markdown": "\n".join(lines).strip(),
        "tables": tables,
        "metadata": {"paragraphs": len(document.paragraphs), "tables": len(tables)},
    }


# ── Utilidades de tabla ──────────────────────────────────────────────────────

def _clean_table(raw_table: list) -> list:
    """Normaliza celdas (None → "") y descarta filas totalmente vacias."""
    matrix = []
    for row in raw_table or []:
        cells = ["" if cell is None else " ".join(str(cell).split()) for cell in row]
        if any(cells):
            matrix.append(cells)
    return _trim_empty_columns(matrix) if matrix else []


def _trim_empty_columns(matrix: list) -> list:
    """Elimina las columnas que estan vacias en TODAS las filas."""
    if not matrix:
        return matrix
    width = max(len(row) for row in matrix)
    padded = [row + [""] * (width - len(row)) for row in matrix]
    keep = [col for col in range(width) if any(row[col] for row in padded)]
    return [[row[col] for col in keep] for row in padded] if keep else []


def _table_to_markdown(matrix: list) -> str:
    """Tabla Markdown (la primera fila se usa como encabezado)."""
    if not matrix:
        return ""
    width = max(len(row) for row in matrix)
    rows = [row + [""] * (width - len(row)) for row in matrix]
    header = rows[0]
    body = rows[1:]
    escaped_header = [_escape_cell(cell) for cell in header]
    lines = [
        "| " + " | ".join(escaped_header) + " |",
        "| " + " | ".join(["---"] * width) + " |",
    ]
    for row in body:
        lines.append("| " + " | ".join(_escape_cell(cell) for cell in row) + " |")
    return "\n".join(lines)


def _escape_cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")
