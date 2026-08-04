## 1. Servicio y seguridad de Electron

- [x] 1.1 Implementar tipos, validación de URL/bounds y estado serializable del navegador integrado.
- [x] 1.2 Implementar `IntegratedBrowserService` con `WebContentsView`, partición persistente aislada, navegación, eventos y ciclo de vida idempotente.
- [x] 1.3 Aplicar gobierno de popups, protocolos y permisos sensibles con HITL nativo.

## 2. Contrato IPC de cuatro capas

- [x] 2.1 Registrar handlers `integrated-browser:*` con autenticación, validación de origen/payload y errores controlados.
- [x] 2.2 Añadir canales a la allowlist y exponer una API preload mínima con sus eventos.
- [x] 2.3 Añadir tipos globales y wrapper tipado del renderer.

## 3. Experiencia de usuario

- [x] 3.1 Crear el panel de navegador con toolbar accesible, estados de carga/error y publicación reactiva del viewport.
- [x] 3.2 Integrar `ActiveView='browser'`, Sidebar en layouts lateral/inferior y apertura solicitada desde main.
- [x] 3.3 Ocultar la vista nativa al cambiar de sección y restaurarla sin perder sesión.

## 4. Control compartido por el agente

- [x] 4.1 Implementar un `CuDriver` para captura y eventos de entrada sobre el `webContents` integrado.
- [x] 4.2 Inyectar el servicio en `DesktopAgentService` y hacer que el backend browser visible abra/reutilice la vista.
- [x] 4.3 Implementar fallback controlado al backend visual desktop cuando Computer Use browser no esté disponible.

## 5. Pruebas y documentación

- [x] 5.1 Añadir pruebas main de URL, bounds, servicio, permisos, popup, IPC, ciclo de vida y driver.
- [x] 5.2 Añadir pruebas renderer de wrapper, panel, navegación de vista y allowlist/preload.
- [x] 5.3 Actualizar arquitectura Electron/IPC, manual runtime, parámetros y catálogo de pantallas.
- [x] 5.4 Ejecutar pruebas focalizadas, typecheck, harness, docs, lint cambiado y `verify:pr`; registrar evidencia.
- [x] 5.5 Ejecutar revisión adversarial de protocolos, permisos, aislamiento, estados parciales, concurrencia y recursos; corregir hallazgos.
