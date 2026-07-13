Actúa como arquitecto senior de software y agente de implementación dentro del repositorio `SofLIA-HUB`.

Necesito que analices el proyecto completo antes de modificar código. El sistema actual es una aplicación desktop construida con Electron + React + TypeScript + Supabase, con un Desktop Agent V2 para Computer Use, automatización de escritorio, WhatsApp, Google Workspace, memoria local, generación de documentos, OCR, Playwright, `nut-js`, `onnxruntime-node`, `tesseract.js`, `sharp`, `better-sqlite3` y servicios en el proceso principal de Electron.

Ahora se añadió Python al stack. Tu tarea es diseñar e implementar una arquitectura profesional para integrar herramientas Python que mejoren el sistema sin romper la arquitectura TypeScript existente.

El objetivo NO es reemplazar el backend actual. El objetivo es crear un **Python Sidecar Service** local que funcione como motor especializado para:

1. Percepción visual del escritorio.
2. OCR avanzado.
3. Parsing de documentos.
4. Audio, voz, STT, VAD y diarización.
5. Memoria semántica y RAG local.
6. Seguridad, anonimización y detección de PII.
7. Evaluación de agentes, RAG y workflows.
8. Empaquetado profesional del servicio Python junto con Electron.

---

## 1. Análisis previo obligatorio

Antes de implementar, revisa como mínimo:

* `package.json`
* `electron/main.ts`
* `electron/preload.ts`
* `electron/desktop-agent-service.ts`
* `electron/desktop-agent/`
* `electron/desktop-agent/agent-config.ts`
* `electron/desktop-agent/service-coordinates.ts`
* `electron/desktop-agent/service-screenshot.ts`
* `electron/desktop-agent/visual-parser/`
* `electron/ocr-service.ts`
* `electron/memory-service.ts`
* `electron/knowledge-service.ts`
* `electron/meetings/`
* `src/services/`
* `src/components/`
* `src/hooks/`
* `src/lib/`
* `electron-builder.json5`
* `.github/workflows/`

Detecta cómo está organizado el IPC, cómo se exponen los servicios al renderer, cómo se sanitizan los payloads, cómo se capturan screenshots, cómo se calculan coordenadas, cómo se integran UIA/OCR/visual parser y cómo se manejan los servicios con EventEmitter.

No dupliques funcionalidades que ya existen en TypeScript. Integra Python como una capa auxiliar.

---

## 2. Arquitectura objetivo

Implementa o prepara la base para esta arquitectura:

```txt
SofLIA-HUB/
├── electron/
│   ├── python-sidecar-manager.ts
│   ├── python-sidecar-client.ts
│   ├── python-sidecar-handlers.ts
│   └── desktop-agent/
│       └── integración opcional con Python Vision/OCR
│
├── src/
│   ├── services/
│   │   ├── python-sidecar-service.ts
│   │   ├── python-vision-service.ts
│   │   ├── python-audio-service.ts
│   │   ├── python-document-service.ts
│   │   ├── python-memory-service.ts
│   │   └── python-privacy-service.ts
│   └── components/
│       └── paneles de diagnóstico si aplica
│
├── python/
│   ├── main.py
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── services/
│   │   ├── health_service.py
│   │   ├── screen_capture_service.py
│   │   ├── vision_service.py
│   │   ├── ocr_service.py
│   │   ├── document_service.py
│   │   ├── audio_service.py
│   │   ├── memory_service.py
│   │   ├── privacy_service.py
│   │   ├── eval_service.py
│   │   └── security_audit_service.py
│   ├── schemas/
│   │   ├── screen.py
│   │   ├── vision.py
│   │   ├── ocr.py
│   │   ├── document.py
│   │   ├── audio.py
│   │   ├── memory.py
│   │   └── privacy.py
│   ├── utils/
│   │   ├── logging.py
│   │   ├── image.py
│   │   ├── files.py
│   │   └── platform.py
│   └── tests/
│       ├── test_health.py
│       ├── test_ocr.py
│       ├── test_documents.py
│       ├── test_privacy.py
│       └── test_memory.py
```

