# Coordinación de intenciones Auth

Estado: evidencia histórica de verificación local; revisión independiente pendiente.
Fecha: 2026-10-25.

## Resultado y contratos

Un coordinador privado por proveedor invalida antes de esperar al iniciar otro
login/SSO o cerrar. Restauración/eventos, directorio, Lia y publicación capturan
vigencia común. El cierre queda bloqueado frente a restauración espontánea;
un acceso explícito nuevo puede recuperar sesión. Se descartan respuesta, catch
y finally anteriores, incluso A/B/A. Lifecycle conserva su cancelación local.

La cola mantiene un activo y un pendiente: sustitución/cancelación libera el
pendiente y su listener; el activo se retiene hasta terminar físicamente.
Ordena mutaciones de sesión del SDK de estos flujos, no todas las consultas o
escrituras del producto.
Eventos SDK del escritor ya revocado no cancelan la intención en espera.
SIGNED_IN propio no inicia una segunda recuperación; cierre externo durante
el acceso vigente sí revoca. El sujeto SDK observado se comprueba contra el
de Session, sin equipararlo al ID del perfil ni usar preferencias como autoridad.

SSO conserva state/verificador en memoria y reclamación única durante todo el
canje. Cancelación, otra intención o desmontaje impiden apertura/canje/OTP,
perfil y Lia posteriores aún no iniciados. Señales alcanzan fetch/backoff y
servicios SOFIA/directorio/Lia, con diagnósticos estáticos de cancelación/error.
Snapshot local y contexto SOFIA se retiran antes de esperar la cola al cerrar;
fallo de almacenamiento no impide intentar logout SDK y conserva diagnóstico.

useAuthPublication separa publicación del modelo. Revocación no espera tokens;
positiva revalida señal/sujeto SDK y maneja errores tardíos. Orbe nunca publica,
el arranque sin intención conserva su espera y el handler mantiene su revisión.
API pública AuthContext, contratos de cuatro capas, almacenamiento y dependencias
compatibles; no se crean canales ni permisos. Sin .env/secretos, SQL, stage,
commit/push, instalador, cuentas reales o despliegue; otros worktrees preservados.
Logs/respaldos: `%TEMP%/soflia-auth-intents-2026-10-25/`.

## Regresiones y contratos

- ownership-red.log: siete fallos conductuales y un caso aprobado sobre el código
  previo. Reproduce login posterior a cierre, SDK solapado, directorio tardío,
  revocación demorada y cancelación SSO durante creación/canje y finally viejo.
- ownership-first-green.log: 55 aprobados en tres archivos.
- consumers-first.log: 73 aprobados y un fallo de expectativa del fixture que
  aún exigía dos argumentos; se conserva su aserción y se comprueba la señal nueva.
  typecheck-first.log identifica además los dos campos privados nuevos ausentes
  en ese fixture, corregidos sin fallback permisivo.
- directed-final.log/directed-tests.json: 120 aprobados, once archivos; 38 casos
  nuevos. Conserva consumidores AuthContext/SSO, ciclo anterior y contrato SDK del
  chat. Fixtures declaran sesión SDK e identidad explícitas; no fabrican sesión
  desde el perfil. El fixture SDK compartido usa storageKey único, persistencia,
  refresh automático y detección URL desactivados; cleanup libera cliente/listeners.

