# Verificación del avatar 2D

Estado: implementación validada; integración con excepción de lint ajena al cambio. No es un candidato de release.

## Evidencia confirmada

- Fuente original: `src/assets/soflia-avatar/provenance.json`, con SHA-256 y método reproducible de extracción.
- Pruebas focalizadas finales: 4 archivos y 33 pruebas aprobadas (modelo, avatar, instalador y conversación de voz). Incluyen cambios de posición/transformación de ancestros.
- `npm run typecheck`: aprobado después de enlazar las dependencias locales existentes de `packages/zoom-runtime`. El intento inicial sin ese enlace falló por ausencia de `@zoom/videosdk`; no se alteró código de Zoom.
- `npm run lint:changed`: aprobado sin deuda nueva en el worktree. ESLint directo sobre el componente, fixture y scripts de recursos también aprobado.
- Revisión visual inicial de la misma imagen en fondos claro/oscuro: `demo-dark.png` y `demo-light.png`.
- La primera compuerta PR detectó el inventario de pruebas pendiente de actualizar; `npm run docs:inventory:sync` lo sincronizó.

## Validación confirmada

- `npm run verify:pr` en el worktree: aprobado. 526 archivos aprobados, 2 omitidos; 5984 pruebas aprobadas y 5 omitidas. Incluye typecheck, lint incremental, arnés, documentación, OpenSpec y suite.
- `node scripts/avatar/verify-assets.mjs`: 637891 píxeles visibles conservan RGB exacto en el recorte original y 935197 quedan transparentes; cuatro capas RGBA válidas.
- `node scripts/avatar/verify-demo.mjs`: siete escenarios de navegador aprobados; sin WebGL/Three.js/GLB, mirada global, prioridades, pausa, tamaños, móvil y amplitud de audio.
- Medición: 120 intervalos RAF, promedio 10.53 ms y p95 10.60 ms en HeadlessChrome 157/Windows. Es una medición de cadencia local, no un benchmark de GPU para todos los equipos.
- Audio: archivo WAV PCM local de 440 Hz, amplitud observada 0.6172 activa y 0.0007 tras pausa. La amplitud manual de la demo se identifica como tal.
- Exportaciones: 12 PNG transparentes y 12 SVG de expresiones, lámina PNG, GIF de 72 frames a 12 fps y WebM VP9. WebM reproducido en navegador: 360 × 360 y fotogramas decodificados. Los doce SVG se renderizaron para comprobar sintaxis y estilos, incluido el círculo de puntos.
- Bundle web del instalador y build independiente de la demo: aprobados, sin Three.js. No se ejecutó el motor de instalación.
- Revisión visual: fondos claro/oscuro, 112/176/340/560 px y móvil 390 px; tras el feedback se eliminó profundidad del visor y se ampliaron símbolos. Movimiento desactivado conserva los símbolos a opacidad completa.
- Revisión adversarial local: [hallazgos y correcciones](adversarial-review.md).

## Integración

Los archivos de este cambio se copiaron al workspace principal tras comprobar que
los destinos no tenían modificaciones ajenas; [manifiesto](integrated-files.json).
El inventario de pruebas se recalculó allí, conservando el resto de documentación.
La compuerta PR del workspace integrado aprueba adaptadores, arnés, cadena de
suministro, documentación, semilla de skills, OpenSpec, pruebas de calidad y
typecheck. Se detiene en lint incremental por incidencias que ya existían en
archivos ajenos, identificados en el estado inicial:

- `src/__tests__/app/useAppViewHandlers-deleteFolder.test.ts`: siete usos de any.
- `src/app/AppModals.tsx`: un uso de any.
- `src/components/folder-modals/DeleteFolderModal.tsx`: una referencia antes de declaración y una dependencia de efecto pendiente.

No son archivos incluidos en el manifiesto de esta integración. Son 9 errores y
1 warning; no se amplió el baseline ni se modificaron esos archivos.

`npm run test` se ejecutó por separado en el workspace integrado: **535 archivos
aprobados, 2 omitidos; 6060 pruebas aprobadas y 5 omitidas**. El typecheck final
también aprobó. ESLint directo de los archivos propios, verificación de recursos,
doce SVG renderizables, `docs:check` y `harness:validate` aprobaron en el workspace.
La excepción restante de la compuerta general es exclusivamente el lint ajeno
identificado arriba.