El servicio Python debe correr localmente, preferentemente en `127.0.0.1`, usando FastAPI.

Electron debe arrancar y detener el proceso Python de manera controlada. Debe haber health checks, logs, timeouts, reintentos y fallback si Python no está disponible.

---

## 3. Herramientas Python a considerar

Implementa la arquitectura dejando soporte modular para estas herramientas. No instales todo de golpe si alguna dependencia es pesada o riesgosa; crea adaptadores opcionales y degradación elegante.

### Base del sidecar

Usar:

```txt
fastapi
uvicorn
pydantic
httpx
websockets
python-multipart
numpy
pillow
opencv-python
```

Objetivo:

* API local.
* Validación estricta.
* Endpoints HTTP.
* WebSockets para audio/streaming.
* Manejo de imágenes base64.
* Contratos claros con TypeScript.

---

### Captura de pantalla y Computer Use

Evaluar e integrar:

```txt
mss
dxcam
pywinauto
pyautogui
keyboard
```

Uso esperado:

* `mss`: captura multi-monitor cross-platform.
* `dxcam`: captura rápida en Windows para Computer Vision y agentes visuales.
* `pywinauto`: automatización Windows por UIA/Win32.
* `pyautogui`: fallback simple de mouse/teclado/screenshot.
* `keyboard`: hotkeys globales, cancelación de tareas, grabación de acciones.

No reemplaces `nut-js` todavía. Python debe actuar como backend alternativo o complementario.

Endpoints sugeridos:

```txt
GET  /screen/displays
POST /screen/capture
POST /screen/capture-region
POST /screen/active-window
POST /input/move
POST /input/click
POST /input/type
POST /input/hotkey
```

El contrato debe regresar coordenadas físicas, coordenadas DIP cuando aplique, display id, escala, bounds y metadatos de monitor.

---

### Visión, OCR y layout

Evaluar e integrar:

```txt
paddleocr
surya-ocr
easyocr
layoutparser
opencv-python
pytesseract
```

Opcional/experimental:

```txt
microsoft/OmniParser
```

Uso esperado:

* PaddleOCR: OCR robusto para documentos, pantallas y tablas.
* Surya OCR: OCR, layout, tablas, orden de lectura.
* EasyOCR: OCR simple y rápido con múltiples idiomas.
* LayoutParser: análisis de layout de documentos.
* OpenCV: preprocesamiento de imágenes.
* Pytesseract: fallback si se requiere.
* OmniParser: detección/captioning de elementos UI, solo como módulo experimental por posibles implicaciones de licencia.

El sistema actual ya tiene `tesseract.js`, `onnxruntime-node`, `sharp` y un parser visual tipo OmniParser. No dupliques sin necesidad. Integra Python como proveedor adicional de elementos para el Desktop Agent.

Endpoints sugeridos:

```txt
POST /vision/parse-screen
POST /vision/detect-ui-elements
POST /vision/describe-elements
POST /ocr/image
POST /ocr/screen
POST /ocr/document
POST /layout/analyze
```

El resultado debe ser compatible con algo similar a:

```json
{
  "success": true,
  "source": "paddleocr",
  "elements": [
    {
      "id": "ocr_1",
      "type": "text",
      "label": "Enviar",
      "text": "Enviar",
      "confidence": 0.94,
      "bbox": {
        "x": 812,
        "y": 642,
        "width": 96,
        "height": 34
      },
      "center": {
        "x": 860,
        "y": 659
      }
    }
  ],
  "metadata": {
    "imageWidth": 1024,
    "imageHeight": 768,
    "durationMs": 128
  }
}
```

---

### Parsing de documentos

Evaluar e integrar:

```txt
docling
markitdown
unstructured
pymupdf
pdfplumber
python-docx
openpyxl
python-pptx
beautifulsoup4
lxml
```

Uso esperado:

* Docling: parsing avanzado de PDFs, DOCX, PPTX, XLSX, imágenes y documentos complejos.
* MarkItDown: conversión rápida de archivos a Markdown para LLMs.
* Unstructured: particionado de documentos y extracción limpia.
* PyMuPDF/pdfplumber: PDF parsing, tablas y texto.
* python-docx/openpyxl/python-pptx: manipulación directa de Office si hace falta.
* BeautifulSoup/lxml: HTML/XML.

