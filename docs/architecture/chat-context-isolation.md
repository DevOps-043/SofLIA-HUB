# Aislamiento de chats y continuidad de entregables

Estado: vigente. Actualizado: 2026-11-14.

<!-- evidence: src/hooks/chat-manager/useScopedMessagesHandler.ts -->
<!-- evidence: src/hooks/chat-manager/useChatManagerState.ts -->
<!-- evidence: electron/background-teams/presentation-workspace.ts -->
<!-- evidence: electron/background-teams/legacy-workspace-owner.ts -->
<!-- evidence: src/services/gemini-chat/background-admission.ts -->

## Identidad y guardado

El gestor reserva un UUID antes del primer envío. Es el futuro identificador
de la conversación y no cambia cuando ésta se guarda. Nuevo chat y selección
de otra conversación cambian el ámbito; usuario y organización invalidan las
publicaciones anteriores.

Cada destino tiene su handler, último snapshot y debounce. Un render no los
reemplaza y flush recorre los destinos pendientes. Conversación y mensaje del
usuario se conservan localmente antes de inferencia. El placeholder se excluye
del guardado sin impedir que se conserve el resto. La red se sincroniza aparte;
no bloquea cambiar de chat. Si el almacenamiento no confirma la escritura, el
turno muestra un error y no inicia inferencia.

Los resultados de una admisión main tardía parchean el mensaje por su ID en el
handler originario. No reemplazan el historial completo ni el turno posterior.
Un mensaje eliminado por regeneración o una identidad revocada no se repone.
Los tombstones siguen siendo autoridad frente a guardados tardíos.

La carga muestra primero el caché de la organización activa. Una respuesta
remota parcial conserva las conversaciones propias conocidas y sus mensajes;
ausencia no equivale a borrado. Los shares revocados no se recuperan como chats
propios. El caché conserva registros propios de otras organizaciones, pero no
los presenta ni reencola como recuperación de la organización actual.

## Skill, memoria y vista

ChatUI se remonta por ámbito estable. Skill y panel llevan conversación de
origen, y el render no concede herramientas de un panel de otra conversación.
La recuperación retira la autoridad anterior antes de esperar IPC. Activaciones
pendientes se invalidan al navegar, desactivar, desmontar o cambiar identidad.
El enlace de un workspace legado necesita el UUID explícito del borrador; un
cambio null → id no constituye prueba de pertenencia.

La memoria semántica del chat se filtra por sesión y propietario. Los recientes,
resúmenes y recuerdos de otra conversación no se convierten en su historial.
Las preferencias y skills aprendidas del propietario conservan su política
durable. La memoria histórica de WhatsApp mantiene su contrato existente.

Los prompts externos comparten el controlador de generación y AbortSignal de
los envíos manuales. Navegar invalida el turno supervisado; Stop y supersesión
conservan sus respectivas razones de cancelación.

## Presentaciones en main

Una presentación con workspace y fuentes ya capturadas se admite mediante
`background-teams:start`. `presentationWorkspaceId` y `executionMode` son campos
opcionales del contrato compartido; no son un canal ni permisos nuevos. El
mensaje del turno sirve como requestId idempotente. Actor y organización se
derivan/revalidan en main y los recursos quedan fijos al trabajo.

El coordinador usa herramientas acotadas de listado, lectura, generación y
observación de imágenes y escritura/edición del workspace. La generación usa
la sesión nativa, el presupuesto y la cancelación del trabajo; su imagen sólo
se publica con la reserva y autorización vigentes. Los especialistas conservan sus
aportes independientes. Modo directo utiliza sólo el coordinador y marca los
especialistas como omitidos. No se concede shell, envío, borrado ni control
continuo de otras aplicaciones.

Main comprueba tipo de Skill, conversación, propietario SOFIA, propietario de
datos y organización. Los workspaces nuevos reciben custodia derivada de la
sesión main al crearse; el renderer sólo declara la organización seleccionada.
Un workspace antiguo sin custodia exige una lectura limitada de su conversación
activa bajo el propietario correcto antes de asignarla. Fallo de red o de
autorización deniega esa recuperación, sin atribuir otro propietario.

Una reserva mantiene un único escritor del workspace. La escritura atómica
revalida sesión, generación y reserva antes de publicar; cancelar no revierte
efectos ya confirmados. El host lee y valida deck.json, comprueba sus imágenes,
exporta PowerPoint mediante el exportador existente y vuelve a abrir el archivo
antes de marcar el trabajo completado. Un guion o un mensaje de éxito no
sustituyen ese entregable. Los archivos y estados fallidos se conservan para
reanudación explícita.

El PowerPoint exportado de un workspace admite hasta el límite existente del
visor (20 MB), para conservar sus imágenes; los demás artefactos de equipos
mantienen 2 MB. El repositorio rechaza aplicar esa excepción a otros formatos
o a trabajos sin workspace de Presentaciones.

Cambiar de chat, remontar la vista u ocultar el panel no cancela un trabajo
admitido. Stop durante una admisión pendiente solicita cancelar el job al recibir
su identificador; navegar conserva el job y su acuse originario. Logout y cambio
de organización interrumpen los trabajos del ámbito anterior. Entre solicitudes
de contexto concurrentes prevalece la última intención válida.

## Monitor y límites

Las tarjetas distinguen preparación del turno y trabajo en segundo plano,
identifican su conversación de origen y permiten volver a ella. Los filtros
«Este chat» y «Todos» no cambian la propiedad del trabajo. Los registros antiguos
sin origen se declaran como tales; no se inventa una asociación por título.

La recopilación inicial que necesita una página o aplicación viva conserva su
supervisión y sus aprobaciones. La continuidad garantizada comienza con la
admisión main del trabajo, no autoriza leer otra superficie al navegar. Cerrar
la aplicación interrumpe la ejecución local y requiere reanudación; no se promete
trabajo con el equipo apagado. Se mantienen los presupuestos existentes de
[equipos locales](runtime-multiagent-harness.md#equipos-ejecutores-locales-en-segundo-plano).
La verificación de archivos y esquema no acredita revisión visual de todas las
diapositivas ni la exactitud factual de contenido no respaldado.

Pruebas y limitaciones del entorno: [verificación del cambio](../../openspec/changes/investigate-chat-isolation/reports/verification.md).
