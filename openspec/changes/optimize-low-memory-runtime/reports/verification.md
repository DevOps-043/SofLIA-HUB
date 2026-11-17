# Evidencia y límites

Fecha: 2026-11-17. Continuación en `codex/optimize-build-runtime`, conservando todos los cambios previos de compilación y respaldos.

## Hallazgos y cambios

- La entrada flotante atravesaba AppContent y montaba managers de chat/carpetas/IRIS antes de elegir OrbWindowRoot. Ahora la entrada decide antes de importar App y conserva AuthProvider, tema, voz y reuniones. Prueba: el import del shell principal no se ejecuta en modo orb.
- Polling de 8/15/30 s continuaba oculto y las ráfagas realtime/foco podían iniciar lecturas paralelas. El controlador visible evita trabajo oculto, agrupa eventos y espera cada resultado. Los callbacks de conversación se estabilizaron para no reiniciar efectos/subscripciones por cada render. Las solicitudes de mensajes duplicadas comparten una promesa por ámbito, eliminada al terminar.
- Respuestas de otro usuario, organización o hook retirado se ignoran. No se cancela una petición física ya enviada.
- Se difieren reuniones, proyectos, agenda y aula, además de los ajustes/productividad ya diferidos. Markdown estable se memoiza sin truncar historial.
- En equipos con señal de hasta 4 GB o dos procesadores lógicos, el avatar reduce sólo actualizaciones visuales a aproximadamente 30 fps. Mantiene energía de voz, expresiones, seguimiento y estados.

## Mediciones disponibles

Build anterior al cambio: chunk App de 1792,92 kB JS minificado. Después: 708,62 kB, alrededor de 60% menos en ese archivo. Hay chunks compartidos y carga posterior; NO significa 60% menos memoria total ni descarga total.

Build separado: OrbApp 0,27 kB, OrbWindowRoot 36,56 kB; LearningWorkspace 151,76 kB; UnifiedProjectHub 99,30 kB; MeetingOpsPanel 47,69 kB; LearningSessions 10,62 kB; FolderProjectPanel 15,41 kB. Los tamaños del root flotante no incluyen AuthProvider, servicios de voz ni dependencias compartidas.

Fixture de refresco: 200 invalidaciones y foco se agrupan en una llamada; oculto durante 60 s con invalidaciones no inicia llamadas; una solicitud lenta conserva una sola ejecución simultánea y una recuperación posterior. No son consultas reales ni medición de RAM del producto completo.

Pruebas dirigidas: seis archivos y 24 pruebas aprobadas, más 31 pruebas de avatar. Build final con tipos y todos los runtimes aprobado tras el ajuste de cadencia y unificación de detección de ventana. Persisten avisos de chunks grandes: la división no elimina el peso total de los SDK multimedia.

`npm run verify:pr`: aprobado completo con código cero. Usa el intérprete Python 3.12.11 temporal preparado en la etapa previa mediante `SOFLIA_TEST_PYTHON`, sólo por proceso. Incluye:

- Adaptadores, arnés, suministro, integridad CI, Electron estable, documentación de sistema/enlaces, semilla y OpenSpec aprobados.
- 66 pruebas del tooling y 33 contratos Python aprobados.
- Typecheck aprobado; lint de 50 archivos sin deuda nueva.
- Suite global: 645 archivos aprobados, dos omitidos; 7586 pruebas aprobadas y cinco omitidas. Duración de suite: 482,38 s.
- Cobertura verificada sobre 2741 fuentes productivas: líneas 63,23%, sentencias 61,40%, funciones 57,93% y ramas 54,80%. Sin reducir pisos ni exclusiones adicionales.

Los resultados cubren también los cambios anteriores de compilación y respaldos en el mismo estado del worktree. No se creó ni publicó instalador y no se afirma RAM máxima global.

## Revisión adversarial

Se revisan permisos preservados, cambio de sesión/organización durante lectura, cleanup, StrictMode, agrupación sin perder la última invalidación, reintento tras error, navegación asíncrona a aulas y continuidad de voz sin foco. No se suspenden servicios main, capturas o tareas del agente por ocultar la ventana. No se elimina funcionalidad ni se recortan datos. Las pruebas de navegación esperan la importación fría en lugar de asumir carga síncrona.

## Objetivo de recursos limitados

El usuario aclaró que 4 GB/Pentium es una analogía de recursos muy limitados; no se necesita un equipo de ese modelo para cerrar esta entrega. Se validaron escenarios simulados de baja capacidad y trabajo redundante mediante fixtures. No se afirma un máximo universal de RAM ni fluidez de todas las tareas simultáneas. Videollamadas, páginas externas, OCR, transcripción/modelos locales y compilación tienen costes propios.

Protocolo reproducible adicional en cualquier host o entorno con recursos restringidos: usar build de producción; medir arranque frío y caliente, reposo 60 s, chat largo/streaming, avatar con voz, navegación entre proyectos/aula y una videollamada con los mismos medios. Registrar CPU, SO, RAM disponible, tiempos y memoria sumada de procesos con `--resource-diagnostics`. Comprobar edición, compartir, reuniones, voz y recuperación al volver; no inferir RAM total sólo por un chunk pequeño. El monitor es opt-in; no añade trabajo permanente si no se habilita.

Reversión: revertir únicamente los archivos de este cambio conservando la entrega anterior; sin migraciones, cambios de secretos, envíos ni respaldos reales.

La [continuación de conexiones y streaming](../../optimize-connection-and-stream-lifecycle/reports/verification.md) del mismo día volvió a verificar el estado acumulado con build y verify:pr completos aprobados, 7605 pruebas globales aprobadas.
