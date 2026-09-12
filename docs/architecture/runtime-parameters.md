# Parametros runtime

Estado: vigente. Actualizado: 2026-09-11.

Inventario de defaults y topes con impacto operativo. Los overrides guardados en
`userData` pueden cambiar el valor efectivo de un host.

<!-- evidence: electron/desktop-agent/agent-config.ts -->
<!-- evidence: electron/memory/constants.ts -->
<!-- evidence: electron/memory/model-config.ts -->
<!-- evidence: electron/monitoring/service-state.ts -->
<!-- evidence: electron/main/boot-timeline.ts -->
<!-- evidence: electron/main/window-controller.ts -->
<!-- evidence: electron/main/bootstrap.ts -->
<!-- evidence: electron/integrated-browser/types.ts -->
<!-- evidence: electron/integrated-browser/validation.ts -->
<!-- evidence: electron/integrated-browser/safe-navigation.ts -->

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
| espera del guardado de sesión antes de salir/instalar | 5000 ms por espera; timeout ofrece reintentar/cancelar/salir sin guardar, nunca concede salida por sí solo | `electron/main/shutdown-guard.ts` |

## Navegador integrado

| Parametro | Default/tope | Fuente |
|---|---:|---|
| importación HTML de marcadores | 5 MiB por archivo; 5.000 entradas y 20 niveles de carpetas; biblioteca hasta 5.000 marcadores | `electron/integrated-browser/bookmark-store.ts`, `electron/integrated-browser/bookmark-importer.ts` |
| revisión de importación de marcadores | 5 minutos, un solo uso, una importación pendiente; cancelar por omisión; invalidación por perfil, ventana o revisión de biblioteca | mismos archivos |
| transferencia de credenciales | JSON de hasta 5 MiB y 500 entradas; exportación con advertencia nativa, destino nuevo (`wx`) y permisos 0600; importación con revisión de conflictos, un solo commit y TTL de 5 minutos | `electron/integrated-browser/credential-vault.ts`, `electron/integrated-browser/credential-transfer.ts` |
| diagnóstico exportable | JSON v1 hasta 64 KiB; 12 métricas instantáneas; hasta 200 registros de descargas retenidos; sin histórico de actividad ni contenido | `electron/integrated-browser/diagnostic-report.ts` |
| confirmación de exportación de diagnóstico | 5 minutos desde preparación; una pendiente; archivo JSON nuevo con publicación por enlace exclusivo, sin sobrescritura; requiere filesystem compatible | mismo archivo |
| particion persistente | `persist:pulse-navegador-<hash del usuario>`; una por usuario con sesion, `sin-sesion` mientras no hay | `electron/integrated-browser/profile-scope.ts` |
| perfil en disco (historial, contrasenas, permisos por sitio, extensiones) | `userData/integrated-browser/perfiles/<hash del usuario>/` | `electron/integrated-browser/profile-scope.ts` |
| cambio de usuario | derriba pestañas, ventanas separadas, permisos y observacion; el perfil `sin-sesion` se vacia | `electron/integrated-browser/service.ts`, `electron/main/browser-session-scope.ts` |
| espera de viewport para el agente | 8000 ms | mismo archivo |
| pestañas del navegador integrado | máximo 500 lógicas; máximo 8 `WebContentsView` vivas globales; una principal y una secundaria visible | `electron/integrated-browser/types.ts` |
| ventanas separadas | máximo 4 `BaseWindow`; mueven la misma vista y cuentan dentro de las 8 vivas | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts` |
| composición de pestañas | `single`, `split` o `overlay`; foco = objetivo de Computer Use | `electron/integrated-browser/service.ts` |
| percepción de pestaña activa | cadencia base 10.000 ms y calma 4.000 ms; YouTube: 30.000/12.000 ms; máximo 1024 px en captura pasiva; solo con ventana enfocada y fuera de Computer Use; DOM completo bajo demanda y solo para turnos dependientes del navegador; una captura por tipo en vuelo; solo último snapshot en memoria; pausada por usuario | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts`, `src/services/gemini-chat/send-message-stream.ts` |
| límites del DOM observado | texto 24.000 caracteres; 100 encabezados; 60 landmarks; 240 controles; 30 frames; 1.800 nodos y margen de viewport 240 px; sin valores de formularios | `electron/integrated-browser/page-observation.ts` |
| longitud de direccion/busqueda | 2048 caracteres | `electron/integrated-browser/validation.ts` |
| viewport minimo | 160 x 120 DIP | mismo archivo |
| protocolos de pagina principal | HTTP(S) y `about:blank` | mismo archivo |
| navegación segura | revisión local siempre activa en HTTP(S), incluidos redirecciones y marcos; proveedor opcional `BROWSER_SAFE_BROWSING_ENDPOINT` sólo en navegación explícita autenticada, sin destinos locales conocidos/IPs; plazo total 1 s, cuerpo 4 KiB, sin redirecciones ni credenciales en endpoint; avisos controlados por pestaña en la barra, con degradación distinguida del bloqueo y sin persistir reputación | `electron/integrated-browser/safe-navigation.ts`, `src/components/browser/BrowserNavigationSafetyNotice.tsx` |
| certificados de navegación | la sesión rechaza verificaciones distintas de `OK` (`-2`); no existe bypass desde renderer | `electron/integrated-browser/service.ts` |
| permisos administrados por sitio | `camera`, `microphone`, `geolocation`, `notifications`, `display-capture`, `clipboard-read`, `idle-detection`, `window-management` preguntan; `fullscreen`, `pointer-lock`, `keyboard-lock`, `speaker-selection`, `protected-media` se conceden sin interrumpir; alcanzan a cualquier pestaña viva de la partición | `electron/integrated-browser/permission-governance.ts`, `electron/integrated-browser/types.ts` |
| permisos concedidos sin panel | `background-sync`, `clipboard-sanitized-write`, `storage-access`, `top-level-storage-access`; solo contenido gobernado o subframe HTTP(S) con `embeddingOrigin` válido | `electron/integrated-browser/permission-governance.ts` |
| permisos siempre denegados | `usb`, `serial`, `hid`, `midi`, `midiSysex`, `openExternal`, `fileSystem` y cualquier nombre desconocido | mismo archivo |
| estado reportado a `permissions.query` | `camera`, `microphone` y `speaker-selection` sin decidir responden concedido para que la página llegue a solicitarlos; una ventana adoptada en `about:blank`, un iframe cruzado HTTP(S) validado o el preflight anónimo de `media` con identidad `null`/`undefined` observado en Electron 43 reciben el resultado provisional solo en la consulta; la concesión real exige `webContents` registrado, origen y aviso, y un origen explícito inválido continúa denegado | mismo archivo |
| almacén de permisos por sitio | `site-permissions.json` en `userData/integrated-browser`; clave por origen HTTP(S) exacto; máximo 500 orígenes | `electron/integrated-browser/site-permissions.ts` |
| permiso nativo de cámara y micrófono | consultado en macOS y Windows antes de conceder; `denied`/`restricted` corta sin preguntar; `not-determined` en macOS dispara `askForMediaAccess`; Linux lo delega al servidor de audio/video | `electron/integrated-browser/permission-governance.ts`, `electron-builder.json5`, `build/entitlements.mac.plist` |
| compartir pantalla | selector nativo de pantallas y ventanas, máximo 24 orígenes listados; audio del sistema solo en Windows y bajo casilla explícita | `electron/integrated-browser/display-media-picker.ts` |
| llamadas directas de Google Chat | deshabilitadas: si `mail.google.com` o `chat.google.com` intenta abrir el host exacto `meet.google.com` con ruta `/call`, el servicio cancela el evento; cubre destino inicial, ventana anidada, `about:blank -> /call`, navegación, redirección y subframe; no crea ni reutiliza pestañas o ventanas, no sustituye por `/new`, no abre navegador externo, no simula notificaciones y no observa RPC de Meet; los permisos generales de cámara, micrófono, pantalla y notificaciones permanecen gobernados por sitio | `electron/integrated-browser/service.ts`, `electron/integrated-browser/permission-governance.ts` |
| pantalla completa de la página | la vista cubre la ventana anfitriona y la ventana pasa a pantalla completa del sistema; al salir se restaura el estado previo | `electron/integrated-browser/service.ts` |
| ventanas emergentes sin destino | `window.open` sin destino abre ventana real que hereda las preferencias del abridor, entre 180 y 2.048 px por lado (640 x 480 por omisión) y sin navegación fuera de HTTP(S); solo se queda encima por debajo de 700 px de ancho; la ventana recibe la misma política de apertura, así que lo que ella abra también queda gobernado | `electron/integrated-browser/service.ts` |
| SharedArrayBuffer | comportamiento predeterminado de Chromium; SofLIA no lo habilita por `--enable-features`, porque el diagnóstico lo expuso con `crossOriginIsolated=false` sin corregir la carga de NetEq y relajaba una mitigación de canal lateral | `electron/main.ts` |
| Document-Isolation-Policy | comportamiento predeterminado de Chromium; SofLIA no desactiva esta política ni agrega `--disable-features` para páginas remotas | `electron/main.ts` |
| origen de una ventana real adoptada | un documento `about:blank` no tiene origen propio: hereda el del abridor y con él se resuelven las consultas de permiso; en cuanto la ventana navega a HTTP(S) manda su propio origen, y la concesión real sigue exigiendo que la solicitud lo declare | `electron/integrated-browser/service.ts`, `electron/integrated-browser/permission-governance.ts` |
| avisos de permiso | globo del renderer anclado a la barra de direcciones, no cuadro del sistema; uno a la vez, encolados; los permisos pedidos juntos se preguntan en un solo aviso y al llegar su turno se descartan los ya decididos; sin ventana, sin respuesta en 120 s o ante un fallo se responde denegado y nunca queda la solicitud pendiente | `electron/integrated-browser/permission-governance.ts`, `electron/integrated-browser/service.ts`, `src/components/browser/BrowserPermissionPrompt.tsx` |
| chat flotante | 332 a 560 DIP (388 default); lado izquierdo o derecho; header de 40 DIP; minimizable o sustituible por Orbe; inicio medido bajo la barra superior | `src/components/browser/BrowserWorkspaceLayout.tsx` |
| convivencia chat/navegador | `WebContentsView` vivo con inset del panel; ancho completo al minimizar | `src/components/browser/IntegratedBrowserPanel.tsx` |
| overlay de gestores | captura puntual + `hide`; no usa polling para componer la página | `src/components/browser/IntegratedBrowserPanel.tsx` |
| contenido del modo lectura | selección hasta 50.000 caracteres; documento hasta 60.000; solo HTTP(S); excluye formularios, controles y contenido editable; Google Docs usa exportación autenticada de hasta 2 MiB con timeout 8 s y árbol AX de hasta 20.000 nodos como respaldo | `electron/integrated-browser/reading-mode-content.ts`, `electron/integrated-browser/reading-accessibility.ts` |
| voz ElevenLabs (Orbe y lectura) | Orbe: máximo 5.000 caracteres por solicitud, timeout 30 s, MP3 hasta 16 MiB; lectura: microlote inicial de hasta 180 caracteres, posteriores de hasta 480, anticipación máxima de dos lotes, contexto anterior/posterior de hasta 600 caracteres, límite defensivo de 3.500 por solicitud, timeout 20 s sin reintento automático y audio transitorio hasta 64 MiB por respuesta; `eleven_turbo_v2_5` + `mp3_44100_128` por defecto; el idioma ISO 639-1 procede del contenido y los aliases españoles conservan un mapa a offsets originales | `electron/elevenlabs-tts.ts`, `electron/speech-text-normalizer.ts`, `electron/orb-tts.ts`, `electron/integrated-browser/reading-mode-service.ts`, `src/components/browser/browser-reading-utils.ts` |
| historial | 50.000 visitas; consulta máxima 200, 50 por omisión | `electron/integrated-browser/browser-history-store.ts` |
| importación de historial | JSON/JSONL de 5 MiB; máximo 50.000 visitas; revisión nativa antes de escribir | `electron/integrated-browser/history-importer.ts` |
| perfiles del navegador | autenticado persistente; invitado/privado con particiones no persistentes y stores temporales en disco; confirmación nativa al cambiar (vigencia 5 minutos), purga al conmutar o cerrar realmente la ventana tras barrera de colas; `will-quit` espera limpieza, cancelar `beforeunload` conserva la sesión; cierre forzado puede dejar temporales | `electron/integrated-browser/profile-scope.ts`, `electron/integrated-browser/service.ts`, `electron/main/app-lifecycle.ts` |
| credenciales | usuario 320; secreto 4.096 caracteres; maximo almacenado 500 | `electron/integrated-browser/credential-vault.ts` |
| revisión manual de credenciales | 5 minutos; un solo uso; una confirmación pendiente por servicio; cancelar por omisión | `electron/integrated-browser/credential-saver.ts`, `electron/integrated-browser/credential-vault.ts` |
| mitigación de fingerprinting | privacidad estricta retira client hints de alta entropía y `Accept-CH`/`Critical-CH`; conserva hints básicos y User-Agent compatible | `electron/integrated-browser/tracking-protection.ts`, `electron/integrated-browser/service.ts` |
| archivo de bóveda | v2 AES-256-GCM; 12 MiB antes de cifrar, 17 MiB de archivo máximo; clave 32 bytes protegida por el SO, nonce 12 bytes, tag 16 bytes; cola por archivo y respaldo cifrado | `electron/integrated-browser/credential-vault.ts`, `electron/integrated-browser/credential-vault-format.ts` |
| guardado sugerido | opt-in por perfil y bóveda desbloqueada; submit tras gesto confiable de hasta 1 s o botón SPA/Enter confiable; espera de 350 ms con candidato cifrado; TTL 60 segundos desde captura; 30.000 caracteres máximos del puente privado; SSO sólo en la misma pestaña antes de revisar, conservando origen inicial; no iframes | `electron/integrated-browser/credential-autosave.ts`, `electron/integrated-browser/credential-autosave-script.ts`, `electron/integrated-browser/credential-saver.ts`, `electron/integrated-browser/service.ts` |
| extension desempaquetada | Manifest V3; 2.000 archivos; 2.000 directorios incluida raíz; profundidad 32; 20 MiB; 100 instalaciones; huella SHA-256 comprobada antes de cargar | `electron/integrated-browser/extension-manager.ts` |
| recuperación de bóveda dañada | principal regular hasta 17 MiB; máximo cinco copias cifradas `.corrupt-UUID`; TTL cinco minutos; una revisión consumible; borrar credenciales retira todas las copias de ese principal | `electron/integrated-browser/credential-vault.ts` |
| reconciliación de sync | 2 MiB por instantánea; 10.000 registros por categoría; 20 etiquetas; orden posición/ID; sin payload parcial ni ganador por reloj | `electron/integrated-browser/sync-crypto.ts`, `electron/integrated-browser/sync-conflicts.ts` |
| diario de conflictos | una revisión por categoría (máximo cuatro); 28 MiB de documento en memoria, 40 MiB de archivo cifrado; sin caducidad/borrado automático; elecciones ligadas a revisión, hasta 100.000 | `electron/integrated-browser/sync-conflict-store.ts` |
| transporte de sync | sólo HTTPS del proyecto `*.supabase.co` configurado, sin redirecciones; 20 s por solicitud incluidos cuerpo/reintentos; 45 s por operación; máximo tres intentos, backoff 250/750 ms sólo red/429/5xx; JWT máximo 16 KiB | `electron/integrated-browser/sync-remote.ts`, `electron/integrated-browser/sync-auth.ts`, `electron/integrated-browser/sync-devices.ts` |
| respuestas de sync | RPC 4 KiB, Auth/dispositivos 64 KiB, envelopes 3 MiB; máximo 100 dispositivos, lectura pide 101 para detectar exceso; DTOs cerrados | `electron/integrated-browser/sync-remote.ts` |
| identidad de sync | `sync-device.json` protegido por el SO, límite 16 KiB (lectura de un byte adicional para detectar exceso); ID aleatorio ligado a perfil, usuario Lia, session_id y backend; una operación y un diálogo pendientes como máximo | `electron/integrated-browser/sync-device-identity.ts`, `electron/integrated-browser/sync-devices.ts` |
| autorizacion de instalacion | token efimero en memoria; 5 minutos | `electron/integrated-browser/extension-manager.ts` |
| restricción de extensiones | 50 sitios de 300 caracteres; 100 patrones por campo y 300 agregados al cargar; manifiesto 256 KiB/paquete 20 MiB tras compilar; MV3 storage/scripting; sólo reducción; dominio/protocolo exactos, todos sus puertos | `electron/integrated-browser/extension-site-access.ts`, `electron/integrated-browser/extension-manager.ts` |
| selección nativa passkey | 60 s; un diálogo pendiente; 10 cuentas máximo; ID base64url hasta 2.048 caracteres; etiqueta visible hasta 80 | `electron/integrated-browser/passkey-selection.ts` |
| bitácora del agente | opt-in `agentGovernance`; SQLite v1; 7/30/90 días (30 por defecto); 5.000 eventos, páginas de 50; 16 MiB por archivo, 16 KiB por fila leída; HITL de 5 minutos | `electron/integrated-browser/agent-audit-store.ts`, `electron/integrated-browser/service.ts` |
| revisión de solicitudes | máximo 32 revisiones remotas pendientes; sin caché persistente; contexto obsoleto cancela | `electron/integrated-browser/request-safety.ts` |

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
| `maxOutputTokens` resumen / extractores | 4000 / 3000 | mismo archivo |
| nivel de pensamiento de memoria | `low` | `electron/memory/model-config.ts` |
| minimo para guardar un resumen | 150 caracteres y sin `MAX_TOKENS` | mismo archivo |
| knowledge bootstrap por archivo / total | 15000 / 25000 caracteres | `electron/knowledge/constants.ts` |