Endpoints sugeridos:

```txt
POST /documents/convert-to-markdown
POST /documents/parse
POST /documents/extract-tables
POST /documents/extract-metadata
POST /documents/chunk
```

Regla recomendada:

```txt
MarkItDown → archivos simples y conversión rápida.
Docling → documentos complejos, PDFs con tablas, reportes, presentaciones.
Unstructured → pipelines flexibles para RAG y clasificación.
```

El resultado debe regresar:

```json
{
  "success": true,
  "format": "markdown",
  "markdown": "...",
  "tables": [],
  "metadata": {},
  "chunks": []
}
```

---

### Audio, voz, STT, VAD, diarización y TTS

Evaluar e integrar:

```txt
faster-whisper
whisperx
silero-vad
sherpa-onnx
pyannote.audio
piper-tts
sounddevice
soundfile
librosa
pydub
webrtcvad
```

Uso esperado:

* `faster-whisper`: transcripción offline rápida.
* `whisperx`: timestamps precisos y diarización para reuniones.
* `silero-vad`: detección de voz/silencio.
* `sherpa-onnx`: STT/TTS/VAD offline con ONNX.
* `pyannote.audio`: diarización de speakers.
* `piper-tts`: TTS local opcional.
* `sounddevice`/`soundfile`: captura y procesamiento de audio.
* `librosa`: features de audio para animaciones tipo orbe reactivo.
* `pydub`: manipulación de archivos de audio.
* `webrtcvad`: VAD ligero alternativo.

Endpoints sugeridos:

```txt
POST /audio/transcribe
POST /audio/vad
POST /audio/diarize
POST /audio/features
POST /audio/tts
WS   /audio/stream
```

Para el orbe visual en React, exponer valores como:

```json
{
  "speaking": true,
  "volume": 0.72,
  "energy": 0.83,
  "bass": 0.45,
  "mid": 0.66,
  "treble": 0.28,
  "pitch": 174.2,
  "speechRate": 1.15
}
```

React/Electron debe usar esos valores para animaciones no repetitivas del orbe, pero el render visual debe permanecer en React con Three.js / React Three Fiber.

---

### Memoria semántica, RAG y NLP local

Evaluar e integrar:

```txt
sentence-transformers
qdrant-client
chromadb
faiss-cpu
llama-index
haystack-ai
spacy
rank-bm25
rapidfuzz
```

Uso esperado:

* `sentence-transformers`: embeddings locales y reranking.
* `qdrant-client`: vector DB local/persistente.
* `chromadb`: alternativa simple para vector DB local.
* `faiss-cpu`: búsqueda vectorial local de alto rendimiento.
* `llama-index`: document agents y RAG.
* `haystack-ai`: pipelines RAG más controlados.
* `spacy`: extracción local de entidades, nombres, fechas, organizaciones.
* `rank-bm25`: búsqueda lexical.
* `rapidfuzz`: matching difuso, deduplicación y similitud de nombres.

No reemplaces de inmediato el sistema actual de memoria con SQLite/FTS5. Integra estas herramientas como capa opcional para mejorar búsqueda semántica y reranking.

Endpoints sugeridos:

```txt
POST /memory/embed
POST /memory/rerank
POST /memory/search
POST /memory/extract-facts
POST /memory/deduplicate
POST /rag/query
POST /rag/chunk
```

Contrato sugerido:

```json
{
  "query": "qué se acordó en la última reunión",
  "topK": 10,
  "filters": {
    "source": "meetings"
  }
}
```

Respuesta:

```json
{
  "success": true,
  "results": [
    {
      "id": "chunk_1",
      "score": 0.87,
      "source": "meeting",
      "text": "...",
      "metadata": {}
    }
  ]
}
```

---

### Seguridad, privacidad y compliance

Evaluar e integrar:

```txt
presidio-analyzer
presidio-anonymizer
presidio-image-redactor
bandit
pip-audit
detect-secrets
python-dotenv
```

Uso esperado:

