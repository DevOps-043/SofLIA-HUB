# Sidecars de Python en Pulse Hub

SofLIA distribuye un runtime de Python **embebido** (`python-runtime/`, no versionado, generado por
`npm run python:setup` y empaquetado con `extraResources`). Sobre él corren **dos procesos sidecar
independientes**, ambos con el mismo protocolo NDJSON sobre stdin/stdout:

| Sidecar | Código | Servicio Electron | Responsabilidad |
|---|---|---|---|
| **Voz** | `python/sidecar/` | `electron/python-runtime-service.ts` | Wake word y dictado local (Vosk). Tiene el micrófono en exclusiva y ~1.5 GB de modelos residentes. |
| **Herramientas** | `python/tools_sidecar/` | `electron/python-tools-service.ts` | Lectura de documentos (PDF/XLSX/PPTX/DOCX) y redacción de datos personales (PII). |

**Por qué dos procesos y no uno:** el sidecar de voz mantiene el micrófono abierto y los modelos en
RAM. Un fallo parseando un PDF corrupto no debe tumbar la escucha pasiva, y la lógica de reinicio del
sidecar de voz está atada a ella. El aislamiento cuesta casi nada: el sidecar de herramientas arranca
**de forma perezosa** (solo en la primera petición real) y no carga ningún modelo.

## Protocolo

```jsonc
// Petición (Electron → Python), una línea por mensaje
{ "id": 1, "cmd": "parse_document", "params": { "file_path": "C:/facturas/marzo.pdf", "redact": false } }

// Respuesta OK
{ "id": 1, "ok": true, "data": { "markdown": "...", "tables": [], "metadata": {} },
  "metadata": { "durationMs": 812, "service": "tools-sidecar" } }

// Respuesta con error (siempre con código estable y `recoverable`)
{ "id": 1, "ok": false, "error": { "code": "DOC_ENCRYPTED", "message": "...", "recoverable": false },
  "metadata": { "durationMs": 4, "service": "tools-sidecar" } }
```

Comandos del sidecar de herramientas: `ping`, `parse_document`, `analyze_pii`, `redact_text`, `shutdown`.

Códigos de error de documentos: `DOC_NOT_FOUND`, `DOC_TOO_LARGE`, `DOC_UNSUPPORTED`, `DOC_ENCRYPTED`,
`DOC_SCANNED` (PDF de imágenes, sin capa de texto), `DOC_PARSE_FAILED`. Del transporte:
`SIDECAR_UNAVAILABLE`, `SIDECAR_START_FAILED`, `SIDECAR_CRASHED`, `TIMEOUT`.

## Decisiones clave

### El lector de stdin nunca se bloquea

Los comandos se despachan a un `ThreadPoolExecutor`; el bucle que lee stdin queda libre de inmediato.
Sin esto, parsear un PDF de 200 páginas congelaría todos los demás comandos (es el defecto que sí
tiene el sidecar de voz: `mic_probe` bloquea 3 s). Hay un test que lo demuestra:
`test_una_tarea_larga_no_bloquea_los_demas_comandos`.

Detalle no obvio: el runtime **embebido** de Python no añade el directorio del script a `sys.path`
(su archivo `._pth` lo impide), por eso `main.py` hace `sys.path.insert(0, ...)`. Sin esa línea, los
módulos hermanos (`documents`, `privacy`) no se importan y todo comando falla con `ModuleNotFoundError`.

### Documentos: sin tool nueva

`read_file` (el mismo que ya usaban el agente de WhatsApp y el chat) detecta la extensión y delega en
el sidecar; devuelve **Markdown con las tablas conservadas**. El agente gana la capacidad sin que haya
que declarar una herramienta nueva ni reentrenar prompts.

Antes, la única forma de "leer" un PDF era **subir el archivo entero a Gemini**: coste, latencia,
límite de 15 MB y el documento completo saliendo a la nube. Ahora se procesa en local.
`.docx` mantiene el fallback a `mammoth` si Python no está (mammoth aplana las tablas, pero es mejor
que nada); el resto de formatos devuelve un error accionable.

### Licencias: PyMuPDF está descartado

`PyMuPDF`/`fitz` es **AGPL-3.0**: incompatible con un producto comercial cerrado. Se usa `pdfplumber`
(MIT), que además extrae tablas. Todas las dependencias del sidecar son MIT/BSD:

| Librería | Licencia | Para qué |
|---|---|---|
| `pdfplumber` | MIT | Texto y tablas de PDF |
| `openpyxl` | MIT | XLSX (modo `read_only` + `data_only`) |
| `python-pptx` | MIT | PPTX |
| `python-docx` | MIT | DOCX con tablas |