## Monitoreo y entrega programada

| Parametro | Default | Fuente |
|---|---:|---|
| captura / idle | 30 / 120 s | `electron/monitoring/service-state.ts` |
| screenshot / OCR / semantic | on / off / off | mismo archivo |
| briefing | disabled; `0 8 * * 1-5` | `electron/main/service-factory.ts` |
| campaign daily limit / preview | 250 / requerido | `electron/communication-hub/state.ts` |
| eventos audit local | 500 | mismo archivo |

## Desktop Agent

| Grupo | Valores default | Fuente |
|---|---|---|
| pasos | `maxSteps=120`, `defaultStepBudget=60`, mínimo integrado `90`, `maxTotalSteps=500` | `electron/desktop-agent/agent-config.ts`, `electron/desktop-agent/task-budget.ts` |
| reintentos por llamada mal formada (chat) | 2: reemitir, luego responder sin herramientas | `src/services/gemini-chat/agentic-loop.ts` |
| modelo conversacional/CU | `gemini-3.8-flash`, sin degradación de modelo | `src/shared/soflia-runtime-model.ts`, `electron/desktop-agent/gemini-cu/model-registry.ts` |
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

## Atajos del navegador

Atajos del navegador: hasta 50 entradas, nombre de 80 caracteres, instrucciones
de 5000 y archivo protegido de 2 MiB; eliminación con revisión de cinco minutos.
Recuperación de un solo uso y cinco minutos, una generación de respaldo y cinco
originales dañados como máximo; IDs nuevos y revisión renovada al recuperar.
Configuración sync: principal cifrado máximo 8 KiB, recuperación con categorías
vacías y sin fecha de última ejecución; mantiene la exclusión de dos minutos
del controlador. Guardar pausa retira las copias locales de configuración.
Fuentes y permisos fijos: `selected-tabs` / `read-fragments`, una a ocho pestañas
frescas por envío. Fuentes: `src/shared/browser-agent-shortcuts.ts`,
`electron/integrated-browser/agent-shortcut-store.ts` y el servicio del navegador.

