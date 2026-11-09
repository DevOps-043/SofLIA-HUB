# Conexiones Python por proceso

Fecha local: 2026-10-22. Rama: codex/reduce-technical-debt.
Base Git: e166d250629e503cf12f69449fb6d66e569134c8.
Estado: implementada y verificada localmente.
Revisión independiente pendiente; no se archiva.

## Resultado

Voz y documentos conservan dos procesos/fachadas/consumidores y comparten sólo
la conexión stdio. Cada hijo posee ready, buffer y pendientes. Los callbacks de
las fachadas comprueban conexión; un exit/error/stdout retirado no cambia el
actual. Ready v4/v1 es compartido por todos los consumidores concurrentes.
Stop retira la generación antes de esperar shutdown/kill y hace esperar a
arranques explícitos nuevos. La voz revalida lifecycle/wake tras esperas y
cancela timers al parar/deshabilitar; tools descarta resultados retirados.

Framing UTF-8 estricto hasta 64 MiB por línea; payload y cola stdin de hasta
8 MiB, 64 pendientes por hijo y plazos de comandos positivos hasta 300 s.
Readiness 10/15 s y ack shutdown hasta 2 s; conserva plazos de dominio 10/15/
60/90 s. Exceso/protocolo inválido produce error sin truncar ni repetir. Se
libera el buffer grande y no se registran stdout/stderr crudos. notify=true
significa aceptado una vez aunque write devuelva backpressure; cola agotada
rechaza antes de escribir. Fallos de spawn usan código SO permitido y mensaje
propio, sin ruta/error crudo. Tools no conserva finally huérfano de startup.

No cambia canales, wrappers, autorización, modelos, Python fuente, descarga,
configuración persistida ni opt-in de redacción PII. [Contratos](contracts.json)
comparan firmas por AST con el build anterior y hashes de fuentes Python y
handlers, sin pretender que el build de app incluya los programas Python.

## Evidencia

Logs: `%TEMP%/soflia-python-sidecar-2026-10-22/`.

| Verificación | Resultado |
|---|---|
| Baseline | 78 casos en cinco archivos, salida 0; baseline.log. Gate previo: 5274 aprobados, cinco omitidos. |
| Reproducción previa | lifecycle-red.log: tres fallos confirmados antes de implementar; ready concurrente de voz/tools y exit antiguo retirando petición nueva. Hijos ficticios en memoria, sin perfiles ni audio. |
| Dirigida | 122 casos en siete archivos, salida 0; directed-acceptance.log. Neto 44 casos sobre baseline, conserva sesiones de dictado/Piper, disponibilidad Python, PII y consumidores Meeting Live. |
| Generaciones | python-sidecar-lifecycle.test.ts: ready compartido, exit/error/stdout de A después de B, stop/config disabled durante startup, barrera de shutdown, backoff cancelado, respuesta recibida justo antes de stop y presupuesto de tres fallos. |
| Transporte negativo | Mismo archivo: versión/frame/UTF-8 incompatibles, tamaños y cola/pending, timeout/respuesta tardía, orden/id, write fallido, serialización, backpressure sin duplicado, idempotencia de cierre y guardas de error hasta close. Framing cuenta bytes, no caracteres. |
| Stdio real | python-sidecar-process.test.ts: cinco casos con hijos Node ficticios y tuberías reales; v1/v4, Unicode fragmentado byte a byte, exit en petición, timeout sin retry y UTF-8 inválido. Cada proceso se cierra al terminar. |
| Python real | python-native-acceptance.log y [reporte](python-smoke.json): cuatro ejecuciones de los dos programas reales con Python 3.12.14 de QA. Cada protocolo comprueba ready/ping/desconocido/shutdown directamente; se repite ping/desconocido mediante conexión main compilada. Sin audio/modelos, .pyc, bootstrap, perfiles, .env ni instalación del distribuible. |
| Tipos/lint iniciales | Typecheck salida 0 y lint de 208 archivos sin deuda nueva en estado intermedio; typecheck.log/lint-first.log. El gate final repite ambos sobre las fuentes finales. lint-acceptance.log
registra también 208 archivos sin deuda nueva tras los ajustes de cierre. |
| Inventario | Derivado por docs:inventory:sync: 654 archivos de prueba y 495 canales; inventory.log. |
| Build de aceptación | app:smoke:build salida 0: 3365 fuentes y seis artefactos; cinco fuentes de producción afectadas coinciden por SHA-256 con el worktree después del gate. build-acceptance.log y [resumen](build-summary.json). Sin .env, empaquetado ni arranque de app. |
| Compuerta de aceptación | verify:pr salida 0: 5318 casos aprobados y cinco omitidos, 482 archivos aprobados y dos omitidos; 219,46 s de suite. Tipos, lint de 208 archivos sin deuda nueva, arnés, docs, suministro y tooling aprobados. verify-pr-acceptance.log y [resumen](gate-summary.json). Neto 44 casos respecto al gate previo a la unidad. |

