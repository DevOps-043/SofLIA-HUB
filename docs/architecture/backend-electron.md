# Arquitectura backend Electron

Estado: vigente. Actualizado: 2026-08-06.

<!-- evidence: electron/main/bootstrap.ts -->
<!-- evidence: electron/main/service-factory.ts -->
<!-- evidence: electron/main/startup.ts -->

## Bootstrap real

`electron/main.ts` configura autoplay, impide bootstrap duplicado y obtiene el
single-instance lock. `runBootstrap` despues:

1. configura entorno antes de evaluar los módulos dinámicos;
2. solicita módulos en paralelo, espera el conjunto y parsea `soflia:`;
3. construye servicios y estado runtime;
4. conecta dependencias entre servicios y eventos;
5. registra handlers que no requieren ventana;
6. espera `app.whenReady()` y registra protocolo/plataforma;
7. inicializa subsistemas con `runOptionalStep`;
8. crea ventana/tray y conecta WhatsApp si corresponde.

Las solicitudes de imports concurrentes conservan las 67 exportaciones y el
registro completo de handlers antes de crear ventanas. Un fallo rechaza el
bootstrap sin publicar servicios parciales. Los hitos `main:entrada`,
`modulos:inicio/fin`, `entorno:inicio/fin` y `servicios:construir:inicio/fin`
separan evaluación estática, carga, entorno y constructores. El reloj incluye
el tiempo anterior a importar `boot-timeline`, desde el origen de Node main;
no incluye compilación de Vite ni representa tiempo de lectura de `.env`.

## Servicios construidos

Monitoreo mantiene un pipeline periódico en vuelo por servicio. Las revisiones
de sesión/configuración descartan resultados anteriores y detienen etapas aún
no iniciadas; una sesión nueva solicita captura fresca al liberarse la anterior.
Las capturas explícitas siguen disponibles. Los archivos incorporan UUID para
evitar colisiones entre capturas del mismo milisegundo. Errores sin receptor del
evento `error` se registran y no lanzan una excepción adicional.

PathMemory conserva un intervalo/watchers por instancia y serializa las
actualizaciones, agrupando invalidaciones. El escáner mantiene sus límites de
entradas/profundidad y consulta hasta cuatro metadatos a la vez. Stop cancela
timers/etapas nuevas y publicaciones antiguas; IO ya iniciado puede terminar.

La caché de embeddings de MemoryService expulsa por LRU al superar cuatro
sesiones o 5000 vectores acumulados. Las filas SQLite y el alcance de búsqueda
se conservan y se recargan al volver a consultar. Las invalidaciones delete/clear
existentes siguen vigentes. Ver [evidencia y límites](../../openspec/changes/bound-background-work-and-memory/reports/verification.md).

`WhatsAppService` conserva estado/configuración sin importar el SDK de transporte.
`whatsapp/connection-runtime.ts` se carga al conectar, también en autoconexión.
Las llamadas simultáneas comparten un intento; desconexión o cambio de sesión lo
revocan y cada espera revalida antes de crear socket. No cambia permisos ni
funciones de QR, envíos, medios o agente. La conversión de documentos del hub
heredado carga su descargador al recibir un documento compatible.

`whatsapp/reconnect.ts` mantiene un reintento cancelable por servicio y retira su
listener de sesión al ejecutarse/cancelarse. Inicio manual, desconexión y cambio
de identidad lo invalidan. Eventos de sockets retirados se descartan y los
rechazos de conexión/credenciales se registran sin escapar del callback. La
desconexión retira la referencia al socket antes de esperar logout y libera el
transporte incluso si falla; no vuelve a borrar el estado de un socket nuevo.
Los lotes de mensajes y llamadas aíslan los errores por elemento, incluida una
resolución de identidad que rechace por falta de red, y continúan con los demás.
El fallo de autorización no habilita el mensaje ni provoca envíos automáticos.

Ver [evidencia y límites](../../openspec/changes/optimize-connection-and-stream-lifecycle/reports/verification.md).

