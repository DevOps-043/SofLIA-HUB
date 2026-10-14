# Operación del estudio síncrono

Estado: preparación local, pendiente de publicación y prueba real. Actualizado: 2026-10-13.

<!-- evidence: electron/main/zoom-protocol.ts -->
<!-- evidence: packages/zoom-runtime/package-lock.json -->
<!-- evidence: scripts/quality/smoke-zoom-runtime.mjs -->
<!-- evidence: openspec/changes/implement-live-studio-runtime/tasks.md -->

El backend vive en el repositorio SofLIA-Learning, rama `codex/live-studio-runtime`. Su migración es `supabase/migrations/20261012193000_live_studio_runtime.sql`; API, dominio, assets y firma están en `apps/web/src/features/live/studio*.ts` y `live-studio*.ts`. El checkout de esta sesión está en `C:/Users/FerSG/Desktop/Soflia/SofLIA-Learning/SofLIA-Learning`. No se aplicó SQL remoto ni se publicó Learning.

## Prueba local de ambos paneles

Ejecutar `npx vite --config test/manual/live-studio-runtime/vite.config.mts`. Abrir `http://127.0.0.1:4321/?actor=instructor` y `http://127.0.0.1:4321/?actor=alumno` en pestañas separadas. La fixture usa el mismo dominio y componentes con identidades explícitas de prueba, estado en memoria y notificaciones SSE. Sirve para probar interacción entre paneles sin credenciales; reiniciar el servidor elimina su estado. Solo escucha loopback y no se incluye en el empaquetado. No reemplaza el backend, RLS ni Realtime Supabase, y rechaza ingreso Zoom real.

## Orden de preparación

1. Revisar y aplicar en staging la migración después de las migraciones existentes de sesiones y aula colaborativa. Crea cuatro tablas privadas, RPC transaccional, RLS de revisiones y bucket privado; no modifica el contrato anterior ni borra datos durante instalación. Verificar publicación `supabase_realtime` de revisiones.
2. Configurar en Learning `ZOOM_MEETING_SDK_CLIENT_ID` y `ZOOM_MEETING_SDK_CLIENT_SECRET` de una app Meeting SDK perteneciente a la cuenta maestra DevOps. Son distintas de las tres credenciales OAuth Server-to-Server que programan reuniones. Conservar las credenciales maestras existentes. Obtener ZAK del anfitrión requiere el permiso correspondiente de la API Zoom. Usar el host vinculado a la sesión, nunca el correo elegido en UI.
3. Publicar el endpoint bearer exacto `/api/auth/live/studio`, su exclusión del filtro de cookies y presupuesto `live-access`. No exponer secretos con prefijo VITE o NEXT_PUBLIC.
4. Construir Hub; `npm run zoom:build` instala el lockfile aislado con `--ignore-scripts`, comprueba tipos y compila assets. `npm run audit:supply-chain` incluye el lockfile SDK. Ejecutar el smoke nativo, luego comprobar ingreso real de instructor y alumno, sin abrir navegador externo.
5. Ejecutar pruebas de chat, moderación, revocación, reconexión, salas académicas, carga de archivos, quizzes, prácticas, reloj y escenas con dos cuentas asignadas. La prueba local SSE no sustituye el ensayo Supabase/Zoom.

Un `401` con `{error:"UNAUTHENTICATED"}` indica que el filtro web intercepta la petición antes de comprobar el bearer del Hub. La ruta studio y su excepción exacta en el proxy deben publicarse juntas. Hub lo presenta como integración no habilitada; un 401 del handler bearer requiere renovar la sesión, mientras que un 403 conserva el diagnóstico de permisos. Abrir sesión en Chrome no sustituye ese contrato de autenticación.

Un 404 con «Sesión no encontrada» procede del handler y revoca el aula/grant previo. Se distingue del 404 de una ruta ausente; este último se presenta como integración no disponible.

No se requieren credenciales SDK por instructor mientras las reuniones pertenezcan a la cuenta Zoom maestra. La firma con rol anfitrión requiere ZAK; una cuenta sin permiso/licencia de webinar no adquiere esa licencia al configurar el SDK. Referencia oficial: [autenticación Meeting SDK](https://developers.zoom.us/docs/meeting-sdk/auth/).

## Retención y barreras de rollout

`live_studio_purge`, invocado por el job existente de retención, limpia ledger después de siete días y estado de sesiones cerradas al superar la retención de organización (30 días por defecto). El job reclama hasta 100 archivos por ejecución, borra bytes mediante Storage API y confirma su ledger. Archivos retirados o subidas sin publicar tienen 24 horas de gracia; material de sesiones cerradas sigue la retención de organización. El bloqueo de sesión y el estado purging impiden publicar un archivo reclamado. Si Storage falla se conserva la reclamación para reintento. Programar y verificar el job en staging antes del rollout general.

También quedan por implementar publicación automática desde Engine, composición de escenas sobre la transmisión y correlación/traslado de salas audiovisuales Zoom. La UI identifica salas académicas y medios locales para no presentar estas rutas como completadas. SofLIA automática permanece deshabilitada.

El tipo de dato limita 500 presencias; no hay evidencia de carga para esa capacidad. El lease no genera invalidación cuando solo cambia su fecha, y se debe ensayar tráfico agregado, rate limit y tamaño de estado en staging antes de abrir grupos grandes.

Rollback operativo: volver al Hub anterior y retirar la ruta studio del despliegue Learning, conservando tablas/bucket para recuperación. No ejecutar DROP ni purgar Storage como rollback. Para volver a activar, restaurar endpoint y cliente compatibles con la misma versión de contrato.

La autorización humana es necesaria antes de aplicar migración remota o modificar permisos/secretos de producción. Ningún archivo local `.env` ni secreto se modificó en esta fase.
