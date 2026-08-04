## Context

Pulse Hub ya tiene dos rutas web para `use_computer`: `BrowserWebService` abre un Chromium Playwright separado y el backend desktop controla el navegador externo del sistema. Ninguna ruta pertenece al layout de SofLIA ni comparte una superficie visible y retomable con el usuario. Electron 39 ya aporta `WebContentsView`, por lo que no se necesita agregar una dependencia ni habilitar la etiqueta `<webview>`.

La capacidad cruza main, preload, renderer y el agente de escritorio. El contenido remoto es una frontera no confiable: no puede recibir preload, Node, IPC ni permisos implícitos. La UI de SofLIA permanece en el `BrowserWindow` principal y solo reserva un rectángulo para la vista nativa.

## Goals / Non-Goals

**Goals:**

- Ofrecer una vista web persistente dentro del workspace con controles de navegación y estados accesibles.
- Compartir exactamente el mismo `webContents` entre el usuario y Computer Use.
- Permitir que una tarea web revele la vista si estaba oculta y espere a que el renderer publique un viewport utilizable.
- Aplicar validación cerrada a URLs, bounds e IPC; mantener aislamiento de contexto y permisos sensibles con HITL.
- Liberar recursos y listeners de forma idempotente durante cierre o reemplazo de la ventana principal.

**Non-Goals:**

- Implementar pestañas, extensiones, DevTools o sincronización de perfiles externos.
- Exponer DOM, cookies, almacenamiento o credenciales del navegador al renderer o al modelo.
- Habilitar control desde grupos o crear una herramienta runtime general de shell/navegación sin las guardas de `use_computer`.
- Garantizar DRM, ventanas emergentes complejas o mecanismos anti-automatización.

## Decisions

### `WebContentsView` nativo en lugar de `<webview>` o iframe

`IntegratedBrowserService` será propietario de un único `WebContentsView` asociado al `BrowserWindow` principal. El renderer enviará únicamente bounds validados del contenedor mediante `ResizeObserver`; el servicio añade/oculta la vista y emite un snapshot de navegación.

Un iframe no puede mostrar sitios que bloquean embedding y no ofrece captura/entrada nativa. `<webview>` exige `webviewTag`, amplía la superficie del renderer y está desaconsejado por Electron. Una segunda `BrowserWindow` no cumple el requisito de estar integrada al workspace.

### Partición persistente propia y aislamiento estricto

La vista usará `partition: 'persist:soflia-integrated-browser'`, `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, sin preload. Conserva sesiones entre aperturas y reinicios, pero no lee perfiles de Chrome/Edge ni comparte la sesión privilegiada del renderer.

La navegación acepta `http:`, `https:` y `about:blank`. Texto sin esquema se convierte en búsqueda HTTPS. Se bloquean `file:`, `javascript:`, `data:`, protocolos internos y ventanas nuevas fuera de HTTP(S); las ventanas HTTP(S) se redirigen a la misma vista.

### Contrato IPC cerrado en cuatro capas

El namespace `integrated-browser:*` tendrá handlers para estado, abrir/navegar, atrás, adelante, recargar/detener, foco, viewport y ocultar. Cada handler valida tipos, longitudes, enteros y origen del evento contra el `BrowserWindow` principal; responde `{ success, error?, state? }`. La allowlist y una API preload dedicada exponen solo esos métodos y el evento de estado/apertura solicitada. El renderer consume un wrapper tipado bajo `src/services/`.

### Computer Use actúa sobre la misma vista

El `DesktopAgentService` recibe el servicio integrado. El backend `browser` de Gemini Computer Use usa un `CuDriver` que obtiene capturas con `webContents.capturePage()` e inyecta mouse, teclado, scroll e historial con `sendInputEvent`, `insertText`, `loadURL` y `navigationHistory`. Antes de la primera captura, `openForAgent` muestra/enfoca la ventana, emite `integrated-browser:open-requested` y espera un viewport visible acotado.

Si Computer Use nativo no está disponible, el flujo abre la misma vista y cae al backend visual desktop sobre la ventana de SofLIA; el Playwright oculto se conserva solo como rollback de implementación, no como la ruta normal de tareas web visibles.

### Permisos sensibles mediante HITL

La sesión deniega por defecto. Solicitudes `media` o `geolocation` del `webContents` integrado muestran un diálogo nativo que incluye origen y capacidad; solo un clic explícito concede esa solicitud. Otras capacidades (HID, USB, serial, filesystem, display capture, MIDI, notificaciones, clipboard read y similares) se deniegan. El handler verifica que la solicitud provenga de la vista integrada.

### Estado, concurrencia y ciclo de vida

Los eventos de carga, título, URL, historial y fallo producen un snapshot serializable; no incluyen HTML, cookies ni paths. Un único servicio y la concurrencia visual existente de `DesktopAgentService` evitan dos actores automatizados simultáneos. `detachWindow` oculta, remueve y destruye el `webContents`, cancela esperas y elimina handlers de sesión propios cuando cierra la ventana.

## Risks / Trade-offs

- [La vista nativa puede tapar modales del renderer] → se oculta al abandonar `activeView='browser'` y el renderer publica bounds solo mientras la vista está activa; los diálogos críticos de permisos son nativos.
- [Bounds desactualizados durante resize o cambio de Sidebar] → `ResizeObserver`, eventos de resize y validación/clamp contra content bounds.
- [Prompt injection desde una página] → se conserva la detección de inyección de Gemini Computer Use, se limita el driver a acciones declaradas y no se expone DOM/cookies al modelo.
- [Una navegación o popup intenta un protocolo privilegiado] → validación en navegación solicitada, `will-navigate` y `setWindowOpenHandler`, con denegación por defecto.
- [El renderer no monta la vista a tiempo] → espera acotada con error controlado; no se colocan bounds estimados sobre otra UI.
- [Sitios que requieren permisos o popup separado degradan] → permisos sensibles con HITL y popup HTTP(S) en la misma vista; la limitación queda documentada.

## Migration Plan

1. Incorporar servicio/driver y pruebas unitarias sin cambiar la ruta del usuario.
2. Registrar handlers, preload y wrapper; añadir la vista/Sidebar.
3. Conectar `DesktopAgentService` y hacer que `backend: 'browser'` prefiera la vista integrada.
4. Ejecutar pruebas focalizadas, typecheck, harness, docs, lint cambiado y gate PR; realizar smoke manual de login/navegación/control visible.
5. Rollback: retirar la entrada de UI y la inyección del servicio; el backend `BrowserWebService` existente sigue disponible. La partición persistente puede permanecer inerte y no requiere migración destructiva.

## Open Questions

Ninguna bloqueante. Múltiples pestañas, gestor de descargas y permisos persistentes se evaluarán como cambios posteriores con contratos propios.
