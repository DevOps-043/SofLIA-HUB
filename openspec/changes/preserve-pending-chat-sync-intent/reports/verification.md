# Vigencia de sincronización del chat

Estado: evidencia histórica de verificación local; revisión independiente pendiente.
Fecha: 2026-10-25.

## Cambio y alcance

El coordinador conserva una pasada activa y una pendiente fusionada por identidad
en el mismo renderer. Une scopes y absorbe alcance global sólo si se solicita;
errores de un lote no bloquean el siguiente. La pasada separada mantiene orden
de borrados, conversaciones y mensajes, con vigencia antes y después de I/O.

El reconocimiento compara contenido normalizado y confirma escritura local.
Una respuesta antigua no retira otra versión ni publica sobre cache cambiado
o adelantado al turno de autosave. Se mantiene rechazo permanente/transitorio,
prioridad de lápidas/borrado y exclusión de otra identidad. Avisos de esta pasada
son estáticos; no se declara redacción global de otros servicios.

El ID del coordinador no acredita sesión ni concede permisos. La autenticación,
renovación/revocación y RLS del proveedor conservan su autoridad; no hubo pruebas
de cambio de sesión real. La garantía demostrada es de contenido/orden local,
con servicios remotos sustituidos, y no constituye auditoría de autorización.

La firma pública de sincronización, DTO, formato localStorage, Supabase y capas
main/preload/renderer conservan contratos. Sin dependencias, IPC, tablas,
permisos, SQL, secretos/.env, UI real, commit/push o despliegue. Rama acumulativa
y cambios ajenos preservados; respaldos/logs propios en
`%TEMP%/soflia-chat-sync-2026-10-25/`.

## Regresión y verificación dirigida

`intent-valid-red.log` reproduce quince fallos y un caso aprobado con el código
previo: pérdida de pendientes, cache anterior publicado y efectos concurrentes,
incluidos fallos de setItem/removeItem que no deben acreditar retirada.
`intent-initial-invalid-storage-red.log` conserva el primer intento, cuyas sondas
Storage.prototype no alcanzaban el Map global; esos dos casos no se cuentan como
regresiones válidas. Se corrigió el fixture a Storage de jsdom sin modificar el
setup compartido ni el producto para acomodarlo. No se simula persistencia real
de Chromium o cuota de un perfil del usuario.

`intent-first-green.log`: dieciséis casos iniciales aprobados. Después,
`consumers-adversarial.log`: 56 casos en cinco archivos de pruebas del coordinador y
consumidores de mensajes/borrado/rechazos permanentes. La ejecución dirigida
final (`directed-final.log` y `directed-tests.json`) aprueba 57 casos, incluidos
30 nuevos, y añade rechazo de texto privado en los avisos locales. El chequeo de tipos inicial
y lint incremental de 406 archivos también aprobaron. Los verificadores finales
deben acreditar las fuentes actuales, no sólo esta ejecución dirigida.

Los casos nuevos adicionales comprueban errores con continuidad y ciclo siguiente,
diez solicitudes fusionadas en dos efectos, espera de todos los destinos del
lote, copia de filtros, entradas revocadas antes de enviar, otra identidad,
lápidas huérfanas, cache cambiado durante red/corrupto y falta de configuración.
Se sustituyen sólo servicios remotos; coordinador, reconocimiento y cache son
implementaciones reales sobre datos ficticios. No se elevan timeouts ni se
añaden omisiones para obtener verde.

## Autorrevisión adversarial y límites

La primera hipótesis de reconocer sólo el contenido de la cola resultó
insuficiente: saveMessages escribe cache antes de esperar su cadena, por lo que
el dato más reciente puede no estar encolado aún. La revisión de cache exige
elegibilidad previa y valor persistido idéntico al finalizar. Cambios ajenos
bajo la misma clave pueden omitir un refresco canónico de forma conservadora.

Se revisaron liberación de coordinación ante rechazo, scopes dirigidos/globales,
avance de otra identidad, borrado durante espera, payloads heredados
contradictorios, errores de persistencia, JSON corrupto y publicación tardía.
La igualdad JSON de DTO persistidos es conservadora; contenido idéntico es la
misma intención idempotente, sin tokens ni nuevo formato almacenado.

No hay transacción entre ventanas/equipos ni CAS remoto. I/O enviado puede
producir efecto antes de la siguiente pasada; no se afirma cancelación física.
La memoria de solicitudes/callbacks tampoco sobrevive cierres: sólo el estado
pendiente que se haya podido persistir. Cuota, payloads corruptos, autorización
de servidor y cache heredado conservan riesgos ajenos a esta garantía local.
Revisión independiente pendiente; no se archiva ni se usa una ruta alternativa
para la revisión visual bloqueada de una unidad anterior.

## Verificación final

`npm run verify:pr` completó sus trece etapas con código 0 en 318.83 s:

- Vitest: 5,896 aprobadas y cinco omitidas; 509 archivos aprobados y dos omitidos
  (511 total), duración 193.63 s. Se conservan las 5,866 aprobadas anteriores
  y se agregan los treinta casos de esta unidad.
- Tooling: 51 aprobadas. Python 3.12.11: 33 aprobadas con el intérprete QA
  seleccionado mediante `SOFLIA_TEST_PYTHON`.
- Tipos, harness, runtime estable, supply-chain y especificaciones aprobados.
  Lint: 406 archivos sin deuda nueva; enlaces válidos en 769 Markdown activos.
  Inventario derivado de 690 archivos de prueba, distinto de suites ejecutadas.

`npm run app:smoke:build` aprobó con código 0 en 70.33 s en
`pulse-app-build-Ls8JPs`. Se verifican seis artefactos no vacíos y 3,488 fuentes
copiadas con hash coincidente. Enumera 3,489 rutas Git; la diferencia es la
eliminación local preexistente `electron/wa-agent/bulk-label-verification.ts`,
preservada y omitida al copiar. Sin `.env`, instalador, arranque completo ni
cuentas reales. Permanecen visibles avisos de chunks/imports dinámicos.

Las 3,508 fuentes del manifiesto ampliado permanecieron idénticas antes/después
de gate/build. SHA256 del manifiesto:
`d138aff4ca291d27b6ac88bfa7227521a93d168bbb0b8945d093d4d745dfc1f2`.
Respecto a la unidad 31 cambian cinco fuentes y se agregan cuatro; manifiesto,
lock y dependencias no cambian. Los ajustes posteriores sólo son docs/tareas/
recibos, con verificaciones documentales separadas y sin repetir el producto
sin cambios.

Recibos: [regresión y 57 casos dirigidos](regression-summary.json),
[gate](gate-summary.json), [build](build-summary.json),
[fuentes](source-evidence.json), [logs](log-evidence.json).
Comandos completos en `gate-final.log` y `build-final.log` del temporal indicado.
Node local 26.7.0 y Electron 44.9.3; CI Node 24/otros SO, instalador y revisión
independiente siguen pendientes. No hay nueva auditoría npm ni evaluación
comparable del índice global; estos resultados no generan otro porcentaje de deuda.
