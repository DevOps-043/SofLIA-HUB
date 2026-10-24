# Verificación de planes privados de Gmail

Estado: implementada y verificada localmente; revisión independiente pendiente.
Fecha: 2026-10-22.
Rama: codex/reduce-technical-debt. Base Git: e166d250629e503cf12f69449fb6d66e569134c8.
Se preservan las cinco unidades anteriores y sus cambios locales; sin commit,
push, despliegue, migración ni correo real.

## Resultado y causa

Los planes anteriores usaban JSON global sin propietario y un ID sin validar
en una ruta local. Apply/undo persistían sólo al terminar: un fallo posterior
a mutaciones podía devolver cero cambios y dejar un archivo sin evidencia del
avance. La unidad mantiene las capas existentes y conserva el contrato
posicional; añade custodia por usuario/cuenta y un diario previo a cada efecto.

El store nuevo comparte cifrado asíncrono del SO y escritura privada con
calendario, conservando sus wrappers. Valida UUID, esquema, referencias,
conteos, propietario e ID internos. No importa ni elimina el legado. Limita
archivo, lectura e historial sin borrar evidencia automáticamente. Preview
persiste grupos e IDs necesarios, omitiendo ejemplos de remitentes/asuntos.

El contexto fija usuario/revisión/conexión y cliente, con exclusión por cuenta
en el proceso. Apply captura etiquetas actuales, registra intención antes del
efecto y deltas/conteos tras confirmación. Undo comprueba el conjunto actual
completo, omite avances ya revertidos y conserva etiquetas creadas con mensajes
nuevos. Estados inciertos bloquean replay; estados completos devuelven el
resumen sin efectos nuevos. La respuesta distingue cancelación, parcialidad,
incertidumbre, conflicto y recuperación requerida.

Tres canales IPC validan actor/frame/documento y schemas cerrados. Main pide
aprobación del plan/cuenta para mutaciones; preload/wrapper comparten DTO.
AbortSignal propaga navegación/cierre/sesión al diálogo y SDK. Cada solicitud
usa hasta 15 segundos sin retry, el plan dispone de 90 segundos desde su primera
llamada y el estado previo de apply se lee en grupos paralelos de hasta ocho.
La misma señal alcanza envío Gmail y diálogos de calendario por la frontera
compartida. El envío también desactiva retry y tiene 15 segundos de timeout.

## Verificación ejecutada

| Comando / evidencia | Resultado |
|---|---|
| Baseline dirigida: servicio Gmail, envío IPC, custodia calendario, calendario IPC | 4 archivos, 75 pruebas aprobadas |
| Suite dirigida final de nueve archivos | 147 pruebas aprobadas antes de añadir el caso de selección ambigua |
| Vitest gmail-plan-store.test.ts tras añadir selección ambigua | 19 pruebas aprobadas |
| npm run typecheck | Aprobado en renderer y main |
| npm run lint:changed | 92 archivos sin deuda nueva |
| npm run calendar:smoke:native | Tres procesos Electron 44.5.1 con DPAPI real; calendario y planes Gmail aprobados |
| npm run app:smoke:build | Aprobado: 3288 fuentes, seis artefactos sin .env |
| npm run verify:pr | Aprobado: 4682 pruebas, 5 omitidas; 449 archivos aprobados y 2 omitidos; suite de 213,65 segundos |

Hay 73 casos nuevos en cinco suites; el fixture compartido es el sexto archivo
añadido al inventario. Se conserva el inventario derivado de 618 archivos y los
494 canales IPC existentes. El SDK Google/OAuth2 real se prueba con transporte
fetch simulado y token ficticio: un 503 no repite el lote y una señal cancelada
durante un interceptor impide transmitir lote/envío. No se simula éxito remoto
para suplir una comprobación real de la compuerta.

La compuerta completa también aprobó adaptadores, arnés, política de dependencias,
documentación/enlaces, semilla de skills, 76 elementos OpenSpec, cuatro pruebas
de tooling, tipos y lint. El [resumen estructurado](verification.json) registra
las cifras de esta ejecución. Quedan advertencias preexistentes de Vite y Node;
no se silencian para obtener el resultado.

