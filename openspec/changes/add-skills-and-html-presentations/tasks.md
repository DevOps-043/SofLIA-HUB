## 1. Datos y modelo de Skills

- [x] 1.1 Escribir la migración idempotente en `database/lia/migrations/skills-registry.sql`: tabla `skills`, índices por `user_id`, RLS de propietario y vista de compatibilidad `user_tools` de solo lectura. Verificación: ejecutar dos veces seguidas sobre una base de prueba y confirmar el mismo resultado.
- [x] 1.2 Copiar las filas de `user_tools` a `skills` dentro de la misma migración mapeando `system_prompt` a instrucciones y conservando favorito y contador de uso. Verificación: conteo de filas por usuario idéntico antes y después.
- [x] 1.3 Actualizar `database/lia/snapshots/schema.sql` con la tabla y la vista resultantes.
- [x] 1.4 Definir los tipos de Skill en `src/services/skills/types.ts` (clase, superficies, herramientas aportadas, política de workspace) y marcar `src/services/tools/types.ts` como obsoleto reexportando desde el nuevo módulo.
- [x] 1.5 Reemplazar `src/services/tools-service.ts` por `src/services/skills-service.ts` con altas, bajas, edición y listado sobre `skills`. Verificación: pruebas de que una consulta sin sesión no devuelve Skills de usuario.

## 2. Registro y catálogo de Skills

- [x] 2.1 Crear el registro de Skills del sistema en `src/shared/skills/registry.ts` como declaraciones inmutables compartidas por renderer y main, con superficies habilitadas por Skill.
- [x] 2.2 Implementar la resolución del catálogo efectivo (sistema + usuario, filtrado por superficie e identidad) con la clase derivada de la fuente, nunca de una columna. Verificación: prueba de que una fila manipulada no puede presentarse como Skill del sistema.
- [x] 2.3 Implementar el estado de Skill activa en el chat y su inyección en `buildSystemInstruction` de `src/services/gemini-chat/system-instruction.ts`, reemplazando el uso actual de `toolSystemPrompt`.
- [x] 2.4 Cubrir con pruebas la activación, desactivación y el aislamiento por propietario del catálogo.

## 3. Herramientas de archivo acotadas al workspace

- [x] 3.1 Crear `electron/skill-workspace/paths.ts` con la resolución y validación de contención: rechazo de rutas absolutas y de segmentos superiores, `realpath` del workspace y del contenedor, y comparación de prefijo real.
- [x] 3.2 Escribir primero las pruebas de escape de ruta en `electron/__tests__/skill-workspace-paths.test.ts`: `..`, ruta absoluta externa, symlink hacia fuera y ruta válida. Verificación: las cuatro pasan antes de continuar.
- [x] 3.3 Implementar `electron/skill-workspace/service.ts` con crear workspace, listar, leer, escribir, editar por reemplazo exacto y borrar, aplicando límites de tamaño por archivo y por workspace y la allowlist de extensiones de la Skill.
- [x] 3.4 Implementar la semántica de edición: fallo sin modificar si el fragmento no existe o es ambiguo, salvo reemplazo total explícito. Verificación: pruebas de los tres casos.
- [x] 3.5 Añadir los handlers `skill-workspace:*` en `electron/skill-workspace-handlers.ts` y registrarlos en el arranque de servicios.
- [x] 3.6 Añadir los canales a la allowlist de preload, exponer el wrapper tipado y actualizar `electron/__tests__/preload/channel-cases.ts`.
- [x] 3.7 Emitir eventos de progreso y error por archivo desde el servicio hacia el renderer. Verificación: prueba de que una escritura y un fallo emiten su evento.

## 4. Catálogo de herramientas por turno

- [x] 4.1 Introducir el catálogo compuesto en `src/services/gemini-tools/` (base de la superficie + herramientas de la Skill activa) sustituyendo los `Set` de módulo de `tool-names.ts` por una resolución por turno.
- [x] 4.2 Adaptar `src/services/gemini-chat/tool-dispatch.ts` para despachar primero contra las herramientas de la Skill activa y degradar al catálogo base cuando no hay Skill.
- [x] 4.3 Aplicar la validación de allowlist de superficie sobre las herramientas aportadas por una Skill. Verificación: prueba de que una Skill no puede habilitar una herramienta bloqueada en su superficie.
- [x] 4.4 Declarar las herramientas de workspace solo cuando existe un workspace activo. Verificación: prueba de que sin Skill activa el catálogo es idéntico al actual y que una invocación sin workspace se rechaza.
- [x] 4.5 Replicar la composición por turno en el camino de OpenAI (`src/services/openai-chat/tool-schema.ts`).