## Memoria y sesión SO del navegador

Memoria semántica del navegador: 200 visitas y 200 marcadores, 768 dimensiones,
lotes de 32 documentos, consulta de 500 caracteres, títulos de 200 y URL saneada
de 1024; máximo 10 resultados. Retención de 30 días con limpieza al acceder,
operación local de dos minutos y timeout SDK de 30 segundos.
Fuentes: `src/shared/browser-semantic-memory.ts` y
`electron/integrated-browser/semantic-memory.ts`.

Bóveda: autorización local de cinco minutos desde verificar (no se prolonga al
leer); helper Windows limitado a 60 segundos y 1024 bytes de salida, sin shell.
Candidato de login: máximo 200 controles, deduplicación de un segundo y revisión
de 60 segundos desde captura. Voz: reanudación confirmada válida 30 segundos.
Sonda sensible: 4000 nodos, 50 000 caracteres y 50 ms; espera main de tres
segundos, agotamiento rechaza. Fuentes: `credential-unlock.ts`,
`credential-autosave-script.ts`, `voice-commands.ts` y `sensitive-page.ts`
dentro de `electron/integrated-browser/`.

## Politica de cambio

Recuperación de permisos/privacidad/políticas del agente: principal máximo
8 MiB, copia protegida máximo 16 MiB, una generación de respaldo y hasta cinco
principales dañados cifrados sin purga automática. Revisión de un solo uso,
cinco minutos, una confirmación pendiente por servicio. Los topes y la cola
por archivo están en `electron/integrated-browser/policy-file-recovery.ts`.

Cambiar un limite requiere: identificar actor y amenaza/costo, escenario positivo
y negativo, prueba de borde, observabilidad y rollback. Si altera comportamiento
visible, actualizar `LIM-*`, requisitos e historias relacionados.