* `presidio-analyzer`: detectar PII en texto.
* `presidio-anonymizer`: anonimizar/redactar PII.
* `presidio-image-redactor`: redacción de PII en imágenes.
* `bandit`: análisis estático de seguridad.
* `pip-audit`: auditoría de dependencias.
* `detect-secrets`: evitar secretos en commits.
* `python-dotenv`: config local segura.

Endpoints sugeridos:

```txt
POST /privacy/analyze-text
POST /privacy/redact-text
POST /privacy/redact-image
POST /security/audit-dependencies
POST /security/audit-code
```

El sidecar debe permitir una política tipo:

```txt
Antes de enviar contenido a modelos cloud:
1. OCR/document/audio/email/screenshot.
2. Detectar PII.
3. Redactar o marcar.
4. Enviar versión segura al modelo.
5. Guardar trazabilidad.
```

---

### Evaluación de agentes, RAG y calidad

Evaluar e integrar:

```txt
ragas
deepeval
pytest
hypothesis
pytest-asyncio
coverage
```

Uso esperado:

* `ragas`: evaluación de RAG y respuestas.
* `deepeval`: testing de agentes, tool use, hallucination, JSON correctness y step efficiency.
* `pytest`: testing Python normal.
* `hypothesis`: pruebas con inputs extremos.
* `pytest-asyncio`: pruebas de FastAPI/WebSockets.
* `coverage`: cobertura de tests.

Endpoints opcionales:

```txt
POST /eval/rag
POST /eval/agent-run
POST /eval/json-contract
POST /eval/tool-use
```

También agrega scripts locales:

```txt
python -m pytest
python -m coverage run -m pytest
python -m bandit -r python/
python -m pip_audit
```

---

### Empaquetado y distribución

Evaluar e integrar:

```txt
pyinstaller
nuitka
ruff
black
mypy
```

Uso esperado:

* `pyinstaller`: empaquetar sidecar como ejecutable.
* `nuitka`: alternativa más optimizada.
* `ruff`: linting/formato rápido.
* `black`: formato si se decide usarlo.
* `mypy`: type checking.

Crear scripts:

```txt
npm run python:install
npm run python:dev
npm run python:test
npm run python:lint
npm run python:audit
npm run python:build
```

En `electron-builder`, preparar inclusión del binario Python dentro de recursos de la app, sin romper Windows/macOS/Linux.

---

## 4. Integración con Electron

Crea un manager de proceso Python:

```ts
electron/python-sidecar-manager.ts
```

Debe:

* Detectar si existe binario empaquetado.
* En desarrollo usar `python/python.exe` o entorno local.
* En producción usar el ejecutable empaquetado.
* Elegir puerto local libre.
* Lanzar proceso con variables de entorno controladas.
* Esperar `/health`.
* Reintentar si falla.
* Apagar proceso al cerrar Electron.
* Guardar logs.
* Exponer estado al renderer.
* No bloquear el arranque de la app si Python falla.

Crear cliente TypeScript:

```ts
electron/python-sidecar-client.ts
```

Debe tener métodos tipados para:

```ts
health()
parseScreen()
ocrImage()
parseDocument()
transcribeAudio()
audioFeatures()
embed()
rerank()
redactText()
redactImage()
runEval()
```

Crear handlers IPC:

```ts
electron/python-sidecar-handlers.ts
```

Agregar canales de forma segura al preload y allowlist existente.

Ejemplo de canales:

```txt
python:health
python:restart
python:status
python:vision:parse-screen
python:ocr:image
python:documents:parse
python:audio:transcribe
python:audio:features
python:memory:embed
python:memory:rerank
python:privacy:redact-text
python:security:audit
```

Todos los payloads deben validarse con Zod o validación equivalente en TypeScript antes de pasar a Python.

---

## 5. Integración con Desktop Agent

El Desktop Agent ya tiene fuentes de elementos: UIA, OCR y visual parser.

Integra Python como proveedor adicional sin romper los existentes:

```txt
UIA
+ OCR actual
+ visual parser ONNX actual
+ Python OCR/Vision provider
= ElementSource final deduplicado
```

Agregar flags de configuración:

```ts
pythonSidecarEnabled: boolean;
pythonVisionEnabled: boolean;
pythonOcrEnabled: boolean;
pythonAudioEnabled: boolean;
pythonDocumentsEnabled: boolean;
pythonPrivacyEnabled: boolean;
pythonMemoryEnabled: boolean;
pythonEvalEnabled: boolean;
```

Agregar degradación elegante:

```txt
Si Python no está disponible:
- no romper Desktop Agent
- usar UIA + OCR actual + visual parser actual
- mostrar diagnóstico en logs
```

---

## 6. Contratos de datos

Define schemas tanto en Python con Pydantic como en TypeScript con Zod o interfaces fuertes.

Contratos mínimos:

```txt
HealthStatus
ScreenCaptureRequest
ScreenCaptureResponse
VisionElement
VisionParseResponse
OCRBox
OCRResponse
DocumentParseRequest
DocumentParseResponse
AudioTranscriptionRequest
AudioTranscriptionResponse
AudioFeatureFrame
EmbeddingRequest
EmbeddingResponse
RerankRequest
RerankResponse
PrivacyAnalysisRequest
PrivacyAnalysisResponse
PrivacyRedactionResponse
EvalRequest
EvalResponse
```

Todo endpoint debe regresar un formato consistente:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "metadata": {
    "durationMs": 0,
    "service": "python-sidecar",
    "version": "0.1.0"
  }
}
```

En caso de error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "OCR_MODEL_NOT_AVAILABLE",
    "message": "PaddleOCR no está disponible",
    "recoverable": true
  },
  "metadata": {
    "durationMs": 0
  }
}
```

---

## 7. Priorización de implementación

No implementes todo de golpe. Hazlo por fases.

### Fase 1 — Sidecar base

Implementar:

```txt
fastapi
uvicorn
pydantic
pillow
opencv-python
mss
```

Crear:

```txt
/health
/screen/capture
/ocr/image básico
```

Integrar con Electron:

```txt
python-sidecar-manager.ts
python-sidecar-client.ts
python-sidecar-handlers.ts
preload.ts
allowlist IPC
```

Criterio de aceptación:

```txt
La app arranca.
Electron lanza Python.
Renderer puede consultar python:health.
Se puede enviar una imagen base64 a Python y recibir respuesta.
Si Python falla, la app sigue funcionando.
```

---

### Fase 2 — OCR y visión avanzada

Agregar:

```txt
paddleocr
surya-ocr
easyocr
layoutparser
```

Implementar:

```txt
/ocr/image
/ocr/screen
/vision/detect-ui-elements
/layout/analyze
```

Criterio de aceptación:

```txt
El Desktop Agent puede recibir elementos detectados por Python.
Los elementos tienen bbox, label, confidence, source y center.
Se deduplican contra UIA/OCR actual.
No rompe el parser ONNX actual.
```

---

### Fase 3 — Audio y orbe reactivo

Agregar:

```txt
silero-vad
faster-whisper
sounddevice
soundfile
librosa
```

Opcional:

```txt
sherpa-onnx
pyannote.audio
whisperx
piper-tts
```

Implementar:

```txt
/audio/vad
/audio/transcribe
/audio/features
/audio/stream
```

Criterio de aceptación:

```txt
Python devuelve volumen, energía, pitch, speaking, bass, mid, treble.
React puede usar esos datos para animar un orbe.
La transcripción local funciona con un archivo de audio.
```

---

### Fase 4 — Document AI

Agregar:

```txt
markitdown
docling
unstructured
pymupdf
pdfplumber
python-docx
openpyxl
python-pptx
```

Implementar:

```txt
/documents/convert-to-markdown
/documents/parse
/documents/extract-tables
/documents/chunk
```

Criterio de aceptación:

```txt
PDF, DOCX, PPTX y XLSX pueden convertirse a Markdown o JSON.
Se pueden extraer tablas.
Se pueden generar chunks para Knowledge/Memory.
```

---

### Fase 5 — Memoria semántica

Agregar:

```txt
sentence-transformers
qdrant-client
chromadb
faiss-cpu
spacy
rank-bm25
rapidfuzz
```

