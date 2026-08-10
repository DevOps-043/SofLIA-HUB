# Arquitectura backend Electron

Estado: vigente. Actualizado: 2026-08-06.

<!-- evidence: electron/main/bootstrap.ts -->
<!-- evidence: electron/main/service-factory.ts -->
<!-- evidence: electron/main/startup.ts -->

## Bootstrap real

`electron/main.ts` configura autoplay, impide bootstrap duplicado y obtiene el
single-instance lock. `runBootstrap` despues:

1. importa modulos de servicio de forma dinamica;
2. configura entorno y parsea protocolo `soflia:`;
3. construye servicios y estado runtime;
4. conecta dependencias entre servicios y eventos;
5. registra handlers que no requieren ventana;
6. espera `app.whenReady()` y registra protocolo/plataforma;
7. inicializa subsistemas con `runOptionalStep`;
8. crea ventana/tray y conecta WhatsApp si corresponde.

## Servicios construidos

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
| `UpdaterService` | electron-updater | estado de descarga |
| `ClipboardAIAssistant` | clipboard; max 100, poll 5 s | historial en memoria |

| `TaskScheduler` | node-cron | `scheduler-state.json` |
| `PathMemoryService` | filesystem/watch | indice/rutas en `userData` |
| `ProactiveService` | Calendar + WhatsApp | `proactive-config.json` |
| `WorkspaceAutomationService` | Gmail, Calendar, Chat, Drive, Desktop | runs/config de automatizacion |
| Servicios Meeting | Store, sources, AI, review, sync, detection | Lia Supabase |
| `SdoService` | repositorio Lia, artifacts | Lia Supabase |
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

El orden de `electron/main/startup.ts` es normativo porque refleja dependencias:
memoria -> conocimiento -> meetings -> SDO -> automation/workflow -> deteccion ->
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
- Documentos/privacidad: `python-tools-service.ts` usa otro proceso para aislar
  fallos y timeout.
- UIA nativo: workers PowerShell/Windows administran accesibilidad/input cuando
  la plataforma lo soporta.
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

## Funcionalidad no activa aunque existan referencias

AutoDev no se construye ni inicializa en `service-factory.ts`/`startup.ts`; quedan
referencias legacy en textos, tests y daily digest. Por tanto no se documenta como
servicio runtime disponible. `NeuralOrganizerService` se importa en
`service-modules.ts` pero tampoco se instancia en el bootstrap actual. Activar
cualquiera exige una integracion OpenSpec, handlers/politicas y pruebas nuevas.