## 5. Branding de la organización

- [x] 5.1 Crear `electron/organization-branding/service.ts` que resuelva `organizations` contra Supabase SOFIA siguiendo el patrón de `electron/iris/clients.ts`, devolviendo solo datos de presentación visual.
- [x] 5.2 Implementar la descarga acotada de recursos: validación de host contra el Supabase SOFIA configurado, límite de tamaño, timeout y escritura en `<workspace>/assets/`. Verificación: pruebas de host no permitido, recurso grande y timeout, sin bloquear la generación.
- [x] 5.3 Implementar la caché por organización con TTL e invalidación por cambio de organización y cierre de sesión. Verificación: pruebas de reutilización e invalidación.
- [x] 5.4 Generar el archivo de variables CSS de marca en el workspace antes de la generación, con tema neutro cuando `branding_enabled` es falso o faltan valores.

## 6. Skill del sistema de presentaciones

- [x] 6.1 Crear `src/prompts/skills/presentaciones.ts` con el contrato de salida: estructura de archivos, consumo obligatorio de las variables CSS de marca, prohibición de recursos remotos y uso de edición por reemplazo en iteraciones.
- [x] 6.2 Declarar la Skill en el registro con sus herramientas de workspace, extensiones permitidas y superficies habilitadas, detrás de una bandera de habilitación.
- [x] 6.3 Implementar el ciclo de vida del proyecto en `electron/skill-workspace/`: creación con identificador, asociación a la conversación, recuperación al reabrirla y acción de abrir la carpeta en el explorador.
- [x] 6.4 Conectar las fuentes de contenido: archivos adjuntos del chat, documentos de Drive, DOM de la pestaña activa e investigación previa, marcando todo el contenido como dato no confiable en el prompt.
- [x] 6.5 Implementar la exportación a un HTML autocontenido (estilos incrustados, imágenes en `data:`) que conserve transiciones y animaciones. No se exporta a PDF.
- [x] 6.6 Cubrir con pruebas la generación completa, la iteración acotada, la fuente insuficiente y el fallo a mitad de generación.

## 7. Protocolo local y superficies de render

- [x] 7.1 Registrar el esquema privilegiado antes de `app.ready` y su handler en `electron/skill-workspace/protocol.ts`, sirviendo únicamente desde la raíz de presentaciones con la validación de contención de la tarea 3.1.
- [x] 7.2 Aplicar la CSP restrictiva por cabecera desde el handler. Verificación: prueba de que una petición a un origen externo desde el documento servido se bloquea.
- [x] 7.3 Verificar con pruebas que una ruta fuera de la raíz devuelve 404 y que un symlink hacia fuera no se sirve.
- [x] 7.4 Implementar la vista previa embebida en `<iframe sandbox="allow-scripts">` sin `allow-same-origin`. Verificación: prueba de que el documento no alcanza las APIs de preload.
- [x] 7.5 Implementar la vista a pantalla completa como `WebContentsView` sin preload, con sesión particionada, creada bajo demanda y destruida al cerrar, sin coexistir con el modo navegador.
- [x] 7.6 Añadir los canales de la vista a pantalla completa a handlers, allowlist, wrapper tipado y `channel-cases.ts`.

## 8. Panel de trabajo de la presentación

- [x] 8.1 Crear `src/components/presentation/PresentationWorkspacePanel.tsx` con la lista de archivos del proyecto y el contenido del archivo seleccionado.
- [x] 8.2 Consumir los eventos de progreso para señalar el archivo en curso y actualizar el contenido sin recarga manual. Verificación: prueba de que el panel refleja escritura y error por archivo.
- [x] 8.3 Implementar el control de reproducción, habilitado solo cuando existe el documento de entrada, con mensaje explícito cuando aún no está lista.
- [x] 8.4 Integrar el panel en `src/app/AppWorkspace.tsx` conviviendo con el chat sin sustituirlo, siguiendo el patrón de insets de `BrowserWorkspaceLayout`.
- [x] 8.5 Implementar ocultar el panel sin cancelar la generación y recuperarlo desde `ToolsDropdownButton`, ocultando la entrada cuando la conversación no tiene presentación.
- [x] 8.6 Cubrir con pruebas de componente la apertura automática, la selección de archivo, la interacción durante la escritura y el ciclo ocultar/recuperar.

