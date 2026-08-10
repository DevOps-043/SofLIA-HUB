# Parametros runtime

Estado: vigente. Actualizado: 2026-08-06.

Inventario de defaults y topes con impacto operativo. Los overrides guardados en
`userData` pueden cambiar el valor efectivo de un host.

<!-- evidence: electron/desktop-agent/agent-config.ts -->
<!-- evidence: electron/memory/constants.ts -->
<!-- evidence: electron/monitoring/service-state.ts -->
<!-- evidence: electron/main/boot-timeline.ts -->
<!-- evidence: electron/main/window-controller.ts -->
<!-- evidence: electron/main/bootstrap.ts -->
<!-- evidence: electron/integrated-browser/types.ts -->
<!-- evidence: electron/integrated-browser/validation.ts -->

## Arranque

La ventana principal se crea antes de la cadena de servicios no esenciales y se
revela en `ready-to-show` para evitar el destello en blanco. El intro de audio
solo suena con la ventana visible (`visibilityState`), no en modo background.

| Parametro | Default/tope | Fuente |
|---|---:|---|
| fallback de `ready-to-show` | 4000 ms | `electron/main/window-controller.ts` |
| orden serial legacy (rollback) | `SOFLIA_STARTUP_LEGACY_ORDER=1` | `electron/main/bootstrap.ts` |
| hitos de arranque | `[BOOT] hito fase=... t_relativo_ms=... duracion_ms=...` | `electron/main/boot-timeline.ts` |

Presupuestos (tiempo hasta `ventana:visible` y hasta `servicios:init:fin`): se
fijan con la medicion antes/despues de la instrumentacion en los escenarios frio
tras reinicio, caliente y `--background`. Ver el cambio
`openspec/changes/optimize-startup-fluidity`. No se declara una cifra sin
evidencia medida en el host de referencia.

## Aplicacion e IPC

| Parametro | Default/tope | Fuente |
|---|---:|---|
| intro / gracia auth / salida overlay | 4200 / 700 / 1250 ms | `src/app/AppContent.tsx` |
| historial clipboard / polling | 100 / 5000 ms | `electron/main/service-factory.ts` |
| profundidad / array / claves IPC | 20 / 1000 / 200 | `electron/preload/safe-ipc.ts` |
| notas de release | 8000 caracteres | `src/components/update-notes/SafeReleaseNotes.tsx` |
| updater polling | 4 h | `electron/updater/constants.ts` |

## Navegador integrado

