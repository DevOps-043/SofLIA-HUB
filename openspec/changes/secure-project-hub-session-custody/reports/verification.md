# Verificación de custodia y sesión Project Hub

Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base: e166d250629e503cf12f69449fb6d66e569134c8.
Estado: implementada y verificada localmente; revisión independiente pendiente.

## Resultado y alcance

La fachada conserva sus [26 métodos públicos y parámetros](api-comparison.json).
Separa autenticación, contexto, HTTP y custodia con fronteras internas explícitas,
reutilizando os-cipher/private-files. No añade dependencias ni canales. Se
revisaron servicio, handler, allowlist, API preload y wrapper renderer; conservar
su integración no acredita las guardas caller/frame/HITL pendientes del handler.

El formato nuevo guarda sólo refresh/workspaces cifrados por propietario,
comprueba propietario interno, cuotas y formato y serializa I/O local. El
archivo global anterior se conserva sin abrirlo ni atribuirlo. No hay fallback
plano ni adjudicación automática. Un fallo de custodia permite sólo memoria
con aviso fijo seguro. No se afirma eliminar físicamente credenciales antiguas.

La autenticación captura identidad main y exige SOFIA verificada coincidente;
revalida ambos getters después de esperas. Comparte la carga del módulo SOFIA,
no el resultado de identidad. Cambios main A/B/A y logout cancelan contexto;
secuencias y referencias impiden aplicar canjes/refresh antiguos. La renovación
es single-flight. Logout invalida memoria y encola clear al iniciarse, antes de
esperar revocación con el token capturado. No se reutiliza acceso vencido si
falla la renovación.

HTTP bloquea redirects, limita bytes/tiempo, captura el token de cada solicitud
y valida credenciales/envelope. Sólo GET admite reintentos de red con backoff
cancelable y una recuperación ante 401; mutaciones nunca se repiten por esa
recuperación. Los mensajes/códigos remotos libres no salen como error público.
Parámetros y límites: `docs/architecture/runtime-parameters.md`.

## Evidencia focalizada

Logs propios: `%TEMP%/soflia-project-session-2026-10-22/`.

| Verificación | Evidencia |
|---|---|
| Baseline | 19 casos en config/handlers/auth-state, salida 0; baseline.log. |
| Seis regresiones iniciales | Seis fallos antes de implementar; regressions-red.log. Incluyen restore anónimo, respuestas tardías, A/B/A, orden de canjes y replay de mutación. |
| Revisión: acceso vencido | Un fallo reproducido antes del arreglo; review-red.log. |
| Revisión: identidad SOFIA adelantada a main | Un fallo reproducido antes del arreglo; verified-identity-red.log. |
| Suite dirigida final | 87 casos en siete archivos, salida 0; focused-final-reviewed.log. Son 68 casos nuevos: auth 23, store 14, transporte 24 y HTTP 7. |
| Disco/cifrado de prueba | Archivos temporales reales, AES-GCM de prueba, propietario/copia, corrupción conservada, cuotas, junction, save/clear/rotación y recifrado. No sustituye evidencia del SO. |
| HTTP local real | Loopback efímero, datos ficticios, 307 no seguido, stream/Content-Length excesivos, aborto/conexión cerrada y fachada canje/lectura/custodia/logout. No usa backend real. |
| DPAPI real | Tres procesos Electron 44.5.1, perfil temporal y credenciales ficticias; [informe](native-custody.json), native-final.log. Conserva smokes calendario/Gmail, añade propietario/copia rechazada, rotación, restauración y clear de Project Hub. |
| Lint previo al gate | 157 archivos sin deuda nueva; lint-reviewed.log. El primer intento detectó tres regex de controles; se centralizó schema de token ASCII y retiró NUL del regex sin desactivar reglas. |
| Inventario | Derivado por docs:inventory:sync: 635 archivos de prueba, 430 main y 203 renderer, más scripts; 494 canales. No se editan cifras a mano. |
| Compilación final | app:smoke:build, salida 0; seis artefactos, 3323 fuentes y hashes de los seis módulos Project Hub iguales al worktree. [Resumen y huellas](build-summary.json), build-final.log. Sin .env, empaquetado, bootstrap ni cuentas reales. |
| Documentación/OpenSpec finales | docs:check, salida 0, 637 Markdown activos; validación estricta del cambio aprobada. docs-final.log y openspec-final.log. |
| Gate completo | npm run verify:pr, salida 0: 4964 casos aprobados y cinco omitidos, 464 archivos aprobados y dos omitidos; suite de 253,90 s. Tipos, lint de 157 archivos sin deuda nueva, arnés, suministro, documentación, OpenSpec y tooling aprobados. verify-pr.log y [resumen](gate-summary.json). |

El primer arnés HTTP cerraba todas las conexiones entre casos, provocando
ECONNRESET en un socket reutilizado del pool de fetch. El diagnóstico aisló
ese error con servidor/datos ficticios; se dejó el cierre global al final y
Connection: close en la fixture. No se añadió retry de escrituras para hacerlo
pasar. Los intentos fallidos constan en http-first.log/http-network-diagnostic.log.
También se corrigieron la reserva de secuencia antes de esperar identidad y la
carga compartida del módulo SOFIA; las pruebas de concurrencia siguen verdes.

## Autorrevisión adversarial

Se intentó refutar aislamiento con A/B/A, identidad SOFIA discordante, copia de
archivo y junction; logout con red pendiente, canje/refresh fuera de orden,
load de disco anterior a nuevo canje y dos GET rechazados simultáneos. Se
probaron respuestas inválidas, controles, UTF-8 corrupto, errores remotos libres,
stream excesivo, timeout, redirect 307 y cancelación del backoff. No se
ejecutaron escrituras remotas ni se usaron credenciales reales.

La revisión propia detectó y corrigió uso de acceso vencido y revalidación
incompleta de la identidad SOFIA. No constituye revisión independiente. El
cambio permanece abierto hasta obtenerla; no se archiva por un gate verde.

## Límites y reversión

Pendientes: caller/frame, schemas y HITL por operación IPC; autorización y
revocación JWT del servidor; transición de accesos directos IRIS y las 30 tablas
sin RLS de la inspección anterior. No hay SQL, despliegue ni prueba de cuenta
real. Una mutación enviada puede completarse pese a cancelar contexto. No se
afirma SLO, bloqueo entre procesos, eliminación física ni porcentaje nuevo de
deuda técnica.

Revertir fachada y módulos de custodia/contexto/auth/transporte juntos, más
sus pruebas/docs y la extensión propia del smoke. Preservar las once unidades
previas y los archivos privados existentes. El formato global antiguo y el
nuevo son distintos: volver al cliente antiguo puede volver a exponer su
restore sin dueño; no usar ese downgrade como mitigación de seguridad.
