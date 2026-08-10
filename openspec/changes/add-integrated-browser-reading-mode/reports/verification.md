# Evidencia de verificación

Fecha: 2026-08-06

## Alcance verificado

- El modo lectura usa una cápsula flotante de bordes redondeados dentro de un
  `ShadowRoot`, anclada sobre la selección o el primer bloque narrable.
- Abrir, reposicionar o cerrar la cápsula no publica otro viewport, no oculta el
  `WebContentsView` y no desplaza la página original.
- La reproducción conserva pausa, detención, reducción/aumento de velocidad y
  cierre desde la propia cápsula; no existe canal ni botón de descarga.
- Google Docs prioriza la selección explícita; para el documento completo usa
  una exportación textual con la misma sesión autenticada y un árbol AX temporal
  como respaldo. Nunca recurre al DOM general de menús o pestañas.
- El primer microlote se limita a 180 caracteres; al recibirlo se anticipan como
  máximo dos lotes de hasta 480 caracteres, antes de la decodificación local. Las solicitudes
  duplicadas comparten promesa y detener/cerrar cancela toda la cola pendiente.
- Cada lote se cancela a los 20 segundos. Un fallo anticipado se conserva hasta
  un nuevo gesto del usuario y no se repite automáticamente al avanzar.
- La cápsula incluye un asa accesible: Pointer Events la mueven libremente, sus
  coordenadas se limitan al viewport y el doble clic restablece el anclaje.
- El seguimiento usa rangos efímeros de CSS Highlights sobre el DOM original, sin
  insertar envoltorios ni reemplazar texto, imágenes, gráficas o controles.
- En el lienzo virtual de Google Docs el seguimiento visual subraya el token
  original dentro de la cápsula cuando no existe un rango DOM estable, en vez de
  marcar etiquetas coincidentes de la UI.
- La voz prepara aliases españoles para `SofLIA`, decimales y versiones, declara
  el idioma ISO 639-1 y envía contexto vecino acotado entre microlotes.
- Cada unidad del texto preparado conserva un rango de origen; los timestamps
  vuelven al texto visible incluso cuando “cinco punto doce” representa `5.12`.
- Los rangos se validan contra la sesión, la URL y límites acotados; las respuestas
  asíncronas antiguas se descartan mediante una revisión monotónica.
- Detener, cerrar, navegar, expirar o destruir el servicio limpia la marca y la
  sesión efímera.

## Compuertas ejecutadas

- Pruebas focalizadas de voz y lectura: correcto; 6 archivos y 46 pruebas de
  dicción, offsets, contexto, extracción, cápsula, resaltado, Orbe e IPC.
- `npm run verify:pr`: correcto; 152 archivos de prueba y 1.295 pruebas aprobadas.
- `npm run build:app`: correcto; incluye `typecheck` y builds de renderer, main y preload.
- `git diff --check`: correcto, sin errores de whitespace.
- La validación estricta de OpenSpec, documentación, arnés y lint de archivos
  modificados quedó incluida y aprobada por `verify:pr`.

## Revisión adversarial

- Privacidad: no se persiste el texto ni el rango resaltado; el audio continúa con
  buffers transitorios y los secretos de ElevenLabs permanecen fuera del renderer.
- Inyección: la cápsula no interpola contenido de la página, rutas, errores del
  proveedor ni secretos. La revisión posterior eliminó toda asignación
  `innerHTML`: ahora crea nodos DOM/SVG y pasa una prueba que simula el rechazo
  obligatorio de `TrustedHTML` de Gmail.
- Integridad del documento: el resaltado no muta su estructura y se degrada sin
  bloquear la narración cuando una página no expone texto mapeable. El fallback
  de Google Docs usa `textContent` dentro del `ShadowRoot`, no búsqueda textual
  ni una escritura remota en el documento.
- Dicciones adversariales: IPs y versiones de tres partes no se interpretan como
  decimales; idiomas no españoles conservan el texto original; el mapa de offsets
  es monótono y todo rango devuelto queda dentro de la fuente preparada.
- Concurrencia: una revisión monotónica evita que una respuesta IPC retrasada haga
  retroceder el resaltado; la síntesis deduplica por segmento y usa un epoch para
  descartar respuestas posteriores a una cancelación.
- Acciones: una espera IPC bloqueante reemplaza el polling. Al cerrar se resuelven
  los waiters, se retiran listeners de scroll/resize y se elimina el host.
- Recursos: solo se precargan dos segmentos; la exportación de Docs tiene timeout
  de 8 segundos y 2 MiB, el árbol AX timeout de 5 segundos y 20.000 nodos, y su
  dominio de accesibilidad se desactiva inmediatamente después de la captura.
- Escritura: se retiraron el botón, wrapper, allowlist, handler, caché main y
  diálogo nativo de descarga; el renderer no puede convertir audio en una
  operación arbitraria de archivo.
- Resiliencia: si una SPA reemplaza el rango seleccionado, la cápsula se centra de
  forma segura; si no puede instalarse, la sesión no arranca de manera invisible.
- Consola remota: los rechazos `NotSameOriginAfterDefaultedToSameOriginByDip` de
  `lh3.googleusercontent.com`, `sandbox_bundle: Invalid URL`, APIs obsoletas,
  iframes y la feature `speaker` pertenecen a bundles/recursos de Gmail y a las
  protecciones de aislamiento de Chromium. El lector no crea URLs dentro de su
  cápsula ni intercepta esas respuestas. No se desactivó `webSecurity`, no se
  reescribieron CORP/CORS y no se ocultó la consola.

## Riesgos residuales

- Contenido dibujado en `canvas`, visores PDF opacos y marcos de otro origen puede
  no ofrecer rangos DOM resaltables. En ese caso la página y el audio siguen
  operativos y la cápsula ofrece seguimiento del token, pero no puede dibujar una
  marca dentro del lienzo sin una API estable del proveedor.
- Si Google Docs bloquea tanto la exportación de la sesión como su árbol AX, el
  lector pide habilitar soporte para lectores de pantalla y no inventa contenido.
- El tiempo del primer audio todavía depende de red, cuota, tipo de voz y
  disponibilidad de ElevenLabs. Los microlotes reducen el trabajo crítico y el
  timeout evita una espera indefinida, pero no sustituyen una prueba de latencia
  contra una cuenta, voz y región reales.
- `language_code: es` reduce ambigüedad y los aliases corrigen casos conocidos,
  pero el acento regional final pertenece a la voz elegida en ElevenLabs. Para
  una dicción estrictamente mexicana se necesita una voz entrenada o clonada con
  ese acento; Turbo v2.5 no admite fonemas IPA españoles como sustituto fiable.
- Gmail puede registrar rechazos de `FetchEvent` hacia `meet.google.com` desde su
  propio service worker. El navegador integrado no intercepta esas solicitudes;
  no se ocultan ni se atribuyen al modo lectura sin evidencia de una regresión.
- El build mantiene advertencias preexistentes de chunks mayores a 500 kB e imports
  dinámicos que también se importan estáticamente; no fueron introducidas por este
  rediseño ni bloquean la compilación.
