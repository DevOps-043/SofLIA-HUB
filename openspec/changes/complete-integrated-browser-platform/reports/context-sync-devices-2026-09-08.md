# Contexto: transporte y dispositivos de sync

- Objetivo: avanzar 7.3, 7.5 y 7.6 usando cifrado, esquema SQL y conflictos existentes.
- Actor: titular de perfil autenticado; renderer principal solicita, main confirma y Auth/RLS autorizan.
- Alcance: transporte cerrado para Auth/dispositivos/envelopes, reintentos y cancelación; identidad aleatoria protegida por el SO; registro/listado/revocación con confirmación nativa; cuatro IPC y panel visible.
- No objetivos: aplicar SQL remoto, activar flags, crear login, sincronizar contraseñas, registrar sin consentimiento o declarar completo el cliente selectivo.
- Restricciones: sesión Lia no anónima, HTTPS configurado, sin service_role, hostname, MAC ni claves E2EE en servidor; tokens no salen de main. Cancelar no revierte una escritura ya recibida.
- Contratos: `sync-remote.ts`, `sync-auth.ts`, `sync-device-identity.ts`, `sync-devices.ts`; servicio/handler/preload/wrapper/panel; `profileRevision` numérica invalida paneles sin publicar identidad. SQL 7.1 no cambia.
- Riesgo/HITL: registro/revocación con diálogo nativo, cancelar por omisión y contexto vigente sin agente controlando. ID persistido antes del registro para reintentar sin duplicarlo; revocar no borra copias descargadas.
- Criterios: apagado/efímero sin red; Auth ajena/anónima rechazada; 403 sin retry; cuerpo/idempotencia conservados; lectura/tiempo acotados; decisión cancelada/tardía sin mutación; corrupción conservada; marco/payload cerrados; respuestas obsoletas ignoradas.
- Incertidumbres: migración no desplegada; Auth/PostgREST/refresh reales pendientes en staging. Adaptadores locales, checkpoints, categorías, recuperación y UI de conflictos faltan en 7.3/7.6.

La inspección confirmó `stripIncomingSignal: true` en el cliente genérico. Sync
usa fetch directo acotado sin cambiar esa configuración global. `getSession`
proporciona el token, no acredita autorización; se contrasta con Auth.
Referencias oficiales: [getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
y [rutas REST](https://supabase.com/docs/guides/api/creating-routes).
