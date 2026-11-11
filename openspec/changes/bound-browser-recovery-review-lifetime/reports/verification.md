# Vigencia y publicación de recuperación local

Estado: implementación, pruebas dirigidas/nativas, gate y build aislado aprobados.
Sin archivar; revisión independiente pendiente.
Fecha: 2026-10-25. Unidad 28 acumulativa, rama codex/reduce-technical-debt.

## Evidencia inicial y hallazgos separados

Se repitió policies-only diez veces con perfiles nuevos: diez exit 0 y 19 casos
por ejecución. Esto no explica el fallo sin diagnóstico de la unidad anterior.
Nuevas ejecuciones sí registraron EPERM de rename Windows al reemplazar
privacy.json. No se identifica el proceso que retenía el archivo ni se atribuye
a antivirus, permisos corporativos o carga sin evidencia.

Un hijo PowerShell oculto con FileStream/FileShare.Read sobre un archivo propio
reprodujo EPERM real. El código anterior falló aunque el tenedor liberara el
archivo tras ese primer error. Se añade publicación condicionada y acotada,
sin borrar el destino ni ampliar timeouts globales. Un bloqueo persistente
todavía debe fallar. Un intento posterior agotó el presupuesto en otro rename;
se conserva ese fallo, sin ampliar el presupuesto para ocultarlo. Repeticiones
posteriores y el recorrido completo final aprobaron.

Otro hallazgo independiente fue el plazo de recuperación. Una regresión dejó
transcurrir más de cinco minutos de intervalo con el reloj civil atrasado una
hora; el commit anterior se aprobó. Una segunda venció durante I/O y también
se aprobó. Ambas fallaron en rojo; no requieren cambiar el reloj del SO.

## Cambios y contratos conservados

