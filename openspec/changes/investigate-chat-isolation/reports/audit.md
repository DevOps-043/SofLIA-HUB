# Auditoría de contexto, continuidad y conservación de chats

Estado: evidencia histórica de la auditoría inicial, anterior a las correcciones. Fecha: 2026-11-13.

Las reproducciones y resultados siguientes corresponden a esa línea base.
Las correcciones posteriores y las pruebas ordinarias que sustituyen los
fallos esperados están en [verificación](verification.md).

## Resultado

Se registraron ocho hallazgos: seis defectos reproducidos mediante pruebas controladas, una limitación arquitectónica que puede interrumpir la presentación al navegar y una carencia de procedencia en el monitor global. La combinación permite explicar los síntomas descritos sin suponer que alguien eliminó el chat. No se confirmó la secuencia exacta del incidente ni se recuperó su conversación.

El usuario identificó el destino como «Apoyo emocional» y el encargo como una presentación sobre calidad y normalización de software. Los nombres usados en las pruebas son datos sintéticos; no son identificadores de los chats reales.

## Hallazgos por impacto

### H-01 · P1 · Un borrador puede entregar su presentación a un chat existente

Evidencia: [useSkillWorkspaceLink.ts](../../../../src/adapters/desktop_ui/chat-ui/useSkillWorkspaceLink.ts), líneas 29–43; [useSkillWorkspaceResume.ts](../../../../src/adapters/desktop_ui/chat-ui/useSkillWorkspaceResume.ts), líneas 47–48.

La transición `null → id` se interpreta como primer guardado. También ocurre al abandonar un borrador y abrir una conversación existente. Link toma el workspace pendiente y llama a `attachConversation` con el identificador del destino; Resume considera que se guardó el mismo chat y puede conservar la Skill anterior sin consultar el destino. La protección de main frente a reasignaciones no protege un workspace que todavía carece de conversación.

Reproducción: montar con conversación nula y workspace suelto, abrir el chat existente «Apoyo emocional». Se observó una llamada que asocia ese workspace al destino. No requiere que termine el modelo.

Corrección: asignar identidad estable al borrador y distinguir explícitamente su persistencia de una selección de chat. El enlace debe consumir una confirmación de creación correspondiente al mismo borrador, nunca deducirse sólo de `null → id`.

### H-02 · P1 · Un chat nuevo puede desaparecer sin haber sido eliminado

Evidencia: [useScopedMessagesHandler.ts](../../../../src/hooks/chat-manager/useScopedMessagesHandler.ts), líneas 29–43 y 98–106; [process-message.ts](../../../../src/hooks/chat-processor/process-message.ts), líneas 84–88; [useChatRuntime.ts](../../../../src/adapters/desktop_ui/chat-ui/useChatRuntime.ts), líneas 43–51.

El primer guardado retorna si cualquier mensaje tiene el placeholder activo. Para un chat nuevo tampoco hay caché de mensajes porque todavía no existe `resolvedConvId`. Salir ejecuta flush, pero flush también se niega a guardar por el placeholder. Si después se invalida la generación, por ejemplo al desmontar la superficie, `settle` descarta el resultado. El primer mensaje puede quedar sólo en memoria y perder toda entrada visible. No toda selección cancela un borrador: `null → id` se exceptúa como se describe en H-01, por lo que la secuencia depende de la ruta de navegación.

Reproducción: enviar el primer mensaje con respuesta `...` y ejecutar flush de navegación. No se llamó ni a crear conversación ni a guardar mensajes.

Corrección: persistir el chat y el mensaje del usuario antes de iniciar inferencia o agentes. Excluir placeholders del snapshot sin descartar los mensajes ya válidos. Registrar estado interrumpido y mantener el chat en el historial.

### H-03 · P1 · Un render puede reemplazar el guardado pendiente por uno vacío

Evidencia: [useScopedMessagesHandler.ts](../../../../src/hooks/chat-manager/useScopedMessagesHandler.ts), líneas 21–26, 83–88 y 110–115; [useChatManager.ts](../../../../src/hooks/useChatManager.ts), líneas 33–36; [AppContent.tsx](../../../../src/app/AppContent.tsx), líneas 103–104.

Cada creación del handler instala una nueva función en `flushSaveRef`. El objeto de estado del gestor cambia al renderizar; la cadena de callbacks vuelve a crear el handler. El stream anterior conserva su closure con mensajes, mientras la referencia global puede apuntar a otro closure con `latestMessages = []`. Flush cancela el timer del anterior y ejecuta el guardado vacío.

