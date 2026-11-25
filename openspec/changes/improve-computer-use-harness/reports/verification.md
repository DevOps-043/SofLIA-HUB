# Verificación del arnés de Computer Use

## Diagnóstico

- La herramienta determinista rechazaba la navegación con el panel cerrado. La ruta visual podía competir con la carga de Inicio al montar el panel. La prueba con revisión de seguridad demorada reprodujo además el cambio de revisión provocado por el nuevo viewport.
- El chat de Max usa `gpt-6.2-sol`. El actuador visual hace sus llamadas aparte, con `gpt-6-luna` y razonamiento bajo. En el flujo anterior, el plan visual podía empezar con dos consultas a especialistas aun para un encargo ordinario.
- Las imágenes aportadas muestran aprobaciones nativas y el chat en la portada. El resultado exacto de la ejecución original y el tiempo total quedan sin confirmar en ausencia de sus trazas.

## Pruebas

- Ocho suites focalizadas pasaron 417 pruebas tras corregir el arranque. Una segunda ejecución de cinco suites pasó 383 pruebas e incluyó el menú del compositor, consulta de la GPU y plazo de carga nativa.
- Con los modos definitivos, las suites de permisos y menú pasaron 41 pruebas. La suite de OpenAI pasó 17 pruebas e incluyó el recorrido simulado desde la promesa inicial hasta la comprobación del archivo en el Escritorio.
- Las cinco suites de permisos, selector, integración del equipo y contratos IPC pasaron 134 pruebas. Ocho suites del flujo modificado pasaron 422 pruebas.
- La última regresión de apertura, navegador y alcance IPC pasó 305 pruebas focalizadas.
- La aprobación aislada se ejercitó en Electron 44.9.3 en una ventana local de prueba. Se confirmaron las dos decisiones, el desmontaje de la vista, una sola ventana y el escape de marcado HTML en el detalle.
- La navegación de arranque se ejercitó con `WebContentsView` real y un HTML servido por loopback. La prueba simuló el acuse de montaje del renderer y comprobó el destino, título y contenido del DOM. También verificó que la vista devolvió el control y pudo renovar el DOM para el clic siguiente.
- El gestor de descargas se ejercitó en Electron 44.9.3 contra un servidor HTTP de loopback. El registro carecía de ruta mientras transfería y publicó la ruta cuando terminó. Se comprobó el contenido en disco.
- OpenSpec estricto, inventario de 547 canales, documentación y lint incremental pasaron sus verificaciones.
- `npm run verify:pr` terminó con código 0. Pasaron 7759 pruebas en 670 suites, con 5 pruebas omitidas. La cobertura verificó 2764 fuentes productivas y alcanzó 64.21% de líneas, 62.25% de sentencias, 58.79% de funciones y 55.57% de ramas. Los contratos Python se ejecutaron con Python 3.12.14.

## Revisión adversarial

- La pantalla de aprobación carece de JavaScript y preload. El renderer solicita la revisión sin resolverla. Se comprobaron carga HTML no confiable, cancelación, uso tardío, ventana ajena, A/B/A y conservación de HITL para shell, borrado y operaciones de red explícitas.
- Se comprobó que ocultar o cambiar la vista no autoriza a actuar sobre otra pestaña, y que el límite de carga sólo detiene la vista que inició la llamada. Se verificó que una transferencia incompleta carece de ruta final y que el modelo recibe el motivo si una ejecución visual falla sin producir un cierre.
- El caso original con una sesión autenticada de SofLIA Max y el instalador de AMD queda fuera de los resultados medidos. El permiso general de tareas visuales todavía requiere revisión y mantiene las guardas por acción de cada backend.

## Seguimiento de edición y permisos

- La edición reutiliza el identificador original y guarda la revisión junto con los IDs de la rama sustituida. Se reprodujo una lectura remota atrasada y se verificó que mantiene el texto editado y los mensajes independientes. La recuperación tampoco encola mensajes locales que una revisión remota ya sustituyó.
- El botón Copiar usa el portapapeles del documento. Se verificó que copiar, manejar un rechazo y volver a intentar no invocan `computer:clipboard-write`. La herramienta del agente permite copia de texto bajo Acceso completo.
- Se comprobó en el sistema de archivos real que un movimiento con destino ocupado conserva el contenido anterior y que el destino libre recibe el archivo solicitado. Las pruebas de main cubren la protección ante cambio del origen, revocación de la sesión, rutas de red explícitas, y revisión en los dos modos.
- Diez suites focalizadas pasaron 214 pruebas. Las ediciones antiguas que se almacenaron con identificadores separados carecen del metadato necesario para identificarlas con certeza.
- La compuerta `npm run verify:pr` terminó con código 0 en el seguimiento. Pasaron 7760 pruebas en 670 suites, con 5 pruebas omitidas. La cobertura verificó 2764 fuentes productivas.

## Autorización de Acceso completo por sesión

- Desktop Agent pedía revisión para toda tarea, incluida la observación. El navegador integrado tenía revisiones propias de sitio, clic y envío. La autorización explícita de la ventana ahora se reutiliza para esas acciones y para las herramientas locales de Computer Use.
- Ocho suites focalizadas pasaron 449 pruebas. Cubren el arranque de una observación sin segundo diálogo, comandos y operaciones de archivos, DOM y navegación, clic y envío, y el reconocimiento de decisiones revisables del actuador.
- La revisión comprobó cambio de modo, revocación durante una tarea, revocación entre la decisión del chat y la ejecución del clic, sesión A/B/A, emisor ajeno y subframes. También comprobó que Acceso completo respeta los bloqueos del actuador y del navegador y no modifica la política guardada del sitio.
- `npm run verify:pr` terminó con código 0. Pasaron 7765 pruebas en 670 suites, con 5 pruebas omitidas. La cobertura verificó 2764 fuentes productivas y alcanzó 64.31% de líneas, 62.34% de sentencias, 58.92% de funciones y 55.68% de ramas.
- La evidencia de esta ronda proviene de pruebas automatizadas. El recorrido completo de AMD en la sesión instalada queda fuera de esta verificación.