| Servicio | Dependencias directas | Estado/persistencia |
|---|---|---|
| `WhatsAppService` | Baileys; agente inicializado aparte | credenciales/config en `userData` |
| `MemoryService` | SQLite, Gemini embeddings/summaries | `soflia-memory.db` |
| `KnowledgeService` | Markdown + SQLite/index | `userData` |
| `MonitoringService` | desktopCapturer, active-win, sharp/OCR | buffer + Lia + screenshots |
| `CalendarService` | Google/Microsoft OAuth | tokens/conexiones |
| `GmailService`, `DriveService`, `GChatService` | auth de CalendarService | proveedores externos |
| `IntegratedBrowserService` | `BrowserWindow` + pestañas `WebContentsView`, doble vista, modo lectura, historial, boveda y extensiones | particion Chromium + archivos administrados en `userData/integrated-browser`; audio lector efímero en memoria |
| `DesktopAgentService` | vision, UIA/OCR/ONNX, nut/Playwright | config JSON, tareas en memoria |
| `DesktopContextService` | `listWindows`, desktopCapturer, COM de Office (solo lectura), UIA, `PythonToolsService` | inventario de la ultima consulta en memoria; sin persistencia |
| `UpdaterService` | electron-updater | estado de descarga |
| `ClipboardAIAssistant` | clipboard; max 100, poll 5 s | historial en memoria |

| `TaskScheduler` | node-cron | `scheduler-state.json` |
| `PathMemoryService` | filesystem/watch | indice/rutas en `userData` |
| `WorkspaceAutomationService` | Gmail, Calendar, Chat, Drive, Desktop | runs/config de automatizacion |
| Servicios Meeting | Store, sources, AI, review, sync, detection | Lia Supabase |
| `WorkflowHubService` | Calendar, Chat, scheduler, automation, meetings | casos/variantes/reglas |
| `DailyBriefingService` | WhatsApp | inicia `enabled: false`, cron `0 8 * * 1-5` |
| `TelegramService` | Telegram API + servicios de workflow | config/identidades locales |
| `CommunicationHubService` | WhatsApp, Telegram, remote nodes | `communication-hub-state.json` |
| `SofliaLearningService` | Supabase Learning | estado remoto |
| Servicios singleton importados | background host, remote node, dynamic tools, Python voice/tools | `userData` y procesos hijos |

La consulta del historial indexa título, dominio, ruta y query; omite el
protocolo salvo que el usuario escriba `://`, y permite buscar el dominio con o
sin `www.`. Esto evita coincidencias universales por `https://`. Los favoritos
son metadata HTTP(S) saneada y acotada del renderer; las extensiones visibles en
su misma fila se obtienen por el contrato de listado existente, sin canales ni
permisos nuevos.

## Orden de inicializacion

La fachada OAuth de calendario coordina navegador externo, ventana local sin
privilegios y revocación. `calendar/oauth-proof.ts` valida y vincula el intento;
`oauth-receiver.ts` posee HTTP/plazos/cierre; los conectores mantienen SDK y
custodia del servicio. [Contrato OAuth](../security/calendar-oauth.md).

El orden de `electron/main/startup.ts` es normativo porque refleja dependencias:
memoria -> conocimiento -> meetings -> automation/workflow -> deteccion ->
path memory -> updater -> scheduler -> clipboard -> daily briefing -> communication
hub -> WhatsApp bridge -> background/remote/Telegram/Learning -> dynamic tools ->
Python -> ventana/tray -> WhatsApp -> Calendar -> polling de deteccion.

Cada paso opcional registra el nombre exacto del fallo. Un servicio fallido puede
dejar funciones degradadas; los consumidores deben consultar status en vez de
asumir que `app.ready` implica todas las integraciones disponibles.

## Patron de modulo

La raiz `electron/*.ts` conserva facades de compatibilidad; la implementacion se
divide en carpetas (`whatsapp/`, `wa-agent/`, `desktop-agent/`, `meetings/`, etc.).
Un dominio con renderer sigue cuatro piezas:

```text
servicio main -> registro ipcMain -> canal preload allowlisted -> wrapper renderer
```

Los eventos main->renderer usan `webContents.send` solo con ventana disponible y
canal permitido. Los servicios no deben importar componentes React.

## Procesos y recursos secundarios

