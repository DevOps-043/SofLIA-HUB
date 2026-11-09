"""Presupuesto incremental compatible con las cuotas UTF-16 del consumidor main."""
from document_errors import resource_limit
from collections.abc import Iterable, Sequence

MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_PDF_PAGES = 200
MAX_SHEET_ROWS = 2000
MAX_COLUMNS = 200
MAX_TABLES = 100
MAX_CELLS = 20000
MAX_MARKDOWN_CHARS = 400000
MAX_SECTIONS = 200


def units(text: str) -> int:
    if len(text) > MAX_MARKDOWN_CHARS:
        raise resource_limit()
    count = len(text) + sum(ord(char) > 0xFFFF for char in text)
    if count > MAX_MARKDOWN_CHARS:
        raise resource_limit()
    return count


class DocumentBuilder:
    def __init__(self):
        self.lines: list[str] = []
        self.tables: list[dict] = []
        self.characters = 0
        self.cells = 0
        self.cell_characters = 0

    def text(self, text: str) -> None:
        cost = units(text) + (1 if self.lines else 0)
        if self.characters + cost > MAX_MARKDOWN_CHARS:
            raise resource_limit()
        self.characters += cost
        self.lines.append(text)

    def table(self, rows: Iterable[Sequence[object]], *, normalize_whitespace: bool = True, **labels: str | int) -> None:
        if len(self.tables) >= MAX_TABLES:
            raise resource_limit()
        matrix = []
        for index, row in enumerate(rows):
            if index >= MAX_SHEET_ROWS or len(row) > MAX_COLUMNS:
                raise resource_limit()
            cells = []
            for value in row:
                if self.cells >= MAX_CELLS:
                    raise resource_limit()
                text = "" if value is None else str(value)
                cost = units(text)
                if self.cell_characters + cost > MAX_MARKDOWN_CHARS:
                    raise resource_limit()
                self.cells += 1
                self.cell_characters += cost
                cells.append(" ".join(text.split()) if normalize_whitespace else text.strip())
            if any(cells):
                matrix.append(cells)
        if not matrix:
            return
        width = max(map(len, matrix))
        keep = [column for column in range(width) if any(column < len(row) and row[column] for row in matrix)]
        # La matriz pública se rellena: presupuestar también las celdas creadas.
        retained = len(matrix) * len(keep)
        original = sum(map(len, matrix))
        if self.cells + max(0, retained - original) > MAX_CELLS:
            raise resource_limit()
        self.cells += max(0, retained - original)
        matrix = [[row[column] if column < len(row) else "" for column in keep] for row in matrix]
        for row_index, row in enumerate(matrix):
            self.text("| " + " | ".join(cell.replace("|", "\\|").replace("\n", " ") for cell in row) + " |")
            if row_index == 0:
                self.text("| " + " | ".join("---" for _ in row) + " |")
        self.tables.append({**labels, "rows": matrix})

    def finish(self, metadata: dict) -> dict:
        return {"markdown": "\n".join(self.lines).strip(), "tables": self.tables, "metadata": metadata}


def validate_result(result: dict) -> dict:
    """Revisar cuotas sin reformatear ni duplicar el Markdown ya redactado."""
    units(result["markdown"])
    if len(result["tables"]) > MAX_TABLES:
        raise resource_limit()
    cells = 0
    characters = 0
    for table in result["tables"]:
        if "sheet" in table and units(table["sheet"]) > 512:
            raise resource_limit()
        if len(table["rows"]) > MAX_SHEET_ROWS:
            raise resource_limit()
        for row in table["rows"]:
            cells += len(row)
            if len(row) > MAX_COLUMNS or cells > MAX_CELLS:
                raise resource_limit()
            for cell in row:
                characters += units(cell)
                if characters > MAX_MARKDOWN_CHARS:
                    raise resource_limit()
    return result