El smoke nativo escribe/restaura un plan, rechaza otra cuenta y conserva una
intención pendiente entre procesos. [Resumen nativo](native-summary.json).
El [resumen de build](build-summary.json) y los [hashes de seis artefactos](build-artifacts.json)
permiten identificar la compilación. Persisten advertencias de tamaño de chunks;
no se alteran límites ni se afirma una mejora de rendimiento por este build.

Logs completos temporales: `%TEMP%/soflia-gmail-plans-2026-10-22/`, archivos
baseline-tests.log, focused-delivery-final.log, store-final.log, typecheck-delivery-final.log,
lint-final.log, native-final.log, build-final.log y verify-pr-final.log. El informe
versionado conserva resultados; los logs temporales pueden caducar.

## Autorrevisión adversarial

| Hipótesis intentada | Evidencia / resolución |
|---|---|
| Otro usuario/cuenta o ID de ruta puede ejecutar un plan | Rechazo antes de E/S para IDs inválidos; ciphertext copiado falla por owner/ID interno; legado intacto |
| Corrupción, cuota o fallo de rename destruye el registro anterior | Store con disco/cifrado reales inyectados, límites 2 MiB/100 planes, publicación fallida y rotación; bytes previos preservados |
| Un fallo del segundo lote oculta el primer avance | Caso de 101 mensajes conserva 100 confirmados e intención/deltas pendientes; replay y undo bloqueados |
| Cambio A/B/A o navegación durante aprobación permite efectos tardíos | Guardas, abort de diálogo, limpieza de listeners y ausencia de transporte; conexiones se vuelven a validar tras esperas |
| Reintento del SDK duplica mutaciones | SDK real con 503 produce un solo POST; retry:false y señal verificados |
| Undo pisa cambios manuales o borra etiquetas con mensajes nuevos | Conflicto previo a sobrescritura, progreso parcial conservado y etiqueta retenida |
| Crash con estado en curso o fallo de checkpoint permite repetir | Intención pendiente durable bloquea replay; undo sin pendiente puede continuar y omite avances confirmados |
| Dos llamadas/instancias actúan a la vez o la selección elige un plan arbitrario | Exclusión y liberación probadas; corrupción y empate de fecha rechazan selección automática |

No quedan hallazgos bloqueantes conocidos dentro de esta unidad tras las
correcciones y pruebas. Es autorrevisión; la revisión independiente sigue
pendiente antes de archivar. No se presenta esta revisión como independiente.

## Límites y recuperación

- No hay transacción disco/Gmail, compare-and-swap ni garantía exactamente una
  vez. Una caída puede dejar intención pendiente aunque Google haya aceptado
  el efecto; exige revisión manual. No hay reparación automática del diario.
- Comparar todas las etiquetas es conservador: incluso un cambio de lectura
  puede detener undo. Hay una ventana de carrera remota entre comprobar y
  escribir; no se asegura aislamiento frente a otro cliente.
- Exclusión sólo dentro del proceso; DPAPI no protege frente a otro proceso
  que controle la misma cuenta del SO. Sin validación nativa Linux/macOS.
- Legacy puede conservar PII sin cifrar; se deja intacto sin atribuir dueño.
  Limpieza y recuperación requieren respaldo/operación explícita.
- No se usaron cuentas, credenciales ni correos reales. Diálogo verificado con
  dobles, sin prueba humana del modal; no se inició el Hub ni un instalador.
- Otros canales Gmail, custodia SMTP, permisos compartidos del build e integridad
  IRIS mantienen deuda. No se recalcula el índice global con conteos de pruebas.

## Reversión

Revertir sólo esta unidad y sus adaptadores compartidos, preservando los cinco
bloques anteriores. Conservar el directorio cifrado y sus diarios; una versión
anterior no debe leerlos como JSON ni reactivar automáticamente el legado.
Los cambios ya aceptados por Gmail requieren revisión y, si el diario permite
una reversión segura sin pendientes/conflictos, aprobación nueva de undo.
Revertir código no revierte correo, etiquetas ni otros efectos externos.