| Parametro | Default/tope | Fuente |
|---|---:|---|
| particion persistente | `persist:soflia-integrated-browser` | `electron/integrated-browser/types.ts` |
| espera de viewport para el agente | 8000 ms | mismo archivo |
| pestañas del navegador integrado | máximo 500 lógicas; máximo 8 `WebContentsView` vivas globales; una principal y una secundaria visible | `electron/integrated-browser/types.ts` |
| ventanas separadas | máximo 4 `BaseWindow`; mueven la misma vista y cuentan dentro de las 8 vivas | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts` |
| composición de pestañas | `single`, `split` o `overlay`; foco = objetivo de Computer Use | `electron/integrated-browser/service.ts` |
| percepción de pestaña activa | cadencia base 10.000 ms y calma 4.000 ms; YouTube: 30.000/12.000 ms; máximo 1024 px en captura pasiva; solo con ventana enfocada y fuera de Computer Use; DOM completo bajo demanda y solo para turnos dependientes del navegador; una captura por tipo en vuelo; solo último snapshot en memoria; pausada por usuario | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts`, `src/services/gemini-chat/send-message-stream.ts` |
| límites del DOM observado | texto 24.000 caracteres; 100 encabezados; 60 landmarks; 240 controles; 30 frames; 1.800 nodos y margen de viewport 240 px; sin valores de formularios | `electron/integrated-browser/page-observation.ts` |
| longitud de direccion/busqueda | 2048 caracteres | `electron/integrated-browser/validation.ts` |
| viewport minimo | 160 x 120 DIP | mismo archivo |
| protocolos de pagina principal | HTTP(S) y `about:blank` | mismo archivo |
| permisos administrados por sitio | `camera`, `microphone`, `geolocation`, `notifications`, `display-capture`, `clipboard-read`, `idle-detection`, `window-management` preguntan; `fullscreen`, `pointer-lock`, `keyboard-lock`, `speaker-selection`, `protected-media` se conceden sin interrumpir; alcanzan a cualquier pestaña viva de la partición | `electron/integrated-browser/permission-governance.ts`, `electron/integrated-browser/types.ts` |
| permisos concedidos sin panel | `clipboard-sanitized-write`, `storage-access`, `top-level-storage-access` | `electron/integrated-browser/permission-governance.ts` |
| permisos siempre denegados | `usb`, `serial`, `hid`, `midi`, `midiSysex`, `openExternal`, `fileSystem` y cualquier nombre desconocido | mismo archivo |
| estado reportado a `permissions.query` | `camera`, `microphone` y `speaker-selection` sin decidir responden concedido para que la página llegue a solicitarlos; la concesión real ocurre en el diálogo | mismo archivo |
| almacén de permisos por sitio | `site-permissions.json` en `userData/integrated-browser`; clave por origen HTTP(S) exacto; máximo 500 orígenes | `electron/integrated-browser/site-permissions.ts` |
| permiso nativo de cámara y micrófono | consultado en macOS y Windows antes de conceder; `denied`/`restricted` corta sin preguntar; `not-determined` en macOS dispara `askForMediaAccess`; Linux lo delega al servidor de audio/video | `electron/integrated-browser/permission-governance.ts`, `electron-builder.json5`, `build/entitlements.mac.plist` |
| compartir pantalla | selector nativo de pantallas y ventanas, máximo 24 orígenes listados; audio del sistema solo en Windows y bajo casilla explícita | `electron/integrated-browser/display-media-picker.ts` |
| pantalla completa de la página | la vista cubre la ventana anfitriona y la ventana pasa a pantalla completa del sistema; al salir se restaura el estado previo | `electron/integrated-browser/service.ts` |
| ventanas emergentes sin destino | `window.open` sin destino abre ventana real que hereda las preferencias del abridor, entre 180 y 2.048 px por lado (640 x 480 por omisión) y sin navegación fuera de HTTP(S); solo se queda encima por debajo de 700 px de ancho | `electron/integrated-browser/service.ts` |
| cuadros de permiso | uno a la vez, encolados; un fallo al mostrarlos responde denegado y nunca deja la solicitud pendiente | `electron/integrated-browser/permission-governance.ts` |
| chat flotante | 332 a 560 DIP (388 default); lado izquierdo o derecho; header de 40 DIP; minimizable o sustituible por Orbe; inicio medido bajo la barra superior | `src/components/browser/BrowserWorkspaceLayout.tsx` |
| convivencia chat/navegador | `WebContentsView` vivo con inset del panel; ancho completo al minimizar | `src/components/browser/IntegratedBrowserPanel.tsx` |
| overlay de gestores | captura puntual + `hide`; no usa polling para componer la página | `src/components/browser/IntegratedBrowserPanel.tsx` |
| contenido del modo lectura | selección hasta 50.000 caracteres; documento hasta 60.000; solo HTTP(S); excluye formularios, controles y contenido editable; Google Docs usa exportación autenticada de hasta 2 MiB con timeout 8 s y árbol AX de hasta 20.000 nodos como respaldo | `electron/integrated-browser/reading-mode-content.ts`, `electron/integrated-browser/reading-accessibility.ts` |
| voz ElevenLabs (Orbe y lectura) | Orbe: máximo 5.000 caracteres por solicitud, timeout 30 s, MP3 hasta 16 MiB; lectura: microlote inicial de hasta 180 caracteres, posteriores de hasta 480, anticipación máxima de dos lotes, contexto anterior/posterior de hasta 600 caracteres, límite defensivo de 3.500 por solicitud, timeout 20 s sin reintento automático y audio transitorio hasta 64 MiB por respuesta; `eleven_turbo_v2_5` + `mp3_44100_128` por defecto; el idioma ISO 639-1 procede del contenido y los aliases españoles conservan un mapa a offsets originales | `electron/elevenlabs-tts.ts`, `electron/speech-text-normalizer.ts`, `electron/orb-tts.ts`, `electron/integrated-browser/reading-mode-service.ts`, `src/components/browser/browser-reading-utils.ts` |
| historial | 2.000 entradas; consulta maxima 200 | `electron/integrated-browser/browser-history-store.ts` |
| credenciales | usuario 320; secreto 4.096 caracteres; maximo almacenado 500 | `electron/integrated-browser/credential-vault.ts` |
| extension desempaquetada | Manifest V3; 2.000 archivos; 20 MiB | `electron/integrated-browser/extension-manager.ts` |
| autorizacion de instalacion | token efimero en memoria; 5 minutos | `electron/integrated-browser/extension-manager.ts` |

Las pestañas integradas y separadas comparten una sola partición. Las
inactivas se suspenden por LRU al superar ocho vistas vivas y recuperan su última
URL cuando vuelven a activarse; no se promete conservar su pila atrás/adelante.
Las pestañas separadas nunca se eligen como víctimas LRU mientras exista su ventana.
Perfiles explicitamente
aislados o con identificador siguen usando `BrowserWebService`/Playwright. Las
extensiones se recargan al iniciar porque Electron no las conserva cargadas; se
rechazan `nativeMessaging`, `debugger`, `proxy` y `management`. Seleccionar otra
carpeta o vencer el plazo invalida la autorizacion pendiente anterior.

## Red, archivos y correo