- Voz: `python-runtime-service.ts` administra sidecar local, modelos, restart y
  eventos de wake word/dictado.
  `voice/session.ts` coordina caller, consentimiento efímero y revocación; init
  carga preferencias sin captura. Ajustes y Orbe comparten la guardia main,
  conservando fachadas y puerto de Meeting Live. Ver
  [autorización y recuperación de voz](../security/local-voice-authorization.md).
- Documentos/privacidad: `python-tools-service.ts` usa otro proceso para aislar
  fallos y timeout.
- Ambas fachadas comparten `electron/python/sidecar-connection.ts` y `ndjson.ts`:
  conexión/ready/pending/framing por hijo, sin mezclar voz y documentos. Ready
  comprueba v4/v1; todos los consumidores esperan la misma preparación. Stop
  retira la generación antes de esperar shutdown/kill, y nuevas solicitudes de
  arranque esperan ese cierre pendiente. Un exit/error/stdout viejo no modifica
  la conexión actual. Los comandos no se repiten automáticamente.
  Si kill falla o devuelve false, se comunica cierre no confirmado y se bloquea
  el reemplazo hasta close real; un spawn sin PID conserva su error de arranque.
- La voz revalida epoch/intención después de esperas; parar/deshabilitar cancela
  restart y arranques pendientes. Los timers de 1/2/3 s comprueban intención antes
  de reactivar, reutilizando un hijo que otro consumidor haya preparado. Reiterar
  stop cancela también arranques en espera. Las respuestas tools se revalidan antes de publicar resultados.
  El transporte no registra stdout/stderr crudos; otros mensajes semánticos de
  los servicios mantienen revisión de privacidad pendiente.
- UIA nativo: workers PowerShell/Windows administran accesibilidad/input cuando
  la plataforma lo soporta.
- Contexto de escritorio: `electron/desktop-context/` lee lo que el usuario ya
  tiene abierto para el chat. Inventaria ventanas sin leer contenido y extrae en
  cascada (documento por COM + sidecar, texto por UIA, captura). Es de solo
  lectura y no persiste nada; `SOFLIA_DISABLE_DESKTOP_CONTEXT=1` lo desactiva.
