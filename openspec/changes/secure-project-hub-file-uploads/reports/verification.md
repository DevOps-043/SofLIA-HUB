# Subida nativa de archivos Project Hub

Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base: e166d250629e503cf12f69449fb6d66e569134c8.
Estado: implementada y verificada localmente; revisión independiente pendiente.

## Resultado y contratos

Se retiran create-upload-intent/complete-upload del handler, allowlist, preload
y wrapper renderer. Sus métodos main continúan el protocolo v1 interno. Se
añaden upload-files/cancel-upload: mismo número de canales, destino e ID UUID
de operación, sin rutas/bytes/URLs/tokens recibidos del renderer. Se migra el
único consumidor UI al selector main y se cancela por botón, desmontaje o
cambio de proyecto. El hook descarta respuestas anteriores y comunica avance.

Main comprueba destino y presenta selección nativa y aprobación del lote. Los
archivos se abren como regulares sin symlink final, comparando lstat/fstat;
hash por bloques y handles retenidos. Tras aprobar se relee un archivo completo
a la vez, exige hash/tamaño iguales y envía ese buffer. Firma local no equivale
a antivirus ni valida estructura OOXML completa. Texto requiere UTF-8 sin NUL.

Por archivo: intención individual, respuesta única, evidence UUID nuevo y path
exacto workspace/project/evidence.ext. La URL sólo puede ir al origen público
configurado de Storage y ruta project-files exacta, con un único token igual
al devuelto. PUT sin cookies/bearer de sesión, redirects ni retry. Complete
sólo después de PUT exitoso y sólo cuenta confirmado con evidence/workspace/
project coincidentes y metadata.upload_state=ready. Un HTTP 200 solo no basta.

Preparación no crea intenciones hasta validar y aprobar todo el lote. Fallos
detienen el siguiente efecto y conservan requested/prepared/stored/uploaded
confirmados; uncertain/recoveryRequired no prometen rollback ni repetición
segura. Una selección activa por registro; el picker cancelado conserva el
slot hasta cerrar. La confirmación comparte exclusión con las mutaciones de
dominio. Presupuesto de trabajo desde aprobación y señales caller/sesión/lote
protegen lecturas y HTTP. No hay journal, reanudación ni borrado remoto.

El contrato del servidor se inspeccionó sólo como código local: schemas.ts,
files.ts y routes files/intents/complete en Project Hub. El SDK instalado
storage-js construye object/upload/sign y token de query. No se añadió SDK ni
dependencias. Esta evidencia no acredita bucket/API desplegados; el host
permitido proviene de VITE_IRIS_SUPABASE_URL en main, nunca de datos remotos.

## Evidencia dirigida

Logs propios: `%TEMP%/soflia-project-uploads-2026-10-22/`.

| Verificación | Evidencia |
|---|---|
| Baseline Project Hub | 271 casos en 11 archivos, salida 0; baseline.log. Gate previo: 5160 aprobados, cinco omitidos. |
| Reproducción antes de implementar | Dos fallos de exposición de primitivas de subida/allowlist; surface-red.log. La ausencia de validación/redirect/cancelación se confirmó por inspección del wrapper anterior. |
| Suite dirigida final | 322 casos en 17 archivos, salida 0; directed-final.log. Incluye los contratos previos migrados: las dos primitivas retiradas ya no se prueban como capacidades renderer vigentes. |
| Archivos reales | Temporales ficticios: hash/bytes, cuotas/tipos/firmas/texto inválido, mutación del mismo tamaño, rename con handle estable, cancelación y cleanup. project-hub-upload-files.test.ts. |
| Destino/protocolo | Host/path/token/query/bucket/userinfo/fragment/UUID/extensión/cantidad y orden intent/PUT/complete; no retry, parcial y cancelación. Respuesta ready del destino obligatoria. project-hub-upload.test.ts. |
| HTTP real | Loopback, servicio main y archivos ficticios: bytes exactos, sin Authorization de sesión en Storage, 307 no seguido, aborto con conexión cerrada y A/B/A sin intención. Timeout PUT con reloj/fetch simulados. project-hub-upload-http.test.ts. |
| IPC/renderer | Caller/aridad/payload, sólo rutas nativas, selector cancelado, cancelación por ID exacto, slot pendiente y exclusión compartida de confirmación; preload/safeIpc reales. Hook: cancelación, desmontaje/cambio de proyecto, respuesta tardía y parcial. project-hub-upload-ipc.test.ts y src/__tests__/services/project-hub-upload.test.ts. |
| Electron nativo | Nueve comprobaciones aprobadas; native-final.log. Ventanas ocultas y perfil temporal, sandbox/contextIsolation, preload/IPC reales, red bloqueada. Nueva subida verifica rutas elegidas sólo en main y resultado sin nombres/rutas; servicio, selector y respuesta de confirmación simulados. |
| Build aislado | app:smoke:build, salida 0: 3346 fuentes y seis artefactos. Trece archivos de producción afectados coinciden por SHA-256 con el worktree; [resumen y huellas](build-summary.json), build.log. Sin .env, empaquetado, bootstrap ni cuentas reales. |
| Inventario | Derivado por docs:inventory:sync: 647 archivos de prueba y 494 canales; inventory.log. OpenSpec estricto válido, openspec.log. |
| Gate final | verify:pr, salida 0: 5211 casos aprobados, cinco omitidos; 475 archivos aprobados y dos omitidos, 212,38 s de suite. Tipos, 187 archivos de lint sin deuda nueva, arnés, documentación, suministro y tooling aprobados. [Resumen](gate-summary.json), verify-pr-final.log. Aumento neto de 51 casos respecto al gate anterior. |