## Revisión posterior de Curiosidad, Durmiendo, Confirmación y Respondiendo

Se rediseñaron las cuatro caras: ceja elevada y ojos asimétricos para curiosidad;
párpados relajados y respiración sin letras para dormir; sonrisa, asentimiento e
insignia lateral para confirmar; ojos abiertos y boca reactiva para responder.
El selector manual de amplitud y Restablecer liberan el archivo de audio anterior,
evitando que su analizador en pausa sobrescriba la demostración manual.

Validación de esta revisión: 33 pruebas focalizadas aprobadas, ESLint de archivos
propios aprobado, siete escenarios de navegador aprobados y documentación sin
enlaces rotos. La boca pasó de escala vertical 1.41562 con WAV activo a 0.55098
tras pausarlo. Se regeneraron PNG, SVG, lámina, GIF y WebM. Las cifras de suite
completa anteriores corresponden a la entrega previa; no se repitió toda la suite
por esta revisión visual. El typecheck final también aprobó.

## Revisión de movimiento continuo y fluidez

Confirmación ya no contiene palomita ni insignia: asiente verticalmente cada
1.3 segundos de forma recurrente. Los doce estados tienen perfiles ambientales
continuos sin cursor ni voz. La pose se conserva al cambiar de expresión y se
interpola en el único RAF; se agrupan eventos de puntero y se eliminan escrituras
CSS repetidas, transiciones duplicadas y cambios del radio de los filtros.

Verificación final de esta revisión:

- 50 pruebas focalizadas aprobadas; incluyen doce estados sin interacción, varios ciclos de asentimiento, continuidad de pose y agrupación del puntero.
- Typecheck y ESLint propio aprobados; especificación OpenSpec y enlaces documentales válidos.
- Nueve comprobaciones de navegador aprobadas. Las doce expresiones cambiaron de pose con energía de audio cero.
- Medición local de 120 intervalos RAF: promedio 10.526 ms, p95 10.60 ms, máximo 10.70 ms. Desplazamiento máximo entre muestras: 0.249 px; variación angular máxima: 0.00234 radianes. No constituye garantía de FPS para otros equipos.
- PNG, SVG, GIF y WebM regenerados; GIF adicional de Confirmación con 48 fotogramas. Los derivados GIF/WebM siguen siendo demostraciones a 12 fps; la demo interactiva conserva la cadencia nativa medida y es la referencia de fluidez.
- Demo interactiva abierta en el navegador integrado con Confirmación y animación activas.

Las cifras de suite completa anteriores son históricas; no se repitió toda la
suite por esta revisión del controlador visual. Persiste la excepción de lint
ajena al avatar documentada antes.

## Revisión de expresividad facial, registro vocal y sueño

La versión actual ofrece catorce expresiones, incluidas Sorpresa y Preocupación.
El rostro tiene traslación e inclinación propias. Confirmación asiente dentro del
visor con amplitud objetivo de 2.8% y el cuerpo flota sólo 0.3%. La mirada recorre
2.7%/1.8%, tiene retorno gradual y acompaña ojos y cejas. Pensando añade órbita y
puntos; la boca cambia su contorno según volumen, registro y bandas reales. Zzz
asciende fuera del cuerpo y del visor y conserva alternativa de movimiento reducido.

- 65 pruebas focalizadas aprobadas, incluidas frecuencias de 110..580 Hz, rechazo de silencio/agudos fuera de rango, reaprovechamiento del nodo y permiso denegado sin fugas.
- Compuerta PR del worktree aprobada: 528 archivos aprobados y 2 omitidos; 6017 pruebas aprobadas y 5 omitidas. Typecheck y lint propio incluidos.
- Diez comprobaciones de navegador aprobadas, con WAV reales locales: 140 Hz suave produjo registro 0.2685/energía 0.586; 480 Hz fuerte produjo 0.8493/1. La onda cambió de distribución y la boca cerró al pausar.
- Cadencia local: promedio 10.527 ms, p95 10.60 ms, máximo 10.70 ms en 120 muestras. La estimación de registro costó 0.068 ms de media en 200 iteraciones tras calentamiento; se ejecuta cada 50 ms y no abre otra captura.
- Se regeneraron catorce PNG/SVG, lámina, GIF y WebM. La demo permanece como referencia de fluidez; los derivados siguen siendo de presentación a 12 fps.
- La demo usa el analizador de producción y ofrece micrófono sólo por acción explícita. No se capturó el micrófono real durante las pruebas automatizadas ni se llamó un TTS remoto. El control para detenerlo aparece también junto al avatar.
- La articulación es acústica. El contrato TTS no contiene alineación de palabras o fonemas; no se afirma lectura semántica ni sincronización fonética exacta.

