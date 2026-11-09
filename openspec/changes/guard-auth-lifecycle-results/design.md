## Context

Ver [propuesta](proposal.md) y [contexto](context-pack.md). useAuthLifecycle inicia getSession antes de suscribir y sus continuaciones no tienen ownership. useLiaSession y lia-session-exchange también esperan I/O y comienzan efectos siguientes sin vigencia. Los intentos explícitos de login/SSO siguen siendo otros productores del estado.

## Goals / Non-Goals

**Goals:** vincular restauración/eventos y sus continuaciones Lia a una operación cancelable, con limpieza al desmontar y diagnóstico estático de fallos vigentes.

**Non-Goals:** no convertir una señal local en autoridad de sesión ni prometer cancelación física. No rediseñar todos los productores Auth en una sola unidad.

## Decisions

- Un AbortController por operación del efecto; evento posterior aborta el anterior y desmontaje aborta antes de unsubscribe. Una bandera de evento observado impide que INITIAL_SESSION tardío sustituya eventos nuevos. Suscripción antes de lectura evita la ventana inicial. Callback síncrono; la resolución asíncrona se agenda fuera del callback y captura la señal.
- Al cambiar de sujeto SOFIA se limpia el estado previo y se activa carga antes de resolver la identidad nueva; un refresh del mismo sujeto no vacía la interfaz. Cada evento de restauración puede reemplazar trabajo anterior sin revalidar operaciones antiguas A/B/A.
- AbortSignal opcional en funciones privadas de Lia conserva consumidores actuales y usa el contrato estándar de cancelación. Se comprueba antes/después de awaits y antes de efectos siguientes, incluyendo OTP, signOut por correo incorrecto y espera de retry. La espera elimina su listener al terminar/cancelar.
- Errores de operaciones obsoletas se descartan. Errores vigentes no imprimen mensajes libres ni tokens. El perfil se sincroniza una vez por recuperación aceptada, manejando rechazos asíncronos.
- Se descarta usar preferencias como autoridad, un simple booleano mounted (no detecta A/B/A), o un guard sólo exterior que permita al canje iniciar OTP tras revocarse.

## Risks / Trade-offs

- SDK ya enviado puede persistir sesión aunque se descarte su respuesta → documentar límite, no ejecutar signOut compensatorio que pueda cerrar otra identidad.
- Otros productores login/SSO/reintento pueden competir → dejar límite explícito; no declarar cierre global resuelto.
- Supabase emite eventos repetidos → probar refresh y último evento vigente, bootstrap síncrono, StrictMode y limpieza.
- Cambios acumulativos ajenos → mantener rama actual, respaldar fuentes afectadas y verificar delta contra manifiesto anterior. Sin concurrencia física ni otros worktrees.

## Migration Plan

Sin migración de datos ni dependencias. Pruebas de regresión antes de implementación; pruebas de hooks/servicio/consumidores, gate PR y build aislado con fuentes congeladas. Rollback sólo de los archivos y hunks de esta unidad usando sus respaldos, sin restaurar toda la rama. No archivar sin revisión independiente.