## 9. Biblioteca de Skills en la interfaz

- [x] 9.1 Renombrar la biblioteca a Skills en `src/components/ToolLibrary.tsx`, `ToolEditorModal.tsx` y `src/components/tool-library/`, separando visualmente Skills del sistema y del usuario.
- [x] 9.2 Impedir en la UI la edición y el borrado de Skills del sistema, con el mensaje explicativo del spec.
- [x] 9.3 Adaptar `src/adapters/desktop_ui/chat-ui/useChatTools.ts` y `tool-display-names.ts` al catálogo de Skills y a los prompts de inicio.
- [x] 9.4 Cubrir con pruebas el rechazo de edición de Skills del sistema y que una Skill de usuario no habilita herramientas.

## 10. Skills en WhatsApp y retiro de Gamma

- [x] 10.1 Sustituir el paso de generación de `electron/presentation-workflow/steps.ts` por la Skill de presentaciones con exportación a PDF, conservando la máquina de estados y los mensajes del flujo.
- [x] 10.2 Entregar el archivo generado por el canal de envío de archivos de WhatsApp con confirmación explícita antes del envío.
- [x] 10.3 Eliminar `electron/presentation-workflow/gamma.ts`, su uso de `GAMMA_API_KEY` y las referencias en `.github/workflows/release.yml` y configuración.
- [x] 10.4 Exponer el catálogo de Skills al agente de WhatsApp respetando `BLOCKED_TOOLS_WA`, `CONFIRM_TOOLS_WA` y `GROUP_BLOCKED_TOOLS`. Verificación: pruebas de Skill no habilitada para la superficie y de Skill restringida en grupo.
- [x] 10.5 Actualizar las pruebas existentes de `electron/__tests__/whatsapp-workflow-presentacion*` al nuevo motor, incluida la cancelación del flujo.

## 11. Documentación

- [x] 11.1 Actualizar `docs/architecture/runtime-agents-manual.md` con el catálogo de Skills, las herramientas de workspace, sus guardas y la desambiguación frente a la memoria aprendida de `electron/memory/skills-*.ts`.
- [x] 11.2 Actualizar `docs/architecture/ipc-and-integrations.md` con los canales nuevos y el protocolo local.
- [x] 11.3 Actualizar `docs/operations/configuration.md` retirando `GAMMA_API_KEY` y documentando la bandera de habilitación y los límites de workspace.
- [x] 11.4 Actualizar `docs/security/security-and-privacy.md` con el aislamiento del render, la validación de rutas y la política de descarga de recursos de marca.
- [x] 11.5 Actualizar `docs/product/functional-requirements.md`, `docs/product/user-stories.md` y `docs/product/traceability-matrix.md` con las capacidades nuevas.
- [x] 11.6 Actualizar `docs/quality/test-strategy-and-inventory.md` y `ai-specs/` con el inventario de pruebas del cambio.

## 12. Verificación y cierre

- [x] 12.1 Ejecutar `npm run typecheck` y `npm run test` y dejar la evidencia en `verification.md`.
- [x] 12.2 Ejecutar `npm run harness:validate` y `npm run verify:pr`.
- [ ] 12.3 (PENDIENTE: requiere la app en ejecucion) Validar manualmente el ciclo completo en el chat: generar desde un archivo adjunto, ver el código en vivo, reproducir, iterar un cambio acotado, exportar a PDF y abrir la carpeta.
- [ ] 12.4 (PENDIENTE: requiere WhatsApp conectado) Validar manualmente el ciclo por WhatsApp, incluida la cancelación y la recepción del archivo.
- [x] 12.5 Ejecutar la revisión adversarial sobre escape de rutas, aislamiento del `iframe`, RLS de `skills`, herramientas expuestas sin workspace y estados parciales de generación.
- [ ] 12.6 (PENDIENTE: requiere ejecutar la migracion en Supabase LIA) Registrar en `verification.md` la evidencia de la migración: conteo por usuario antes y después, y prueba de la vista de compatibilidad.

