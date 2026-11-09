## Context

Ver propuesta. Los controladores ya reciben señales main; faltan comprobaciones
después de esperas y dentro de acciones con varias llamadas. Inicio y finalización
quedan parcialmente fuera de las protecciones de limpieza.

## Goals / Non-Goals

Evitar iniciar la siguiente etapa controlada al revocar y dejar el backend
disponible después de fallos. No prometer deshacer una llamada ya enviada,
aislamiento global de perfiles/cachés ni cancelación física del proveedor/SO.

## Decisions

- Guarda compartida pequeña con error de cancelación fijo en español; verificar
  antes/después de esperas, incluidas rutas de fallback. Un timeout artificial
  que libere plaza mientras hay I/O vivo se descarta.
- Señal interna en decisiones, capturas y acciones; conservar clientes/modelos
  existentes y comprobar revocación antes de cualquier intento alternativo.
- Tipos de servicio y SDK en las funciones intervenidas; sin supresiones,
  cambios de reglas o abstracción general de automatización.
- Inicio dentro de try y finalización dentro de try/finally de limpieza; retirar
  listeners y restablecer estado aunque un consumidor/finalizador falle.
- Finalizar trazas ya iniciadas es limpieza; una tarea cancelada no inicia una
  captura final adicional. Las capturas/artefactos previos conservan su política.

## Risks / Trade-offs

- I/O ya iniciado puede aplicarse → no reintentar tras revocar y no declararlo revertido.
- Un helper externo puede contener operaciones indivisibles → garantías sólo
  en las fronteras instrumentadas, no sobre todo el sistema operativo.
- Fallo del finalizador → propagar error y liberar estado/cola, sin inventar artefactos.

## Migration Plan

Respaldar delta frente al lote 45; pruebas causales y casos de cancelación,
éxito, fallback y limpieza. Una compuerta global y build aislado al cerrar.
Reversión sólo del delta con respaldos, sin reset ni cambios al índice ajeno.
Revisión independiente pendiente; no archivar.