Reproducción: publicar un snapshot completo, dejar que el gestor renderice y ejecutar flush antes del debounce. Incluso avanzando el reloj 1100 ms no se crea ni guarda el chat. Es una causa distinta de H-02: no necesita placeholder.

Corrección: mantener snapshots y colas de guardado estables por conversación/borrador; registrar flush al recibir cambios y evitar que el render sustituya una operación pendiente por otra vacía. Una ref global a un único guardado tampoco basta para trabajos simultáneos.

### H-04 · P1 · El chat destino conserva el workspace anterior mientras carga

Evidencia: [useSkillWorkspaceResume.ts](../../../../src/adapters/desktop_ui/chat-ui/useSkillWorkspaceResume.ts), líneas 67–82 y catch final; [useChatUIController.ts](../../../../src/adapters/desktop_ui/chat-ui/useChatUIController.ts), resolución de `turnSkill`; [resolve-turn-skill.ts](../../../../src/adapters/desktop_ui/chat-ui/resolve-turn-skill.ts).

Al pasar entre dos conversaciones guardadas, Resume espera `findByConversation` antes de retirar la Skill y el workspace anteriores. Durante la espera el compositor sigue habilitado y `resolveTurnSkill` puede entregar el workspace anterior al nuevo turno. Si la consulta rechaza, el catch sólo registra una advertencia y conserva ese estado.

Reproducción: cambiar de presentación a «Apoyo emocional» con consulta pendiente. No se solicitó limpiar ni Skill ni panel.

Corrección: retirar inmediatamente la autoridad del destino anterior y ligar la Skill a una identidad de conversación validada durante render, antes de cualquier envío. Mostrar la reanudación pendiente; un error no debe devolver acceso al workspace anterior.

### H-05 · P1 · La activación tardía de una Skill puede contaminar otro chat

Evidencia: [useChatTools.ts](../../../../src/adapters/desktop_ui/chat-ui/useChatTools.ts), líneas 57–77.

`handleUseSkill` espera `prepareSkillWorkspace` y después publica Skill y panel sin verificar si continúan vigentes conversación, usuario, organización o activación. Navegar o desactivar la Skill durante la espera no invalida el resultado.

Reproducción: iniciar preparación en el chat de presentación, cambiar al destino y liberar la promesa. Se vuelve a publicar el workspace originario en el estado compartido con el destino.

Corrección: token de activación por ámbito, invalidado al navegar/desmontar/cambiar identidad o desactivar. El resultado debe quedar disponible para su origen sin convertirse en Skill del chat visible.

### H-06 · P1 · Las presentaciones con Skill activa dependen del turno que se cancela al navegar

Evidencia: [send-message-stream.ts](../../../../src/services/gemini-chat/send-message-stream.ts), línea 74; [useChatRuntime.ts](../../../../src/adapters/desktop_ui/chat-ui/useChatRuntime.ts), línea 51; [agent-team.ts](../../../../src/services/gemini-chat/agent-team.ts); [contrato de equipos](../../../../docs/architecture/runtime-multiagent-harness.md).

La delegación a main exige que no haya Skill activa. Con Presentaciones activa se usa el turno supervisado del renderer; sus especialistas preparatorios reciben la señal de ese turno y no materializan por sí mismos el entregable. Abrir otro chat cancela ese turno. También puede cancelarse al remontar la superficie. Que el panel muestre varios especialistas no implica que exista un trabajo durable independiente.

Confirmación: inspección de catálogo/ruta y prueba existente `chat-runtime-owner.test.tsx`, que verifica expresamente la cancelación al cambiar conversación. La suite del servicio main comprueba por separado sus trabajos y asociación al origen; no certifica continuidad de una presentación con Skill activa.

Corrección: dar a la generación de presentaciones un trabajo con propietario y recursos fijos que pueda continuar en main. Mantener la diferencia entre navegación, Stop del turno y cancelación del trabajo. No basta con retirar el abort del renderer: dejaría herramientas supervisadas sin su interfaz de aprobación y mantendría las carreras de guardado/workspace.

### H-07 · P2 · Los mensajes externos eluden las guardas del envío manual

Evidencia: [useChatRuntime.ts](../../../../src/adapters/desktop_ui/chat-ui/useChatRuntime.ts), línea 70; [useChatProcessor.ts](../../../../src/hooks/useChatProcessor.ts), `runWithAbort`; [process-message.ts](../../../../src/hooks/chat-processor/process-message.ts), línea 73.

