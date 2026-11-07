# Vigencia de restauración y eventos Auth

Estado: evidencia histórica de verificación local; revisión independiente pendiente.
Fecha: 2026-10-25.

## Regresión de arranque del 7 de noviembre de 2026

Pasaron 159 casos dirigidos de contextos Auth, canje Lia, contrato de publicación
y barra lateral. El caso nuevo retiene la respuesta de Lia, comprueba la
publicación SOFIA sin otra lectura del SDK y acepta la identidad Auth aunque el
correo del perfil sea distinto. Las pruebas usan sesiones y transportes simulados.

La revisión de la aplicación en ejecución observó un rechazo de publicación
nativa y HTTP 503 en el canje Lia autenticado. Sin credenciales, la función
respondió 204 a OPTIONS y 401 al POST. En una comprobación posterior, la
sección de conversaciones volvió a mostrar elementos y Proyectos seguía
esperando verificación. El binario main abierto era anterior al nuevo
diagnóstico. Pasaron 264 casos dirigidos de recuperación y 92 casos al volver
a probar el contrato IPC con los motivos de rechazo. El registro por etapas
de la función está implementado localmente y pendiente de despliegue.

Una segunda reproducción con la compilación de desarrollo confirmó
`sofia_unverified` en la publicación de la sesión. Se corrigió el uso del
token original en el canje de Project Hub cuando main lo renueva. La ruta
legada de Lia ahora consulta un RPC limitado a `auth.uid()` en SOFIA, donde
la lectura directa de `public.users` está restringida.

Pasaron 104 casos dirigidos de custodia SOFIA, IPC, Project Hub y canje Lia.
La migración se ejecutó dos veces en PostgreSQL embebido. Se comprobaron
la denegación al rol anónimo, la ausencia de filas sin sujeto, el aislamiento
entre dos sujetos ficticios y la reversión. Quedan pendientes la aplicación
en SOFIA Learning, el despliegue de la función Lia y la verificación real.

El diagnóstico del SDK en Electron confirmó `AuthSessionMissingError` para
la sesión persistida del incidente. Se distinguió la revocación de un error
genérico y se invalidó el workspace únicamente si la publicación pertenece al
sujeto vigente. Pasaron 126 casos dirigidos tras agregar esa cobertura.

La app volvió a la pantalla de acceso al recibir `sofia_revoked`. Con la
sesión nueva, main verificó SOFIA y desapareció el aviso de conversaciones.
Project Hub dejó de esperar la identidad y mostró indisponibilidad durante el
canje. Se impidió que la barra lateral reemplace un canje en curso y se
comprobó que un canje lento termina con una sola solicitud en 130 pruebas
dirigidas. El endpoint público rechazó una petición sin credenciales con 401.

El reinicio reproducía la revocación por el cierre de las copias nativas.
Los clientes de main se descartan sin llamar a `signOut` sobre las sesiones
compartidas. La prueba de Lia incluye una aplicación que termina después
de la limpieza. Pasaron 128 casos dirigidos. El reinicio real posterior
conservó la identidad y llegó al canje de Project Hub, que respondió HTTP
500. Solicitud correlacionable en Netlify: `53676eda-49e5-45f0-b1d8-ae14d296e6e6`.

## Resultado y alcance

La suscripción precede a la lectura inicial. Cada operación del ciclo conserva
su propia señal: evento posterior o desmontaje la cancela, incluso A/B/A.
Resultados, errores y denegaciones obsoletos no publican estado ni finalizan
carga de otra operación. INITIAL_SESSION tardío no revierte otro evento.
El callback devuelve void; la resolución se agenda fuera del callback.
La lectura de arranque comienza inmediatamente después de suscribir.

Al cambiar sujeto SOFIA se limpia estado anterior antes de resolver el nuevo;
un refresh del mismo sujeto no lo vacía. Se cancela antes de liberar el listener,
con receptor conservado y error de limpieza estático. Un fallo de suscripción
cierra el ciclo incluso si quedó retenido un callback.

AbortSignal opcional viaja por useLiaSession y lia-session-exchange: antes/después
de lecturas, refresh, canje y OTP, y antes de iniciar el siguiente efecto. Cancelar
libera timer/listener del backoff sin reintento ni degradación ajena. Perfil
auxiliar se sincroniza una vez al aceptar; su rechazo manejado no borra sesión.
syncOptionalLiaSession sólo recupera; su único consumidor ensureLiaSession
publica la sesión vigente. Se conservan validación de correo y acceso denegado.

Sin dependencias, almacenamiento, DTO, IPC o UI nuevos. Se conserva la rama
acumulativa y otros worktrees, sin secretos/.env, SQL, stage/commit/push ni
despliegue. Auth, perfiles y endpoints son dobles de QA; no hubo red/cuentas
reales. Respaldos/logs: `%TEMP%/soflia-auth-lifecycle-2026-10-25/`.