## 13. Refuerzo de la generación: imágenes, JavaScript y profundidad

- [x] 13.1 Añadir `writeImage` al servicio de workspace con destino forzado a `assets/`, nombre saneado, formato restringido a PNG/JPEG/WebP y límite propio de tamaño, sin pasar por la allowlist de extensiones de texto.
- [x] 13.2 Crear `electron/skill-workspace/fetch-image.ts` con las guardas de descarga en main: solo HTTPS, rechazo de destinos privados y de enlace local, revalidación de cada redirección, cadena acotada, límite de tamaño y timeout.
- [x] 13.3 Exponer `skill-workspace:write-image` y `skill-workspace:download-image` por handler, allowlist de preload y envoltorio tipado del renderer.
- [x] 13.4 Declarar `workspace_generate_image` y `workspace_download_image` al modelo y despacharlas: la generación pasa por el modelo de imagen del renderer y entrega a main solo base64; la descarga delega en main.
- [x] 13.5 Actualizar el prompt de presentaciones: JavaScript permitido para diseño y movimiento (siempre local), exigencia de agotar la fuente y sostener cada afirmación con un dato concreto, y uso de imágenes con su frontera frente a gráficos y hechos reales.
- [x] 13.6 Cubrir con pruebas la escritura de imágenes, las guardas de descarga, el despacho de las dos herramientas, el conteo de canales del workspace y las decisiones nuevas del prompt.
- [x] 13.7 Actualizar especificaciones y documentación (`ipc-and-integrations.md`, `runtime-agents-manual.md`, inventario de pruebas).

## 14. Continuidad del turno, sentido del avance y material de la fuente

- [x] 14.1 Diagnosticar la muerte del turno de generación: el camino de OpenAI llamaba al proveedor sin reintento (el de Gemini sí lo tenía) y cada iteración reenviaba el contenido ya escrito.
- [x] 14.2 Extraer `retryTransientCall` (backoff con respeto al abort, sin tocar el circuit breaker de Gemini) y usarlo al abrir el stream de OpenAI, nunca al consumirlo.
- [x] 14.3 Aligerar el contexto replicado: los argumentos voluminosos de una llamada ya ejecutada se sustituyen por un marcador que indica cómo recuperarlos.
- [x] 14.4 Dar al turno con workspace vivo más iteraciones y más presupuesto de salida que a un turno de chat, en ambos motores.
- [x] 14.5 Separar el error de contexto agotado del de capacidad temporal: decían lo mismo y el consejo era el contrario; excluirlo además de los reintentos.
- [x] 14.6 Añadir la variante horizontal de la baraja al sistema de diseño, con las entradas ligadas al eje X, y corregir el escalonado, que usaba `animation-delay` (ignorado sobre una línea de tiempo de scroll).
- [x] 14.7 Ampliar el catálogo de movimiento: entradas laterales, de escala y de barrido, revelado palabra por palabra, acercamiento del fondo y primitivas de imagen (`.imagen-fondo`, `.figura`).
- [x] 14.8 Exponer en la observación del navegador las imágenes de contenido de la página (URL con query, texto alternativo y tamaño; sin iconos, credenciales, `data:` ni `blob:`) para que la presentación reutilice el material de la propia fuente.
- [x] 14.9 Actualizar el prompt: elección del sentido del avance con su manejador de rueda, entrada escalonada obligatoria con variedad de gestos, y prioridad de las imágenes de la fuente sobre las generadas.
- [x] 14.10 Cubrir con pruebas el reintento, la compactación, los límites del turno, la clasificación del contexto agotado, las imágenes de la observación y las decisiones nuevas del prompt.
- [x] 14.11 Actualizar especificaciones y documentación (agentes, IPC, seguridad, inventario de pruebas).

## 15. Binarios fuera del contexto del orquestador

