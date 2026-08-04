# Arquitectura backend Electron

Estado: vigente. Actualizado: 2026-08-04.

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
| `IntegratedBrowserService` | `BrowserWindow` + `WebContentsView`, historial, boveda y extensiones | particion Chromium + archivos administrados en `userData/integrated-browser` |
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
- Navegador integrado: `electron/integrated-browser/` administra una
  `WebContentsView` dentro de la ventana principal, con sesion persistente
  aislada, protocolos HTTP(S), permisos sensibles con HITL y un driver de
  Computer Use sobre la misma superficie visible. `BrowserHistoryStore` conserva
  visitas HTTP(S) saneadas; `BrowserCredentialVault` cifra secretos con
  `safeStorage` y solo devuelve metadata; `BrowserExtensionManager` valida,
  copia y carga extensiones Manifest V3 desempaquetadas aprobadas por el usuario.
- Browser automation aislada: Playwright Core se conserva para perfiles
  configurables o ejecuciones explicitamente aisladas; no es la ruta normal de
  la vista compartida con el usuario.

## Funcionalidad no activa aunque existan referencias

AutoDev no se construye ni inicializa en `service-factory.ts`/`startup.ts`; quedan
referencias legacy en textos, tests y daily digest. Por tanto no se documenta como
servicio runtime disponible. `NeuralOrganizerService` se importa en
`service-modules.ts` pero tampoco se instancia en el bootstrap actual. Activar
cualquiera exige una integracion OpenSpec, handlers/politicas y pruebas nuevas.