Implementar:

```txt
/memory/embed
/memory/rerank
/memory/search
/memory/extract-facts
/memory/deduplicate
```

Criterio de aceptación:

```txt
Se pueden generar embeddings locales.
Se puede rerankear una lista de chunks.
Se puede mejorar la búsqueda semántica sin reemplazar SQLite/FTS5 actual.
```

---

### Fase 6 — Privacidad y seguridad

Agregar:

```txt
presidio-analyzer
presidio-anonymizer
presidio-image-redactor
bandit
pip-audit
detect-secrets
```

Implementar:

```txt
/privacy/analyze-text
/privacy/redact-text
/privacy/redact-image
/security/audit-code
/security/audit-dependencies
```

Criterio de aceptación:

```txt
Se detecta PII en texto.
Se puede anonimizar texto antes de enviarlo al modelo.
Se puede auditar código y dependencias Python.
```

---

### Fase 7 — Evaluación de agentes

Agregar:

```txt
ragas
deepeval
pytest
hypothesis
pytest-asyncio
coverage
```

Implementar:

```txt
/eval/rag
/eval/agent-run
/eval/json-contract
/eval/tool-use
```

Criterio de aceptación:

```txt
Se puede evaluar una respuesta RAG.
Se puede evaluar si un agente usó la herramienta correcta.
Se puede detectar JSON inválido o tool use incorrecto.
```

---

### Fase 8 — Build y distribución

Agregar:

```txt
pyinstaller
nuitka
ruff
mypy
```

Implementar:

```txt
npm run python:install
npm run python:dev
npm run python:test
npm run python:lint
npm run python:audit
npm run python:build
```

Criterio de aceptación:

```txt
El sidecar Python se puede correr en desarrollo.
El sidecar Python se puede empaquetar.
Electron Builder incluye el binario o recursos necesarios.
La app no falla si el sidecar no existe.
```

---

## 8. Reglas técnicas estrictas

Cumple estas reglas:

1. No rompas la app actual.
2. No reemplaces servicios TypeScript existentes sin justificación.
3. No metas dependencias pesadas en producción sin flag experimental.
4. Todo debe tener fallback.
5. Todo endpoint debe tener timeout.
6. Todo error debe ser estructurado.
7. No expongas Python a red externa; usar `127.0.0.1`.
8. No guardar imágenes/audio sensibles sin consentimiento explícito.
9. No enviar PII a modelos cloud sin pasar por módulo de privacidad si está habilitado.
10. No romper `contextIsolation`.
11. No agregar canales IPC sin allowlist.
12. No aceptar payloads sin sanitización.
13. No bloquear el arranque de Electron si Python falla.
14. No implementar UI grande hasta validar servicios base.
15. Documenta cada módulo en `docs/python-sidecar.md`.

---

## 9. Entregables esperados

Al finalizar, entrega:

1. Análisis breve del estado actual del repo.
2. Lista de archivos modificados/creados.
3. Arquitectura final propuesta.
4. Implementación de Fase 1 completa.
5. Stubs o adaptadores para fases futuras.
6. Scripts npm agregados.
7. Tests mínimos.
8. Documentación en `docs/python-sidecar.md`.
9. Instrucciones de instalación.
10. Riesgos técnicos y dependencias pesadas identificadas.

---

## 10. Resultado esperado final

Quiero que SofLIA Hub tenga una base profesional para Python así:

```txt
Electron + React + TypeScript:
- UI
- IPC seguro
- Desktop Agent actual
- Supabase
- WhatsApp
- Google Workspace
- automatización principal

Python Sidecar:
- visión avanzada
- OCR premium
- documentos
- audio/STT/VAD
- memoria semántica
- privacidad/PII
- evaluación de agentes
- auditoría de seguridad
```

El primer objetivo concreto es:

```txt
SofLIA Hub debe poder arrancar un servicio Python local, verificar su salud, enviarle una imagen o screenshot, recibir OCR/elementos estructurados, y degradar de forma segura si Python no está disponible.
```

Implementa primero lo mínimo estable, dejando la arquitectura preparada para integrar el resto de herramientas por fases.
