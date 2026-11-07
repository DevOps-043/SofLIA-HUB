# Publicación síncrona integrada de recuperación

Estado: implementación, pruebas dirigidas/nativas, gate y build aislado aprobados.
Unidad 29 acumulativa. Fecha: 2026-10-25. Rama: codex/reduce-technical-debt.
Sin archivar; revisión independiente pendiente.

## Hallazgo y resultado

Memoria semántica, SQLite (historial/auditoría) y sync repetían publicación
síncrona. Si fallaba escribir/fsync/publicar y luego cerrar o limpiar, el
finally sustituía la primera excepción. Se reproducen ocho casos consumidores
rojos con el código de la unidad 28 y el fixture final: ocho fallos y 107 casos
no seleccionados por filtro, distintos de omisiones de la suite general.

El fixture inicial de SQLite interceptaba también su proyección previa. Se
acotó al fsync de publicación o al temporal que intenta el rename principal;
no se retiraron aserciones. Se repitió contra las tres fuentes originales
guardadas en TEMP y se restauraron las fuentes de esta unidad en finally,
comprobando sus hashes. El recibo de restauración queda en el directorio QA.

La nueva primitiva conserva el fallo de escritura/fsync frente a cierre, y el
fallo de publicación frente a limpieza. Cierre se intenta una sola vez; si es el
primer fallo impide publicar. Sólo se limpia un temporal creado. El éxito ya
comprometido no cambia por limpieza fallida. Los avisos no serializan destinos,
contenido ni Error. Tres consumidores reales reemplazan sus copias sin cambiar
fachadas, formatos, cifrado, cuotas, revisiones, guardas o IPC.

La primera implementación introdujo throw condicional en finally. Lint lo
rechazó (no-unsafe-finally); se cambió a precedencia explícita antes de la
publicación sin desactivar reglas. Se retiraron parámetros/ramas tolerantes
sin consumidores de las limpiezas estrictas de SQLite/sync. Éstas conservan
rechazo para borrados deliberados.

La autorrevisión añadió una novena regresión: retirar marcador sync falla y su
compensación también. Antes devolvía el segundo error; ahora mantiene el primero,
avisa del residuo protegido y conserva marcador/bloqueo. Otra revisión válida
revierte bytes exactamente; no trata el estado aplicado como un éxito completo.

## Pruebas y alcance

Nueve suites dirigidas aprueban 205 casos. Hay 26 nuevos frente a la unidad 28:
17 de primitiva y nueve de consumidores. Se comprueban bytes, guardas, temporal
ocupado, link exclusivo, orden fsync/cierre/publicación, fallos en cada etapa,
errores dobles, identidad aun con mensajes iguales, residuos y rollback sync.
Los casos existentes de borrado/retención rechazados siguen pasando.

El arnés agrega cinco comprobaciones de disco real: creación/reemplazo,
exclusividad, guarda revocada tras fsync, fallo doble de fsync/cierre y fallo
doble de rename/limpieza. Los fallos se limitan a una llamada síncrona y se
restauran en finally. El fixture de close cierra el descriptor real antes de
simular resultado ambiguo; no acredita un cierre real denegado por el SO.
Los módulos consumidores siguen corriendo con SQLite y DPAPI reales en la fase
existente. No usa perfiles/cuentas, red remota, credenciales ni archivos reales.

## Autorrevisión y riesgos residuales

Se intentó refutar precedencia/identidad del error, propiedad de temporal y
cuarentenas, guarda tras preparación, no publicación con cierre fallido, éxito
falso de cleanup y retirada del marcador ante parcialidad. Se corrigieron las
regresiones anteriores sin elevar timeouts, workers, cuotas o baselines.

Si close falla, no se sabe si liberó descriptor; no se reintenta ese número ni
se promete ausencia de recursos abiertos ante ese fallo real del SO. Un residuo
no eliminable se informa; no hay purga automática. El archivo compensatorio
sync retenido ocupa cuota. No hay bloqueo multiproceso ni garantía ante corte
eléctrico, RPO/RTO o copia portable. Lecturas, proyecciones y preparación de
snapshots auxiliares siguen fuera de la primitiva y conservan sus propios ciclos.

