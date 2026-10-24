# Parametros runtime

Estado: vigente. Actualizado: 2026-10-22.

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

Computer Use de escritorio deja 400 ms de asentamiento tras una acción antes
de recapturar y comprueba el cierre con una captura adicional. Esa consulta no
dispone de herramientas y no aplica acciones; la cancelación se conserva.

El [acompañamiento del orbe](autonomous-orb-guidance.md) usa una ventana de
208×340 DIP, animación de 280 ms, presentación previa de 180 ms y caducidad de
1500 ms por acción u 8 s por señalización explícita. Las prácticas admiten 20
pasos y reprograman la observación 2500 ms después de terminar la anterior.
La captura oculta superficies propias y espera 32 ms al compositor.

El contrato privado del [aula Learning](learning-live-workspace.md) conserva entrada de 32 KiB, salida de 512 KiB, timeout de 15 s y hasta 4 solicitudes main concurrentes. El aula consulta un snapshot para confirmar el rol, sin polling. El estudio de diseño mantiene hasta 100 mensajes locales, 20 nombres de archivos de hasta 25 MB, hasta 12 escenas con medios locales de hasta 25 MB, salas de diseño y relojes locales de un segundo; no realiza mutaciones remotas. La agenda carga 20 sesiones por página, admite hasta 256 KiB de salida y comparte el timeout y el límite concurrente del contrato; se actualiza al abrir, cambiar página/vista o por solicitud del usuario. El gateway Learning limita por actor lectura, mutación y generación de IA; la retención predeterminada es 30 días y se administra entre 1 y 90.

El [arnés multiagente](runtime-multiagent-harness.md) define sus límites en
[`AGENT_LIMITS`](../../src/shared/agent-runtime.ts): fuente de 80000 caracteres,
salida de 24000 por etapa, doce herramientas por etapa, seis llamadas Gemini
por etapa, 3000 tokens solicitados por llamada Gemini, tres minutos por análisis,
treinta segundos por RPC, aprobación de diez minutos y veinte runs por ámbito.
El presupuesto observado de Codex no equivale a un límite de facturación.

<!-- evidence: src/shared/agent-runtime.ts -->

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