- [x] 15.1 Diagnosticar con el error real (`Request too large ... Limit 200000, Requested 399008`): `take_screenshot` devuelve el PNG completo como `data:image/...` y el árbol de accesibilidad entero, y ambos entraban como texto y se reenviaban en cada iteración.
- [x] 15.2 Crear `src/services/gemini-chat/tool-result-payload.ts`: extrae las imágenes del resultado, deja una nota en su lugar, descarta por peso los campos desproporcionados señalando lo omitido y garantiza JSON de objeto.
- [x] 15.3 Aplicarlo en el despacho compartido, para que valga en ambos motores, y devolver las imágenes aparte.
- [x] 15.4 Adjuntar la captura como imagen real: parte `inlineData` en Gemini y mensaje con `input_image` en OpenAI.
- [x] 15.5 Conservar solo las capturas recientes del turno, para que no crezcan con las iteraciones.
- [x] 15.6 Clasificar `request too large` junto al contexto agotado: llega como 429 pero no es capacidad, y excluirlo de los reintentos.
- [x] 15.7 Cubrir con pruebas la extracción, el recorte por peso, la entrega como imagen y el descarte de capturas antiguas; documentar la frontera en el manual de agentes y el inventario.

## 16. El límite por minuto llega leyendo el stream

- [x] 16.1 Diagnosticar el segundo incidente (`Rate limit reached ... Used 164853, Requested 38644. Please try again in 1.049s`): el 429 se lanza al **consumir** el stream, no al abrirlo, así que el reintento alrededor de `create()` nunca lo veía.
- [x] 16.2 Mover el reintento al intento completo (abrir y consumir), permitido solo mientras no se haya emitido texto, para no duplicar lo ya escrito en pantalla.
- [x] 16.3 Respetar el retraso que indica el proveedor (`try again in Xs`) con margen y techo, en vez de un backoff fijo que vuelve a chocar con la misma ventana.
- [x] 16.4 Dar presupuesto de tokens a la petición: los resultados de herramienta antiguos se sustituyen por una nota, conservando intactos los recientes. Es la acumulación, no una petición enorme, la que agota la cuota por minuto.
- [x] 16.5 Estimar el coste de las imágenes por su precio real y no por la longitud de su base64, para no recortar texto útil sin motivo.
- [x] 16.6 Retirar `retryTransientCall`, que quedó sin uso al mover el reintento donde puede ver si ya se emitió texto.
- [x] 16.7 Cubrir con pruebas el reintento a mitad de stream, el no-reintento tras emitir texto y el recorte de resultados antiguos; actualizar manual de agentes e inventario.

## 17. Animaciones visibles, composición contenida y edición posterior

- [x] 17.1 Diagnosticar por qué no se percibían las animaciones: ligadas al scroll, el salto de `scroll-snap` recorría entero el rango de entrada, y sobre esa línea de tiempo `animation-delay` se ignora.
- [x] 17.2 Crear `guion-base.js` como archivo de sistema protegido: marca con `.activa` la diapositiva en pantalla, numera `.palabras`, anima `data-contador` y resuelve la rueda en la baraja horizontal; no se instala con movimiento reducido.
- [x] 17.3 Reescribir la capa de movimiento a animaciones por tiempo disparadas por `.activa`, con `.cascada`, `.aparece--difuso` y retardos reales; el estado oculto depende de la clase que pone el guion, de modo que sin él nada queda invisible.
- [x] 17.4 Servir `.js` en el protocolo del visor e incrustar los guiones locales en el HTML exportado.
- [x] 17.5 Corregir la composición: `align-content: safe center` para que el contenido no se empuje fuera de pantalla cuando no cabe.
- [x] 17.6 Añadir primitivas de diagrama (`.diagrama`, `.flujo`, `.orbita`), que sustituyen al SVG colocado por coordenadas y garantizan que quepa.
- [x] 17.7 Reanudar la Skill de una conversación que ya tiene entregable, para que un cambio posterior disponga de las herramientas de archivo en vez de responder que no hay acceso.
- [x] 17.8 Actualizar el prompt: enlace obligatorio del guion base, catálogo de movimiento nuevo, reglas de diagrama y contadores.
- [x] 17.9 Cubrir con pruebas el sistema de diseño, el guion base, el protocolo, la exportación y la reanudación; actualizar especificaciones y documentación.

## 18. Panel utilizable: binarios, ancho, edición y recuperación

