# Copia local de archivos Project Hub

Fecha local: 2026-10-22. Rama: codex/reduce-technical-debt.
Base: e166d250629e503cf12f69449fb6d66e569134c8.
Estado: implementada y verificada localmente.
Revisión independiente pendiente; no se archiva el cambio.

## Resultado y contratos

get-download se retira de handler/allowlist/preload/wrapper. download-file y
cancel-download sólo reciben IDs UUID; 23 canales Project Hub y 495 globales,
derivados de los arrays vigentes. El protocolo main getDownload conserva la
ruta del servidor. No se entregan URL/token/bytes/ruta local al renderer.

Se captura identidad/caller hasta finalizar. Evidencia requiere upload ready,
no archivada, IDs/MIME/extensión/tamaño/hash/path coincidentes. Confirmación
nativa muestra archivo/hash/tamaño y proyecto comprobado; SaveDialog main elige
una copia nueva. La URL se pide después: origen público configurado, ruta
object/sign/project-files exacta, un token y TTL 1–300 s. GET de bytes sin
cookies/bearer, redirect ni retry. Longitud exacta/hash/formato se comprueban
antes de publicar; 20 MiB máximo, 30 s bytes y 90 s desde elección de destino.

Formato y origen se extraen de upload para dos consumidores; un registro
compartido permite una operación de archivo activa. Cancelación compara
tipo/id/actor/WebContents/frame; selector pendiente retiene el slot. Se
mantiene exclusión de confirmación con las mutaciones de dominio.

Staging exclusivo modo 0600, sincronización/cierre y hard link exclusivo al
destino. Una colisión, aun en el commit, conserva el archivo existente. No se
abre/ejecuta ni se sobrescribe. Sólo se limpia staging propio. Si se publica
antes de cancelar, saved=true/bytes conservan ese hecho y piden revisar destino.
Si link no confirma el resultado, uncertain/recoveryRequired prevalecen sobre
cancelación: saved=false sólo significa que no se acreditó commit, no ausencia
de archivo. La UI pide comprobar el destino antes de repetir.
El hook cancela por botón/desmontaje/cambio de proyecto e ignora respuestas
obsoletas; vista por key retira listas/acciones del destino anterior. No se
refactorizan otros flujos asíncronos de esta vista.

## Evidencia

Logs: `%TEMP%/soflia-project-downloads-2026-10-22/`.

| Verificación | Resultado |
|---|---|
| Baseline | 322 casos en 17 archivos, salida 0; baseline.log. Gate anterior 5211 aprobados y cinco omitidos. |
| Reproducción | surface-red.log: un fallo y dos casos aprobados antes de implementar, prueba de getDownload/URL aún públicos. |
| Metadata/disco | project-hub-download.test.ts: IDs/ready/archivo/hash/path/MIME/URL, bytes alterados, tamaño/texto/firma, firma en fragmentos de un byte, colisiones antes/durante commit, directorio cambiado, fallo de link y cancelación antes/después de publicar. Archivos temporales ficticios reales. |
| HTTP | project-hub-download-http.test.ts: servicio/loopback/disco reales ficticios, bearer sólo en API, Storage sin bearer/cookies, 307 sin seguimiento, hash/exceso, aborto del cuerpo con conexión cerrada y A/B/A durante selector. Timeout con reloj/fetch simulados. |
| IPC | project-hub-download-ipc.test.ts: caller/payload, HITL/selector, cancelación tipo/id/frame, navegación, slot compartido upload/download, resultado guardado tardío y preload/safeIpc sin getDownload. Servicio/diálogo simulados. |
| Renderer | Wrapper/hook sin rutas/URL; cancelación, desmontaje/proyecto y respuesta tardía. UnifiedProjectHub.test.tsx comprueba copia sólo para ready, cancelación y retirada inmediata de lista/acción al cambiar destino. |
| Suite dirigida revisada | 385 casos en 22 archivos, salida 0; directed-reviewed.log. Incluye subida, custodia, autorización IPC y nuevas descargas; neto 63 respecto al baseline. |
| Electron | Diez comprobaciones aprobadas, native-final.log e informe native-ipc.json. Perfil temporal, ventanas ocultas, sandbox/contextIsolation, preload/IPC/frame/navegación reales; servicio y selectores simulados, red bloqueada, sin SOFIA/IRIS clients/dotenv/bootstrap. |
| Build revisado | app:smoke:build, salida 0: 3359 fuentes, seis artefactos y 19 archivos de producción afectados idénticos por SHA-256 al worktree; build-reviewed.log y build-summary.json. Sin .env, empaquetado ni arranque. Sustituye como evidencia final el primer build anterior al ajuste de incertidumbre. |
| Firmas main | AST TypeScript contra snapshot del build previo: conserva las 27 firmas públicas anteriores y añade downloadFile con autorización explícita; contracts.json. |
| Lint | 200 archivos revisados sin deuda nueva, salida 0; lint-first.log. |
| Inventario | 652 archivos de prueba y 495 canales derivados; inventory.log. |
| Gate final | verify:pr, salida 0: 5274 casos aprobados y cinco omitidos, 480 archivos aprobados y dos omitidos; 241,65 s de suite. Tipos, lint de 200 archivos sin deuda nueva, arnés, documentación, suministro y tooling aprobados. verify-pr-final.log y [resumen](gate-summary.json). Neto 63 casos aprobados respecto al gate anterior. |

