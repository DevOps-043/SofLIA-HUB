# Verificación de operaciones directas del buzón Gmail

Estado: implementada y verificada localmente; revisión independiente pendiente.
Fecha: 2026-10-22.
Rama: codex/reduce-technical-debt. Base: e166d250629e503cf12f69449fb6d66e569134c8.
Se preservan las seis unidades anteriores, sin commit, push ni mutación remota.

## Resultado

Nueve canales Gmail que usaban un wrapper sin validar caller ahora comprueban
actor, ventana registrada, frame principal, documento y payload cerrado. Las
seis mutaciones exigen aprobación contextual antes de producir efectos. Se
mantienen canales, firmas posicionales y capas servicio/handler/preload/wrapper.
Los DTO y esquemas públicos se comparten; se retiran any de fronteras tocadas y
la duplicación de EmailMessage. Runtime mantiene sus guardas previas sin nuevos
permisos ni herramientas.

El contexto de cuenta extraído de planes fija propietario, revisión, conexión y
cliente; las mutaciones comparten su exclusión por cuenta. Señal de cancelación,
solicitudes de hasta 15 segundos sin retry y presupuesto de trabajo de hasta
90 segundos se conservan. La aprobación humana tiene su propia vigencia y no
consume el presupuesto posterior de ejecución.

Las referencias de etiquetas se preparan antes de crear ninguna. No se ignoran
las etiquetas desconocidas a quitar; ambigüedades y añadir/quitar la misma
etiqueta se rechazan. Crear por nombre no interpreta el nombre como el ID de
otra etiqueta. Las etiquetas de sistema pueden originar lotes coherentes de
mensajes, como archivar INBOX, y nunca se eliminan como etiquetas.

El vaciado anterior repetía la primera página, dependía de que la mutación
retirase origen y podía perder conteos tras errores. Ahora selecciona todas las
páginas antes de aprobar/mutar, con límites y detección de duplicados/ciclos.
Sólo se toca el snapshot aprobado; no se amplía con mensajes recién llegados.
Antes de borrar tras vaciado se verifica vacío. La limpieza total deja de
declarar éxito con errores, se detiene al primer fallo y conserva confirmaciones.

`effectsConfirmed` cuenta solicitudes de escritura, `processed` mensajes del
lote y `totalMessagesMovedToInbox` membresías por etiqueta (no necesariamente
mensajes únicos). Se devuelven partial/uncertain/recoveryRequired/conflict según
el resultado. `remaining` desconocido no se transforma en cero; los nombres
restantes llevan `remainingLabelsVerified`. Un ID efímero de operación permite
correlacionar fallos sin registrar payload, cuentas, mensajes ni errores crudos.

## Evidencia ejecutada

| Comando / ámbito | Resultado |
|---|---|
| Baseline: servicio, planes, IPC de planes y SDK de planes | 4 archivos, 63 pruebas aprobadas |
| Dirigida de once suites | 224 pruebas aprobadas antes de los dos casos finales de compatibilidad |
| Compatibilidad final: operaciones e IPC | 2 archivos, 86 pruebas aprobadas |
| SDK real con fetch simulado | 503 sin retry, cancelación previa al transporte y contrato POST de papelera aprobados |
| npm run calendar:smoke:native | DPAPI real y módulos compartidos aprobados en tres procesos Electron 44.5.1 |
| npm run app:smoke:build | Final aprobado tras compatibilidad: 3297 fuentes, seis artefactos sin .env |
| npm run verify:pr | Aprobado: 4774 pruebas, 5 omitidas; 453 archivos aprobados y 2 omitidos; suite de 228,59 segundos |

Se añadieron 92 casos en cuatro suites y un fixture compartido: el inventario
derivado registra 623 archivos de prueba y 494 canales. La compuerta final también
aprueba tipos, 106 archivos de lint sin deuda nueva, 77 elementos OpenSpec,
cuatro pruebas de tooling, adaptadores, arnés, política de dependencias,
documentación/enlaces y semilla de skills. Los primeros checks detectaron
tipos demasiado amplios del handler heredado, inferencias de mocks y tres
incidencias nuevas de lint: se corrigieron sin desactivar reglas ni ampliar
baseline. El primer build aprobó antes de la corrección de compatibilidad; se
repite para acreditar el código final, sin confundir snapshots.

