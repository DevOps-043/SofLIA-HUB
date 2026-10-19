# Cierre seguro del navegador integrado

## Problema y alcance

Al cerrar la aplicación instalada, `mainRendererCleanup` consulta
`BrowserWindow.webContents` desde `closed`, cuando la ventana ya está destruida.
La excepción interrumpe `detachWindow` y deja incompleta la liberación del servicio.

Conservar la referencia al renderer al registrar sus listeners y retirarlos de
esa misma referencia. Cubrir cierre con y sin pestañas, llamadas repetidas y
reemplazo de ventana. Sin cambios en IPC, permisos, UI ni persistencia.

## Verificación y reversión

Reproducir primero con un getter que lance `Object has been destroyed`, ejecutar
la suite del servicio y las compuertas del repositorio. Revertir únicamente este
cambio si aparece una regresión. La aplicación instalada requiere recompilación
y distribución para incorporar el arreglo.
