# Indicador de página guardada

Fecha: 2026-10-24. Solicitud: iluminar el icono al guardar y retirar el mensaje de éxito del navegador.

El control conserva el tamaño de la barra y resalta la carpeta con los tokens de acento del tema después de un éxito confirmado. La opacidad de deshabilitado no atenúa el estado guardado. El destino permanece en tooltip y etiqueta accesible, y `aria-pressed` expone el estado. No se muestra texto de éxito junto al icono. Fuera del proyecto, elegir destino y guardar cierra el selector y actualiza ese mismo indicador.

Se conserva el bloqueo de envío duplicado y los avisos de error/resultado incierto. Cambiar de página no marca la nueva URL como guardada; cambiar usuario, organización o proyecto conserva el descarte de respuestas del ámbito anterior. No se cambian IPC ni base de datos. El indicador corresponde al guardado confirmado durante la vida del control; no añade una consulta para reconstruir marcadores tras reiniciar la aplicación.

Prueba dirigida: `vitest run src/__tests__/components/ProjectResources.test.tsx --silent`, 14 aprobadas. Cubre éxito sin mensaje, selector que se cierra, indicador por URL, errores y cambio de ámbito. `npm run verify:pr` terminó con código 0: tipos, lint sin deuda nueva, arnés, documentación y 5.913 pruebas aprobadas/5 omitidas (520 archivos aprobados/2 omitidos). Evidencia: `saved-page-indicator-gate.log` en el directorio de trabajo de la conversación.