Una primitiva interna concentra consumo único y dos límites de cinco minutos:
process.hrtime.bigint para intervalo y Date.now para límite civil conservador.
Vencer por cualquiera queda memorizado. El reloj de intervalo es independiente
de hora civil según [Node](https://nodejs.org/api/process.html#processhrtimebigint).
No se persiste este plazo ni cambia metadata de negocio/retención. No se promete
defensa contra sustitución de ambos relojes por un administrador de main.

Los cuatro motores (políticas/codecs de atajos y settings, SQLite, semántica y
estado sync coordinado) revalidan tras cola/I/O/proyección antes de nuevos
efectos. Si sync vence tras su marcador, conserva bloqueo y una revisión nueva
permite rollback exacto; no declara éxito parcial. Mantiene errores, cifrado,
formatos, bytes esperados y HITL existentes. Un syscall iniciado dentro del
plazo puede terminar después: no se presenta como cancelado o revertido.

La publicación asíncrona de políticas reintenta sólo rename EPERM/EBUSY en
Windows: cinco intentos y esperas de 20/40/80/160 ms, sumando 300 ms de esperas,
además del I/O y planificación del SO. Revalida guardas suministradas por el
consumidor y bytes esperados del principal/respaldo antes de cada publicación.
No inventa actor ni sustituye la autorización de la fachada. Una recuperación
incluye su guarda de perfil/sesión/plazo; escrituras ordinarias conservan el
contrato de sus servicios. No reintenta link exclusivo, otros errores o SO;
un cambio ajeno/revocación aborta. No hay borrado del destino para forzar rename.
Los motores síncronos conservan su API sin introducir esperas bloqueantes.

Una regresión adicional encontró que fallar open exclusivo podía borrar el
temporal preexistente. Se registra creación efectiva antes de limpiar. Otra
mostró que EACCES de limpieza sustituía el EIO original; se conserva el resultado
de operación y se informa el residuo sin paths o errores libres. En semántica
también se registra publicación efectiva de cuarentena: vencer al fsync ya no
intenta borrar una copia no creada ni devuelve su ruta por ENOENT. Una copia
protegida que no puede limpiarse queda registrada con aviso estático y fallo
original; no se afirma purga ni limpieza completa.

La autorrevisión encontró la misma falta de propiedad efectiva en cuarentenas
de políticas y SQLite: asignar la ruta antes del link no acredita creación.
Se añadieron seis regresiones rojas (políticas, historial y auditoría): link
exclusivo ocupado eliminaba el destino ajeno; cleanup denegado ocultaba el
error original en SQLite y quedaba silencioso en políticas. Ahora sólo se
limpia una cuarentena publicada por esta operación y los residuos propios
se declaran sin rutas, preservando el fallo de publicación. Las seis pasan.

No cambia IPC/allowlist/preload/wrappers, datos de negocio o dependencias. La
primitiva tiene cuatro consumidores y los motores mantienen sus fronteras.
Fuente canónica:
[persistencia y recuperación](../../../../docs/architecture/integrated-browser-platform.md#persistencia-y-recuperación).

## Verificación dirigida

Ocho suites aprobaron 179 casos. Se añaden 41 respecto de sus suites anteriores:
siete de primitiva, dieciséis de publicación y dieciocho de consumidores. Incluyen
frontera exacta, retroceso/adelanto/no reactivación, consumo, cola, fsync,
proyección, marcador/rollback, dos clases de bloqueo para principal/respaldo,
presupuesto agotado, otros SO/errores, cambios ajenos, contexto/plazo revocados,
link exclusivo, temporal/cuarentena ajenos y limpieza fallida. Comprueban bytes públicos,
copias, caché y residuos; no sólo número de llamadas.

La simulación de plataforma en pruebas unitarias se restaura tras cada caso.
Los relojes se sustituyen sólo en el proceso de QA y se restauran en finally.
No se suben timeouts, workers o tolerancias; las esperas de retry son propias
del contrato nuevo, no un aumento del plazo de aprobación.

## Electron y ajustes del arnés

El recorrido nativo completo final aprobó doce fases y 132 comprobaciones.
Políticas pasa de 19 a 27: bloqueo real transitorio y persistente, consumo/reloj
de intervalo y cuatro motores con DPAPI/SQLite reales, rechazo de revisión
vencida y recuperación restrictiva con otra revisión; límite civil no revivible.
Los hijos PowerShell sólo abren archivos del sandbox con entorno permitido y
se liberan/esperan en finally. No controlan aplicaciones o archivos del usuario.

El primer fixture semántico usó una URL de origen sin slash final y fue
rechazado como fuente inválida. Se corrigió el fixture a URL canónica tras
inspeccionar semanticSource, sin debilitar el validador. Se mantienen los logs
del fallo y los EPERM anteriores al resultado final.

Un recorrido completo posterior pasó políticas y falló al inicio de percepción,
con resultado null y sin artefactos; no conservaba detalle de errores/frames.
Se identificó que el fixture esperaba loadURL y un tick, sin exigir primer
render. Ahora espera ready-to-show antes de capturar, según la API instalada,
y registra métricas de frames/errores propios. No se atribuye retrospectivamente
una causa única al intento sin esos datos. La fase focalizada y el recorrido
completo posteriores pasaron las mismas siete comprobaciones de percepción,
sin relajar aserciones ni repetir capturas hasta que resulten válidas. El cambio
es del arnés y no modifica percepción del producto.

## Autorrevisión adversarial y riesgo residual

Se intentó refutar vigencia tras retroceso, cola y syscall/proyección lenta;
autoridad/bytes tras backoff; preexistencia de temporales; error oculto por
cleanup; éxito falso con caché adelantada; marcador sync borrado ante parcialidad.
Las regresiones rojas y los archivos observados llevaron a correcciones dentro
del alcance. Crear/copiar/quarantinar se restringe a fixtures temporales propios.

Persisten bloqueo multiproceso no garantizado, I/O ambiguo o permanentemente
denegado, syscalls iniciados y residuos de limpieza sin purga automática. Una
recuperación parcial sync requiere intervención bajo otra revisión; no debe
borrarse manualmente el marcador para saltar su bloqueo. No garantiza RPO/RTO,
respaldo portable, corte eléctrico ni toda la política temporal del producto.

Windows/x64 es el único SO nativo ejecutado aquí. Linux/macOS, CI Node 24 y
revisión independiente siguen pendientes. No se leen secretos/.env ni perfiles
reales; no hay SQL remoto, envío de mensajes, commit, push o despliegue. Se
conservan 27 unidades y trabajo ajeno. IRIS e Intel Python mantienen sus
precondiciones externas. El índice experto histórico 50.375% no se recalcula
desde pruebas, backoffs o líneas de código. No se archiva antes de revisión.

Reversión: retirar selectivamente esta implementación sólo por otra que conserve
las regresiones de plazo, ownership, autoridad y bytes; no restaurar Date.now
como único límite ni forzar renames/borrar datos ajenos para pasar un smoke.

## Verificación final

| Comprobación | Resultado final |
| --- | --- |
| Ocho suites dirigidas | 179 aprobadas; 41 nuevas respecto de la unidad 27 |
| Electron real Windows/x64 44.9.3 | 12 fases, 132 comprobaciones; políticas 27, percepción 7 |
| npm run verify:pr | 13 etapas, exit 0; 323.19 s |
| Suite Vitest completa | 5816 aprobadas, 5 omitidas; 506 archivos aprobados, 2 omitidos; 191.78 s |
| Tooling Node | 48 aprobadas |
| Contratos Python stdlib | 33 aprobadas con Python 3.12.11 |
| Typecheck / lint incremental | Ambos aprobados; 377 archivos sin deuda nueva |
| Enlaces Markdown / inventario | 746 documentos activos; inventario de 685 archivos de pruebas sincronizado |
| npm run app:smoke:build | Exit 0; 80.72 s; seis salidas compiladas con hashes |

Se congelaron 3490 fuentes existentes antes del gate/build y se compararon al
terminar ambos procesos. No cambiaron; SHA-256 de ambos manifiestos:
`ca84c90f2f4ff2a867e76c8674683a77a18377b9a6a8e865ca5cafdc6bdbec74`.
HEAD de referencia: e166d250629e503cf12f69449fb6d66e569134c8. Las modificaciones
acumuladas permanecen sin commit; no se presentan como parte de ese commit.

El build enumeró 3471 rutas Git y copió 3470 archivos existentes, todos con
hash idéntico al worktree. La eliminación previa de
electron/wa-agent/bulk-label-verification.ts se omite por ENOENT; no se restauró
ni se cuenta como archivo copiado. No carga .env, empaqueta, arranca la aplicación
completa ni acredita el instalador. Conserva la advertencia conocida de chunks
grandes; no se elevó su umbral.

El perfil nativo final es pulse-browser-smoke-zXzCva. Se cotejaron los módulos
compilados de los cuatro motores, la primitiva de vigencia y percepción con las
fuentes actuales. Los cinco PNG coinciden con sus hashes; firstPaintReady es
true, sin errores de captura, y los cinco frames tienen dimensiones válidas.
Esto acredita el arnés focalizado, sin ampliar su alcance al producto completo.

La primera compuerta también pasó (5810 casos), pero antecede a la corrección
de cuarentenas y no se usa como evidencia del estado final. Se conservan sus
logs con prefijo before-quarantine junto con los seis fallos rojos y el gate
final. Los cambios posteriores al gate sólo completan tareas/reporte/evidencia;
se vuelven a validar documentación, arnés y OpenSpec.

Recibos verificables: [gate](gate-summary.json), [build](build-summary.json),
[Electron](native-summary.json), [fuentes](source-evidence.json) y
[hashes de logs locales](log-evidence.json). Los logs y fixtures voluminosos
permanecen bajo `%TEMP%/soflia-policy-recovery-2026-10-25`; los recibos no incluyen
secretos ni datos reales. Todos los checks locales de esta unidad aprobaron;
las limitaciones y revisión independiente descritas arriba permanecen abiertas.
