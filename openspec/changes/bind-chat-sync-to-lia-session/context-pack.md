# Contexto del cambio

- Objetivo: vincular cada lote de sync al sujeto y ciclo observados de la sesión Lia del SDK, sin usar un ID recibido como prueba de sesión.
- Usuario o actor: persona que cambia/cierra sesión mientras hay trabajo del chat esperando red o turno.
- Alcance: revisión efímera de sesión del coordinador y revalidaciones de la pasada; contratos de SDK y consumidores con sesiones ficticias explícitas.
- No objetivos: sustituir RLS/verificación JWT, rediseñar login/SSO/signOut, cancelar físicamente I/O, resolver concurrencia entre dispositivos ni revisar UI bloqueada.
- Restricciones: rama acumulativa y 453 entradas dirty, otros worktrees preservados, sin stage/commit/push/despliegue/SQL/.env/secretos, sin cuentas/SDK de producción ni escrituras reales.
- Contratos afectados: firma pública/DTO/formato local sin cambios; una revisión por coordinador vivo, liberada al quedar ocioso. Las solicitudes revocadas conservan datos pendientes para una solicitud nueva válida.
- Riesgo y HITL: Auth y servicios sustituidos por promesas/eventos controlados; sin red o cuentas reales. El gate local nunca concede permisos de servidor ni usa preferencias como autoridad.
- Criterios verificables: no efectuar sin sesión coincidente o ante error; detectar cambio/cierre y A/B/A; no reconocer/publicar después de revocación; no fusionar lotes de ciclos distintos; permitir refresh/eventos repetidos de misma identidad; lectura inicial tardía no sustituye un evento más reciente; liberar listener y progresar con solicitud nueva.
- Incertidumbres: getSession refleja estado del SDK/almacenamiento, no certifica autenticidad del JWT. I/O ya enviado puede tener efecto; el cierre seguro global de sesión y la coordinación entre equipos mantienen su propio contrato.
