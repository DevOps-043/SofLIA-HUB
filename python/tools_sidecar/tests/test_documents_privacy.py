# Tests del sidecar de herramientas: documentos, PII y NO-BLOQUEO del lector.
# Ejecutar:  python-runtime/python.exe -m pytest python/tools_sidecar/tests -q
import json
import os
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SIDECAR_DIR = os.path.join(ROOT, "python", "tools_sidecar")
PYTHON = os.path.join(ROOT, "python-runtime", "python.exe")

sys.path.insert(0, SIDECAR_DIR)

import documents  # noqa: E402
import main  # noqa: E402
import privacy  # noqa: E402


# ── Documentos ───────────────────────────────────────────────────────────────

def _build_xlsx(path: str) -> None:
    from openpyxl import Workbook

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Ventas"
    sheet.append(["Producto", "Unidades", "Total"])
    sheet.append(["Teclado", 3, 1500])
    sheet.append(["Monitor", 1, 4200])
    workbook.save(path)


def test_xlsx_se_convierte_a_markdown_con_tabla(tmp_path):
    archivo = str(tmp_path / "ventas.xlsx")
    _build_xlsx(archivo)

    resultado = documents.parse_document(archivo)

    assert "## Hoja: Ventas" in resultado["markdown"]
    assert "| Producto | Unidades | Total |" in resultado["markdown"]
    assert "Monitor" in resultado["markdown"]
    # La tabla tambien viaja estructurada (no solo como texto).
    assert resultado["tables"][0]["rows"][0] == ["Producto", "Unidades", "Total"]
    assert resultado["metadata"]["format"] == "xlsx"


def test_docx_conserva_encabezados_y_tablas(tmp_path):
    from docx import Document

    archivo = str(tmp_path / "informe.docx")
    documento = Document()
    documento.add_heading("Resumen", level=1)
    documento.add_paragraph("Contenido del informe.")
    tabla = documento.add_table(rows=2, cols=2)
    tabla.cell(0, 0).text = "Concepto"
    tabla.cell(0, 1).text = "Monto"
    tabla.cell(1, 0).text = "Licencias"
    tabla.cell(1, 1).text = "12000"
    documento.save(archivo)

    resultado = documents.parse_document(archivo)

    assert "## Resumen" in resultado["markdown"]
    # mammoth (TS) aplanaba las tablas; aqui se conservan.
    assert "| Concepto | Monto |" in resultado["markdown"]
    assert resultado["tables"][0]["rows"][1] == ["Licencias", "12000"]


def test_formato_no_soportado_da_error_con_codigo(tmp_path):
    archivo = tmp_path / "notas.txt"
    archivo.write_text("hola", encoding="utf-8")

    try:
        documents.parse_document(str(archivo))
        assert False, "deberia haber lanzado DocumentError"
    except documents.DocumentError as error:
        assert error.code == "DOC_UNSUPPORTED"


def test_archivo_inexistente_da_error_con_codigo():
    try:
        documents.parse_document("C:/no/existe.pdf")
        assert False, "deberia haber lanzado DocumentError"
    except documents.DocumentError as error:
        assert error.code == "DOC_NOT_FOUND"


# ── PII ──────────────────────────────────────────────────────────────────────

def test_redacta_pii_mexicana_antes_de_la_nube():
    texto = (
        "Cliente Juan con RFC GODE561231GR8, CURP GODE561231HDFSRL05, "
        "tarjeta 4111 1111 1111 1111, tel 55 1234 5678 y correo juan@empresa.mx."
    )

    resultado = privacy.redact(texto)

    assert "[RFC]" in resultado["redacted"]
    assert "[CURP]" in resultado["redacted"]
    assert "[TARJETA]" in resultado["redacted"]
    assert "[EMAIL]" in resultado["redacted"]
    assert "[TELEFONO]" in resultado["redacted"]
    # El dato sensible ya no aparece en el texto que se enviaria al modelo.
    assert "GODE561231GR8" not in resultado["redacted"]
    assert "4111" not in resultado["redacted"]
    assert "juan@empresa.mx" not in resultado["redacted"]
    # Y tampoco se devuelve en el detalle de entidades.
    assert all("text" not in entidad for entidad in resultado["entities"])


