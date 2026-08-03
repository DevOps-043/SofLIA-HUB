# =============================================================================
# Pulse Hub - Sidecar de HERRAMIENTAS (documentos + privacidad)
# =============================================================================
# Proceso separado del sidecar de voz a proposito: aquel tiene el microfono en
# exclusiva y ~1.5 GB de modelos Vosk residentes; un fallo parseando un PDF
# corrupto no debe tumbar la escucha pasiva.
#
# Protocolo NDJSON sobre stdin/stdout (el mismo del sidecar de voz):
#   Peticion:  {"id": 1, "cmd": "parse_document", "params": {...}}
#   Respuesta: {"id": 1, "ok": true,  "data": {...}, "metadata": {...}}
#              {"id": 1, "ok": false, "error": {"code","message","recoverable"}}
#
# CLAVE: los comandos se ejecutan en un ThreadPoolExecutor. El bucle lector de
# stdin nunca se bloquea, asi que `ping` responde al instante aunque haya un PDF
# de 200 paginas en curso (el sidecar de voz tiene este defecto: `mic_probe`
# congela 3 s todos los comandos porque corre en el hilo lector).
# =============================================================================
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

# El runtime Python EMBEBIDO no añade el directorio del script a sys.path (su
# archivo ._pth lo impide), asi que los modulos hermanos no se importarian.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PROTOCOL_VERSION = 1
SERVICE_NAME = "tools-sidecar"
MAX_WORKERS = 4

_stdout_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="soflia-tool")


def emit(payload: dict) -> None:
    """Escribe una linea NDJSON en stdout de forma thread-safe."""
    with _stdout_lock:
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def _respond_ok(msg_id, data: dict, started_at: float) -> None:
    emit({
        "id": msg_id,
        "ok": True,
        "data": data,
        "metadata": {
            "durationMs": int((time.monotonic() - started_at) * 1000),
            "service": SERVICE_NAME,
        },
    })


def _respond_error(msg_id, code: str, message: str, started_at: float, recoverable: bool = False) -> None:
    emit({
        "id": msg_id,
        "ok": False,
        "error": {"code": code, "message": message, "recoverable": recoverable},
        "metadata": {
            "durationMs": int((time.monotonic() - started_at) * 1000),
            "service": SERVICE_NAME,
        },
    })


def _run_command(msg: dict) -> None:
    """Ejecuta un comando en un worker. Nunca lanza: siempre responde."""
    from documents import DocumentError, parse_document
    import privacy

    msg_id = msg.get("id")
    cmd = msg.get("cmd", "")
    params = msg.get("params") or {}
    started_at = time.monotonic()

    try:
        if cmd == "ping":
            _respond_ok(msg_id, {
                "pong": True,
                "python": sys.version.split()[0],
                "protocol": PROTOCOL_VERSION,
            }, started_at)

        elif cmd == "parse_document":
            file_path = str(params.get("file_path") or "").strip()
            if not file_path:
                _respond_error(msg_id, "BAD_REQUEST", "Falta params.file_path.", started_at)
                return
            result = parse_document(file_path, int(params.get("max_pages", 200)))
            # Con redact=true, la PII se elimina AQUI: el dato sensible nunca
            # sale del sidecar hacia Electron (ni, por tanto, hacia la nube).
            if params.get("redact") is True:
                result = _redact_document(result, privacy)
            _respond_ok(msg_id, result, started_at)

        elif cmd == "analyze_pii":
            entities = privacy.analyze(str(params.get("text") or ""))
            # No se devuelve el texto original de cada entidad (dato sensible).
            _respond_ok(msg_id, {
                "entities": [
                    {"type": e["type"], "start": e["start"], "end": e["end"]} for e in entities
                ],
                "engine": privacy.ENGINE,
            }, started_at)

        elif cmd == "redact_text":
            _respond_ok(msg_id, privacy.redact(str(params.get("text") or "")), started_at)

        else:
            _respond_error(msg_id, "UNKNOWN_COMMAND", f"Comando desconocido: '{cmd}'.", started_at)

    except DocumentError as exc:
        _respond_error(msg_id, exc.code, exc.message, started_at, exc.recoverable)
    except ImportError as exc:
        _respond_error(
            msg_id, "DEPENDENCY_MISSING",
            f"Falta una dependencia del sidecar: {exc}. Ejecuta 'npm run python:setup'.",
            started_at, recoverable=True,
        )
    except Exception as exc:  # noqa: BLE001 — un comando jamas debe tumbar el sidecar
        _respond_error(msg_id, "INTERNAL_ERROR", f"{type(exc).__name__}: {exc}", started_at)


def _redact_document(result: dict, privacy) -> dict:
    """Redacta la PII del Markdown y de cada celda de las tablas."""
    redaction = privacy.redact(result.get("markdown", ""))
    redacted_count = redaction["redactedCount"]

    tables = []
    for table in result.get("tables", []):
        rows = []
        for row in table.get("rows", []):
            cells = []
            for cell in row:
                cell_redaction = privacy.redact(cell)
                redacted_count += cell_redaction["redactedCount"]
                cells.append(cell_redaction["redacted"])
            rows.append(cells)
        tables.append({**table, "rows": rows})

    metadata = {**result.get("metadata", {}), "piiRedacted": redacted_count, "piiEngine": privacy.ENGINE}
    return {"markdown": redaction["redacted"], "tables": tables, "metadata": metadata}


def _report_worker_crash(future) -> None:
    """Un Future silencia las excepciones si nadie consulta su resultado."""
    error = future.exception()
    if error is not None:
        emit({"event": "error", "message": f"Fallo interno del worker: {type(error).__name__}: {error}"})


def main() -> None:
    emit({"event": "ready", "protocol": PROTOCOL_VERSION, "service": SERVICE_NAME})
    # readline() explicito: iterar `for line in sys.stdin` usa un buffer de
    # lectura anticipada que puede retener lineas hasta llenarlo.
    while True:
        line = sys.stdin.readline()
        if not line:
            break  # EOF: Electron cerro el proceso
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            emit({"event": "error", "message": f"JSON invalido en stdin: {line[:200]}"})
            continue
        if msg.get("cmd") == "shutdown":
            emit({"id": msg.get("id"), "ok": True, "data": {"bye": True}})
            break
        # El trabajo pesado se delega: el lector queda libre de inmediato.
        future = _executor.submit(_run_command, msg)
        future.add_done_callback(_report_worker_crash)

    # wait=True: los comandos ya aceptados terminan y responden. Cancelarlos
    # dejaria al cliente esperando un resultado que nunca llega.
    _executor.shutdown(wait=True)


if __name__ == "__main__":
    main()