Los 19 hashes de producción del build revisado coinciden de nuevo tras la
compuerta final. [Resumen de build](build-summary.json), [contratos](contracts.json)
y [smoke nativo](native-ipc.json) conservan resultados y límites.
Un primer filtro con asteriscos literales en PowerShell sólo ejecutó los dos
casos del componente (directed-final.log); la ejecución dirigida válida usa
filtros project-hub/UnifiedProjectHub (directed-all.log). No se presenta la
selección incompleta como cobertura del módulo.

El typecheck detectó una firma sobrecargada del mock de showMessageBox; se
tipó el tuple de la llamada con ventana y opciones de Electron. No se cambió
producción para acomodar la prueba. El caso de firma PDF se reforzó para llegar
realmente a los bytes con destino/URL PDF, en vez de fallar antes por extensión.

## Autorrevisión adversarial y límites

Se intentó refutar origen/path/bucket/token/TTL, metadata de otro proyecto,
archivo archivado/pending, bytes discordantes y nombres de ruta remotos.
Se comprobaron cancelación en red, A/B/A en selector, colisión en link y commit
previo a cancelación. La revisión añadió firma fragmentada en chunks de un byte
y colisión atómica, conservando subida y su protocolo. Sin resultados inventados
del servidor: [contratos y huellas](contracts.json) corresponden sólo al código
local inspeccionado, no a un despliegue.

Inyección de fallo: link publica y luego rechaza su confirmación mientras se
cancela. commit-uncertain-red.log reproduce un fallo con 34 casos aprobados:
se respondía sin incertidumbre y la UI podía afirmar ausencia de copia. Se
corrige conservadoramente con DOWNLOAD_COMMIT_UNCERTAIN y mensaje de revisión;
no se borra la copia. La suite dirigida revisada de 385 casos incluye el caso
y su resultado renderer, sin afirmar que hubo ese fallo en un filesystem real.

La primera compuerta (verify-pr.log) terminó con 5272 casos aprobados, uno
fallido y cinco omitidos. Su ejecución coincidió con la incorporación de la
prueba/corrección de incertidumbre; el nuevo caso renderer observó el mensaje
anterior. No se usa esa ejecución como evidencia del estado final. Después
de la suite dirigida verde se repiten build y compuerta con fuentes estables,
sin cambiar pruebas ni producción durante su ejecución.

No acredita prueba humana de diálogo/selector, antivirus ni estructura OOXML
completa. Un filesystem sin hard links falla sin copia parcial; no hay fallback
de sobrescritura. Crash/cleanup fallido pueden dejar staging propio; no se hace
barrido ni reanudación. No se garantiza integridad contra un actor local con
escritura en el directorio elegido/control del usuario del SO. Un enlace emitido
puede vivir hasta expirar aunque no se entregue al renderer.

Persisten RLS/revocación del servidor, accesos IRIS directos y huérfanos de
subida tras cierre abrupto. La inspección anterior de 30 tablas sin RLS no se
considera remediada por esta unidad. No hubo cuentas reales, escrituras remotas,
SQL, despliegue ni porcentaje global recalculado. Las cuotas no son SLO ni
benchmark. Esto es autorrevisión, no revisión independiente.

Rollback conjunto de servicio/coordinador, handlers, formatos/registro,
allowlist/preload/wrapper/hook/UI y pruebas/docs de esta unidad, preservando
las catorce unidades anteriores. El downgrade reexpone get-download y no es
una mitigación de seguridad. Copias aprobadas y staging no se borran al revertir.
