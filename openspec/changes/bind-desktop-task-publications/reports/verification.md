# Verificación del lote 45

Fecha: 2026-10-27. Verificado localmente; revisión independiente pendiente.

## Alcance y pruebas dirigidas

Publicaciones/respuestas de tareas Desktop ligadas a identidad originaria y
revisión main. AsyncLocalStorage conserva la lease de ejecución; el EventEmitter
filtra eventos y WeakMap acredita sólo la copia admitida, sin campos nuevos de
autoridad en DTO. Forwarding revisa antes de modificar marcas. Memoria usa
snapshot, propietario originario, consumo único y revalidación por escritura.

Las tres colas conservan contexto y reserva síncrona; señales llegan a contratos
internos BrowserWeb/UIA sin serializarlas al renderer. El control task-aborted
mantiene aviso mínimo con sesión main, sin aprender de ese aviso. No se cambian
canales, autorizaciones/HITL, política de modelos o dependencias.

Tres regresiones causales fallaron antes del cambio: payload forjado aprende,
evento sin contexto publica y respuesta posterior a A/B/A vuelve al llamador.
Suite dirigida final: 154 aprobadas, cero fallos en diez archivos; 26 casos nuevos.
Recorre servicios/clase/colas/memoria reales con modelos y efectos sustituidos;
no GUI, cuentas, claves, archivos del usuario o modelos reales.

## Compuerta y compilación

`npm run verify:pr` aprobó sus 14 etapas: 6,628 casos aprobados y cinco omitidos,
548 archivos aprobados y dos omitidos; 62 pruebas de tooling y 33 de Python.
Typecheck, arnés, contratos y lint incremental aprobaron; éste revisó 597 fuentes.
La compuerta verificó 854 Markdown antes de agregar la planificación del lote
siguiente; se vuelven a comprobar documentos al cerrar esta evidencia.

Cobertura real de las 2,594 fuentes productivas: líneas 58.47%, sentencias 57.10%,
funciones 53.44%, ramas 50.96%; antes 58.35/57.00/53.28/50.85. Pisos
56/55/51/49 sin cambios, sin nuevas exclusiones. ESLint completo conserva exit 1
por deuda histórica: 1,811 → 1,806 errores, producción 1,401 → 1,396 y any
1,228 → 1,223; 31 advertencias, cero fatales y cero aumentos por archivo/regla/severidad.

`npm run app:smoke:build` aprobó: 3,577 fuentes copiadas con hashes coincidentes
y seis salidas no vacías, sin .env ni arranque. Fuente estable antes/después:
3,597 archivos, SHA-256 `d05cfa9d9fc17dc03055265732812207db3eb15b1f70b2cc7a7a39fdd4fbc124`.
Delta contra lote 44: 14 existentes respaldados y tres nuevos. La eliminación
ajena staged de bulk-label-verification.ts permanece ausente, sin restaurarla.

Recibos: [compuerta](gate-summary.json), [build](build-summary.json),
[cobertura](coverage-evidence.json), [lint](lint-evidence.json),
[regresiones](regression-summary.json), [fuentes](source-evidence.json) y
[logs](log-evidence.json). No se deduce porcentaje global desde estos contadores:
el último índice publicado, después del lote 37, sigue siendo histórico (40.88%).

## Revisión adversarial propia

Se intentó atribuir evento al ownerKey del modelo o al usuario activo al recibir,
mutar task/message antes del consumidor, guardar copias/replay/eventos diferidos,
revocar durante primera escritura, capturar identidad nueva desde una continuación
vieja, enviar backend sin contexto y heredar contexto del trabajo que libera plaza.
Se probaron tareas simultáneas, FIFO, cancelación en cola y rechazos síncronos.

La prueba FIFO detectó que desplazar arranque a Promise.then consumía plazas
antes de reservarlas: se restauró ejecución síncrona con captura de rechazo.
Se preserva task-aborted mínimo fuera de tarea, sin transferirle procedencia.
BrowserWeb retira cinco any de las funciones modificadas con tipos de servicio
y catch unknown; sin supresiones o relajación de reglas.

Revisión independiente pendiente; la propia no la sustituye. No archivar.

## Límites y reversión

No aísla todas las mutaciones internas, perfiles persistentes, historial/cachés
o lecturas globales entre cuentas. Suprimir publicación no evita por sí mismo
cambios de estado tardíos ni revierte I/O/entrada. El SDK puede terminar trabajo
ya enviado; las señales no cancelan cada etapa interna de todos los backends.

Memoria consume síncronamente durante la lease. Dos escrituras no son transacción:
un fallo/revocación puede dejar aprendizaje parcial en el propietario correcto.
Se deduplica el mismo evento admitido, no emisiones distintas ni resultados
durables. No se acreditan procesos múltiples ni permisos GUI reales.

Respaldos relativos/logs en TEMP/soflia-desktop-publications-2026-10-27, frente a
unidad 44. Reversión sólo del delta, preservando índice/trabajo ajenos. Sin
stage/commit/push, SQL remoto, despliegue o modificación de secretos/.env.
