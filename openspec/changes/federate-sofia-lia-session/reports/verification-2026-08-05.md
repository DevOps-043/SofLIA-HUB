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

## Seguimiento: ejecución en instancia incorrecta

La captura de soporte del 2026-08-05 confirmó que el diagnóstico SOFIA se pegó
en el SQL Editor de Pulse Hub/Lia. PostgreSQL respondió `42P01` porque Lia no es
propietaria de `public.users`. Se añadió una guarda al inicio del archivo para
detener el lote con un error `P0001` accionable y se corrigieron las dos guías
operativas. No se creó ninguna tabla en Lia ni se ejecutó una mutación remota.

Una segunda ejecución en SOFIA reveló `42703` sobre `u.password_hash`: el script
todavía mezclaba el diagnóstico vigente con una limpieza histórica ya aplicada.
Se retiraron todas las referencias a hashes, `encrypted_password`, RPCs legados y
DDL destructivo. El archivo final contiene solo comprobaciones de esquema y
consultas de identidad/confirmación compatibles con `public.users` actual.

La verificación del seguimiento confirmó que la guarda precede a las consultas,
que las columnas requeridas existen en el snapshot, que no hay DML/DDL ni nombres
de campos de contraseña, y que pasan `typecheck`, `lint:changed`, `docs:check`,
`harness:validate` y OpenSpec estricto. `verify:pr` conserva el mismo bloqueo de
línea base documentado: inventario de 314 frente a 315 archivos de prueba.

## Seguimiento: usuario afectado Lord

El resultado productivo aportado para `Lord` descarta la hipótesis de identidad
SOFIA incompleta: el perfil y Auth tienen el mismo UUID y correo, el correo está
confirmado y existe una sesión reciente. La divergencia mostrada para otro usuario
no debe atribuirse ni aplicarse a Lord.

Se añadió `database/lia/audits/federated-chat-account-diagnostic.sql`, una
consulta de solo lectura para comparar en Lia el UUID y correo SOFIA por separado,
detectar ownership histórico, contar conversaciones y exponer el estado RLS sin
mutaciones. La captura también muestra Pulse Hub v0.8.1, anterior al código local
v0.9.1; por tanto, la verificación operativa debe incluir versión instalada,
despliegue de la Edge Function y sus secretos antes de atribuir el fallo a datos.

La revisión adversarial encontró además una guía vigente de marzo que todavía
proponía escribir hashes y contenía datos reales, incluida una credencial en
texto claro. `password-change-soflia-learning.md` se sustituyó por un aviso sin
datos personales que dirige al contrato Supabase Auth actual. La credencial se
considera expuesta y debe rotarse fuera del repositorio; no se reescribió el
historial Git ni se hizo ninguna mutación remota.

Una ejecución posterior de la auditoría Lia se detuvo en la guarda porque una o
más relaciones esperadas no estaban disponibles. Se retiró `public.folders` de
las precondiciones y del resultado porque no participa en el intercambio ni en
el ownership de conversaciones. La guarda ahora enumera solo las relaciones
esenciales ausentes y ordena cambiar al proyecto Pulse Hub/Lia sin crear tablas
duplicadas en SOFIA.
