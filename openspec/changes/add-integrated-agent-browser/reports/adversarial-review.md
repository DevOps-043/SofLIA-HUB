# Revisión adversarial

Fecha: 2026-08-04.

## Superficie revisada

- protocolos, búsquedas, redirecciones y popups;
- permisos sensibles y origen solicitante;
- aislamiento Electron, partición y contrato IPC;
- apertura agente, viewport, estados parciales y cleanup;
- concurrencia entre tareas automatizadas;
- exposición de cookies, DOM, paths o credenciales;
- recursos al ocultar, cerrar o reemplazar la ventana.

## Hallazgos corregidos

### AR-01 — una aprobación de audio podía ampliar acceso a video

Severidad inicial: alta. El permiso Chromium `media` agrupaba cámara y
micrófono en una clave por origen. Aprobar solo audio podía satisfacer una
comprobación posterior de video del mismo origen.

Corrección: las concesiones se registran por `origin + permission + mediaType`;
un tipo desconocido se deniega. Se añadió un caso que aprueba audio y demuestra
que video sigue bloqueado.

### AR-02 — dos tareas podían compartir la misma vista agente

Severidad inicial: alta. Dos ejecuciones paralelas podían intercalar capturas y
eventos sobre el único `WebContentsView`; además, el `finally` de la segunda
podía apagar el indicador de la primera.

Corrección: `openForAgent` adquiere control exclusivo antes de cualquier espera,
rechaza una segunda tarea y libera el estado propio si falla el viewport. Los
llamadores solo liberan después de adquirir. Se añadieron casos de exclusión y
timeout.

### AR-03 — coordenadas incorrectas con escalado de pantalla

Severidad inicial: media. `capturePage` puede producir una imagen cuya
resolución difiere de los bounds DIP de la vista. Usar directamente las
coordenadas de la captura podía desplazar clicks en pantallas HiDPI.

Corrección: el driver informa al modelo las dimensiones reales de la imagen y
escala cada punto de captura al viewport antes de inyectar mouse, drag o scroll.
La prueba usa una captura 1600x1200 sobre una vista 800x600 y verifica el mapeo.

## Hipótesis sin hallazgo abierto

- `file:`, `data:`, `javascript:` y protocolos internos se rechazan en entrada,
  navegación, redirección y popup; HTTP(S) de popup se confina a la misma vista.
- La vista remota usa sandbox, context isolation, Node desactivado, sin preload y
  una partición persistente separada del renderer privilegiado.
- Los handlers verifican autenticación, sender principal, payload y bounds; el
  preload solo expone los canales allowlisted y cada listener tiene cleanup propio.
- Permisos fuera de media/geolocalización se deniegan; los permitidos requieren
  diálogo nativo con origen y no aceptan aprobación generada por el modelo.
- Un viewport ausente expira, el cierre rechaza esperas, y detach oculta, remueve,
  cierra contenidos y elimina handlers de permisos de forma idempotente.
- Los snapshots enviados al renderer no contienen HTML, cookies, storage,
  credenciales ni rutas locales.
- La detección de prompt injection de Computer Use permanece activa por defecto.

## Riesgos residuales aceptados

- Usuario y agente comparten deliberadamente la superficie visible; el badge
  indica control del agente, pero una interacción manual puede alterar su tarea.
- HTTP se conserva por compatibilidad y no ofrece confidencialidad de transporte.
- Cookies y storage sobreviven reinicios dentro del perfil local del sistema
  operativo; no se comparten con Chrome/Edge ni con el renderer.
- Popups separados, DRM, extensiones y múltiples pestañas siguen fuera de alcance.
- El smoke manual y la suite nativa total deben repetirse sin la sesión Electron
  que actualmente bloquea `better-sqlite3`; ver `verification.md`.
