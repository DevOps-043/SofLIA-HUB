## Context

Ver propuesta y contexto. La generación usa un endpoint fijo del proveedor y admite cuerpo REST producido por el renderer; el límite actual cuenta caracteres y el error se refleja parcialmente saneado. La guarda común ya valida fuente/identidad y señales.

## Goals / Non-Goals

Servicio/handler/preload/wrapper coherentes sin duplicar autoridad ni quitar herramientas para pasar pruebas. No se resuelve custodia global de claves ni se acredita modelo/proveedor real.

## Decisions

- Snapshot JSON con profundidad 12, 20000 nodos, arrays hasta 1000, objetos hasta 200 claves y bytes UTF-8 antes de HTTP. Top-level cerrado y herramientas únicas vacías bajo política existente. generationConfig y partes REST conservan campos JSON extensibles dentro de cuotas; el proveedor valida su semántica.
- Servicio HTTP puro reutilizado main/web, header x-goog-api-key sin clave en URL, redirect error, respuesta objeto validada y lectura incremental. Errores fijos por clase/código; jamás adjuntar causas privadas a IPC/logs.
- Handler conserva trabajos por WebContents/frame/user/revisión e ID, una solicitud por emisor y cuatro transportes físicos. Cancelación y deadline devuelven pronto, pero la plaza se libera al terminar el transporte real. Sin cola ni reintento tras rechazo de autoridad/busy/cancelación.
- Preload tipado y canal cancelar; wrapper prefiere API tipada, admite invocación legacy sólo como transporte a los mismos canales y falla cerrado cuando hay superficie Electron. Fetch directo sólo fuera de ese entorno. Fuentes/partes como unknown comprobado, sin ampliar any.
- El cuerpo conserva code_execution sólo donde la política local supportsCodeExecutionCombo ya lo solicitaba. No se cambia esa política ni se declara compatibilidad nueva del proveedor.

## Risks / Trade-offs

- Un proveedor puede recibir datos antes de cancelar → no prometer revocación física externa; conservar señal y no publicar resultados tardíos.
- Transporte que ignora señales → plazas retenidas y rechazo busy, sin crecer trabajo en segundo plano.
- Cambio de versión con puente incompleto → fallo explícito en Electron, sin bypass; navegador independiente sigue funcionando.
- Claves aún presentes en renderer → deuda registrada, no se afirma custodia completa por mover HTTP.

## Migration Plan

Respaldos relativos contra unidad 40 y preservación del índice ajeno. Pruebas negativas previas, contratos/consumidores y una compuerta final con cobertura/build congelados. Sin datos/cuentas/secretos reales, GUI, stage/commit/push ni despliegue. Revertir sólo el delta; revisión independiente pendiente y no archivar.
