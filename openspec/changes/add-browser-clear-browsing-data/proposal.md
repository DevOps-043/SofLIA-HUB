## Why

El navegador integrado acumula cookies, caché, historial, contraseñas y permisos por sitio en el perfil de cada usuario, pero no ofrece ninguna forma de vaciarlos. Lo único que existe es "Borrar historial" dentro de su panel, y una purga completa de la partición que solo corre al cerrar sesión sobre el perfil sin usuario.

Un usuario que se equivoca de cuenta en un sitio, que presta el equipo un momento o que arrastra una sesión rota no tiene salida: en cualquier navegador de escritorio abriría "Borrar datos de navegación" y elegiría qué tirar.

## What Changes

- Añadir una pestaña "Privacidad" al panel de administración del navegador y su entrada en el menú de herramientas, con el diálogo equivalente al de Chrome.
- Ofrecer cinco categorías: historial, cookies y datos de sitios, archivos en caché, contraseñas guardadas y permisos por sitio. Marcadores y extensiones quedan fuera, igual que en Chrome.
- Ofrecer un intervalo de tiempo (última hora, 24 horas, 7 días, 4 semanas, desde siempre) que **solo el historial puede respetar**, y declararlo en la interfaz en lugar de aparentar que se aplica a todo.
- Exigir confirmación explícita antes de borrar y devolver un resumen por categoría con cuántos elementos se quitaron, si se ignoró el intervalo y qué falló.
- Acotar el borrado al perfil del usuario con sesión activa: los perfiles de otras cuentas no se tocan.
- Fallar de forma aislada por categoría: un error en cookies no impide borrar el historial.

No objetivos: borrar marcadores o extensiones; borrar el perfil de otra cuenta; exponer el borrado como herramienta del agente runtime; cerrar o recargar las pestañas abiertas tras el borrado; sincronizar el borrado con otros dispositivos.

## Capabilities

### New Capabilities

- `browser-browsing-data`: selección de categorías e intervalo, borrado acotado al perfil activo y resumen verificable de lo ocurrido.

### Modified Capabilities

Ninguna. El panel de administración y su menú ya existen y solo ganan una pestaña; el requisito vigente del navegador (`RF-037`) no cambia de comportamiento.

## Impact

- Electron main: nuevo `electron/integrated-browser/browsing-data.ts` con las categorías, el intervalo, la validación y el orquestador; `IntegratedBrowserService.clearBrowsingData` resuelve la partición del perfil activo y llama a `session.clearData`, `clearCache` y `clearAuthCache`.
- Almacenes del perfil: `BrowserHistoryStore.clearSince` acota por fecha y cuenta lo quitado; `BrowserCredentialVault.clearAll` vacía la bóveda sin exigir origen; `BrowserSitePermissionStore.clearAll` informa cuántos orígenes tenían decisión.
- IPC/preload/renderer: canal `integrated-browser:clear-browsing-data` con handler, allowlist, API de preload y wrapper tipado.
- Renderer React: `BrowserPrivacyPanel` con categorías, intervalo, aviso de alcance, confirmación y resumen; cuarta pestaña en `BrowserManagementPanel` y entrada en el menú de herramientas.
- Seguridad y privacidad: operación destructiva con HITL explícito, acotada al perfil activo y ausente del catálogo de herramientas del agente.
- Documentación y pruebas: IPC e integraciones, requisitos, historias, trazabilidad, seguridad e inventario de pruebas.