La compuerta principal conserva la excepción de lint ajena previamente descrita;
la validación completa citada corresponde al worktree aislado. Los últimos ajustes
del encuadre y controles de la demo se verifican por lint y build dirigido.

## Límites de la implementación

No se invocó un proveedor remoto de voz ni se capturó micrófono durante la QA aislada. La imagen aplanada no permite recuperar información oculta; cuerpo y bandas se conservan unidos y el visor se uniforma por solicitud expresa, con trazos SVG de referencia. No hay promesa de 60 FPS para hardware no medido. El código 3D previo permanece fuera del bundle como referencia de reversión durante la entrega. No se archiva el cambio. La publicación autorizada se registra al final de este reporte.

## Integración final en Hub — 2026-11-12

El personaje está integrado en la orbe, la bienvenida y el compositor de los chats
compartidos (general, navegador y proyectos), las miniaturas del historial y el
inicio de conversación de proyecto. El inicio del navegador usa el personaje tanto
en renderer como en su documento nativo aislado. Los borradores se clasifican
localmente sin enviar o guardar su contenido.

La activación ofrece alegría y espera. Tras 20 segundos sin uso aparece reposo con
Zzz; el cierre automático del dictado a los ocho segundos no reinicia ese contador.
Permisos reales muestran advertencia, fallos preocupación, resultados concluyentes
éxito y confirmaciones asentimiento facial. Herramientas activas y tareas prolongadas
muestran concentración. El dictado del chat presta sus pistas al analizador sin
otra captura; el streaming escrito tiene gesto de boca separado del audio real.

Resultados de la revisión final:

- `npm run verify:pr`: aprobado en `codex/soflia-avatar-2d`; 530 archivos aprobados y 2 omitidos, 6034 pruebas aprobadas y 5 omitidas. Incluye typecheck, 49 archivos de lint sin deuda nueva, arnés, OpenSpec, documentación y auditoría de dependencias.
- Workspace principal: typecheck aprobado; 110 pruebas dirigidas aprobadas en doce archivos y revisión posterior de presencia/avatar aprobada con el ajuste final del reposo. Su `verify:pr` sigue detenido por 9 errores y 1 advertencia preexistentes de lint en cambios ajenos (eliminación de carpetas y AppModals); no se incluyeron en esta rama.
- `node scripts/avatar/verify-assets.mjs`: 637891 píxeles visibles originales, 935197 transparentes y cuatro capas RGBA válidas.
- `node scripts/avatar/verify-demo.mjs`: diez comprobaciones aprobadas, catorce expresiones y derivados regenerados. WAV de 140 Hz suave: registro 0.2684/energía 0.5868; 480 Hz fuerte: 0.8493/1; la boca cierra al pausar.
- `node scripts/avatar/verify-integration.mjs`: cuatro comprobaciones aprobadas, sin errores JS: borradores independientes, boca del streaming escrito, ancho 390 px sin desbordamiento y documento nativo con su CSP real y movimiento reducido.
- Cadencia local de integración: 120 intervalos RAF, promedio 10.527 ms y p95 10.60 ms. El resultado no garantiza la misma frecuencia en otros equipos.
- Build SSR dirigido del protocolo nativo aprobado y módulo compilado cargado para comprobar recursos embebidos y correspondencia del hash SHA-256 de su script con CSP.
- Revisión adversarial local completada; sin nuevos canales IPC, dependencias, migraciones ni cambios de autorización. El diff y el staged diff no tienen errores de whitespace.

Alcance de QA: componentes y documento nativo reales en fixture local, pruebas de
conversación con proveedores simulados y audio WAV local. No se ejecutó una sesión
autenticada de producción, un TTS remoto ni captura del micrófono real. No se afirma
alineación fonética exacta. Los GIF/WebM son presentación a 12 fps; la referencia de
fluidez es el componente vivo.

Reversión: revertir el commit de implementación en la rama aislada. El workspace
principal conserva cambios ajenos; no usar un reset global para revertir esta UI.
La fusión local del compositor de proyecto añadió sólo imports y el personaje,
preservando sus cambios de iconografía.
