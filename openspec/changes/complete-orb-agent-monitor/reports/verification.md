# Evidencia de la entrega

Fecha: 2026-09-25. Estado: implementación verificada localmente.
Rama: codex/complete-orb-agent-monitor. Base: 6237e37.

## Resultado

La Orbe adjunta el propietario del turno al pipeline común. El runtime recibe
la ventana real desde startup; main autoriza su frame principal, asigna origen
orb y separa sus IDs del Hub. La vista muestra Orbe. Cambio de usuario cancela
el turno de voz, limpia su contenido y descarta activaciones/anuncios cacheados.
Se reutilizan servicio, handlers, preload allowlisted y wrapper existentes;
no se agregan canales ni herramientas.

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| Vitest focalizado: actividad IPC, store, ventana, UI, eventos y conversación Orbe | 6 archivos, 21 pruebas correctas |
| npm run typecheck | Correcto |
| npx openspec validate complete-orb-agent-monitor --strict | Correcto |
| npm run verify:pr | Correcto; 340 archivos aprobados, 1 omitido; 3549 pruebas correctas y 1 omitida; suite 92,02 s |
| npm run build:app | Correcto; main, renderer y preload compilados |
| Vitest de orb-conversation y orb-speech-text después de reforzar la aserción de activación cacheada | 2 archivos, 16 pruebas correctas |
| node scripts/quality/smoke-agent-activity.mjs | Correcto: renderer, preload restringido, ocultar, reabrir, minimizar y cerrar |
| npm run docs:check, npm run docs:system:check tras ampliar el informe | Correctos; 332 Markdown activos; 28 documentos, 150 IDs, 441 canales, 506 archivos de prueba |
| npm run lint:changed y npm run docs:check al cerrar la evidencia | Correctos; 10 archivos sin deuda nueva y 333 Markdown activos |

La compuerta incluye adapters, harness, cadena de suministro, documentación,
semilla de Skills, OpenSpec, tipos, lint incremental y suite. Se mantuvieron los
avisos del entorno sobre Vite configLoader y localStorage de Node; no hubo fallos.
No se modificó implementación después del gate; se reforzó una aserción de la
prueba de propietario y se volvió a ejecutar su suite focalizada.

## Revisión adversarial local

Se intentó refutar aislamiento con subframes, monitor publicador, ventana ajena,
Orbe reemplazada, usuario anterior y UUID compartido por dos superficies. Los
casos están en agent-activity-ipc.test.ts. La procedencia declarada meetings se
normaliza a Chat/Orbe, por lo que el renderer no suplanta eventos de reuniones.

Se encontró y corrigió un riesgo en la ampliación: al cambiar de usuario, el
hook podía volver a consumir una promesa cacheada de activación. Se vacían esas
referencias y se prueba una activación inicial positiva seguida de cambio de
propietario sin reactivación antigua. El turno previo conserva su propietario y
recibe abort; las callbacks anteriores no presentan respuesta al nuevo usuario.

Esta revisión fue local, no independiente. No se archivó el cambio ni se publicó
un PR. Antes de archivar corresponde la revisión independiente del estándar base.

## Investigación y límites

El informe canónico agrega secciones 22–26 sobre Codex c7e80f873f67dbef58206b9d4f3c60e9d556eb16:
V1/V2, espera, buzón, capacidad, presupuesto, contexto, permisos, persistencia,
licencia y matriz de adopción. Se leyó código y contratos sin compilar ni ejecutar
upstream. No se probó inferencia, voz real, envío WhatsApp ni proveedor externo.
El smoke usa datos sintéticos y no prueba de extremo a extremo dictado real.

El monitor sigue siendo efímero y no cancela tareas. Los límites de equipos
generales siguen siendo por proceso. No se afirma mejora de latencia medida;
presupuesto global, recuperación durable y evaluación comparativa quedan como
propuestas claramente separadas en el informe.

## Reversión

Revertir el commit de esta rama restaura la observación anterior. No hay migración,
dependencias nuevas, secretos modificados ni efectos remotos que revertir.