Tampoco se usan `markitdown`, `docling` ni `unstructured`: arrastran decenas de dependencias
transitivas para lo que aquí son ~150 líneas de conversión a Markdown.

### PII: opt-in y redactada dentro de Python

`privacy.py` detecta RFC, CURP, CLABE, IBAN, tarjeta (**validada con Luhn**, para que un folio de 16
dígitos no se confunda con una tarjeta), teléfono MX y correo. Todo con regex locales, sin dependencias.

Dos decisiones deliberadas:

1. **La redacción ocurre dentro del sidecar** (`parse_document` con `redact: true`). El texto original
   nunca cruza a Electron, así que no puede filtrarse por un log, un error o un camino de código futuro.
   `analyze`/`redact` tampoco devuelven el texto de la entidad detectada: solo tipo y posición.
2. **Está DESACTIVADA por defecto.** Activarla cambiaría en silencio lo que ve el modelo (pedir
   "dime el RFC del cliente" pasaría a responder que está oculto). El usuario la enciende en
   Ajustes → Privacidad; la preferencia vive en `userData/privacy-config.json`.

Presidio + spaCy (nombres y direcciones por NER) queda como mejora futura opcional: son ~50 MB de
modelo. El contrato ya devuelve `engine` (`soflia-regex-mx`) para que el consumidor sepa con qué se
analizó el texto.

### Seguridad

Sin puerto de red (todo por stdio), rutas validadas por la capa de `computer-use` que ya existe,
límite de tamaño (50 MB) y de páginas (200), timeout por comando (60 s documentos, 10 s el resto),
y el contenido de los documentos nunca se escribe en los logs.

## Qué se rechazó del prompt original (`docs/archive/prompts/python-sidecar-original.md`)

El documento proponía un servidor **FastAPI + uvicorn** en `127.0.0.1` con ~60 dependencias.
Contrastado con el código real, la mayor parte duplicaba lo que ya existe:

| Propuesta | Por qué no |
|---|---|
| FastAPI + uvicorn + puerto local + PyInstaller | Ya existe el transporte NDJSON sobre stdio (ciclo de vida, correlación por `id`, timeouts, reintentos). Un servidor HTTP lo duplicaría y **abriría un puerto local**: superficie de ataque nueva a cambio de nada. |
| `mss`, `dxcam`, `pyautogui`, `pywinauto` | Duplican `nut.js` + `desktopCapturer` + UIA, en producción y ya corregidos para multi-monitor. |
| `paddleocr`, `surya-ocr`, `easyocr` | Ya hay OCR (`electron/ocr-service.ts`, tesseract spa+eng) y un parser visual ONNX fusionado por IoU. Ganancia marginal frente a cientos de MB. |
| `faster-whisper`, `whisperx`, `pyannote` | Vosk ya hace STT local (wake word + dictado) y funciona. |
| `qdrant`, `chromadb`, `faiss`, `llama-index` | Sobredimensionado: la memoria maneja ≤5000 chunks con coseno en JS. |
| `ragas`, `deepeval` | Infraestructura de evaluación sin valor de usuario hoy. |

Solo se implementaron los **tres huecos reales** verificados en el código: el sidecar que se bloquea,
la imposibilidad de leer un PDF en local y la ausencia total de redacción de PII antes de la nube.

## Cómo extender

1. Añade el módulo en `python/tools_sidecar/` y su dependencia (MIT/BSD) en `requirements.txt`.
2. Registra el comando en `_run_command` de `main.py` (respuesta con `_respond_ok` / `_respond_error`).
3. Expón el método en `PythonToolsService` con su timeout.
4. Si el renderer lo necesita: handler IPC + canal en `preload/channel-group-4.ts` + método en
   `src/services/python-tools-service.ts`. Si solo lo usa un agente, **no hace falta IPC**: llama al
   servicio desde el ejecutor de la herramienta.
5. Tests: `python/tools_sidecar/tests/` (lógica) y `electron/__tests__/` (contrato y degradación).

Regla de oro: **si Python no está, la app sigue funcionando.** Cada llamada comprueba `isAvailable()`
y el camino de TypeScript existente debe seguir siendo válido.

## Comandos

```bash
npm run python:setup                                        # instala runtime + dependencias de ambos sidecars
python-runtime/python.exe -m pytest python/tools_sidecar/tests -q   # tests del sidecar de herramientas
npx vitest run --project main electron/__tests__/python-tools-service.test.ts
```
