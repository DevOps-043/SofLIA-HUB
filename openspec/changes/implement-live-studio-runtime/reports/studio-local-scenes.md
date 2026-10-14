# Escenas locales con fuentes ligadas

Estado: implementación y validación local. Fecha: 2026-10-13.

## Corrección

El banco enviaba scene/select_scene/remove_scene a Learning y representaba una
fuente de pantalla como un título libre. Ahora prepara escenas localmente, sin
comandos remotos ni uploads de producción. Learning mantiene ingreso, permisos,
contenido académico, chat y actividades. Los archivos locales tienen URLs blob
con dueño; las escenas importadas conservan la renovación de assets académicos.

El editor usa el selector propio en modo Vincular, guarda una referencia UUID
efímera a una fuente real y muestra su miniatura. Compartir reutiliza esa fuente;
detener conserva el vínculo. Se puede sustituir con Cambiar fuente. Main valida
inventario, existencia, actor y ventana, con cuatro operaciones IPC cerradas.
La vista local tiene un permiso de un solo uso; el SDK utiliza la fuente activa.
No se persistieron IDs nativos, permisos ni capturas, ni se añadió una dependencia.

## Evidencia

- 47 pruebas dirigidas correctas en StudioProduction, studio-capture,
  display-media-picker y zoom-share-lifecycle.
- Typecheck de Hub y del paquete aislado Zoom correctos.
- Lint incremental inicial: 78 archivos sin deuda nueva sobre HEAD. El gate final,
  que incluye trabajo concurrente de marca, revisó 164 archivos sin deuda nueva.
- Build de runtime Zoom correcto; conserva el aviso de tamaño de chunk del SDK.
- Smoke de protocolo Zoom: `SDK_READY_ORIGIN=soflia-zoom://meeting`.
- Smoke nativo comprobó pantallas, ventanas y pestañas reales; vincular, activar,
  capturar dos veces sin selector, liberar y rechazar el UUID liberado.
- QA nativa del editor, sin backend Learning: creación con miniatura real,
  Compartir, detener/retomar sin otra selección y quitar la escena. Se comprobó
  además vídeo decodificado (`readyState >= 2` y `videoWidth > 0`) en la vista local.
- Capturas locales temporales de editor y banco de escenas fuera de Git.
- `npm run verify:pr` final correcto: 423 suites correctas y una omitida;
  4346 pruebas correctas y una omitida. Typecheck, harness, lint, documentación,
  semilla, cadena de suministro y 64 cambios OpenSpec correctos. El total incluye
  cambios concurrentes ajenos al alcance. Diff de archivos staged/unstaged correcto.

Comandos reproducibles:
`npx vitest run electron/__tests__/studio-capture.test.ts electron/__tests__/display-media-picker.test.ts src/__tests__/components/StudioProduction.test.tsx src/__tests__/services/zoom-share-lifecycle.test.ts`,
`npm run verify:pr`, `npx tsc -p packages/zoom-runtime/tsconfig.json`,
`npx vite build --config vite.zoom.config.mts`,
`node scripts/quality/smoke-display-media-picker.mjs` y
`node scripts/quality/smoke-zoom-runtime.mjs`.

## Revisión adversarial local

Durante la validación hubo cambios concurrentes de marca y un gate observó una
prueba del visor de archivos desalineada con su mensaje. No se modificó esa área;
el trabajo concurrente alineó código y prueba, y se repitió la compuerta. El smoke
también corrigió una dependencia frágil del título de ventana: ahora usa la
identidad nativa de la página, que no cambia cuando Vite actualiza document.title.

Se rechazaron subframes, otro renderer, falta de identidad, IDs inventados y campos
extra. Cerrar, navegar, cambiar actor, quitar y cancelar edición invalidan permisos.
Se refutaron activaciones/capturas tardías después de cambiar escena mediante
generaciones separadas; el resultado anterior no puede reemplazar la elección nueva.
Se probaron fuente desaparecida, límite de concesiones, selección simultánea,
respuesta tardía tras salir y renovación de recursos importados. No hay fallback
a otra pantalla ni búsqueda de fuentes por nombre. Las pestañas vinculadas siguen
su navegación, pero no una vista recreada o de otro perfil.

En Zoom, detener libera las pistas nativas y notifica ended a sus consumidores:
MediaStreamTrack.stop por sí solo no emite ese evento. El wrapper se restaura al
desmontar y cancela capturas que llegan después de una detención.

## Límites verificados

El [API público de EmbeddedClient](https://marketplacefront.zoom.us/sdk/meeting/web/components/modules/EmbeddedClient.html)
y los tipos instalados de Meeting SDK 6.5.0 no ofrecen iniciar o sustituir pantalla.
El control oficial Compartir de Zoom inicia la emisión y toma la fuente ligada;
cambiar escena durante una emisión la detiene y requiere iniciar la nueva desde
ese control. No se introducen métodos inexistentes ni selectores privados de DOM.
No se ha ensayado una llamada remota autenticada. Las láminas/archivos locales no
se convierten automáticamente en una cámara virtual ni composición audiovisual.

Hasta 12 escenas y 14 concesiones de fuente (incluida edición/reemplazo); una vista
local de pantalla y permiso de un solo uso de 10 segundos. Los vínculos se conservan
durante el estudio y se liberan al salir; requieren consentimiento nuevo al reabrir.
La captura individual de pestañas externas sigue fuera de Electron: se comparte
su ventana. No hay migraciones ni cambios de datos remotos que revertir.

Reversión: retirar únicamente la implementación de escenas locales/canales
studio-capture y su ciclo de pistas, conservando el selector propio y el trabajo
previo del estudio. No archivar el cambio mayor mientras sus validaciones remotas
sigan pendientes.
