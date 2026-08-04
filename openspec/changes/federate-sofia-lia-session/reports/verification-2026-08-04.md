# Evidencia de verificación y revisión adversarial

Fecha: 2026-08-04.

## Resultado

La implementación local elimina el uso de la contraseña SOFIA en Lia y sustituye la segunda autenticación por un intercambio backend de token de un solo uso. No se configuraron secretos, no se desplegó la función y no se publicó el cliente.

## Pruebas observables

| Caso | Evidencia |
|---|---|
| Dos intentos SOFIA inválidos no invocan Lia; el tercero válido intercambia sesión | AUTH-024 |
| Denegación secundaria conserva la sesión principal y usa mensaje simple | AUTH-025, AUTH-006 |
| Reintento manual recupera sin contraseña | AUTH-026 |
| Sesión persistida de otra identidad se cierra localmente | AUTH-027 |
| Restauración al arrancar obtiene el JWT SOFIA e intercambia automáticamente | AUTH-028 |
| Bearer ausente/inválido no ejecuta operaciones administrativas | AUTH-029, AUTH-030 |
| Membresía inactiva se niega antes de generar acceso | AUTH-031 |
| Respuesta exitosa contiene solo `tokenHash` para el correo verificado | AUTH-032 |
| Correo operativo distinto se rechaza | AUTH-033, AUTH-036 |
| Correo SOFIA no confirmado se rechaza antes de consultar/generar | AUTH-034 |
| Fallo 5xx se reintenta de forma acotada | AUTH-035 |
| UI no menciona Lia, Supabase, tokens, credenciales ni contraseñas | UI-068 a UI-070 |

## Compuertas ejecutadas

- `npm run build:app`: pasa renderer, main y preload; conserva advertencias preexistentes de tamaño/chunks.
- `npm run typecheck`: pasa.
- Vitest focalizado: 25/25 pruebas pasan en 3 archivos.
- ESLint focalizado con `--max-warnings=0`: pasa.
- Empaquetado estático de la Edge Function con esbuild: pasa; el artefacto temporal fue eliminado.
- `npm run docs:check`: pasa, 132 Markdown activos.
- `openspec validate --all --strict`: pasa, 8 cambios.
- `npm run harness:validate`: pasa, 25 rutas y 8 skills.
- `git diff --check` del alcance: pasa; solo informa normalización futura LF→CRLF.
- Escaneo estático de logs/persistencia: no encuentra tokens, contraseñas o correos registrados/persistidos; la mención de `service_role` existe únicamente en backend/documentación.

## Compuertas bloqueadas por baseline/entorno

- `npm run test` no pudo iniciar porque Windows mantiene bloqueado `node_modules/better-sqlite3/build/Release/better_sqlite3.node` (`EBUSY`/`EPERM`). No se cerraron procesos del usuario para forzarlo.
- `npm run docs:system:check` falla por dos inventarios preexistentes: catálogo IPC distinto de 273 canales e inventario de pruebas esperado de 286 archivos (238 main, 48 renderer).
- El worktree contiene numerosos cambios ajenos; no se ejecutó una compuerta global de lint sobre ese alcance ni se alteraron esos archivos.

## Revisión adversarial

Se intentó refutar el diseño con token ausente/malformado, identidad inválida, correo no confirmado, membresía inactiva, correo operativo ajeno, sesión persistida ajena, 5xx, respuesta parcial, fuga en logs y exposición de clave administrativa.

Hallazgos corregidos durante la revisión:

1. El primer borrador aceptaba cualquier correo presente en un JWT válido. Se agregó la exigencia de `email_confirmed_at/confirmed_at` y AUTH-034.
2. El primer borrador convertía cualquier error de `sofia.auth.getUser` en 401. Ahora solo 401/403 son denegación; una caída del proveedor lanza 503 y permite reintento.
3. Se agregó rechazo y revocación local si `verifyOtp` devuelve una sesión de otro correo (AUTH-036).

Riesgos residuales que impiden afirmar producción completa:

- Debe reconciliarse que los correos piloto pertenezcan a la misma persona en ambos proyectos; la coincidencia histórica de correo es el vínculo para conservar UUID Lia.
- La función debe desplegarse con `verify_jwt = false`; de lo contrario el gateway Lia rechazará el JWT SOFIA antes del handler.
- Los secretos y el despliegue remoto requieren HITL, prueba real y observabilidad agregada sin PII.

## Reversión

Deshabilitar la función y volver al cliente anterior. No hay migración SQL, cambio de UUID ni mutación remota que revertir en este trabajo local. El flujo anterior de doble contraseña no debe considerarse una solución permanente.
