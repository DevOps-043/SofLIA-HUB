## Why

Los planes de organización se guardan sin propietario en JSON común y el ID recibido forma parte de una ruta sin validar. Apply/undo sólo persisten al final y devuelven cero cambios ante errores aunque Gmail ya haya mutado parte del buzón.

## What Changes

- Custodia cifrada por usuario y cuenta Google, IDs cerrados y proyección mínima de datos persistidos.
- Preparación, aplicación y reversión vinculadas a sesión/conexión; tres canales con schemas cerrados y HITL de mutaciones en main.
- Checkpoints antes de cada efecto, conteos confirmados e incertidumbre visible; impedir replay de operaciones incompletas y hacer idempotentes las terminadas.
- Undo verifica las etiquetas actuales antes de invertir cambios y conserva etiquetas creadas que ahora contienen mensajes ajenos al plan.
- Compartir primitivas de cifrado/archivos privados con calendario, conservando su contrato y smoke nativo.
- Propagar cancelación del caller al diálogo y SDK, acotar solicitudes/ejecución y desactivar retry. Aplicar la misma señal al envío Gmail y a las confirmaciones de calendario porque comparten la frontera de autorización.

## Capabilities

### New Capabilities
- `gmail-organization-custody`: planes privados, ejecución trazable y resultado parcial explícito de organización del buzón.

### Modified Capabilities
Ninguna. El envío Gmail y los demás canales conservan contratos; los planes heredados sin dueño quedan fuera de ejecución automática.

## Impact

Store y módulos de planes Gmail, primitivas privadas compartidas con calendario, handlers/preload/wrapper/tipos y pruebas/documentación. Sin dependencias nuevas, canales o permisos remotos. Se conservan archivos heredados sin leerlos ni migrarlos a una cuenta por inferencia. No se ejecutan operaciones reales de correo.