- [x] 18.1 Dejar de leer las imágenes como texto: se muestran como imagen por el protocolo local, con `pulse-presentacion:` permitido en `img-src`. Leer un PNG en UTF-8 bloqueaba la aplicación al seleccionarlo o al cambiar de pestaña.
- [x] 18.2 Acotar el visor a 4000 líneas indicando cuánto se omitió, y abrir el documento de entrada en vez de la primera imagen.
- [x] 18.3 Mover el tirador de ancho DENTRO del panel: fuera de su borde quedaba recortado por `overflow-hidden` y el ancho no se podía cambiar. Ancho mínimo bajado a 260 px.
- [x] 18.4 Permitir que el usuario edite y guarde los archivos propios desde el panel, con los archivos del sistema sin acción de edición.
- [x] 18.5 Abrir la carpeta tras exportar, para que el archivo generado sea alcanzable.
- [x] 18.6 Resolver la presentación por conversación: se recupera al abrir un chat anterior y se desapunta cuando el chat no tiene ninguna, para que el menú no reabra la de otra.
- [x] 18.7 Prohibir en el prompt escribir rutas de disco en el chat: el modelo solo maneja rutas relativas y las que inventaba no existían.
- [x] 18.8 Cubrir con pruebas y actualizar especificaciones y documentación.

## 19. La Skill del turno deja de depender del estado de la interfaz

- [x] 19.1 Diagnosticar la tercera reaparición de "no tengo acceso operativo a los archivos": cada eslabón funcionaba por separado, pero la Skill del turno salía SOLO del estado del compositor, que no sobrevive a un remonte del chat.
- [x] 19.2 Crear `resolve-turn-skill.ts`: deriva la Skill del espacio de trabajo que la conversación tiene resuelto —el mismo que alimenta el panel—, respeta la elección manual y completa el workspace de una Skill recién activada.
- [x] 19.3 Llevar el identificador de Skill en el contexto de la presentación, para que la derivación no asuma cuál es.
- [x] 19.4 Añadir a la nota de contexto la instrucción de comprobar con `workspace_list_files` antes de afirmar que no puede acceder.
- [x] 19.5 Cubrir la cadena completa con una prueba de extremo a extremo, desde el espacio de trabajo resuelto hasta la declaración de `workspace_write_file`; actualizar especificación y documentación.

## 20. Calidad visual: serie ilustrada y acabado técnico

- [x] 20.1 Convertir la dirección de arte en parámetro de `workspace_generate_image`: un hueco que rellenar en cada llamada produce series coherentes; un recordatorio en el prompt, no.
- [x] 20.2 Añadir `getDirectedImagePrompt`, que conserva las reglas de seguridad pero omite el envoltorio general —empujaba a fotorrealismo y rompía cualquier serie ilustrada.
- [x] 20.3 Añadir al sistema de diseño la capa de plano técnico (`.plano`, `.cota`), las composiciones densas (`.rail`, `.bloque`, `.bloque--con-apoyo`), la comparativa con eje y las capas en perspectiva.
- [x] 20.4 Dibujar los esquemas al llegar la diapositiva con `.traza-auto` y `.surge-auto`, escalonados por `--i`.
- [x] 20.5 Reescribir el prompt: sistema de ilustración con ejemplo concreto de dirección de arte, orden de preferencia de las tres vías de imagen, ilustración como contenido y no como fondo, y densidad con estructura.
- [x] 20.6 Restaurar las secciones de profundidad y calidad visual que se perdieron al reemplazar el bloque de imágenes.
- [x] 20.7 Cubrir con pruebas y actualizar especificación y documentación.

## 21. Ediciones que enseñan y contenido que siempre cabe