| Parametro | Default/tope | Fuente |
|---|---:|---|
| Supabase timeout / retries read / backoff | 25 s / 2 / 250 ms | `src/shared/supabase-http.ts` |
| RNF concurrencia (objetivo) / lectura p95 / error | 800 usuarios / < 400 ms / < 0.5 % | `docs/architecture/load-and-scalability.md` |
| archivo leido / search results / depth | 1 MiB / 200 / 8 | `electron/computer-use/filesystem-handlers/constants.ts` |
| comando / shell WhatsApp | 30 s / 15 s | `electron/computer-use/command-tool.ts`, `electron/whatsapp-terminal/shell-handler.ts` |
| destinatarios / asunto / cuerpo / adjuntos | 20 / 300 / 200000 / 10 | `electron/computer-use/email-security.ts` |
| Gmail batch / drain iterations | 100 / 500 | `electron/gmail/batch.ts` |
| media inline WhatsApp | 15 MiB | `electron/wa-agent/media-preparation.ts` |

## Memoria

| Parametro | Valor | Fuente |
|---|---:|---|
| chunk / overlap / chars por token | 400 / 80 / 4 | `electron/memory/constants.ts` |
| mensajes recientes / top K / score minimo | 30 / 10 / 0.22 | mismo archivo |
| budgets summary / semantic / facts / skills | 3000 / 2500 / 1800 / 1500 tokens | mismo archivo |
| skills / summaries en contexto | 8 / 5 | mismo archivo |
| umbral de resumen | 15 mensajes | mismo archivo |
| knowledge bootstrap por archivo / total | 15000 / 25000 caracteres | `electron/knowledge/constants.ts` |

## Monitoreo y proactive

| Parametro | Default | Fuente |
|---|---:|---|
| captura / idle | 30 / 120 s | `electron/monitoring/service-state.ts` |
| screenshot / OCR / semantic | on / off / off | mismo archivo |
| proactive enabled / intervalo | true / 5 min | `electron/proactive/config.ts` |
| horas de notificacion | 08:00 a 20:00 | mismo archivo |
| calendario / tareas / sistema | true / true / true | mismo archivo |
| briefing | disabled; `0 8 * * 1-5` | `electron/main/service-factory.ts` |
| campaign daily limit / preview | 250 / requerido | `electron/communication-hub/state.ts` |
| eventos audit local | 500 | mismo archivo |

## Desktop Agent

| Grupo | Valores default | Fuente |
|---|---|---|
| pasos | `maxSteps=120`, `defaultStepBudget=60`, mínimo integrado `90`, `maxTotalSteps=500` | `electron/desktop-agent/agent-config.ts`, `electron/desktop-agent/task-budget.ts` |
| modelo conversacional/CU | `gemini-3.6-flash`, sin degradación de modelo | `src/shared/soflia-runtime-model.ts`, `electron/desktop-agent/gemini-cu/model-registry.ts` |
| selector conversacional | SofLIA y Lite: Google; Max y Pro: OpenAI; elección y razonamiento persistidos por modelo | `src/hooks/model-selector-options.ts`, `src/hooks/useModelSelector.ts`, `src/services/model-routing.ts` |
| razonamiento Gemini / OpenAI | `low/medium/high` / `low/medium/high/xhigh/max`; `minimal` y `none` heredados migran a `low` | `src/services/gemini-chat/model-config.ts`, `src/services/openai-chat/reasoning.ts` |
| captura | 1024x768, active monitor, max edge 1568, min scale .5 | mismo archivo |
| timing | action 300 ms, change 8 s/500 ms, observation 2 s, queue 60 s | mismo archivo |
| recovery | 3 fallos, stuck 4, 2 retries, autorecover/replan on | mismo archivo |
| contexto | memory 10, resumen cada 15, raw 8, progress 25 | mismo archivo |
| elementos | max 60, dedup IoU .6, sufficient 12, skip visual 40, score .10, NMS .45 | mismo archivo |
| concurrencia | 1 agente visual | mismo archivo |
| engine | Gemini; modelo CU por registro; deteccion de prompt injection activa | mismo archivo |

## Reuniones, voz y agentes

| Parametro | Valor | Fuente |
|---|---:|---|
| WA loop / history | 25 iteraciones / 20 entradas | `electron/wa-agent/agent-loop.ts`, `constants.ts` |
| WA repeat / critical | 3 / 5 | `electron/wa-agent/constants.ts` |
| meeting screenshot default/min | 75 / 15 s | `electron/meeting-live/meeting-live-service.ts` |
| meeting chunk base64 / stop drain | 1000000 chars / 45 s | mismo archivo |
| source AI / low confidence | 16000 chars / .65 | `electron/meetings/meeting-ai/constants.ts` |
| Python model start / restart | 90 s / 3 | `electron/python-runtime-service.ts` |
| Python tools document/quick/restart | 60 s / 10 s / 3 | `electron/python-tools-service.ts` |
| speech orbe | 4000 caracteres | `src/components/orb/useOrbConversation.ts` |

## Politica de cambio

Cambiar un limite requiere: identificar actor y amenaza/costo, escenario positivo
y negativo, prueba de borde, observabilidad y rollback. Si altera comportamiento
visible, actualizar `LIM-*`, requisitos e historias relacionados.