Se conservan [contratos/huellas](contracts.json) del servidor/SDK inspeccionados
y el [informe nativo](native-ipc.json). No contienen credenciales reales.
El build precede al ajuste del reloj de la prueba SQLite; se comprobaron de
nuevo los trece hashes de producción sin cambios, y el gate final ejecutó
tipos y pruebas con la reparación incluida. Enlaces finales: 649 Markdown
activos válidos y sistema con 647 archivos de prueba; docs-delivery.log y
system-delivery.log.

Un primer test parametrizado pasaba la fila como argumentos de Vitest en vez
de como array; sus cuatro fallos de fixture constan en ipc-first.log. Se
corrigió la tabla con objeto args, sin cambiar validación para hacerlo pasar.
La creación CLI encontró el directorio de esta misma unidad ya escrito al
terminar su inicialización; se continuó el cambio existente con instrucciones
y validación del CLI, sin sobrescribir otro cambio ni duplicarlo.

## Autorrevisión adversarial y límites

Se intentó refutar aislamiento con caller/subframe/origen ajenos, rutas
inyectadas, payload extra, cancelación mientras picker sigue abierto y
navegación. Se comprobaron tipos/buffers inválidos, exceso de selección/tamaño,
archivo alterado, intención de otro host/path y resultados sin ready. Se
verificaron cancelación del PUT, no complete tras fallo, detención del siguiente
archivo y conservación del primero confirmado.

La revisión reforzó dos aspectos: respuesta complete debe acreditar misma
evidencia ready, y la confirmación de lote debe compartir exclusión con las
otras mutaciones Project Hub. El smoke nativo y las pruebas de IPC conservan
esas condiciones. No constituye revisión independiente ni prueba humana de
diálogo/selector. No se archiva el cambio por un gate verde.

El primer verify:pr finalizó con un fallo ajeno al uploader: recuperación del
historial esperaba una visita en el respaldo y encontró dos, con 5210 casos
aprobados y cinco omitidos; verify-pr.log. La política de producción rota si la
edad de la copia es negativa o llega a 30 s. La prueba no controlaba esa edad.
Se reprodujo determinísticamente el mismo fallo en history/audit poniendo el
reloj un milisegundo antes de mtime, sqlite-clock-red.log (dos fallos). Se fijó
el reloj de la prueba dentro de la ventana de primera generación, sin cambiar
la expectativa ni producción; los 32 casos de recuperación pasan en
sqlite-clock-green.log. La causa temporal reproduce el resultado; no se retuvo
la diferencia exacta de relojes del proceso original. El gate se repite después
de esta reparación de fiabilidad, sin ampliar baseline ni desactivar casos.

Pendientes: descargas firmadas, huérfanos y reconstrucción de avance después de
cierre abrupto; validación antivirus/estructura OOXML; permisos/RLS/revocación
del servidor y accesos IRIS directos. Las 30 tablas sin RLS de la inspección
anterior siguen pendientes. Los límites locales no son un benchmark ni SLO.
Cancelar un efecto ya enviado no garantiza detenerlo remotamente; revisar el
proyecto antes de repetir. No hubo cuentas reales, escrituras remotas, SQL,
despliegue ni recalculo del porcentaje global de deuda.

Revertir coordinador, servicio/handler, allowlist/preload, wrapper/hook/UI y
pruebas/docs de esta unidad juntos, preservando trece unidades anteriores.
El downgrade reabre exposición de URLs/tokens y PUT renderer, y no es una
mitigación de seguridad. No se eliminan perfiles ni credenciales heredadas.
