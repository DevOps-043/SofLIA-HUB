# Diagnóstico de apertura del estudio

Fecha: 2026-10-13. Síntoma: `Learning no autorizó esta operación` al abrir el aula desde Hub.

## Evidencia

Se consultó por POST `https://soflia.ai/api/auth/live/studio` con cuerpo vacío, primero sin bearer y después con un bearer de diagnóstico inválido, sin credenciales ni cookies reales. Ambas respuestas fueron `401 {"error":"UNAUTHENTICATED"}`.

Como control, catalog y workspace respondieron al mismo bearer inválido `401 {"error":"La sesión de Soflia Hub no es válida"}`. El primer mensaje pertenece al filtro de cookies de `api-route-auth.ts`; el segundo, al handler `verifiedHubUser`. En el checkout Learning la ruta studio y su excepción del filtro existen, pero continúan sin publicar. La migración remota también sigue pendiente; esta consulta no verifica su estado.

El diagnóstico confirma que studio en el despliegue consultado se intercepta antes del handler bearer. No demuestra un rechazo de membresía, asignación de curso o configuración Zoom, ni permite concluir si el bearer real del usuario sigue vigente.

## Corrección local

- Distinguir filtro web, sesión bearer vencida, permisos 403, ruta 404/405 y error de proveedor.
- Conservar lectura de error limitada a 4096 bytes y lista cerrada de mensajes visibles.
- Centrar estado de espera/error y restaurar botones de navegación con iconos; el texto anterior se comprimía en botones de 36 píxeles destinados a iconos.
- Pruebas negativas para clasificación, cuerpos grandes y contenido privado; regresión de navegación y ausencia de panel privilegiado sin autorización.
- La revisión independiente encontró que un 404 de sesión eliminada debía revocar el aula previa, distinto del 404 de ruta no publicada. Se corrigió y se agregaron regresiones HTTP y de desmontaje del iframe después de acceso válido.

No se publicó Learning ni se modificaron permisos, secretos, sesiones remotas o `.env`. Para resolver el acceso real se requiere el rollout descrito en `docs/operations/live-studio-runtime.md`.

## Verificación

La compuerta `npm run verify:pr` pasó con 4287 pruebas y una omitida antes de la corrección adicional del 404 de sesión eliminada. En el estado final se repitieron las pruebas afectadas: 6 HTTP y 6 UI correctas, además de `npm run typecheck`, `npm run lint:changed` (55 archivos sin deuda nueva), `npm run docs:check` (510 Markdown) y `git diff --check`, todos correctos. La revisión independiente confirmó que el hallazgo de revocación quedó resuelto y no encontró otros P1/P2.
