# Cierre al abrir el navegador — revisión del 2026-09-14

## Causa reproducida

La hipótesis GPU de la primera revisión no resolvió el cierre. Se reprodujo con
Electron 43.4.0 real: crear una WebContentsView, adjuntarla a una ventana y
ejecutar disableDeviceEmulation() antes de loadURL() termina el proceso main
con código 4294930435. Ocurre también con disable-gpu; la sonda alcanza el
log anterior a la llamada y nunca el posterior. mainFrame existe, pero eso no
garantiza que su vista nativa exista.

El [código de Electron 43.4.0](https://github.com/electron/electron/blob/v43.4.0/shell/browser/api/electron_api_web_contents.cc#L2925)
accede a frame_host->GetView() sin comprobarlo en la emulación. El servicio
llamaba a esa API al materializar una pestaña con zoom 1, antes de la primera
carga. SharedImageManager::ProduceSkia por sí solo no identificaba al driver
como causa. La primera respuesta dio el fallo por resuelto sin reproducirlo;
esa conclusión queda corregida por esta evidencia.

## Corrección

- Zoom: no invoca emulación si el contenido está destruido, caído, sin URL o
  todavía cargando el documento principal.
- El factor y la geometría pendientes se aplican en did-stop-loading.
  Se observó que loadURL() puede resolverse con isLoadingMainFrame() === true.
- Al 100% solo desactiva emulación previamente activada por el módulo.
- Se retiraron el ajuste global GPU y sus pruebas; no resolvían el fallo y
  modificaban el rendimiento gráfico de toda la aplicación.
- Se conserva la notificación de crash de pestaña como error recuperable;
  no se atribuye a ese listener la capacidad de rescatar un crash nativo de main.

## Evidencia

- npm run verify:pr: compuerta completa aprobada; 320 archivos y 3461 pruebas,
  tipado, lint incremental, arnés, documentación y OpenSpec válidos.
- Sonda mínima previa: pulse-zoom-crash-probe.cjs en Temp, --software, termina
  en la llamada a disableDeviceEmulation, salida 4294930435.
- npm run browser:smoke:native -- --electron <electron.exe> --zoom-startup-only:
  11 comprobaciones aprobadas, GPU predeterminada, Electron 43.4.0. Cubre vista
  inicial al 100% y 200%, carga, navegación lenta, reset, crash deliberado del
  renderer, recarga y vista destruida. Evidencia local:
  C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-RpNRge/zoom-startup.json.
- Servicio completo empaquetado por Rolldown sin .env, ejecutado en Electron
  real con perfil temporal y servidor HTTP local: viewport antes de apertura,
  cinco pestañas, ocultar/reabrir y redimensionar; salida 0, ventana conservada.
  Sonda local: C:/Users/fysg5/AppData/Local/Temp/pulse-browser-service-run.cjs.
  Un intento adicional de apertura y viewport en el mismo tick fue rechazado
  por el guard de revisión de pestaña; es una cancelación controlada, no el
  cierre nativo aquí corregido.

## Límites

Estas pruebas verifican el cierre reproducido al abrir. No acreditan aceptación
completa con cuentas, Windows Hello, instalador ni sincronización entre equipos;
la tarea 9.5 sigue abierta. Las fuentes corregidas están en el worktree
upgrade-integrated-browser; el checkout principal y los instaladores ya
generados no se actualizaron automáticamente.