SDK Supabase real usa fetch ficticio cerrado a auth.example.invalid con JWT,
usuario y credenciales sintéticos: confirma SIGNED_IN/refresh y un SIGNED_OUT
real emitido mientras otro dueño espera. No hay red/cuentas reales ni validación
criptográfica de JWT. Fuentes primarias: [eventos Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
y [setSession](https://supabase.com/docs/reference/javascript/auth-setsession).

## Autorrevisión adversarial y límites

Se intentó refutar ownership mediante A/B/A, cierre con login/red/lectura de
tokens pendientes, evento propio y cierre viejo, sujeto observado incompatible,
reclamación SSO duplicada/cancelada, nuevo intento durante finally viejo,
unmount/StrictMode, cola sustituida/cancelada/rechazada, backoff, error de
almacenamiento y perfil auxiliar. La limpieza local inmediata evita regresión
introducida al ordenar logout; no se retrasa al I/O físico anterior.

La coordinación es de un proveedor en ese renderer. Otros clientes/ventanas o
dispositivos, logout remoto, token ya emitido y SQL/RLS requieren su propio
contrato. No se afirma cierre criptográfico global ni que un I/O enviado no
tenga efecto. Si SDK no responde, la cola espera: cancelación revoca UI y etapas
posteriores, sin liberar una mutación viva que pueda escribir después del nuevo
acceso. Fetch cancelable no demuestra reversión de servidor. No hay compensación
que cierre indiscriminadamente otra identidad.

Una lectura de perfil ya iniciada puede terminar sus consultas internas; la
señal se revalida antes de aceptar/persistir o comenzar la siguiente etapa. Las
escrituras auxiliares ya enviadas, como el perfil Lia, conservan ese mismo
límite y requieren autorización del servidor.

IDs de perfil/SOFIA Auth/IRIS no se equiparan. Su vínculo y permisos de backend
no se verifican con estos fixtures. El código de perfil conserva sus consultas
y diagnóstico existentes; esto no sanea todos los logs del producto ni migra
tokens fuera del cliente. La revisión visual bloqueada anterior se conserva;
no se abrió otra vía. Revisión independiente pendiente, sin archivar.

## Verificación final

`npm run verify:pr` completó trece etapas con código 0 en 330.39 s:

- Vitest: 5,989 aprobadas y cinco omitidas; 516 archivos aprobados y dos omitidos
  (518 total), duración 203.90 s. Se conservan las 5,951 aprobadas anteriores y
  se agregan 38 casos de esta unidad.
- Tooling: 51 aprobadas. Python 3.12.11: 33 aprobadas con SOFLIA_TEST_PYTHON
  apuntando al intérprete QA preparado.
- Tipos, harness, runtime estable, supply-chain y especificaciones aprobados.
  Lint incremental: 440 archivos sin deuda nueva; enlaces válidos en 788 Markdown.
  Inventario: 700 archivos relacionados con pruebas, distinto de suites ejecutadas.

`npm run app:smoke:build` aprobó con código 0 en 71.26 s en
`pulse-app-build-KquXZC`: seis artefactos no vacíos y 3,503 fuentes copiadas con
hash coincidente. Enumera 3,504 rutas Git, incluida la eliminación local
preexistente `electron/wa-agent/bulk-label-verification.ts`, preservada y omitida
al copiar. Sin .env, instalador, arranque completo ni publicación; persisten
avisos del bundler sobre chunks/imports dinámicos.

Las 3,523 fuentes del manifiesto ampliado fueron idénticas antes/después de
ambos procesos terminales. SHA256:
`628182058729d3ed5947733e1c302b1b0f4c548f94d5e660784a35ea3a33de8c`.
Contra la unidad 34 cambian diecisiete fuentes y se agregan nueve; manifiesto y
lock conservan hashes. Respaldos de las diecisiete coinciden con el manifiesto
anterior. Después sólo se completan docs/tareas/recibos, con chequeos documentales.

Recibos: [regresión y 120 casos dirigidos](regression-summary.json),
[gate](gate-summary.json), [build](build-summary.json),
[fuentes](source-evidence.json), [logs](log-evidence.json).
Node local 26.7.0 y Electron 44.9.3. CI Node 24, otros SO, instalador, cuentas
reales y revisión independiente no se acreditan aquí. No hubo auditoría npm
global nueva ni reauditoría del índice ponderado. Sin nuevo porcentaje global
de deuda derivado de pruebas, casillas o líneas.