Logs temporales bajo `%TEMP%/soflia-gmail-mailbox-2026-10-22/`: baseline.log,
directed-final.log, compatibility-final.log, adversarial-tests.log,
build-compatible-final.log, native-final.log y verify-pr-final.log. Los resúmenes
versionados conservan la evidencia esencial aunque caduquen los temporales:
[verificación](verification.json), [build](build-summary.json),
[seis artefactos con hashes](build-artifacts.json) y [DPAPI](native-summary.json).
Persisten advertencias preexistentes de tamaño de chunks, Vite y Node; no se
silencian ni se presentan como mejoras de rendimiento o seguridad.

## Autorrevisión adversarial

| Hipótesis intentada | Evidencia / corrección |
|---|---|
| Un frame, usuario, documento o payload ajeno llega al SDK | Nueve canales rechazan caller/argumentos; listeners liberados y ausencia de cliente/efectos |
| Cancelar o A/B/A/navegación conserva una aprobación utilizable | Seis rutas de escritura cancelan sin efectos; señales y guardas invalidadas tras esperas |
| Un listado parcial u otro ID se devuelve como selección completa | Detalles faltantes o ID de respuesta distinto rechazan la lectura |
| Resolver referencias deja etiquetas creadas antes de descubrir un error | Preflight de todas las referencias, ambigüedad nombre/ID y conflictos antes de efectos |
| El lote vuelve a tocar mensajes que mantienen origen | Selección de 101 mensajes en dos páginas, dos lotes con 101 IDs únicos y sin vaciado repetitivo |
| Un segundo fallo hace desaparecer cien confirmaciones | Conteos preservados en servicio e IPC, incluso al invalidar la cuenta tras el acuse conocido |
| Fallar un borrado o verificación anuncia éxito | Error parcial con avance, remaining desconocido y ausencia de borrados posteriores |
| Se borran mensajes nuevos o una etiqueta protegida | Snapshot fijo, conflicto al quedar mensajes, sistema protegido y archivo desde INBOX compatible |
| Un nombre duplicado borra otra entrada del registro de avance | Etiquetas pendientes identificadas por ID, no por nombre; caso negativo cubierto |
| Un listado sin tipo se interpreta como limpieza completa | Preparación/verificación rechazan clasificación ausente sin éxito falso |
| Retry del SDK duplica una escritura o abort llega demasiado tarde | SDK/OAuth2 reales con fetch simulado: un POST tras 503 y cero POST tras abort durante interceptor |

No hay hallazgos bloqueantes conocidos en los nueve canales y el servicio
modificados. La inspección de consumidores detectó una deuda runtime separada:
`electron/wa-agent/bulk-label-verification.ts` añade al modelo una orden de seguir
vaciando etiquetas tras modificaciones individuales exitosas, aunque su selección
original fuera menor. Además registra IDs/errores crudos. Lotes, limpieza y
planes no añaden etiquetas a ese conjunto de verificación, pero sí las
modificaciones individuales: puede ampliar el alcance de una secuencia runtime
que las incluya. Se
registra como siguiente unidad de reducción, sin certificar esa política legacy.
La autorrevisión no sustituye revisión independiente; permanece pendiente antes
de archivar.

## Límites y reversión

- Las operaciones directas conservan progreso en memoria durante la llamada;
  no hay diario durable, reanudación ni garantía exactamente una vez tras un
  crash. Revisar Gmail antes de repetir fallos parciales/inciertos. Los planes
  conservan su store/diario separado.
- Gmail no ofrece transacción con el proceso ni CAS de etiquetas. Persisten
  carreras entre consulta y escritura; el snapshot no es una transacción remota.
- Preparación hasta 50000 membresías/100 etiquetas en limpieza; solicitudes y
  tiempo acotados pueden rechazar operaciones grandes. No hay benchmark ni SLO.
- Google/fetch simulados con token ficticio. Sin buzón, correo o credenciales
  reales, sin inspección humana del diálogo ni Hub/instalador iniciado.
- El smoke DPAPI acredita custodia compartida, no el flujo completo de Gmail.
  No hay validación nativa Linux/macOS ni nueva auditoría de dependencias.
- Configuración de confirmaciones y permisos runtime previos preservada; no se
  certifica toda esa superficie por endurecer IPC. El feedback de vaciado legacy
  indicado arriba requiere una unidad propia con pruebas del loop/agente.
  El índice global no se
  recalcula a partir del número de pruebas.

Revertir sólo esta unidad y su extracción de contexto conserva las seis unidades
anteriores y sus diarios cifrados. No retirar registros de planes para intentar
repetir operaciones directas. Revertir código no revierte mensajes/etiquetas ya
aceptados por Google; la reconciliación requiere revisión y aprobación propias.
