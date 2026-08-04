# Contexto del cambio

- Objetivo: incorporar en SofLIA un navegador web persistente, visible y controlable tanto por el usuario como por el agente runtime sobre la misma superficie.
- Usuario o actor: usuario autenticado de Pulse Hub y agente de escritorio invocado desde el chat del mismo usuario.
- Alcance: vista de navegador en el workspace; historial básico de navegación; sesión persistente aislada; apertura desde UI o agente; captura e inyección de eventos para Computer Use; IPC tipado; permisos sensibles con HITL; pruebas y documentación.
- No objetivos: extensiones de Chrome, importación de cookies o contraseñas desde perfiles externos, múltiples pestañas, DevTools expuesto al usuario, automatización remota desde WhatsApp/grupos ni sustitución del navegador predeterminado del sistema.
- Restricciones: Electron main/preload/renderer separados; `sandbox`, `contextIsolation` y `nodeIntegration: false`; solo `http:`/`https:` y `about:blank`; sin acceso Node desde contenido remoto; una sola tarea visual concurrente; UI/prompts/logs/documentación en español.
- Contratos afectados: servicio main `IntegratedBrowserService`; canales `integrated-browser:*`; API preload `window.integratedBrowser`; wrapper renderer; `ActiveView`; herramienta `use_computer` con backend web visible; ciclo de vida de `BrowserWindow`/`WebContentsView`.
- Riesgo y HITL: navegación carga contenido remoto no confiable y puede contener prompt injection; permisos de cámara, micrófono y ubicación requieren aprobación explícita por solicitud; el resto se deniega. Acciones destructivas dentro de sitios conservan las guardas del modelo Computer Use y la autorización del usuario.
- Criterios verificables: el usuario abre la vista y navega; la sesión persiste tras ocultar/reabrir; el agente abre la vista si estaba cerrada, captura la misma página visible y ejecuta eventos; payloads/URLs inválidos se rechazan; protocolos peligrosos y permisos no allowlisted se deniegan; listeners y view se liberan al cerrar.
- Incertidumbres: los sitios con DRM, extensiones, ventanas emergentes complejas o controles anti-automatización pueden degradarse; no se promete compatibilidad con ellos en este cambio.
