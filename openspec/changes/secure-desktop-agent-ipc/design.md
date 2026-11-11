## Context

Ver propuesta/context-pack. Las seis familias de handlers comparten servicio
pero no fuente ni contratos. Los DTO puros de unidad 38 ya existen.

## Goals / Non-Goals

Cerrar la frontera nativa sin retirar operaciones ni ampliar allowlist. Señales
main quedan fuera de los DTO. No certificar toda la ejecución interna, sus
eventos/memoria entre cuentas ni drivers frente a otros procesos del equipo.

## Decisions

- Registrar handlers con schema por nombre y trustedAppCaller compartido. Evitar
  casts de primitivas never[] y un objeto universal permisivo. Getters de ventanas
  desde startup; ausencia de ventanas deniega, sin fallback a cualquier emisor.
- Lecturas raw status/config rechazan con error fijo; otros canales conservan
  respuesta success/error. No reflejar excepciones privadas. Outcomes válidos
  conservan contenido del servicio y no se certifican como redactados.
- Un trabajo con efectos por emisor y cuatro globales, sin cola de IPC; lecturas
  y controles tienen cuotas separadas. Abort/stop autorizados no esperan HITL
  ni una plaza ocupada por la tarea que deben detener.
- HITL nativo ligado al snapshot. Config/perfil/entrada/foco/calibración y tareas
  requieren aprobación; tareas pueden producir efectos externos. Se preservan
  guardas internas existentes. No permiso durable desde renderer.
- Propagar AbortSignal interno en tareas y cada paralelo. Observación retiene
  lease hasta stop y revisa su generación tras cada await, evitando acción tardía
  y finally que modifique una observación nueva.
- Teclado usa tokens cerrados antes de driver/PowerShell, y texto separado de
  opciones xdotool. Conservar teclas/aliases y clipboard con restauración cuidadosa.
- Configuración cerrada y acotada, guardado atómico sin fallback a cwd y publicación
  tras éxito. Carga conserva campos válidos y sustituye valores inválidos por defaults.

## Risks / Trade-offs

- Confirmar tarea no certifica todos sus pasos → preservar HITL interno y registrar
  límites de proveedores/acciones ya admitidos; no prometer rollback.
- Datos/eventos globales de otros productores → no atribuir ownership a esta
  frontera; documentar trabajo pendiente en memoria/caches y eventos runtime.
- Proveedor físico pendiente → retener plaza, sin reemplazarlo por una cola infinita.
- Clientes viejos pueden mostrar doble diálogo → capability opcional del preload
  actual evita sólo duplicado del renderer, nunca revisión main.
- Observación no revierte I/O ya enviado; abort impide siguientes etapas si el
  proveedor respeta señal o devuelve control.

## Migration Plan

Main/preload/renderer se actualizan juntos, sin canales ni dependencias nuevos.
Respaldos relativos TEMP frente a unidad 43; no tocar índice ajeno. Pruebas
causales/dominio/integración, compuerta global/cobertura y build aislado. Revisión
independiente pendiente antes de archivar; no se ejecuta GUI real.