- [x] 21.1 Diagnosticar los quince reintentos idénticos: el error de una edición fallida era genérico ("no existe, lee el archivo") y no daba nada con lo que corregir.
- [x] 21.2 Devolver evidencia real en el fallo: fragmento presente con otro formato, contenido de la zona con sus líneas, o líneas de las ocurrencias ambiguas.
- [x] 21.3 Añadir al prompt la regla de cierre: no repetir una edición adivinando, y releer el archivo entero tras dos fallos seguidos; verificar el resultado antes de anunciarlo.
- [x] 21.4 Ajustar el contenido de cada diapositiva a la ventana desde `guion-base.js`, dejando fuera del escalado el fondo, el halo y la retícula, y rehaciéndolo al cambiar el tamaño.
- [x] 21.5 Dar salida a lo que no cabe en la baraja horizontal (`overflow-y: auto`) como respaldo si el guion no se ejecuta.
- [x] 21.6 Subir la exigencia visual del prompt: una pieza visual por diapositiva de contenido y entre seis y diez ilustraciones por baraja.
- [x] 21.7 Permitir rótulos cortos dentro de una ilustración cuando el esquema los pide, manteniendo fuera cifras, frases y titulares.
- [x] 21.8 Cubrir con pruebas y actualizar especificación y documentación.

## 22. Verificación por lectura y medida correcta del contenido

- [x] 22.1 Prohibir en el prompt abrir la presentación en un navegador para verificarla: sin conocer la ruta real, la dirección que construía apuntaba a un archivo inexistente y el usuario veía una página en blanco. La comprobación es releer el archivo.
- [x] 22.2 Volver a medir el ajuste cuando cada ilustración termina de cargar, al terminar la página y ante cualquier cambio de altura: medir solo en `DOMContentLoaded` no contaba el alto de las imágenes y el texto acababa fuera de la pantalla.
- [x] 22.3 Bajar el suelo del escalado al 50 %, que en un panel estrecho el 62 % no bastaba.
- [x] 22.4 Renderizar la vista previa sobre un lienzo fijo de 16:9 escalado, para que el panel muestre lo mismo que la pantalla completa.
- [x] 22.5 Cubrir con pruebas y actualizar documentación.

## 23. Diagramas que no salen descuadrados

- [x] 23.1 Alinear el anillo de `.orbita` con el radio real de los satélites: llevaba un inset fijo y quedaba descuadrado respecto a ellos.
- [x] 23.2 Evitar que el rótulo del núcleo desborde su círculo (relleno proporcional, escala menor y corte de palabra).
- [x] 23.3 Repartir los satélites por igual desde `guion-base.js` y numerarlos; un ángulo escrito a mano sigue mandando.
- [x] 23.4 Animar la órbita al llegar la diapositiva: el anillo crece, el núcleo entra y los satélites aparecen en orden.
- [x] 23.5 Impedir que `.comparativa` se estreche hasta partir el texto en una palabra por línea: suelo en los lados y eje en su ancho mínimo, con apilado en pantallas angostas.
- [x] 23.6 Numerar y medir automáticamente los trazos de `.diagrama` (`getTotalLength`), para que el dibujado no dependa de índices ni longitudes escritas a mano.
- [x] 23.7 Añadir al prompt las reglas de reparto del espacio (no dejar medio lienzo vacío) y de variedad de forma (no repetir la misma caja).
- [x] 23.8 Cubrir con pruebas cada corrección.

## 24. Reordenar pestañas del navegador integrado

- [x] 24.1 Diagnosticar la pantalla en blanco al arrastrar una pestaña: el canal `integrated-browser:tab-reorder` faltaba en la allowlist de preload; `validateChannel` lanzaba de forma síncrona dentro de un updater de React y el error desmontaba el árbol entero.
- [x] 24.2 Añadir el canal a la allowlist y cubrirlo en el contrato de SEC-035.
- [x] 24.3 Reescribir el arrastre con Pointer Events y captura: el gesto ya no se pierde al salir de la pestaña ni compite con la región de arrastre de la ventana de Electron.
- [x] 24.4 Sacar la llamada IPC del updater de estado y blindarla, de modo que un fallo del puente no pueda volver a tumbar la interfaz.
- [x] 24.5 Derivar el orden mostrado en vez de sincronizarlo por efecto, eliminando el desfase de un render.
- [x] 24.6 Cubrir con pruebas el reordenamiento, el clic sin desplazamiento, el botón derecho y la resistencia a un fallo del puente.
- [x] 24.7 Corregir la pestaña que se quedaba clavada al soltarla: el fin del arrastre se escucha en la ventana y no en el nodo, porque el contenido web es una vista NATIVA sobre el renderer y el `pointerup` no llegaba al DOM. Se añaden como red el `blur` de la ventana, la pérdida de captura del puntero y el regreso del puntero sin botón pulsado.
