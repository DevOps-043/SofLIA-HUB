## Why

La vista integrada actual reemplaza todo el workspace de chat y no ofrece administración de navegación, credenciales o extensiones. Para colaborar como en Codex, el usuario necesita conversar con SofLIA mientras observa o retoma el navegador en una superficie lateral ajustable, con persistencia útil pero gobernada.

## What Changes

- Convertir Navegador en un panel derecho redimensionable que convive con el chat y puede expandirse hasta cubrir el chat central.
- Sustituir temporalmente la Sidebar de chats/carpetas por un chat compacto con el agente mientras el modo navegador está abierto; restaurarla sin perder estado al cerrar.
- Añadir historial local persistente, paginado, buscable y borrable con URLs saneadas y retención acotada.
- Añadir una bóveda de credenciales por origen cifrada mediante `safeStorage`; listar solo metadata y rellenar directamente en el `WebContentsView` mediante gesto explícito del usuario.
- Añadir un gestor de extensiones desempaquetadas compatibles con Electron, con validación de manifest, permisos visibles, confirmación HITL, carga por sesión y recuperación al reiniciar.
- Ampliar el contrato IPC cerrado, las pruebas, documentación de seguridad/UX y evidencia del cambio.

No objetivos: Chrome Web Store o `.crx`, compatibilidad completa con Chrome, sincronización cloud, captura automática de contraseñas, autofill iniciado por el modelo, pestañas o ejecución de extensiones sin aprobación.

## Capabilities

### New Capabilities

- `browser-sidecar-workspace`: layout colaborativo con chat compacto izquierdo y navegador derecho ajustable hasta ancho completo.
- `browser-history`: registro local acotado, consulta, búsqueda, reapertura y borrado explícito de navegación.
- `browser-credential-vault`: almacenamiento cifrado por origen y llenado explícito sin devolver secretos al renderer o al agente.
- `browser-extension-management`: importación, validación, confirmación, carga persistida y remoción de extensiones desempaquetadas compatibles.

### Modified Capabilities

- `integrated-agent-browser`: la vista deja de ser una sección exclusiva del workspace y pasa a operar como panel lateral compartido que conserva el control visible del agente.

## Impact

Afecta el layout de `AppContent`/`AppWorkspace`/`AppSidebar`, componentes de navegador y chat, estado de preferencias, `IntegratedBrowserService`, nuevos stores locales bajo `userData`, handlers y canales `integrated-browser:*`, preload/wrapper, mocks Electron y pruebas main/renderer. No agrega dependencias ni migraciones Supabase. Historial y metadata de extensiones se guardan en JSON local; las contraseñas se almacenan únicamente cifradas por el proveedor seguro del sistema operativo. El rollback permite desactivar el sidecar y sus gestores conservando el navegador base.