El efecto de `externalPrompt` llama directamente a `processMessage`, sin el AbortController ni la función `isCurrent` de `runWithAbort`. `cancelScope` invalida los tokens del hook, pero este turno no recibió ninguno; el procesador considera siempre vigente su resultado. Esta ruta puede seguir produciendo resultados tras Stop, navegación o desmontaje y competir con un turno posterior del mismo origen.

Reproducción: iniciar `externalPrompt` con el hook real y observar el límite del procesador. Los argumentos de señal y guardia son `undefined`.

Corrección: un único punto de entrada al procesamiento que asigne identidad de turno, señal, historial y destino antes de iniciar cualquier operación. Conservar semántica de los disparadores que ya incluyen mensajes en su historial.

### H-08 · P2 · El monitor muestra equipos de otros chats sin identificar su conversación

Evidencia: [AgentActivityProvider.tsx](../../../../src/components/agents/AgentActivityProvider.tsx), combinación de actividades por usuario/organización; [AgentActivityPanel.tsx](../../../../src/components/agents/AgentActivityPanel.tsx), listado de todos los items y etiqueta de superficie; [agent-activity.ts](../../../../src/shared/agent-activity.ts), `activityFromTeam`.

El panel es global y conserva trabajos al navegar. Para los especialistas preparatorios, la actividad no tiene conversación ni mensaje de origen: sólo superficie y tipo. La tarjeta muestra «Chat / Presentación», también dentro de otro chat, y al finalizar indica «Resultado disponible en el chat» sin enlazar el origen. Un trabajo visible en «Apoyo emocional» no demuestra que su ejecución o sus datos se trasladaran allí; puede ser la misma actividad global sin procedencia visible.

Confirmación: inspección del contrato de eventos, proveedor y listado; no se simuló el incidente real ni se atribuye a esta carencia una mutación de datos.

Corrección: mostrar conversación de origen y acceso a ella, diferenciar preparación del turno frente a ejecución durable y ofrecer una vista «Este chat / Todos». No ocultar los trabajos activos al navegar. Esta corrección de presentación no reemplaza H-01, H-04 ni H-05, que sí afectan a la asociación operativa.

## Contexto compartido que también debe contemplar la solución

La memoria reciente usa sesiones por conversación, pero la recuperación semántica carga chunks por `session_key = ? OR phone_number = ?`: [embedding-search.ts](../../../../electron/memory/embedding-search.ts), línea 55. En el chat, `phoneNumber` se usa con la clave del propietario. Por diseño puede traer recuerdos de otros chats del mismo usuario, y el resultado reduce cada recuerdo a texto/fecha/puntuación, sin conservar su conversación de origen en el prompt. [formato](../../../../electron/memory/context-formatter.ts).

Esto no demuestra que el historial completo de «Apoyo emocional» se enviara a los especialistas ni que la memoria causara este incidente. La solución debe distinguir preferencias durables de instrucciones y trabajos del chat actual y conservar procedencia para cualquier recuerdo de otra conversación. No se recomienda borrar toda la memoria como arreglo.

## Rastreo del incidente real

- Se inspeccionaron sólo metadatos de workspaces/trabajos y se consultó en modo de sólo lectura la memoria SQLite del perfil local `soflia-hub-desktop` buscando los dos temas aportados por el usuario.
- El índice local de workspaces contenía un trabajo audiovisual antiguo, sin la presentación descrita. La coincidencia SQLite sobre software/calidad pertenecía a ese otro encargo audiovisual; se descartó al revisar el extracto. No se encontró una coincidencia que identificara estos chats.
- El perfil de distribución `Pulse Hub`, indicado por la configuración actual, no existía en este entorno. No se leyeron archivos de sesión, credenciales ni `.env`, no se descifraron trabajos y no se modificaron perfiles.
- No se consultó el historial remoto. No hay evidencia suficiente para distinguir un primer guardado perdido, un filtro de vista/organización, un enlace incorrecto o una ausencia remota concreta. No se afirma borrado ni recuperación.

## Verificación

Se añadieron [pruebas de guardado](../../../../src/__tests__/hooks/chat-save-isolation-audit.test.tsx), [workspace](../../../../src/__tests__/components/chat-workspace-isolation-audit.test.tsx) y [turnos externos](../../../../src/__tests__/hooks/chat-external-turn-audit.test.tsx).

Las seis invariantes se ejecutaron primero como pruebas normales: seis fallos reales de aserción, sin errores de importación ni proveedor. Después quedaron marcadas `it.fails` para documentar defectos conocidos de esta auditoría. No son seis arreglos ni seis validaciones funcionales aprobadas. Al corregir cada defecto deberá retirarse su marca y pasar como prueba normal.

