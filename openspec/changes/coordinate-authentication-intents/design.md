## Context

Ver [contexto](context-pack.md) y [propuesta](proposal.md). Cada productor comparte setters, pero sólo el lifecycle tiene cancelación local. El cierre espera red antes de limpiar y la publicación de no autenticado espera getSession. SSO pierde referencia de su operación al reclamar el callback; cancelar sólo borra una solicitud todavía no reclamada.

## Goals / Non-Goals

**Goals:** ownership común por AuthProvider, invalidación síncrona, mutaciones SDK ordenadas, cancelación propagada y resultados de UI vigentes.

**Non-Goals:** no arbitrar entre ventanas/equipos, cancelar HTTP que ya salió, cambiar RLS/JWT, perfil de identidad o contrato IPC. No identificar usuario desde preferencias o equivalencia supuesta perfil/UUID Auth.

## Decisions

- Coordinador privado estable, con señal de generación e intención explícita. Nueva intención aborta la señal anterior y revoca estado antes de la primera espera; cierre deja bloqueada la restauración espontánea hasta otro acceso explícito. Activación/cleanup soportan StrictMode y desmontaje.
- Cola compartida para operaciones que mutan SDK, incluyendo recuperación Lia. Un intento superado no comienza; la llamada ya enviada termina antes de empezar la nueva. No se ejecuta logout compensatorio contra una identidad posiblemente nueva. Un proveedor que no responde puede demorar la cola: no se libera artificialmente una llamada todavía viva.
- La cola tiene una operación activa y una pendiente; otra continuación sustituye la pendiente y resuelve la anterior como cancelada. Abort elimina referencias/listener de pendientes sin esperar al activo. Eventos emitidos mientras termina el escritor revocado no se atribuyen al dueño nuevo en espera.
- Durante una intención explícita se observan los eventos del SDK sin aplicar una segunda recuperación concurrente. SIGNED_OUT externo revoca el acceso; eventos propios SIGNED_IN/refresh no lo cancelan. Se compara el sujeto SDK observado con session.user.id al aceptar; no con el ID del perfil SOFIA. INITIAL_SESSION tardío no habilita un cierre intencional.
- Restauración, retry de directorio/conversaciones y publicación capturan señal común, además de la señal local de su consumidor. Revisan vigencia después de waits y antes de efectos; el directorio cancela también backoff. La cola no contiene esperas del navegador por interacción humana: cada etapa SSO reclama la cola cuando debe mutar sesión.
- SSO conserva una solicitud viva con fase reclamada y señal hasta terminar/cancelar. Correlación state y reclamación única permanecen. El cleanup elimina suscripción y referencias sin publicar errores tardíos.
- La revocación local tiene revisión propia en estado React para que la publicación main niegue acceso incluso durante loading intencional. El arranque sin intención conserva la regla de no emitir un false transitorio. Publicaciones positivas verifican señal y sujeto de la sesión SOFIA después de leer.
- Servicios SOFIA/SSO y utilidades de cancelación revisan señales antes/después de cada etapa. Errores obsoletos no imprimen datos ni se convierten en fallos de otra sesión.

## Risks / Trade-offs

- Eventos SDK propios no incluyen requestId → observar durante la intención, ordenar mutaciones y validar sujeto SDK del resultado; no afirmar correlación remota inexistente.
- I/O vivo no es cancelable universalmente → cola espera su resultado físico. Señales cortan etapas posteriores; SDK y servidor mantienen sus permisos.
- Más consumidores que el lifecycle → probar AuthProvider completo y adaptadores de servicio, incluyendo propios eventos, cierre, errores y SSO cancelado tras reclamar retorno.
- Publicación main asíncrona → conservar protección de revisión existente en handler; no abrir otra superficie ni cambiar payload/canales.
- Worktree acumulativo → respaldar archivos antes de editar, delta contra unidad 34 y fuentes congeladas para gate/build; no mover ni limpiar cambios existentes.

## Migration Plan

Sin datos o dependencias nuevos. Introducir regresiones observables primero, integrar coordinador y todos sus productores, comprobar servicios/consumidores, documentar límites y ejecutar gate/build congelados. Rollback selectivo de hunks de esta unidad con respaldos; no reset global. Sin archivo antes de revisión independiente.
