# Verificación de compatibilidad para cuentas migradas

Fecha: 2026-08-05.

## Resultado

Se reprodujo en el núcleo del intercambio que una identidad autenticada sin
`email_confirmed_at` era rechazada antes de comprobar membresía. La captura no
permite confirmar por sí sola que ese sea el dato productivo del usuario; la
sección 2B de `database/sofia-learning/migrations/auth-supabase-hub.sql` permite
confirmar o descartar esa hipótesis mediante una consulta de solo lectura.

La función acepta ahora evidencia legada únicamente cuando `public.users`
presenta el mismo UUID y correo normalizado del sujeto autenticado, además de
`email_verified = true` y `email_verified_at` presente. No se acepta correo del
cliente, `user_metadata`, coincidencia con otro UUID ni evidencia parcial.

No se ejecutó SQL remoto, no se configuraron secretos y no se desplegó la Edge
Function.

## Evidencia ejecutada

- Regresión antes del arreglo: AUTH-037 falló porque la ruta legada no existía.
- Núcleo final: 10/10 pruebas pasan, incluidos AUTH-037 a AUTH-040.
- `AuthContext`: 16/16 pruebas pasan.
- Suite completa: 139 archivos y 1194 pruebas pasan; el script restauró
  `better-sqlite3` para la ABI de Electron.
- `npm run typecheck`: pasa.
- `npm run lint:changed`: pasa, 3 archivos sin deuda nueva.
- `npm run docs:check`: pasa, 150 Markdown activos.
- `npm run harness:validate`: pasa, 25 rutas y 8 skills canónicas.
- `npm run openspec:validate`: pasa, 10 cambios.
- Empaquetado estático de `sofia-session-exchange` con esbuild: pasa.
- `git diff --check`: pasa; solo informa normalización futura LF a CRLF.

## Compuerta de PR

`npm run verify:pr` se detuvo en `docs:system:check` por una deuda presente en
`main`: el documento registra 314 archivos de prueba (247 main, 67 renderer),
pero el validador cuenta 315 (247 main, 68 renderer). Este cambio modifica una
prueba existente y no crea archivos de prueba. Las compuertas posteriores del
gate se ejecutaron de forma explícita según la evidencia anterior.

## Revisión adversarial

Se intentó refutar el arreglo con token ausente, correo sin confirmar, UUID
distinto, correo distinto, booleano falso, fecha ausente, error/RLS al leer el
perfil legado, membresía inactiva y acceso operativo para otro correo.

Hallazgos corregidos durante la revisión:

1. La consulta de soporte unía por correo y por ello no podía detectar una
   divergencia de correo del mismo UUID. Ahora compara el perfil por UUID y usa
   una segunda coincidencia solo para clasificar posibles UUID migrados.
2. La guía presentaba la causa productiva como confirmada sin logs ni consulta
   real. Ahora la clasifica como hipótesis reproducida que debe verificarse.
3. Se comprobó que una identidad ya confirmada no consulta datos legados y que
   un error de lectura falla cerrado con 503 antes de membresía o Lia.

## Riesgo residual y despliegue

- Si RLS de SOFIA no permite leer el perfil propio por UUID, la ruta falla
  cerrada y permanece reintentable; debe revisarse la política, no ampliarse el
  acceso desde el renderer.
- Si la cuenta no conserva las dos marcas legadas o divergen UUID/correo,
  requiere reconciliación humana y no obtiene acceso automático.
- Para recuperar al usuario es necesario desplegar primero la Edge Function
  actualizada con `verify_jwt = false`, probar una cuenta controlada y después
  usar **Reintentar**. Esas mutaciones remotas requieren HITL.
