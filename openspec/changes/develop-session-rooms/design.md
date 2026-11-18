## Context

Learning persiste Studio como JSON bajo CAS, idempotencia y autorización. Hub consume copias generadas. Video SDK sincroniza asignaciones por identidad firmada. El manifiesto v1 solo contiene prácticas con título e instrucciones.

## Goals / Non-Goals

Preparar toda la experiencia operativa de salas sobre esa infraestructura. Mantener la autoría en Architect y permitir ajustes explícitos del instructor. No desplegar ni producir una integración Architect inexistente.

## Decisions

- Añadir `collaboration` opcional a las prácticas: modalidad individual/equipos y tamaño aproximado. Ausente significa sin propuesta, sin inferir trabajo en equipo.
- Las salas abiertas guardan `room_activity` con ID de práctica y configuración efectiva. El instructor puede ajustar tamaño/cantidad antes de abrir y reasignar después. Abrir no equivale a trasladar automáticamente a un participante.
- Ampliación negociada mediante `X-Soflia-Studio-Rooms: 1` y `rooms_version: 1` en snapshot. Los clientes anteriores reciben prácticas y salas en su forma anterior; clientes nuevos deshabilitan operaciones nuevas frente a servidores antiguos.
- Solo comandos administrativos nuevos; permisos SQL existentes ya rechazan estos comandos para participantes. No cambian políticas/tablas/funciones SQL. La validación de negocio se hace en el dominio servidor y persiste con el commit existente.
- Asignar usuarios conectados o previamente asignados y no bloqueados; nunca instructores. Reasignar a quien está dentro lo devuelve académicamente al grupo principal; el plan audiovisual compensa la pertenencia anterior.
- Instrucciones y entregas siguen siendo las prácticas autorizadas. La actividad de sala no convierte entregas personales en entregas de equipo.
- El iframe audiovisual permanece montado al abrir gestión o cambiar de actividad para no perder la llamada.

## Risks / Trade-offs

El despliegue de Learning debe preceder a Hub. Servidores anteriores no permiten abrir por actividad ni asignar manualmente. El productor Architect debe adoptar el campo opcional; se valida recepción pero no se afirma que ya lo envíe. Una cuenta real sigue siendo necesaria para verificar movimiento de audio y video.

Video SDK no ofrece desasignación directa en la API instalada. Volver al principal
puede conservar la invitación anterior. El bridge expone `assignment_revocation`
y el panel pide cerrar y reabrir salas; no declara sincronización `ready` en ese
estado. Esta recuperación es explícita para no reunir a todos silenciosamente.

## Migration Plan

Publicar API Learning y después Hub; sin migraciones. Revertir cliente primero y después servidor mientras no existan estados ampliados, o conservar el lector ampliado. No ejecutar un servidor antiguo strict contra estados ampliados sin retirar los campos y metadatos primero.