El chat ejecuta hasta diez tandas de herramientas, o veinte con workspace,
seguidas de una respuesta final sin herramientas. El cierre no aumenta el
presupuesto de efectos y no ejecuta llamadas adicionales. Las aprobaciones
locales recordadas conservan hasta 200 huellas SHA-256 por usuario (las más
recientes); nunca guardan comandos. Ver [política y límites](runtime-agents-manual.md#211-permisos-locales-de-comandos-y-archivos).

Los equipos transversales usan `TEAM_LIMITS` en
[`src/shared/agent-teams/policy.ts`](../../src/shared/agent-teams/policy.ts):
dos especialistas, cuatro llamadas de especialistas pendientes por proceso, 15 segundos por
equipo, 4000 caracteres de solicitud, 24000 de fuente, 1500 tokens de salida
solicitados y 6000 caracteres conservados por aporte. No incluyen el tiempo
del coordinador ni constituyen un límite monetario. Ver
[comportamiento y degradación](runtime-multiagent-harness.md#límites-y-rendimiento-de-equipos-generales).

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
| pestañas del navegador integrado | máximo 500 lógicas y 8 `WebContentsView` vivas como defensa; las visibles + 1 fondo reciente permanecen calientes; las frías se suspenden tras 90.000 ms, o 30.000 ms con la ventana oculta | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts` |
| ventanas separadas | máximo 4 `BaseWindow`; mueven la misma vista y cuentan dentro de las 8 vivas | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts` |
| composición de pestañas | `single`, `split` o `overlay`; foco = objetivo de Computer Use | `electron/integrated-browser/service.ts` |
| percepción de pestaña activa | dirigida por navegación/interacción, sin reprogramación periódica en reposo; ventana base 10.000 ms y calma 4.000 ms; YouTube: 30.000/12.000 ms; máximo 1024 px; observación fresca y DOM bajo demanda; una captura por tipo en vuelo; solo último snapshot en memoria; pausada por usuario | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts`, `src/services/gemini-chat/send-message-stream.ts` |
| diagnóstico de recursos Electron | apagado por defecto; `--resource-diagnostics` agrega cada 30.000 ms CPU, RAM y conteo por tipo de proceso, sin URL, contenido, PID ni nombres | `electron/resource-diagnostics.ts` |
| límites del DOM observado | texto 24.000 caracteres; 100 encabezados; 60 landmarks; 240 controles; 30 frames; 1.800 nodos y margen de viewport 240 px; sin valores de formularios | `electron/integrated-browser/page-observation.ts` |
| captura explícita bajo demanda | resolución lógica del viewport (sin el tope de 1024 px de la pasiva); separación mínima de 350 ms entre invocaciones consecutivas | `electron/integrated-browser/types.ts`, `electron/integrated-browser/service.ts` |
| evidencia visual no utilizable | desviación típica por canal < 3,5 sobre hasta 4.000 muestras del bitmap ⇒ `contenido-protegido`; imagen vacía ⇒ `captura-vacia` | `electron/integrated-browser/capture-quality.ts` |
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
| llamadas directas de Google Chat | el flujo nativo de Gmail/Chat puede cargar `meet.google.com/call` en su frame o ventana real gobernada, conservando sesión y abridor; la excepción de ventana usa el origen actual y solo hereda Gmail/Chat mientras el documento es `about:blank`; no sustituye por `/new`, no abre navegador externo ni simula tarjetas o notificaciones; los permisos de dispositivos siguen gobernados por sitio. La retirada histórica queda sustituida por `fix-google-chat-huddle`; el cierre funcional exige prueba real | `electron/integrated-browser/service.ts`, `electron/integrated-browser/permission-governance.ts` |
| pantalla completa de la página | la vista cubre la ventana anfitriona y la ventana pasa a pantalla completa del sistema; al salir se restaura el estado previo | `electron/integrated-browser/service.ts` |
| ventanas emergentes sin destino | `window.open` sin destino abre ventana real que hereda las preferencias del abridor, entre 180 y 2.048 px por lado (640 x 480 por omisión) y sin navegación fuera de HTTP(S); solo se queda encima por debajo de 700 px de ancho; la ventana recibe la misma política de apertura, así que lo que ella abra también queda gobernado | `electron/integrated-browser/service.ts` |
| SharedArrayBuffer | comportamiento predeterminado de Chromium; SofLIA no lo habilita por `--enable-features`, porque el diagnóstico lo expuso con `crossOriginIsolated=false` sin corregir la carga de NetEq y relajaba una mitigación de canal lateral | `electron/main.ts` |
| Document-Isolation-Policy | comportamiento predeterminado de Chromium; SofLIA no desactiva esta política ni agrega `--disable-features` para páginas remotas | `electron/main.ts` |
| origen de una ventana real adoptada | un documento `about:blank` no tiene origen propio: hereda el del abridor y con él se resuelven las consultas de permiso; en cuanto la ventana navega a HTTP(S) manda su propio origen, y la concesión real sigue exigiendo que la solicitud lo declare | `electron/integrated-browser/service.ts`, `electron/integrated-browser/permission-governance.ts` |
| avisos de permiso | globo del renderer anclado a la barra de direcciones, no cuadro del sistema; uno a la vez, encolados; los permisos pedidos juntos se preguntan en un solo aviso y al llegar su turno se descartan los ya decididos; sin ventana, sin respuesta en 120 s o ante un fallo se responde denegado y nunca queda la solicitud pendiente | `electron/integrated-browser/permission-governance.ts`, `electron/integrated-browser/service.ts`, `src/components/browser/BrowserPermissionPrompt.tsx` |
| chat flotante | 332 a 560 DIP (388 default); lado izquierdo o derecho; header de 40 DIP; minimizable o sustituible por Orbe; inicio medido bajo la barra superior | `src/components/browser/BrowserWorkspaceLayout.tsx` |
| convivencia chat/navegador | `WebContentsView` vivo con inset del panel; ancho completo al minimizar | `src/components/browser/IntegratedBrowserPanel.tsx` |
| overlay de gestores | captura puntual + `hide`; no usa polling para componer la página | `src/components/browser/IntegratedBrowserPanel.tsx` |
| sugerencias de URL | ocho resultados, debounce de 140 ms; desplegable hasta 256 DIP, reservando 128 DIP inferiores; página nativa visible debajo sin captura | `src/components/browser/BrowserAddressBar.tsx`, `src/components/browser/IntegratedBrowserPanel.tsx` |
| zoom emulado repetido | una aplicación por factor/tamaño efectivo/documento; carga o crash invalidan la deduplicación por WebContents | `electron/integrated-browser/tab-zoom.ts` |
| acuse de navegación | `waitForLoad` booleano opcional, true por defecto; la UI usa false tras validar e iniciar, agentes mantienen espera completa; errores tardíos se publican solo para carga vigente | `src/shared/browser-navigation.ts`, `electron/integrated-browser-handlers.ts`, `electron/integrated-browser/service.ts` |
| geometría de vista | resize agrupado por cuadro; mismo rectángulo visible no genera layout/emisiones extra; restauración y petición del agente fuerzan el acuse | `src/components/browser/IntegratedBrowserPanel.tsx`, `electron/integrated-browser/service.ts` |
| sondeo de selección | no se programa por keyUp ordinario; selectionchange no avisa por cursor colapsado; se conservan selección real, mouseUp, Ctrl/Meta+A y Shift con navegación; publicación exige contexto y control vigentes | `electron/integrated-browser/service.ts` |
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

Las pestañas integradas y separadas comparten una sola partición. Chromium
permite throttling en cualquier pestaña oculta; solo las superficies presentadas
lo desactivan. Una pestaña visible y un fondo reciente permanecen calientes; las
demás se suspenden por LRU al vencer la gracia y recuperan su última URL cuando
vuelven a activarse. No se suspende una pestaña visible, cargando, audible,
capturada, con DevTools, en una ventana separada visible o bajo control del
agente. No se promete conservar su heap, DOM ni pila atrás/adelante.
Perfiles explicitamente
aislados o con identificador siguen usando `BrowserWebService`/Playwright. Las
extensiones se recargan al iniciar porque Electron no las conserva cargadas; se
rechazan `nativeMessaging`, `debugger`, `proxy` y `management`. Seleccionar otra
carpeta o vencer el plazo invalida la autorizacion pendiente anterior.

## Entrada multimodal

El video cuesta del orden de cientos de tokens por segundo enviado. Sin límites
explícitos, una pregunta casual sobre un video de una hora produce un turno de
coste desproporcionado, así que la degradación es ordenada: primero baja la
resolución de medios, luego acorta la ventana conservando el instante actual, y
solo entonces excluye un medio declarándolo.

<!-- evidence: src/shared/multimodal-input.ts -->
<!-- evidence: electron/media-input/service.ts -->

| Parametro | Default/tope | Fuente |
|---|---:|---|
| ventana máxima de video por turno | 90 s | `src/shared/multimodal-input.ts` |
| ventana alrededor de la reproducción | 30 s antes y 10 s después de la posición actual | mismo archivo |
| umbral de resolución reducida | > 20 s de video ⇒ `MEDIA_RESOLUTION_LOW` | mismo archivo |
| costo estimado de video | 100 / 300 / 600 tokens por segundo (low / medium / high) | mismo archivo |
| costo estimado de audio | 32 tokens por segundo | mismo archivo |
| presupuesto de medios por turno | 30.000 tokens | mismo archivo |
| muestreo de cuadros | 6 cuadros separados 2 s (máximo 12 por llamada) | mismo archivo, `electron/integrated-browser-handlers.ts` |
| adjuntos de medio por turno | máximo 4; duración combinada máxima 600 s | `src/shared/multimodal-input.ts` |
| umbral de subida remota | > 15 MB se sube por Files API; por debajo viaja incrustado; las imágenes siempre incrustadas | `src/shared/multimodal-input.ts`, `src/services/media-attachments.ts` |
| tope de subida al proveedor | 2 GB | `src/shared/multimodal-input.ts` |
| espera de procesamiento del archivo | sondeo cada 1.500 ms, límite 120.000 ms | `electron/media-input/service.ts` |
| retención del archivo remoto | 48 h (o `expirationTime` del proveedor); referencia caducada no se reutiliza | mismo archivo |
| escucha ambiental | máximo 60 s; WAV mono 16 kHz; sin persistencia en disco | `src/shared/multimodal-input.ts`, `src/services/ambient-audio-service.ts` |
| interruptores de reversión | `VITE_MULTIMODAL_BROWSER_VISION`, `VITE_MULTIMODAL_MEDIA_ATTACHMENTS`, `VITE_MULTIMODAL_AMBIENT_AUDIO`; activas salvo valor `false` | `src/shared/multimodal-input.ts` |

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
| recuperación de cierre prematuro CU | máximo 2 por loop; cada recuperación consume un paso del presupuesto original y exige `canContinue: true` del verificador | `electron/desktop-agent/gemini-cu/loop.ts`, `electron/desktop-agent/gemini-cu/client.ts` |
| reintentos por llamada mal formada (chat) | 2: reemitir, luego responder sin herramientas | `src/services/gemini-chat/agentic-loop.ts` |
| modelo conversacional/CU | `gemini-3.8-flash`, sin degradación de modelo | `src/shared/soflia-runtime-model.ts`, `electron/desktop-agent/gemini-cu/model-registry.ts` |
| selector conversacional | SofLIA: OpenAI `gpt-6-luna` (predeterminado); Max: OpenAI `gpt-6.1-sol` (3 usos/mes, fallback a SofLIA); Pro: Google `gemini-3.8-flash`; elección y razonamiento persistidos por modelo | `src/hooks/model-selector-options.ts`, `src/hooks/useModelSelector.ts`, `src/services/model-routing.ts` |
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
| Python ready / shutdown | voz 10 s, tools 15 s / ack hasta 2 s y kill si sigue vivo | `electron/python/sidecar-connection.ts`, ambas fachadas Python |
| Python NDJSON / salida | línea UTF-8 hasta 64 MiB / payload y cola stdin hasta 8 MiB cada uno | `electron/python/ndjson.ts`, `sidecar-connection.ts` |
| Python peticiones | hasta 64 pendientes por hijo, plazo entero positivo hasta 300 s; sin retry automático | `electron/python/sidecar-connection.ts` |
| speech orbe | 4000 caracteres | `src/components/orb/useOrbConversation.ts` |

Cada conexión Python exige ready v4 (voz) o v1 (tools), compartido por consumidores
concurrentes. El cierre retira la generación antes de esperar; nuevos arranques
explícitos esperan la operación de cierre. Si kill no se confirma, se informa
SIDECAR_STOP_UNCONFIRMED y no se reemplaza hasta close real del hijo. Eventos/respuestas/exit viejos no se
transfieren al nuevo hijo. Voz conserva hasta tres reinicios con demora 1/2/3 s,
cancelados al parar/deshabilitar; tools conserva arranque perezoso y tres fallos
consecutivos antes de ready, que renueva su presupuesto. El buffer de una línea
grande se libera tras procesarla. No se trunca una carga que supera cuotas.

notify=true acredita aceptación de escritura una sola vez, incluso si write
señala backpressure; cola agotada devuelve false antes de escribir. Timeout no
garantiza rollback/cancelación de un comando ya entregado, ni acota la cola interna
del programa Python. Son políticas defensivas locales, no benchmark/SLO ni prueba
de carga. No se certifican descendientes externos después de kill.

## Recursos del navegador

El selector UI compartido agrupa prefijos durante 500 ms usando el timestamp
del evento, sin timer propio. El buffer se acota a la longitud de la etiqueta
más larga. La lista usa hasta 288 px y margen de viewport de 12 px; su altura
efectiva se limita al espacio disponible. Animación de entrada de hasta 150 ms,
omitida con movimiento reducido; la geometría cambia sin transiciones. Fuente:
`src/components/ui/SelectDropdown.tsx`.

La [política de recursos](../../electron/integrated-browser/resource-policy.ts)
usa los defaults de `electron/integrated-browser/types.ts`: objetivo de ocho
vistas vivas, una de fondo warm, gracia de 90 segundos con ventana utilizable
y 30 con ventana oculta, y retry de 30 segundos para trabajo protegido o fallo
periódico. Las candidatas LRU excluyen disposición protegida y carga/espera,
audio, captura o DevTools activos; el objetivo puede excederse temporalmente
cuando no hay candidatas seguras. La política conserva un solo timer útil,
invalidable al limpiar el perfil. No constituye un límite de memoria medido.

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

Equipos ejecutores locales: dos trabajadores y un coordinador; un trabajo activo,
hasta seis admitidos y treinta en historial. Diez minutos de tiempo activo
acumulado, doce rondas por agente, cuarenta y dos llamadas totales incluyendo
investigación, sesenta herramientas y umbral observado de 160000 tokens.
Una respuesta puede rebasar el umbral; al observarlo no se ejecutan nuevas acciones
ni se declara éxito. Contexto hasta32000 caracteres, doce artefactos por trabajo,
2MB por archivo, veinte diapositivas y tablas de hasta200 filas/20columnas.
Las guardas de bytes, entradas y formatos son previas a publicar el archivo.
Fuente: `src/shared/background-teams.ts`, `electron/background-teams/schemas.ts`
y `electron/background-teams/artifacts.ts`.

Recuperación de permisos/privacidad/políticas del agente: principal máximo
8 MiB, copia protegida máximo 16 MiB, una generación de respaldo y hasta cinco
principales dañados cifrados sin purga automática. Revisión de un solo uso,
cinco minutos, una confirmación pendiente por servicio. Los topes y la cola
por archivo están en `electron/integrated-browser/policy-file-recovery.ts`.

Cambiar un limite requiere: identificar actor y amenaza/costo, escenario positivo
y negativo, prueba de borde, observabilidad y rollback. Si altera comportamiento
visible, actualizar `LIM-*`, requisitos e historias relacionados.

## Diseño de documentos generados

Portada automática desde 6000 caracteres, salvo decisión explícita. Página
Carta de 12240 × 15840 twips; margen editorial de 1440 twips. Corporativo:
1080 twips laterales/inferior y 1560 superior para separar el encabezado.
Cuerpo de 11 puntos,
títulos de 22–32 según contexto; tablas hasta 20 columnas, sin alturas fijas
de fila. Gráficas anexas hasta 520 × 680 px, manteniendo proporción. PDF:
timeout de carga e impresión de 30 segundos con liberación de la ventana.
Fuentes: `src/shared/document-design.ts`, `electron/document-designer/`
y `electron/wa-executor/handlers/create-document/pdf-document.ts`.

Identidad de documentos: consulta de membresía/marca 8 s, descarga HTTPS sin
redirecciones 8 s/2 MiB, logo bitmap 16 MP y PNG 480 × 240/64 KiB. Se valida
membresía nuevamente antes de guardar. Logo en portada hasta 180 × 120 px y
encabezado hasta 88 × 26 px, sin ampliación de originales pequeños. Metadatos
de tema para lectura: 16 KiB por parte XML, 8000 caracteres por propiedad,
nombre de organización hasta 200 caracteres. Imágenes de contenido en lectura:
presupuesto 64 KiB, más logo del encabezado hasta 64 KiB.
Se decodifican como máximo ocho imágenes embebidas por documento. Fuentes:
`electron/organization-branding/document-branding.ts`,
`electron/organization-branding/document-logo.ts` y
`electron/artifact-viewer/document-theme.ts`.

## Visor local de archivos

Archivo de entrada: 20 MB; lectura de texto: 200000 caracteres; expansión Office:
32 MB / 2000 entradas ZIP, sin ZIP64 ni multidisco. Vista: 8 hojas, 500 filas,
50 columnas y 10000 celdas en conjunto; 12 pestañas y dos lecturas simultáneas.
Imágenes: 40 millones de píxeles de entrada y 2400 por lado de salida.
PDF: 20 segundos de inicialización, 16 millones de píxeles por canvas y zoom 50–200%.
HTML: 12 rutas efímeras de 200000 caracteres ligadas al contexto, sin caché ni CORS.
Copias externas: 12 retenidas y dos preparaciones simultáneas, con limpieza de
mejor esfuerzo al cerrar; un cierre abrupto o un bloqueo de Office puede dejar
una copia temporal. Fuentes: `src/shared/artifact-viewer.ts`,
`electron/artifact-viewer/` y `src/components/artifacts/pdf-runtime.ts`.

## Selector de compartir pantalla

Hasta 100 fuentes por solicitud; miniaturas de 480 × 270 píxeles. Una ventana
modal por padre, timeout de 120 segundos y actualización manual sin polling.
Miniaturas y objetos de captura efímeros en memoria; no se guardan capturas.
Solo pestañas materializadas del perfil actual, sin activar pestañas frías.
El estudio conserva hasta 14 vínculos (12 escenas más edición/reemplazo),
concesión de vista local de un solo uso por 10 segundos y una captura local de
pantalla. Los vínculos se liberan al salir, navegar, cerrar o cambiar actor;
no sobreviven al cierre del estudio ni se guardan en Learning.
Fuentes: `electron/integrated-browser/display-media-picker.ts` y
`electron/integrated-browser/display-media-sources.ts`.

## Producción audiovisual local

Programa del estudio síncrono: un canvas de 1280 × 720, máximo 30 fps, una ventana
de salida y un peer local sin STUN/TURN. Transiciones entre 100 y 2000 ms,
500 ms por defecto; corte sin duración visual. Intermedio de imagen/pantalla:
500–10000 ms (1500 ms por defecto), fundidos de hasta 200 ms; movimiento reducido
conserva intervalo con cortes. Reloj opcional de 0–7200 segundos desde su primera
aparición. Hasta tres fuentes durante un intermedio (saliente, intermedio y
entrante); dos para fundido/barrido. Conserva las 12 escenas/25 MB del banco.
Preparación de medios: 10 segundos por fuente, abortable al cerrar; ICE local: 8 segundos; receptor/primer frame:
25 segundos. Oferta/respuesta SDP: 64 KiB por mensaje. Video de programa sin
audio; cámara y micrófono de la llamada siguen separados. El modo continuo puede
mantener capturas saliente/intermedia/entrante simultáneamente, a diferencia del modo directo
de una sola fuente. Fuentes: `src/shared/studio-program.ts`,
`src/services/studio-program-renderer.ts` y `electron/studio-output/`.

Una producción simultánea, doce minutos, 6–60 segundos, 30/60 fps, 1280/1920 de ancho, MP4 hasta 80 MB y workspace hasta 128 MB. Manifiestos de 512 KB; máximo tres entidades visibles por escena. [Contrato y operación](presentation-audiovisual-production.md).

## Confirmación del calendario IPC

Una confirmación nativa por registro; vigencia 120 segundos. Vencimiento o cambio
de contexto solicitan cerrar el diálogo mediante señal. Mientras no cierre sigue
bloqueando otros; nunca ejecuta al aceptar tarde.
Título hasta 500 caracteres, descripción 10000, ubicación 1000, identificadores
1024. Intervalos ISO con zona y fin posterior al inicio; actualización de fechas
requiere ambos extremos. Fuentes: `electron/calendar/ipc-contract.ts` y
`electron/calendar/ipc-authorization.ts`.

Custodia OAuth: archivos de hasta 1 MiB; máximo dos proveedores por usuario,
tokens de hasta 65536 caracteres y propietario de hasta 320. El archivo heredado
admite hasta 100 registros antes de sellarlo; no se reactivan registros inactivos.
Polling: intervalo entre 1000 y 3600000 ms, sin consultas solapadas; detenerlo o
cambiar sesión invalida respuestas pendientes. Fuentes:
`electron/calendar/credential-store.ts`, `credential-files.ts` y `polling.ts`.

## Planes de organización Gmail

Preview: hasta 1000 mensajes, 50 páginas de hasta 50 mensajes y grupo mínimo
de 1–20; por defecto 250 mensajes, 20 páginas y mínimo 2. Consulta hasta 4096
caracteres. Aplicación: lotes de hasta 100 y lectura previa de etiquetas con
máximo ocho solicitudes paralelas. Solicitud SDK de hasta 15 segundos y
presupuesto de 90 segundos desde la primera llamada del plan, independiente
de los 120 segundos de confirmación; sin retry automático. El envío Gmail
también usa 15 segundos, señal de cancelación y retry desactivado.

Store: 100 planes por pareja usuario/cuenta, 2 MiB de JSON, 4 MiB cifrados;
exclusión por cuenta en el proceso, sin bloqueo entre procesos ni eliminación
automática. Estos límites son políticas locales, no un benchmark ni límites
garantizados por Google. Fuentes: `src/shared/gmail-organization.ts`,
`electron/gmail/plan-context.ts`, `plan-storage.ts`, `batch.ts` y `delivery.ts`.

## Operaciones directas de Gmail

Lectura: 1–100 mensajes por página, consulta/token de hasta 4096 caracteres y
hasta 100 IDs de etiquetas. Etiquetas: nombres hasta 225 caracteres, referencias
hasta 100 por lista; IDs hasta 256. Duplicados de páginas/IDs se rechazan.
Preparación masiva: hasta 50000 membresías de mensajes y limpieza de hasta 100
etiquetas; lotes de 100. Exceder cuota rechaza antes de mutar, sin truncar.
Estos topes son políticas locales, no promesas del proveedor ni benchmarks.

El contexto común usa presupuesto de hasta 90 segundos para preparar y otro
de hasta 90 segundos tras aprobación; la espera humana conserva su vigencia de
120 segundos. Cada solicitud SDK dispone de hasta 15 segundos, señal de
cancelación y retry desactivado. El contexto se revalida tras esperas; no hay
reanudación tras cerrar el proceso ni nuevos timers de polling. Fuentes:
`src/shared/gmail-mailbox.ts`, `electron/gmail/execution-context.ts`, `batch.ts`
y `label-cleanup.ts`.

Feedback de WhatsApp: una respuesta por llamada ejecutada, sin consultas
globales añadidas tras modificar un mensaje y sin sondeo de etiquetas. Se
conservan tokens/flags de paginación, no órdenes de leer hasta agotar resultados.
Esta simplificación no introduce cuotas, timers ni presupuesto de red nuevo.
Fuente: `electron/wa-agent/agent-loop-tools.ts` y los ejecutores Gmail.

## Sesiones y HTTP de Project Hub

Custodia: 4 MiB de JSON y 8 MiB cifrados por usuario; propietario de 1–256
caracteres, tokens ASCII imprimibles sin espacios de 1–65536 y hasta 1000
workspaces. Cada workspace: UUID, nombre/slug hasta 512, rol hasta 128 y logoUrl
opcional hasta 4096. Payload versión 1; sólo refresh token y workspaces, sin
access token ni vencimiento persistido. Cifrado del SO asíncrono, sin
basic_text/unknown ni fallback plano. No hay barrido o migración del legado
global sin dueño ni límite de cuentas global nuevo.

HTTP: JSON saliente hasta 2 MiB, respuesta hasta 4 MiB por lectura real y
Content-Length; 15 segundos por intento y backoff cancelable de 250/500 ms
para los dos reintentos de red GET. Un 401 de lectura admite una renovación
single-flight y una repetición sin retry de red. Mutaciones/auth/logout no se
repiten automáticamente; una clave de operación tiene hasta 200 caracteres y
rechaza CR/LF/NUL. Margen de renovación: 30 segundos; un acceso vencido nunca
se usa si la renovación falla. `expires_in` aceptado: 1–31536000 segundos.
El plazo no incluye espera en la cola de disco; no es un SLO ni benchmark.
Fuentes: `electron/project-hub/session-contract.ts`, `authentication.ts`,
`session-store.ts` y `transport.ts`.

IPC Project Hub: 23 canales, 21 payloads y dos operaciones sin argumentos;
diez mutaciones de dominio, lote nativo y copia local con confirmación de hasta 120 segundos, cancelar por
defecto y un diálogo pendiente por registro. Preview: hasta 12000 caracteres
de JSON resumido más encabezado/aviso; arrays muestran conteo y primeros tres
elementos, archivos hasta diez declaraciones completas; textos de más de 600
caracteres muestran 120 y longitud total. Nunca se presenta como vista íntegra.
Se comprueba workspace de la sesión y nombre/IDs del proyecto antes del diálogo;
la autorización efectiva sigue en el servidor. Workspace nuevo requiere canje
para actualizar la lista local.

Snapshot: presupuesto conservador de 2 MiB UTF-8 de JSON, profundidad hasta 12
desde raíz cero y 20000 nodos; aridad exacta y schemas de dominio cerrados.
Descripción de proyecto: 20000 caracteres, tarea: 50000; títulos 255/500,
25 tags de 50, colecciones de 1–50 pestañas y hasta 51200 caracteres por extracto.
Evidencia hasta 100 items; reunión hasta 200 items y 100 acciones. No se reciben
declaraciones de archivos desde renderer: las produce el selector/inspector main.
No hay timer de polling nuevo ni presupuesto
global que incluya custodia; cancelar retira sólo la espera del caller mientras
la renovación compartida del dueño puede seguir. Fuentes:
`src/shared/project-hub.ts`, `electron/project-hub-handlers.ts`,
`electron/project-hub/ipc-review.ts` y `session-context.ts`.

Subida: 1–10 archivos de 1 byte a 20 MiB cada uno; hash en bloques de 64 KiB,
relectura de un archivo completo a la vez tras aprobar. Un lote activo por
registro; presupuesto de 180 s desde aprobación y PUT hasta 30 s, metadatos
HTTP hasta 15 s por intento sin retry de escritura. El presupuesto incluye
relecturas; preparación previa y selección humana tienen su propio lifecycle.
Nombres hasta 255 caracteres; MIME derivado de extensión: JPEG/PNG/GIF/WebP,
PDF, TXT/MD/CSV UTF-8 sin NUL y DOCX/XLSX/PPTX con firma ZIP. No es antivirus.
Signed URL hasta 100000 caracteres, token ASCII hasta 65536; una intención por
archivo con UUID/path/origen/token exactos; sin journal/reanudación/borrado
automático de huérfanos. Cancelar picker no promete cerrarlo: el slot se retiene
hasta su respuesta. Fuentes: `src/shared/project-hub-files.ts` y
`electron/project-hub/upload-files.ts`, `upload-target.ts`, `upload.ts`,
`upload-handlers.ts`. Las cuotas son políticas locales, no benchmark ni SLO.

Descarga: evidencia upload ready no archivada, de 1 byte a 20 MiB, MIME/extensión
y SHA-256 obligatorios; mismo catálogo y validación de formato de subida en
`electron/project-hub/file-format.ts`. Nombre sugerido hasta 255 caracteres,
fallback por evidence UUID si es inseguro. Signed URL hasta 100000 caracteres,
token ASCII hasta 65536, expires_in de 1–300 s y origen/ruta exactos. Bytes por
streaming hasta 30 s, sin redirect/retry/cookies/bearer; presupuesto de 90 s
desde elección de destino hasta publicación, sin incluir espera humana previa.
Un slot compartido upload/download por registro, retenido mientras el picker
cancelado siga pendiente. Copia nueva mediante staging exclusivo, fsync y hard
link; sin sobrescritura, ejecución, fallback de copia parcial ni reanudación.
saved/bytes conservan commit confirmado si se cancela después. Un fallo de
link sin confirmación informa uncertain/recoveryRequired incluso con cancelación;
saved=false en ese caso no acredita ausencia de copia. Un fallo de cleanup o
crash puede dejar staging propio. No es SLO. Fuentes: `src/shared/project-hub-files.ts`,
`electron/project-hub/download.ts`, `download-target.ts`, `download-destination.ts`,
`download-handlers.ts` y `file-operations.ts`.

Observación de herramientas WhatsApp: hasta 30 nombres y resúmenes por evento
persistente, identificadores de herramienta de hasta 128 caracteres, estados de
vocabulario cerrado y contadores enteros no negativos representables con seguridad.
Metadata operativa sólo UUID y duración en ms. Las huellas HMAC-SHA256 usan una
clave aleatoria de 32 bytes por objeto de turno, en WeakMap, sin persistencia ni
temporizador de limpieza nuevo. Fuente: `electron/whatsapp/tool-observation.ts`
y `electron/wa-agent/tool-fingerprint.ts`. No introduce cuotas de conversación
ni limita el resultado funcional que se devuelve al modelo.

Voz local: revisión nativa de 120 s, un control de activación/instalación por
coordinador. Probe fijo de 3 s, temporal, sin grant persistente. Micrófono null,
índice entero 0–65535 o nombre de 1–512 caracteres; 1–10 palabras de 1–64;
velocidad 0.5–2; voz hasta 128 y ruta main absoluta local hasta 4096 sin UNC ni
controles. Modelos small/large y los cuatro IDs Piper existentes. Texto de
síntesis hasta 5000 caracteres; IDs opcionales de flujo hasta 200. Los DTO
públicos no incluyen rutas internas. Fuentes: `electron/voice/contract.ts`,
`session.ts`, `src/shared/local-voice.ts` y `src/shared/orb.ts`.

Síntesis Orbe: 4 solicitudes activas y hasta 128 en espera cancelable de 30 s;
cada síntesis conserva plazo de proveedor de 30 s, audio hasta 16 MiB y error
hasta 16384 bytes reales, aun sin Content-Length fiable. No hay retry. Conserva
prefetch paralelo y encola exceso admitido antes de solicitar al proveedor.
Fuentes: `electron/voice/synthesis-queue.ts` y `electron/orb-tts.ts`. Son límites
de defensa, no un SLO ni una prueba de carga de producción.

Documentos Python: entrada local de 4 bytes a 50 MiB, un selector/lectura renderer
por registro, páginas 1–200; Markdown/texto hasta 400000 caracteres. Hasta 100
tablas, 2000 filas por tabla, 200 columnas, 20000 celdas y 400000 caracteres
acumulados. Redacción devuelve hasta 20000 entidades con posiciones Unicode.
Plazos de documento 60 s y PII 10 s; sin retry. Configuración de privacidad
hasta 1024 bytes, una clave booleana. Fuentes: `src/shared/python-tools.ts`,
`electron/python/tools-contract.ts`, `privacy-store.ts` y `python-tools-service.ts`.
Los límites no garantizan RAM/CPU del parser ni seguridad completa de ZIP.
Ver [contrato y alcance](../security/python-document-boundary.md).

La admisión Office en Python limita directorio ZIP a 2 MiB/4096 entradas,
16 MiB por entrada y 64 MiB inflados, con ratio hasta 1000. XML hasta 128 niveles
y 500000 elementos acumulados; 200 hojas/diapositivas y 100 tablas por paquete.
Rechaza DTD/ZIP64/multidisco y coordenadas/spans excesivos. El constructor aplica
las cuotas del DTO durante conversión y tras redacción, contando UTF-16. Fuentes:
`python/tools_sidecar/office_preflight.py` y `document_budget.py`. Son presupuestos
de admisión/trabajo; permanecen estructuras de terceros y riesgos del SO.