Comando focalizado: `node node_modules/vitest/vitest.mjs run electron/__tests__/background-teams.test.ts electron/__tests__/cross-surface-agent-team.test.ts src/__tests__/hooks/chat-save-isolation-audit.test.tsx src/__tests__/components/chat-workspace-isolation-audit.test.tsx src/__tests__/hooks/chat-external-turn-audit.test.tsx src/__tests__/components/skill-workspace-resume.test.tsx src/__tests__/components/skill-workspace-link.test.tsx src/__tests__/hooks/chat-runtime-owner.test.tsx`.

Resultado: ocho archivos; 66 pruebas ordinarias aprobadas y seis fallos esperados reproducidos (72 casos). Proveedores/IPC de las reproducciones son dobles controlados, sin solicitudes reales de IA. Advertencias existentes: futura configuración nativa Vite y localStorage experimental de Node.

Validaciones complementarias:

- `npm run harness:validate`: aprobado; 25 rutas y diez skills canónicas.
- `npm run docs:check`: aprobado; 1092 documentos activos.
- `npm run lint:changed`: aprobado; tres archivos sin deuda nueva. Se corrigió antes una variable no usada del nuevo test.
- `npm run typecheck`: no aprobado por tres errores `nonce`/`AuthorizationCodeRequest` en archivos de Calendar ajenos a esta auditoría. El prepaso instaló las dependencias de Zoom exclusivamente en el worktree y resolvió la ausencia inicial de ese paquete. Las incidencias iniciales de tipos de las pruebas nuevas se corrigieron.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json`: aprobado por separado, porque el script combinado se detuvo en el primer proyecto.
- `npm run verify:pr`: detenido en `runtime:stable`; Electron declarado 44.9.3 e instalado 44.5.1 en las dependencias existentes reutilizadas mediante junction. Antes aprobaron adapters, harness, supply-chain e integridad CI. No se ejecutaron las etapas posteriores del gate y no se afirma cobertura global aprobada.
- Comparación del typecheck sin los tres tests de auditoría: reprodujo exactamente los mismos tres errores de Calendar. Se usó una configuración temporal que extendía la vigente y excluía sólo esos archivos; se retiró al terminar. Confirma que esos errores también existen sin las pruebas nuevas.

No se cambiaron manifiestos, versiones ni dependencias del checkout principal para resolver validaciones ajenas al diagnóstico.

## Plan de corrección y aceptación

1. RF-CHAT-ISO-001: crear identidad estable y guardar el primer mensaje antes de inferencia. Navegar a otro chat o recargar conserva el origen incluso con generación pendiente y sin red.
2. RF-CHAT-ISO-002: asociar workspace y callbacks al origen mediante identidad explícita de borrador/conversación. Abrir un chat existente desde borrador nunca lo adopta.
3. RF-CHAT-ISO-003: invalidar Skill/panel por destino y descartar activaciones tardías. Con consultas lentas o rechazadas, «Apoyo emocional» no recibe instrucciones, archivos ni herramientas de la presentación.
4. RF-CHAT-ISO-004: alojar generación durable de presentaciones en main con resultado ligado al origen. Navegar, ocultar panel o remontar no interrumpe el trabajo; cancelación explícita, logout y revocación conservan sus guardas.
5. RF-CHAT-ISO-005: unificar entrada de turnos manuales/externos. Stop y supersesión invalidan todas las respuestas tardías del mismo turno.
6. RF-CHAT-ISO-006: verificar extremo a extremo presentación A → apoyo emocional B → regreso a A, con latencias, error de guardado, navegación rápida A/B/A, dos borradores consecutivos, desactivación de Skill y cambio de organización. El contenido y los entregables nunca cambian de propietario.
7. RNF-CHAT-ISO-001: registrar transiciones con conversationId/draftId, turnId, jobId y workspaceId, sin cuerpos sensibles. Mostrar estado guardado/sincronización pendiente/interrumpido y una ruta de recuperación visible.
8. RF-CHAT-ISO-007: cada tarjeta de equipo identifica su conversación de origen y si prepara un turno o ejecuta un trabajo durable. Ver una actividad global desde otro chat no cambia su destino.

Antes de recuperar el incidente, localizar sus filas/mensajes y metadatos bajo la identidad correcta, comprobar workspaces sueltos y mantener un respaldo. No reasociar por título ni volver a generar sobre archivos existentes sin comparar su contenido.

Reversión de esta auditoría: retirar sus tres archivos de prueba y el directorio OpenSpec; no hay mutaciones de producto ni datos que revertir. El trabajo de voz del checkout principal permanece fuera de esta rama.
