## Context

Ver propuesta y Context Pack. La API pública recibe dataUserId Lia. RLS sigue
siendo autoridad del servidor; el gate local sólo evita continuar trabajo bajo
otra identidad del SDK. La unidad anterior ya protege contenido/scopes/cache.

## Goals / Non-Goals

**Goals:** impedir efectos nuevos, reconocimiento y publicación de un lote
cuando pierde su sesión observada; conservar pendientes y liberar recursos.

**Non-Goals:** certificar JWT, sustituir RLS, rehacer AuthContext/login/SSO,
detener físicamente I/O enviado, ordenar otros renderers o usar preferencias
como prueba de sesión. El botón de salir y la revocación global del proveedor
conservan su propia implementación; se reacciona a los cambios observados del SDK.

## Decisions

- Revisión privada por coordinador vivo: suscribir Auth antes de leer sesión,
  guardar sólo sujeto y ciclo en memoria y liberar listener al quedar ocioso.
  Sin suscripción global permanente ni nueva lectura por cada autosave fusionado.
- getSession y eventos corresponden al cliente Lia existente. Su resultado se
  compara con el ID solicitado, sin inspeccionar/persistir tokens. La lectura
  inicial no puede reemplazar un evento posterior; tampoco un INITIAL_SESSION
  tardío reemplaza eventos ya observados. Error/servicio ausente falla cerrado.
- Cambios de sujeto y SIGNED_OUT avanzan ciclo. A/B/A no revive un lote previo.
  TOKEN_REFRESHED y SIGNED_IN repetidos de la misma identidad no lo revocan:
  esos eventos no demuestran por sí solos un cambio de cuenta. El callback es
  síncrono y no llama otros métodos Auth desde su notificación.
- Cada lote captura ciclo y revalida antes de la pasada, antes de invocar cada
  operación remota y después de esperarla. Revocación termina la pasada sin
  reconocer/publicar. Lotes de ciclos distintos no se fusionan; la solicitud
  pendiente anterior se resuelve sin efectos y los datos persistidos quedan
  disponibles para una solicitud nueva válida. Se conserva una sola pendiente.
- La cola física de la misma identidad se conserva hasta terminar I/O anterior,
  aunque cambie su ciclo. Una solicitud nueva del usuario que volvió espera ese
  I/O y usa su revisión nueva; no hay dos escritores locales de ese ID.
- Diagnóstico de error/limpieza es estático. Cierre local de la revisión primero,
  luego unsubscribe; su fallo no bloquea liberar el coordinador ni revivir leases.

Referencias primarias: [eventos Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
y [getSession](https://supabase.com/docs/reference/javascript/auth-getsession).
getSession carga estado del almacenamiento del SDK; no es verificación remota
de identidad. La comprobación de JWT y permisos se mantiene en el servidor.

## Risks / Trade-offs

I/O ya enviado → puede producir efecto; su resultado revocado no se publica.
Eventos no recibidos/otras ventanas → garantía limitada al cliente observado,
sin sustituir políticas de servidor. Sesión ausente/fallo → cola conservada para
un intento nuevo, sin fallback permisivo. Preferencias/SOFIA alias → no son
autoridad Lia. Callers concurrentes de ciclos distintos → probar sustitución y
promesas resueltas, manteniendo orden físico y límites de memoria previos.

## Migration Plan

Regresiones con SDK ficticio explícito; revisión/coordinador/pasada; consumidores
con contexto de sesión realista, docs y gate/build congelados. No hay migración
de datos ni permisos. Recuperación conserva firma/formato y corrige el vínculo
de sesión con esos contratos, sin deshacer unidades anteriores. Revisión
independiente pendiente antes de archivar.