## Regresión y pruebas dirigidas

`lifecycle-red.log` ejecutó quince casos del código anterior: trece fallos
conductuales y dos fallos de fixture que borraba el callback junto al historial
de mocks. Esos dos no se cuentan como regresión del producto. Dos cargas previas
del fixture quedaron interrumpidas sin ejecutar casos y tampoco son evidencia.

`first-green.log`: 49 aprobadas, seis fallos; dos del fixture anterior y cuatro
regresiones de secuencia de arranque. Se corrigió el fixture y se inició la
lectura inmediatamente después de suscribir, conservando la agenda diferida sólo
para callbacks. `second-green.log`: 55 aprobadas en cuatro archivos.

`adversarial.log`: 66 aprobadas y un fallo de fixture StrictMode: envolver sólo
el componente no duplicó el efecto raíz. Se habilitó reactStrictMode en el root
y se exigen dos lecturas/suscripciones para comprobar el caso realmente.
`directed-final.log`/`directed-tests.json`: 67 aprobadas, cuatro archivos; 27 casos
nuevos y 40 consumidores AuthContext/SSO/contrato del servidor existentes.

## Autorrevisión adversarial y límites

Se intentó refutar vigencia con lectura antigua, error inicial tardío, cierre
durante resolución/lectura/refresh/canje/OTP, denegación A/B/A, suscripción
fallida con callback retenido, INITIAL_SESSION tardío, StrictMode y unsubscribe
fallido. Se probó cancelación y limpieza del backoff, recuperación vigente,
rechazo permanente y perfil auxiliar fallido sin rechazo libre.

Una señal local no autentica al usuario ni sustituye JWT/RLS. SDK/HTTP ya enviados
pueden persistir sesión o tener efecto: no hay signOut compensatorio que cierre
otra identidad. La resolución de directorio ya iniciada puede terminar sus
lecturas internas; se descarta su resultado antes de cualquier continuación Lia.
Login/SSO, reintento de contexto/conversaciones, intención explícita de cierre y
coordinación entre ventanas siguen requiriendo arbitraje global propio. No se
declara que todo Auth esté resuelto. La revisión visual bloqueada anterior se
mantiene; este bloque no abre UI ni busca otra vía para aquel archivo.
Revisión independiente pendiente, sin archivar.

El contrato de eventos y la liberación de suscripción se contrastaron con
[Supabase Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
La señal comunica cancelación a operaciones que la observan, como explica
[AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal);
no revierte automáticamente una llamada SDK que no la consume.

## Verificación final

`npm run verify:pr` completó sus trece etapas con código 0 en 393.43 s:

- Vitest: 5,951 aprobadas y cinco omitidas; 512 archivos aprobados y dos omitidos
  (514 total), duración 226.88 s. Las 5,924 aprobadas anteriores se conservan y
  se agregan 27 casos de esta unidad.
- Tooling: 51 aprobadas. Python 3.12.11: 33 aprobadas con el intérprete QA elegido
  mediante SOFLIA_TEST_PYTHON.
- Tipos, harness, runtime estable, supply-chain y especificaciones aprobados.
  Lint incremental: 418 archivos sin deuda nueva; enlaces válidos en 781 Markdown.
  Inventario documental: 695 archivos de prueba, diferente de suites ejecutadas.

`npm run app:smoke:build` aprobó con código 0 en 77.59 s en
`pulse-app-build-BFlHDG`, con seis artefactos no vacíos. Se comprobaron hashes
de las 3,494 fuentes copiadas. Las 3,495 rutas enumeradas incluyen la eliminación
local preexistente `electron/wa-agent/bulk-label-verification.ts`, preservada y
omitida al copiar. Sin .env, instalador, arranque completo ni publicación.
Persisten los avisos del bundler sobre chunks e imports dinámicos.

Las 3,514 fuentes del manifiesto ampliado permanecieron idénticas antes/después
de ambos procesos, comprobado tras sus códigos de salida terminales.
SHA256: `a3227903331526d8a428e3f44a5f7f4a3a9b303212802c020e6d6454730998ac`.
Contra la unidad 33 cambian tres fuentes existentes y se agregan dos de pruebas;
manifiesto y lock de dependencias conservan hashes. Sólo se completan después
docs/tareas/recibos, con nueva comprobación documental.

Recibos: [regresión y casos dirigidos](regression-summary.json),
[gate](gate-summary.json), [build](build-summary.json),
[fuentes](source-evidence.json) y [logs](log-evidence.json).
Node local 26.7.0 y Electron 44.9.3. No acredita CI Node 24, otros sistemas,
instalador, cuentas reales o revisión independiente. No se ejecutó una auditoría
npm global nueva. No se deriva un porcentaje global de deuda del número de
pruebas o de esta refactorización.
