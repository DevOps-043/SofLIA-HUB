# Evidencia de trabajo de fondo y caché

Fecha: 2026-11-17. Misma rama codex/optimize-build-runtime; conserva etapas previas.

## Hallazgos y decisiones

- MonitoringService iniciaba una captura por tick incluso si seguía pendiente el OCR anterior. No validaba sesión/configuración al publicar un resultado tardío. Ahora mantiene un pipeline periódico en vuelo, descarta etapas/resultados revocados y recupera la captura inicial de una sesión nueva al liberarse la anterior.
- El evento especial error de EventEmitter podía lanzar sin receptor y producir otro rechazo en el diagnóstico. Se registra sin lanzar y se contiene también un receptor fallido.
- Dos capturas del mismo milisegundo/pantalla podían usar el mismo nombre. Ahora llevan UUID, también para evitar que limpiar una captura revocada borre otra captura válida.
- PathMemory.start duplicaba intervalos; watchers y polling podían iniciar escaneos y escrituras superpuestos. Ahora el inicio es idempotente, las actualizaciones se serializan y se agrupan las invalidaciones; se recuperan cambios al iniciar/reiniciar.
- Los metadatos de cada archivo se consultaban secuencialmente. Ahora son tandas de hasta cuatro, con revisión entre tandas y mismo orden/tope previo de entradas.
- La caché de embeddings no tenía presupuesto entre sesiones. LRU limita a cuatro sesiones/5000 vectores acumulados; la búsqueda usa el mismo conjunto cargado y la expulsión no borra datos. Se conserva el coste de recargar una sesión fría, a cambio de evitar crecimiento residente indefinido.

## Pruebas y mediciones dirigidas

Nueve archivos y 43 pruebas dirigidas aprobadas antes del gate final.

- Captura lenta: diez ticks mantienen una sola operación; completarla permite el ciclo posterior.
- Stop/cambio de sesión/configuración: no publican resultado antiguo; una sesión nueva obtiene trabajo fresco sin esperar el siguiente periodo.
- Inicios concurrentes y start detenido durante mkdir: una sesión vigente y un timer, sin reactivarse tras stop.
- Errores sin receptor y receptor que lanza: no interrumpen el siguiente ciclo.
- Cancelación durante detección/OCR: evita etapas posteriores y limpia imagen no publicada. Dos capturas de igual timestamp producen rutas diferentes.
- Veinte metadatos simulados con latencia de 10 ms terminan en 50 ms, con pico exacto de cuatro consultas; no es un benchmark del disco real. Se conservan 200 entradas y orden estable para fechas iguales.
- Cien eventos más ticks durante un escaneo lento se recuperan con un pase posterior, sin escaneos simultáneos. Start repetido mantiene un timer. Stop durante escritura no emite resultados antiguos.
- Se reprodujeron en rojo dos carreras adicionales mediante tests antes de corregirlas: invalidación entre terminar y liberar la promesa, y captura inicial de sesión nueva mientras seguía en vuelo la antigua. Repetición posterior aprobada.
- LRU: acceso promueve sesión, expulsión recarga el mismo resultado; dos sesiones de 5000 vectores respetan el presupuesto acumulado sin reducir los cinco resultados solicitados. Delete/clear conservan sus efectos.

Todo usa filesystem/capturas/DB simulados; no se escaneó el disco ni se capturó el escritorio del usuario.

## Verificación integral

Build final con typecheck y runtimes renderer/main/preload/presentación/audiovisual/Zoom aprobado. `npm run verify:pr`: aprobado completo con código cero sobre el estado acumulado de las cuatro etapas:

- Adaptadores, arnés, suministro, integridad CI, runtime estable, documentación, semilla y OpenSpec aprobados.
- 66 pruebas de tooling y 33 contratos Python aprobados; Python 3.12.11 temporal configurado con SOFLIA_TEST_PYTHON sólo por proceso.
- Typecheck aprobado y lint de 79 archivos sin deuda nueva.
- Suite global: 653 archivos aprobados y dos omitidos; 7625 pruebas aprobadas y cinco omitidas. Duración 406,66 s.
- Cobertura validada sobre 2743 fuentes productivas: líneas 63,50%, sentencias 61,63%, funciones 58,15%, ramas 54,92%.

No se bajaron pisos de cobertura ni se omitieron funciones para verificar. Los cinco casos omitidos conservan la situación previa. No se generó ni publicó instalador.

## Revisión adversarial y límites

Revisión local de solapamiento, stop/restart, A→B, configuración durante OCR, evento error sin receptor, colisión de archivos, limpieza de capturas revocadas, watcher inválido, invalidación tardía y recarga de caché expulsada. Sin archivado.

La caché limita vectores retenidos, no el heap global: siguen existiendo filas transitorias, texto de sesiones, imágenes y memoria de terceros. No se recorta historial persistido ni se desactivan OCR, semántica, capturas o búsqueda. El primer acceso tras expulsión vuelve a consultar SQLite. IO/captura/escritura ya empezados pueden terminar después de stop; sus resultados obsoletos no se publican.

El primer índice completo conserva profundidad y alcance anteriores; no se acredita un plazo global de arranque para carpetas muy grandes o unidades remotas a partir del fixture de metadatos.

Reversión por diff de esta etapa, conservando entregas anteriores. Sin cambios de permisos, IPC, esquemas o secretos; sin servicios remotos ni instaladores publicados.
