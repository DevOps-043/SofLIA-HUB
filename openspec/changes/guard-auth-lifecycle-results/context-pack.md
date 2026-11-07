# Contexto del cambio

- Objetivo: impedir que restauraciones o eventos Auth obsoletos publiquen estado o inicien pasos posteriores de recuperación Lia.
- Usuario o actor: persona cuya sesión cambia/cierra durante la inicialización, resolución de membresía o canje de conversaciones.
- Alcance: useAuthLifecycle, propagación de AbortSignal por useLiaSession y lia-session-exchange, pruebas de hooks/servicio con promesas controladas.
- No objetivos: arbitrar todos los intentos explícitos de login/SSO/reintento/signOut, revocar SDK/HTTP ya enviados, coordinación entre ventanas, RLS/JWT, UI o migraciones.
- Restricciones: conservar rama acumulativa codex/reduce-technical-debt y cambios existentes; otros worktrees sin tocar, sin stage/commit/push, secretos/.env, cuentas o red reales. No se archiva sin revisión independiente.
- Contratos afectados: cada operación del lifecycle tiene una señal privada; las funciones internas Lia admiten señal opcional conservando sus consumidores actuales. Main/preload/renderer, DTO y almacenamiento no cambian.
- Riesgo y HITL: autenticación de riesgo alto verificada con dobles y sin efectos remotos reales. Una señal es vigencia local, no credencial ni política de servidor.
- Criterios verificables: suscribir antes de leer; evento más reciente prevalece sobre lectura inicial, resultado/error/denegación antiguos; A/B/A invalida operaciones antiguas; desmontaje libera listener y cancela continuaciones; callback síncrono sin esperar SDK; cancelación detiene refresh/canje/OTP/reintentos/publicación todavía no iniciados y no degrada sesión nueva; éxito/degradación vigente permanecen compatibles.
- Incertidumbres: una operación SDK ya enviada puede persistir o producir efecto antes de observar cancelación; los demás productores Auth siguen pendientes de una revisión de ownership global. No confundir esta garantía acotada con cierre seguro completo.
