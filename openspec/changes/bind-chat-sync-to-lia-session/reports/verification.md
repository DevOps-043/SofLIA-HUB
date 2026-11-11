# Sesión vigente de sincronización del chat

Estado: evidencia histórica de verificación local; revisión independiente pendiente.
Fecha: 2026-10-25.

## Resultado y alcance

El coordinador vincula cada lote a sujeto y ciclo observados del SDK Lia.
Suscribe antes de leer sesión, no deja que un resultado inicial tardío reemplace
un evento más reciente y revisa vigencia antes de operaciones remotas y después
de esperarlas. Cierre/cambio revocan el lote, incluso A/B/A. Sus respuestas no
reconocen pendientes ni publican cache; los datos permanecen para otro intento.

La cola mantiene una sola pasada pendiente. Ciclos distintos no heredan scopes:
una solicitud nueva válida sustituye la pendiente revocada y espera al I/O
físico anterior. Refresh/eventos repetidos de la misma identidad se conservan.
El callback es síncrono y no llama otros métodos Auth; un evento vigente también
libera una lectura inicial pendiente. Se cierra la revisión y libera listener
al quedar ocioso, aun si unsubscribe falla.

Sólo se retienen sujeto y ciclo, sin inspeccionar/persistir tokens. Misma API
pública, DTO, formato local, dependencias y capas main/preload/renderer. La rama
acumulativa y trabajo ajeno se preservan. Sin SQL, secretos/.env, cuentas/red
reales, UI, stage/commit/push o despliegue. Logs y respaldos propios:
`%TEMP%/soflia-chat-session-2026-10-25/`.

## Regresiones y contratos dirigidos

- `session-red.log`: catorce fallos y dos casos aprobados con el código previo,
  incluyendo efectos sin sesión y reconocimiento/publicación tras revocación.
  No se usa ausencia de un módulo o timeout como prueba de regresión.
- `session-first-green.log`: dieciséis casos iniciales aprobados.
- `consumers-first.log`: 79 aprobados y un fallo de fixture: el consumidor
  declaraba user-123 pero pretendía sincronizar lia-user-1. Se explicitó la sesión
  de su actor manteniendo sus aserciones; no se añadió fallback permisivo.
- `contracts-adversarial.log`: 87 aprobados en ocho archivos.
- `directed-final.log`/`directed-tests.json`: 92 aprobados, ocho archivos;
  26 casos de sesión y dos de SDK real, 28 nuevos respecto de la unidad 32.

Los fixtures de consumidores declaran sesión explícita y comparten un emisor
Auth tipado; se retiró un any del adaptador de prueba. Se conserva la garantía
anterior de contenido/cache/borrado. SDK ficticio y servicios remotos sustituidos
son datos de QA, no sesiones ni permisos del usuario.

El SDK Supabase real comprueba setSession, getSession/eventos, signOut y refresh
con fetch ficticio limitado a user/token/logout bajo un dominio .invalid.
Tokens/usuario son sintéticos, persistSession/autoRefreshToken/detección de URL
están desactivados; revisión, observador y cliente Auth se liberan en finally.
No hay verificación criptográfica real ni prueba de RLS o proveedor remoto.

Referencias primarias: [eventos Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
y [getSession](https://supabase.com/docs/reference/javascript/auth-getsession).
getSession obtiene estado del almacenamiento del cliente y puede renovar sesión;
no equivale a autenticar un JWT ni concede permisos de servidor.

## Autorrevisión adversarial y límites

Se intentó refutar vigencia con cierre/A/B/A durante las tres clases de efecto,
scope global revocado seguido de otro dirigido, lectura antigua con otro sujeto
o error, INITIAL_SESSION tardío, error de suscripción/lectura/limpieza,
renovación e invocación síncrona del callback. El SDK real comprueba compatibilidad
del adaptador y revocación al disponer, además de los dobles dirigidos.

El resultado inicial, incluido su error, no prevalece sobre un evento vigente.
No hay suscripción global permanente ni nueva lectura por cada autosave
fusionado. Fallos bloquean efectos y dejan pendientes; los diagnósticos son
estáticos y se probó que no incluyen detalles libres del error.

La garantía depende del estado/eventos del SDK observado en este renderer. No
sustituye RLS/verificación JWT del servidor, cierre seguro global, flujos
AuthContext/login/SSO o coordinación entre ventanas/equipos. Tampoco cancela
I/O ya enviado: puede producir efecto aunque su respuesta se descarte.
La revisión visual bloqueada anterior conserva su estado; no se usó otra vía
para abrir ese archivo. Revisión independiente pendiente, sin archivar.

## Verificación final

`npm run verify:pr` completó sus trece etapas con código 0 en 318.76 s:

- Vitest: 5,924 aprobadas y cinco omitidas; 511 archivos aprobados y dos omitidos
  (513 total), duración 191.21 s. Se conservan las 5,896 aprobadas anteriores y
  se agregan 28 de esta unidad (26 dirigidas de sesión y dos de SDK real).
- Tooling: 51 aprobadas. Python 3.12.11: 33 aprobadas con el intérprete QA
  seleccionado mediante `SOFLIA_TEST_PYTHON`.
- Tipos, harness, runtime estable, supply-chain y especificaciones aprobados.
  Lint incremental: 413 archivos sin deuda nueva; enlaces válidos en 775 Markdown.
  Inventario derivado de 693 archivos de prueba, distinto de suites ejecutadas.

`npm run app:smoke:build` aprobó con código 0 en 76.86 s en
`pulse-app-build-2Hph3F`: seis artefactos no vacíos y 3,492 fuentes copiadas con
hash coincidente. Enumera 3,493 rutas Git; la diferencia es la eliminación local
preexistente `electron/wa-agent/bulk-label-verification.ts`, preservada y omitida
al copiar. Sin `.env`, instalador, arranque completo o publicación. Persisten
avisos de chunks/imports dinámicos del bundler.

Las 3,512 fuentes del manifiesto ampliado permanecieron idénticas antes/después
de gate/build, comprobadas nuevamente al cerrar la espera de sus handles.
SHA256 del manifiesto:
`f5298a1f5ed9e4df27babf8979457b9c67586aeb27f495d9f41b6ee9944d88ed`.
Respecto a la unidad 32 cambian siete fuentes y se agregan cuatro; manifiesto,
lock y dependencias conservan sus hashes. Los cambios posteriores sólo registran
docs/tareas/recibos y se comprueban documentalmente, sin repetir producto intacto.

Recibos: [regresión y 92 casos dirigidos](regression-summary.json),
[gate](gate-summary.json), [build](build-summary.json),
[fuentes](source-evidence.json), [logs](log-evidence.json).
Los comandos completos están en `gate-final.log` y `build-final.log` del temporal
indicado. Node local 26.7.0 y Electron 44.9.3; CI Node 24, otros SO, instalador,
cuentas reales y revisión independiente no se acreditan con esta ejecución.
No hubo auditoría npm nueva ni una evaluación comparable del índice global;
estos resultados no generan otro porcentaje de deuda técnica.