Las firmas públicas se revalidaron después del gate: 20 métodos de voz y ocho
de herramientas conservan parámetros/retornos, según AST contra snapshot previo.
Dependencias/devDependencies/overrides permanecen iguales; sólo se añade el
comando QA. Los [contratos y hashes](contracts.json) conservan esa evidencia.

El primer build y gate fallaron en tipos de la fixture de proceso: el proyecto
aumenta ProcessEnv con cuatro campos obligatorios y el entorno mínimo no los
declaraba. Se añadieron valores test/vacíos explícitos, preservando allowlist de
variables SO y sin heredar secretos. No se cambió producción ni se relajó tipado;
build.log/verify-pr.log conservan esos fallos. La ejecución final repite todo.

## Autorrevisión y límites

Se intentó refutar propiedad mediante generación antigua, error posterior a
kill antes de close, cierre durante ready y comandos simultáneos. Se añadieron
guardas tras await también a resultados tools y a la voz; deshabilitar durante
startup invalida la intención pendiente. Se preserva restaurar wake únicamente
si sigue vigente la operación. Fallos síncronos de spawn se sanean y cuentan
en el presupuesto tools, igual que los asíncronos. No se relajan aserciones
para conseguir resultados verdes. Las pruebas existentes adaptan sólo el
detalle privado de conexión/handleMessage y el código SO de la fixture.

Esto es autorrevisión, no revisión independiente. El intérprete de QA no es
python-runtime del producto, ausente en el checkout: no certifica paquete,
Vosk/Piper/micrófono, parsers/PII reales ni todas las dependencias Python.
El entorno heredado, autorización IPC heterogénea, descargas de modelos y
otros logs semánticos siguen pendientes. No se borra ni modifica una sesión,
modelo o configuración real para probar esta unidad.

Las cuotas son políticas defensivas, no SLO/benchmark. Timeout no prueba
rollback de comandos ya enviados ni acota la cola interna del programa Python;
no se agregan reintentos. Kill no certifica terminar descendientes del SO. Una
prueba de protocolo no demuestra todos los flujos de la aplicación instalada.
No hubo captura, cuentas reales, mutaciones remotas, SQL ni despliegue; no se
deduce un porcentaje global de deuda de estas pruebas o del traslado de líneas.

Rollback conjunto de dos fachadas, conexión/framer, script/fixture/pruebas y
docs de esta unidad, preservando quince unidades anteriores. Sin migraciones
ni limpieza de perfiles. El downgrade reintroduce carreras y buffers ilimitados;
no es una mitigación. Fuentes Python y handlers consumidores permanecen iguales.

La primera compuerta verde (verify-pr-final.log) obtuvo 5311 casos aprobados y
cinco omitidos, 482 archivos aprobados y dos omitidos, 260,25 s. La revisión
posterior inyectó un kill que lanza excepción: kill-red.log demuestra que el
cierre se resolvía sin informar fallo. Se corrigió SIDECAR_STOP_UNCONFIRMED y
retención de la generación hasta close real, con pruebas en ambas fachadas y
fallo de protocolo con kill=false. Un spawn sin PID conserva su error original
sin requerir kill. Se repiten QA Python, build y compuerta sobre ese estado.

La compuerta siguiente (verify-pr-delivery.log) rechazó no-unsafe-finally en
la salida de error del cierre. Se movió fuera de finally sin desactivar la regla.
Interleaving-red.log reprodujo dos regresiones de la implementación inicial:
un consumidor que abría B impedía restaurar wake válido, y una segunda orden
stop no invalidaba un arranque esperando el primer cierre. Se conservó la
intención wake y se revalidó epoch antes de crear el hijo; stop reiterado
invalida todas las intenciones previas. Casos positivos/negativos de ambas
fachadas y conexión cerrada pasan en la suite dirigida final de 122 casos.
