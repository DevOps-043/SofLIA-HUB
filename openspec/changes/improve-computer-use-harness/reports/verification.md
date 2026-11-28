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

## Continuidad del chat y permiso recordado, 26 de noviembre de 2026

- Acceso completo se perdía porque la autorización anterior vivía en memoria. Se probó con tres procesos Electron 44.9.3 y un perfil temporal de Windows. El primero guardó el permiso cifrado, el segundo lo recuperó para la misma cuenta, comprobó el aislamiento entre cuentas y lo retiró. El tercero confirmó la revocación.
- Abrir el navegador sustituía el árbol del chat. La limpieza del componente cancelaba la generación que había iniciado la apertura. Se probó el controlador real del chat al pasar al panel lateral durante un envío nuevo, una edición y un reintento sin cambios. Se verificó que la misma vista publica el resultado o el error y que la edición conserva un solo mensaje.
- Se simuló el cierre de la pestaña durante una carga pendiente. El navegador devolvió el error al chat y liberó el control. El estado del proceso observado y el registro de Windows no confirmaron un reinicio del proceso principal durante el incidente informado. La descarga de AMD no se ejecutó en la cuenta instalada.
- Pasaron 420 pruebas en ocho suites focalizadas. La revisión incluyó el atajo Escape del chat flotante, la cancelación de revisiones vencidas y la denegación de efectos cuando el almacenamiento del permiso falla.
- La prueba nativa `smoke-browser-native.mjs --lifecycle-only` pasó ocho comprobaciones. Verificó restauración de vistas en un perfil temporal, guardado de la sesión al cerrar y una sola salida del proceso. El coordinador se ejercitó con servicios auxiliares simulados.
- La primera ejecución con cobertura detectó que el reintento sin cambios podía repetir una edición si el chat todavía no había publicado su respuesta. Se añadió una comprobación del estado visible. Pasaron las pruebas de edición que ya recibió respuesta y las de reintento de un mensaje interrumpido.
- La ejecución final de `npm run verify:pr` pasó las etapas de arnés, documentación, OpenSpec estricto, Python, TypeScript y lint. Vitest aprobó 7726 pruebas, marcó un fallo en `Auth.test.tsx` y agotó el plazo al iniciar varios workers. La compuerta terminó con código 1 antes de validar cobertura. En una repetición dirigida pasaron las 44 pruebas de autenticación, recuperación de contexto, selector de modelo, cierre de turnos y continuidad al abrir el navegador.

## Enlaces de descarga en otra pestaña

- Al convertir una apertura de Chromium en una pestaña integrada, main conservaba la URL y descartaba la referencia de origen. El aviso de la captura coincide con la restricción publicada por AMD. [Ayuda de AMD sobre descargas incompletas](https://www.amd.com/en/resources/support-articles/faqs/Download-Incomplete.html)
- La prueba nativa con Electron 44.9.3 usó dos orígenes HTTP de loopback y un perfil temporal. El servidor sólo entregó el archivo si el clic enviaba el origen esperado. Se verificaron el registro completado y el contenido en disco. Abrir la URL directamente y usar `noreferrer` conservaron la ausencia de referencia y el servidor devolvió su página de error. El instalador de AMD queda fuera de la prueba.
- La revisión cubrió la política `no-referrer`, los registros anteriores, una transferencia que comienza después del clic, un rechazo con DOM disponible y un cambio de documento tras una acción ya emitida. La indicación DOM se retira por identidad del objetivo, incluso si el marcador ya caducó. Una indicación posterior y los controles de una tarea visual supervisada conservan su propio ciclo de vida.
- Pasaron 346 pruebas en ocho suites focalizadas. `npm run verify:pr` terminó con código 0, con 7779 pruebas aprobadas y 5 omitidas. La cobertura verificó 2765 fuentes productivas y alcanzó 64.36% de líneas, 62.38% de sentencias, 58.98% de funciones y 55.71% de ramas.

## Lectura DOM y enlaces fuera de la vista

- El historial confirmó la visita a las notas de AMD. En la reproducción, el navegador cargaba el documento aunque el compositor no devolvía una imagen. La lectura DOM anterior descartaba ese resultado. El enlace del paquete también quedaba fuera del primer viewport.
- Con Electron 44.9.3, un perfil temporal encontró en la página oficial el enlace de AMD y lo reveló al desplazar hasta `scrollY=1764`. La revisión visual cambió durante la lectura y la identidad del documento siguió vigente. La prueba observó y desplazó la página de AMD sin activar la descarga.
- En loopback, el mismo servicio leyó el DOM con el compositor simulado como indisponible, localizó un enlace fuera del viewport y resolvió su referencia. La activación DOM de ese enlace abrió una pestaña mediante el flujo de Chromium, conservó `Referer` y produjo un registro completado. Se comprobó el contenido en el destino temporal. La inyección de ratón sobre la ventana oculta no produjo una descarga, por lo que la verificación del clic físico del agente queda pendiente en una ventana visible.
- La revisión adversarial comprobó el permiso de interacción para revelar, la revocación al cambiar de documento o perfil, el descarte de enlaces ocultos, la eliminación de parámetros sensibles y la caducidad de referencias al reemplazar un nodo. El clic y la consulta del estado de transferencia siguen siendo pasos independientes.
- Pasaron 379 pruebas en siete suites focalizadas. `npm run verify:pr` terminó con código 0 y 7786 pruebas aprobadas, 5 omitidas y cobertura verificada en 2765 fuentes. La cobertura fue de 64.39% de líneas, 62.4% de sentencias, 59% de funciones y 55.75% de ramas.
