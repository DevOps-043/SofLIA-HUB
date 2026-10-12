# Revisión de escenas y visita a salas

Fecha: 2026-10-11. Estado: frontend implementado y verificado localmente.

## Alcance

Pantalla/Cámara/Combinada son modos compactos de vista. Escenas es un banco independiente de láminas, fuentes de pantalla preparadas e imágenes/videos locales. Cambiar de escena conserva los estados de compartir, cámara y micrófono; desde cámara sola abre una composición con contenido. Grupo comparte las salas de Actividades, permite visitarlas y volver al grupo principal, y el chat separa mensajes y borradores por sala. Quitar o sustituir salas vuelve al grupo principal.

No se agregaron IPC, mutaciones Learning/Zoom, permisos de dispositivos ni persistencia. Los materiales/quizzes continúan como metadatos; solo los medios de escenas usan URLs de objeto locales, con limpieza al quitar o desmontar. Las pantallas son fuentes pendientes de captura real. Hasta 12 escenas y 25 MB por archivo multimedia; títulos/nombres y formatos tienen límites. Los videos no arrancan con audio ni se reproducen automáticamente.

## Verificación

- Focal: 18 pruebas aprobadas en `StudioProduction`, `InstructorStudio`, `LearningWorkspace` y `learning-room-routing`. [Registro](scenes-focal-tests.log). Cubre escenas y modo sin apagar controles, alta/baja/fallback de escenas, sala vacía, visita/regreso, aislamiento de mensajes/borradores, quitar/reemplazar salas, tipos/tamaño/cantidad de medios y liberación de URLs.
- Typecheck exitoso y lint incremental sin deuda nueva en 226 archivos en la primera verificación de esta revisión. El checkout contiene otros cambios concurrentes; no se atribuyen al estudio todas las cifras del conjunto global.
- `npm run verify:pr`: exitosa, 4054 pruebas aprobadas y una omitida en 382 archivos aprobados y uno omitido. [Compuerta](scenes-gate.log). Pasaron adaptadores, harness, cadena de suministro, documentación, semillas, OpenSpec, tipos y lint.
- Chrome: se eligió Práctica, se crearon seis salas, se entró a Sala 2 y se publicó solo un comentario local de ejemplo, se volvió al grupo y se preparó/seleccionó Cierre. Se comprobó que elegir una escena desde cámara sola muestra contenido y conserva el botón Compartiendo. Evidencia: [estudio oscuro](studio-scenes-dark.png), [claro](studio-scenes-light.png), [Grupo y salas](studio-group-rooms.png), [retroalimentación](studio-room-feedback.png), [salas en móvil](studio-rooms-mobile.png).
- Inspección a 1440 × 900 y 390 × 844 px. En móvil los modos ocupan 101 × 34 px y conservan nombres accesibles; no hay desbordamiento horizontal. La selección de archivos mediante la extensión tuvo una limitación documentada en [la revisión anterior](verification.md); la limpieza de medios y sus límites se prueban automáticamente y no se atribuye esa prueba a una validación visual de reproducción multimedia.
- [Escenario móvil](studio-scenes-mobile.png) y [editor de escenas móvil](studio-scene-editor-mobile.png): se preparó una lámina con título de dos líneas, se seleccionó y se retiró, conservando una escena válida. Se dejaron las tres escenas de ejemplo, seis salas y una visita a Sala 2 en la demo; se restauraron tema oscuro y tamaño normal. Solo hay un comentario local de ejemplo en la sala.
- La vista previa se recargó después de reiniciar únicamente su servidor al añadir módulos/hojas CSS: la caché de desarrollo conservaba importaciones anteriores. No se alteraron procesos de la aplicación principal.

## Límites

Esta evidencia acredita los flujos React de diseño y no una transmisión real ni admisión a salas Zoom. El banco se conserva durante la sesión del estudio y se pierde al cerrarlo. La captura de pantalla, dispositivos reales, participantes remotos, sincronización y publicación siguen pendientes de integrar. La fixture contiene ejemplos explícitos que no se inyectan en la aplicación.