def test_no_marca_como_tarjeta_un_numero_que_no_pasa_luhn():
    # Un folio de 16 digitos no valido por Luhn NO debe redactarse como tarjeta.
    resultado = privacy.redact("Folio 1234567812345678 del pedido.")
    assert "[TARJETA]" not in resultado["redacted"]
    assert "1234567812345678" in resultado["redacted"]


def test_texto_sin_pii_queda_intacto():
    texto = "La reunion es el martes a las diez en la sala grande."
    resultado = privacy.redact(texto)
    assert resultado["redacted"] == texto
    assert resultado["redactedCount"] == 0


def test_parse_document_con_redact_no_devuelve_pii_ni_en_las_tablas(tmp_path):
    """Con redact=true la PII se elimina DENTRO del sidecar: nunca llega a Electron."""
    from openpyxl import Workbook

    archivo = str(tmp_path / "clientes.xlsx")
    workbook = Workbook()
    hoja = workbook.active
    hoja.title = "Clientes"
    hoja.append(["Nombre", "RFC", "Correo"])
    hoja.append(["Juan", "GODE561231GR8", "juan@empresa.mx"])
    workbook.save(archivo)

    resultado = main._redact_document(documents.parse_document(archivo), privacy)

    assert "GODE561231GR8" not in resultado["markdown"]
    assert "juan@empresa.mx" not in resultado["markdown"]
    assert "[RFC]" in resultado["markdown"]
    # Las celdas de las tablas estructuradas tambien van redactadas.
    celdas = [celda for fila in resultado["tables"][0]["rows"] for celda in fila]
    assert "GODE561231GR8" not in celdas
    assert "[RFC]" in celdas
    assert resultado["metadata"]["piiRedacted"] >= 2
    assert resultado["metadata"]["piiEngine"] == privacy.ENGINE


# ── El lector NUNCA se bloquea (el defecto que tiene el sidecar de voz) ──────

def test_una_tarea_larga_no_bloquea_los_demas_comandos(tmp_path):
    """Con un XLSX grande en curso, `ping` debe responder igualmente rapido."""
    grande = str(tmp_path / "grande.xlsx")
    from openpyxl import Workbook

    workbook = Workbook()
    hoja = workbook.active
    for fila in range(1500):
        hoja.append([f"dato-{fila}-{columna}" for columna in range(12)])
    workbook.save(grande)

    proceso = subprocess.Popen(
        [PYTHON, "-u", os.path.join(SIDECAR_DIR, "main.py")],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        text=True, encoding="utf-8", cwd=SIDECAR_DIR,
    )
    respuestas: dict = {}
    listo = threading.Event()

    def leer():
        for linea in proceso.stdout:
            try:
                mensaje = json.loads(linea)
            except json.JSONDecodeError:
                continue
            if mensaje.get("event") == "ready":
                listo.set()
            elif mensaje.get("id") is not None:
                respuestas[mensaje["id"]] = (mensaje, time.monotonic())

    threading.Thread(target=leer, daemon=True).start()
    assert listo.wait(timeout=15), "el sidecar no arranco"

    # 1) Se lanza el trabajo pesado.  2) Inmediatamente despues, un ping.
    inicio = time.monotonic()
    proceso.stdin.write(json.dumps({"id": 1, "cmd": "parse_document", "params": {"file_path": grande}}) + "\n")
    proceso.stdin.write(json.dumps({"id": 2, "cmd": "ping"}) + "\n")
    proceso.stdin.flush()

    limite = time.monotonic() + 30
    while 2 not in respuestas and time.monotonic() < limite:
        time.sleep(0.02)

    assert 2 in respuestas, "el ping nunca respondio (el lector estaba bloqueado)"
    ping_ms = (respuestas[2][1] - inicio) * 1000
    assert respuestas[2][0]["ok"] is True
    # Si el comando pesado corriera en el hilo lector, el ping tardaria segundos.
    assert ping_ms < 1000, f"el ping tardo {ping_ms:.0f} ms: el lector se bloqueo"

    while 1 not in respuestas and time.monotonic() < limite:
        time.sleep(0.05)
    assert respuestas[1][0]["ok"] is True
    assert respuestas[1][0]["data"]["metadata"]["format"] == "xlsx"

    proceso.stdin.write(json.dumps({"id": 9, "cmd": "shutdown"}) + "\n")
    proceso.stdin.flush()
    proceso.wait(timeout=5)