La publicación asíncrona de políticas conserva su retry Windows y no se mezcla
con la síncrona. No hay backoff bloqueante nuevo. Las guardas/cifrado/plazo y
confirmaciones siguen siendo responsabilidad de los motores y sus fachadas.
Sólo Windows/x64 se ejecuta nativamente aquí; Linux/macOS, CI Node 24 y revisión
independiente pendientes. Las fuentes locales usan Node 26.7.0/Electron 44.9.3.

No se leen secretos/.env, no hay SQL remoto, mensajes, commit, push o despliegue.
Se conservan las 28 unidades anteriores y cambios ajenos. IRIS/macOS Intel
mantienen sus precondiciones externas; el usuario no dispone de entorno Intel.
No se recalcula el índice experto histórico 50.375% desde estos resultados.

Reversión: sustituir selectivamente esta implementación conservando regresiones
de propiedad, guarda y errores; no restaurar finally que oculte el fallo primario
ni usar limpieza tolerante para eludir un borrado deliberado fallido.

Las aserciones de privacidad comparan rutas escapadas mediante JSON.stringify,
además de rechazar mensajes de error ficticios. Evitan un falso negativo por
dobles barras Windows en el JSON de diagnóstico; no se cambia el producto para
satisfacer esa comprobación.

Fuente canónica: [persistencia y recuperación](../../../../docs/architecture/integrated-browser-platform.md#persistencia-y-recuperación).

## Verificación final

| Comprobación | Resultado final |
| --- | --- |
| Pruebas dirigidas | 205 aprobadas en nueve suites; 26 casos nuevos |
| Electron real 44.9.3 Windows/x64 | 12 fases, 137 comprobaciones; políticas 32, percepción 7 |
| npm run verify:pr | 13 etapas, exit 0; 315.88 s |
| Vitest completo | 5842 aprobadas, 5 omitidas; 507 archivos aprobados, 2 omitidos; 192.67 s |
| Tooling Node / contratos Python stdlib | 48 y 33 aprobadas; Python 3.12.11 |
| Typecheck / lint incremental | Aprobados; 381 archivos sin deuda nueva |
| Documentación / inventario | 752 Markdown activos; 687 archivos de pruebas derivados |
| npm run app:smoke:build | Exit 0; 70.71 s; seis salidas compiladas con hashes |

Las 3494 fuentes existentes se congelaron antes de la última prueba nativa,
gate y build, y se compararon tras terminar ambos procesos. Sin cambios;
SHA-256 de ambos manifiestos:
`eafaceaf9d531552e083dd508f13f7d233a40efcdbf1540e7f3d361d063d6d2d`.
El build enumeró 3475 rutas Git y copió 3474 archivos existentes con idéntica
huella al worktree. La eliminación previa de
electron/wa-agent/bulk-label-verification.ts se omite por ENOENT; no se restaura
ni cuenta como archivo copiado. No carga .env ni acredita empaquetado,
instalador o arranque completo. Conserva la advertencia conocida de chunks
grandes sin elevar su umbral.

El perfil nativo final es pulse-browser-smoke-Y4Ih9x. Siete módulos recompilados
coinciden con las fuentes actuales, incluidos la nueva primitiva, los tres
consumidores y las guardas compartidas verificadas. Los cinco PNG de percepción
coinciden con sus hashes; firstPaintReady es true y no hay errores de captura.
Los tres recorridos nativos completos de esta unidad aprobaron 137 comprobaciones;
el último incluye las aserciones finales de privacidad. Sigue siendo un arnés
focalizado, sin ampliar evidencia al producto completo.

Las tres fuentes usadas como código previo coinciden con las huellas de la
unidad 28. El recibo de restauración conserva los hashes comprobados al devolver
las fuentes nuevas tras la ejecución roja. No se hicieron commits, resets ni
cambios en otros worktrees. Tras el gate sólo se completaron tareas y reportes;
se vuelven a validar enlaces, catálogo documental, arnés y OpenSpec.

Recibos: [gate](gate-summary.json), [build](build-summary.json),
[Electron](native-summary.json), [regresiones](regression-summary.json),
[fuentes](source-evidence.json) y [logs](log-evidence.json). Logs/fixtures
voluminosos permanecen en `%TEMP%/soflia-recovery-publication-2026-10-25`;
no se incluyen secretos ni datos reales. Revisión independiente y plataformas
pendientes según los límites anteriores; no se archiva este cambio.
