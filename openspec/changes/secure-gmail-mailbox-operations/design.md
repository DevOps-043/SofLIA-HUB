## Context

Ver propuesta y Context Pack. El servicio público conserva operaciones de mensajes, etiquetas, planes y envío. El contexto de planes ya resuelve owner/cliente/guardas; se extraerá su parte de ejecución para compartirla sin dar a las operaciones directas acceso al diario.

## Goals / Non-Goals

**Goals:** nueve canales con entradas/salidas tipadas y autorización; mutaciones confirmadas, acotadas y observables, con resultados parciales reales.

**Non-Goals:** transacción Gmail/disco, diario general o replay tras crash, nuevas herramientas runtime, nuevos permisos ni llamadas reales al proveedor.

## Decisions

- Extraer ejecución de cuenta desde plan-context conservando exports/semántica de planes. Compartir cliente capturado, guardas, señal, solicitud de hasta 15 segundos sin retry y presupuesto de trabajo de 90 segundos. Lecturas usan contexto pero no exclusión; mutaciones comparten la exclusión por cuenta con planes.
- Esquemas/DTO en src/shared/gmail-mailbox.ts; no ampliar any en límites. Conservar firmas posicionales añadiendo autorización interna opcional; runtime mantiene HITL previo y main exige confirmación nativa para los seis canales de escritura. Retirar el resolver con efectos implícitos y sin consumidores externos; preparar referencias de etiquetas antes de crear ninguna.
- Validar todas las referencias antes de efectos; etiquetas a quitar desconocidas o ambiguas se rechazan, sin ignorarlas. La confirmación enumera las etiquetas que se crearán. Rechazar añadir y quitar la misma etiqueta y borrar etiquetas de sistema. Operaciones masivas resuelven IDs contra la cuenta actual.
- Una etiqueta de sistema puede ser origen de un lote con opciones coherentes (por ejemplo, quitar INBOX para archivar); la restricción a etiquetas de usuario corresponde al borrado de etiquetas, no a modificar sus mensajes. Se verifica explícitamente esa compatibilidad.
- Preparar un snapshot de IDs de todas las páginas antes de modificar; detectar páginas/tokens/IDs repetidos. Hasta 50000 mensajes por operación (mismo orden del tope de vaciado anterior), lotes de 100, y 100 etiquetas en limpieza completa. Una preparación excesiva falla antes de efectos; no truncar silenciosamente. Los valores se documentan como políticas locales, no límites del proveedor.
- Aplicar sólo al snapshot; mensajes nuevos quedan fuera. Verificar que origen esté vacío antes de eliminar y declarar conflicto si no lo está. La selección evita el bucle de primera página cuando no se quita origen. No se adoptan reintentos automáticos de mutaciones.
- Registrar en memoria cada efecto confirmado para responder con conteos/etiquetas creadas y flags partial/uncertain/recoveryRequired al fallar; detener el resto ante error. Cleanup no devuelve success:true con errores. remaining es desconocido si no pudo comprobarse, no un cero inventado. El total histórico de mensajes movidos cuenta membresías procesadas por etiqueta; se explicita su semántica.
- Lecturas validan opciones/ID antes de adquirir cliente y rechazan detalles incompletos cuando correspondan. La respuesta posterior a cambio de actor no expone contenido del buzón anterior. Logs y errores omiten payload y errores crudos.

## Risks / Trade-offs

- Falta transacción/CAS → snapshot + comprobación antes de borrar y resultado explícito; persiste carrera externa.
- Proceso cerrado pierde conteos directos → no ofrecer replay/reanudación ni éxito durable; revisar Gmail antes de repetir. Los planes mantienen su diario separado.
- Nuevos mensajes durante la operación → no ampliar el alcance aprobado; no borrar etiqueta no vacía y reportar operación incompleta.
- Cuotas/tiempo → fallar preparación antes de mutar y conservar avances si vence tras efectos. La confirmación tiene 120 segundos propios; renovar presupuesto después de aprobar evita consumirlo esperando al usuario.
- Extracción del contexto → regresiones de planes/envío/calendario, SDK simulado y build aislado antes de entrega.

## Migration Plan

Sin datos nuevos ni SQL/dependencias/canales. Mantener capas y wrappers. Verificar baseline, casos adversariales, SDK real con fetch simulado, typecheck/lint, smoke nativo compartido, build y verify:pr. Revertir esta unidad conserva diarios de planes y cambios anteriores; no revierte efectos de Gmail. Revisión independiente pendiente antes de archivar.