- Navegador integrado: `electron/integrated-browser/` administra hasta 500
  pestañas lógicas con un presupuesto máximo global de ocho `WebContentsView`
  vivas, con una o dos
  superficies visibles y sesion persistente
  aislada, protocolos HTTP(S), User-Agent derivado de Chromium sin token
  Electron, permisos sensibles con HITL y un driver de Computer Use sobre la
  pestaña enfocada. `BrowserSitePermissionStore` administra los permisos por
  origen y `IntegratedBrowserPermissionGovernance` los aplica a cualquier
  pestaña viva de la partición, no solo la activa; para cámara y micrófono
  verifica además el permiso del sistema operativo antes de conceder.
  `getDisplayMedia` pasa por un selector nativo de pantalla o ventana. La
  pantalla completa de la página lleva la vista a cubrir la ventana anfitriona
  y la ventana a pantalla completa del sistema, y `window.open` sin destino
  abre una ventana real para Document Picture-in-Picture en vez de una pestaña. La captura visual pasiva no recorre el DOM, se reduce a
  1024 px, usa cadencia adaptativa (más amplia para YouTube) y cede durante
  interacción o Computer Use; la extracción saneada se realiza bajo demanda y
  no se fuerza para turnos ajenos al navegador. Los popups HTTP(S) se convierten en
  pestañas internas. `BrowserHistoryStore` conserva
  visitas HTTP(S) saneadas; `BrowserCredentialVault` cifra secretos con
  `safeStorage` y solo devuelve metadata; `BrowserExtensionManager` valida,
  copia y carga extensiones Manifest V3 desempaquetadas aprobadas por el usuario,
  incluye permisos opcionales y verifica SHA-256 por archivo entre inspección y
  confirmación; no serializa rutas en errores de carga. Una extensión fallida
  puede reintentarse sobre su copia administrada. Los overlays renderer que
  deben cubrir contenido nativo —gestores y predicciones de dirección— toman
  una captura puntual, ocultan temporalmente las vistas y republican los mismos
  bounds al cerrar; no destruyen pestañas, recargan ni cambian de partición.
  Al superar ocho vistas vivas, la pestaña inactiva menos reciente se suspende
  conservando URL y título; al activarla se recrea en la misma partición. La
  activa, las dos superficies visibles y hasta cuatro pestañas trasladadas a
  `BaseWindow` quedan protegidas de la suspensión. Separar o reintegrar mueve la
  misma vista sin recargar, duplicar perfil ni crear un renderer de aplicación.
  La llamada directa automática de Google Chat está deshabilitada. Cuando
  Gmail o Chat intenta abrir o navegar a la ruta exacta
  `meet.google.com/call`, main cancela el evento sin crear pestaña, ventana,
  reunión alternativa, navegador externo ni telemetría RPC de Meet. La regla
  cubre destinos iniciales, ventanas anidadas, transiciones desde `about:blank`,
  redirecciones y subframes. Los `about:blank` de Document Picture-in-Picture
  ajenos a esa ruta conservan una `BrowserWindow` hija real. La gobernanza de
  cámara, micrófono, pantalla y notificaciones no cambia.
  `BrowserReadingModeService` extrae selección o estructura semántica bajo
  demanda, sintetiza segmentos explícitos con timestamps de ElevenLabs y
  conserva sesiones/audio únicamente en una caché acotada en memoria. El
  controlador React no ocupa espacio visual: una cápsula redondeada vive en un
  `ShadowRoot` efímero, se ancla sobre la selección, puede arrastrarse dentro
  del viewport y se reposiciona al hacer
  scroll o resize sin modificar el viewport. El primer segmento es corto y se
  precargan hasta dos posteriores durante la reproducción. Main relaciona offsets con nodos
  visibles y aplica un CSS Custom Highlight efímero; un DOM opaco o modificado
  degrada el subrayado al token sincronizado dentro de la cápsula, no la
  reproducción ni la página. La síntesis prepara aliases españoles y decimales
  con un mapa reversible a los offsets originales; no existe descarga de audio.
  La ruta crítica de voz usa un microlote inicial de hasta 180 caracteres,
  prepara como máximo dos lotes de hasta 480 mientras reproduce y cancela cada
  solicitud a los 20 segundos; no reintenta automáticamente operaciones
  facturables.
  `orb:synthesize` reutiliza la configuración ElevenLabs main-only con modelo
  `eleven_turbo_v2_5` por defecto y entrega MP3 al renderer autorizado; la Orbe
  decodifica y encola los bloques con Web Audio sin exponer la API key.
- Browser automation aislada: Playwright Core se conserva para perfiles
  configurables o ejecuciones explicitamente aisladas; no es la ruta normal de
  la vista compartida con el usuario.

## Documentos generados

<!-- evidence: electron/document-designer/create-document.ts -->
<!-- evidence: electron/wa-executor/handlers/create-document/pdf-document.ts -->

Word y PDF comparten bloques y diseño declarativo. Chat, equipos y herramientas
de canales reutilizan el generador; una skill puede indicar preset, fuente,
acento y portada sin inyectar código. Los archivos conservan sus guardas.
Contrato y límites: [Diseño de documentos](generated-documents.md).

## Funcionalidad no activa aunque existan referencias

AutoDev no se construye ni inicializa en `service-factory.ts`/`startup.ts`; quedan
referencias legacy en textos, tests y daily digest. Por tanto no se documenta como
servicio runtime disponible. `NeuralOrganizerService` se importa en
`service-modules.ts` pero tampoco se instancia en el bootstrap actual. Activar
cualquiera exige una integracion OpenSpec, handlers/politicas y pruebas nuevas.

## Frontera documental Python

El servicio de herramientas comparte transporte por hijo con voz, pero mantiene
proceso y cancelación propios. Contratos, persistencia y snapshot se separan en
`electron/python/`; los handlers validan caller y selección y los consumidores
internos conservan su fachada. Contrato de privacidad, errores y recuperación:
[lectura documental local](../security/python-document-boundary.md).

Dentro del sidecar, `document_errors.py`, `office_preflight.py` y
`document_budget.py` separan error de dominio, admisión ZIP/XML y presupuesto
incremental compartido por PDF/Excel/PowerPoint/Word. La fachada documents.py,
redacción y proceso tools conservan sus consumidores y protocolo. La distribución
incluye los módulos por el filtro existente de tools_sidecar, excluyendo tests;
el build de aplicación no certifica el runtime Python empaquetado.
