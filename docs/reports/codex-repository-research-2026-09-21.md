# Investigación del código de Codex para SofLIA Hub

Estado: investigación completada por inspección estática; propuesta no implementada.
Fecha: 2026-09-21.
Ampliación: 2026-09-22; fronteras de integración, autorización y cancelación.
Repositorio: openai/codex.
Commit analizado: [3fd5160cd6c78f2051bb54359d53f09207171733](https://github.com/openai/codex/commit/3fd5160cd6c78f2051bb54359d53f09207171733).
Fecha del commit: 2026-09-21T22:30:43Z.

## Alcance y método

Se clonó el repositorio fuera del workspace de SofLIA y se fijó este commit. Se
inspeccionaron manifiestos, código de ejecución, contratos, persistencia y pruebas
seleccionadas. No se compiló Codex, no se ejecutaron sus pruebas y no se hicieron
llamadas de inferencia. Este informe no certifica seguridad ni compatibilidad de
una distribución publicada: main puede contener cambios posteriores a la release
que terminemos instalando.

Los enlaces de código apuntan al commit, no a main. “Confirmado” indica evidencia
en los archivos revisados; “propuesta” indica una decisión recomendada para SofLIA.
La cobertura es por subsistemas críticos, no una auditoría línea por línea de todo
el repositorio. La documentación de Agents API consultada anteriormente sirve de
contexto, pero sus contratos no se deducen de los handlers locales.

## 1. Conclusión técnica

El activo más reutilizable es el runtime de agentes accesible mediante app-server.
Incluye coordinación, sesiones, herramientas y políticas, pero SofLIA debe seguir
siendo propietaria de identidad, autorización, aprobaciones de negocio y datos.

Para Electron, la primera alternativa a probar es un proceso Codex separado,
con cliente app-server tipado y herramientas MCP propias. El SDK TypeScript es
más sencillo para tareas delimitadas; incrustar crates Rust implica una inversión
mayor de compilación y mantenimiento.

No hay evidencia suficiente para afirmar que cambiar una URL permita conservar
nuestro proveedor Gemini con todas las capacidades de Codex. Tampoco que los
conectores disponibles dentro de productos OpenAI estén incluidos o licenciados
para su distribución por clonar este repositorio.

## 2. Arquitectura observada

| Capa | Fuente | Responsabilidad |
|---|---|---|
| Cliente TypeScript | [exec.ts](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/sdk/typescript/src/exec.ts), [thread.ts](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/sdk/typescript/src/thread.ts) | Iniciar CLI, consumir eventos y continuar threads |
| CLI no interactiva | [exec/lib.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/exec/src/lib.rs) | Ejecutar tareas y presentar resultados |
| Cliente Rust compartido | [app-server-client](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server-client/README.md) | Arranque, handshake, transporte interno y cierre |
| Servicio de producto | [app-server](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server/src/lib.rs) | Procesar solicitudes y eventos de clientes |
| Contrato | [thread.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server-protocol/src/protocol/v2/thread.rs) | Parámetros tipados y campos experimentales |
| Ejecución del turno | [session/turn.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/session/turn.rs) | Muestreo, herramientas, entrada pendiente y compactación |
| Coordinación | [agent/control.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/control.rs) | Árbol de agentes y ciclo de vida |
| Herramientas | [router.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/router.rs) | Despacho de llamadas |
| Persistencia | [thread-store](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/thread-store/README.md) | Historial y metadatos |

### Ruta real del SDK TypeScript

Confirmado en exec.ts: construye los argumentos `exec --experimental-json`,
inicia el ejecutable con `spawn`, envía el prompt por stdin y lee stdout por líneas.
Cuando ya existe threadId añade `resume`. Thread.runStreamedInternal procesa esos
eventos y obtiene la identidad del thread del evento correspondiente.

Por tanto, no es una implementación TypeScript del motor ni un cliente HTTP de
Agents API. Invocar otro turno inicia otra ejecución de CLI que puede reanudar
el estado persistido.

El SDK hereda el entorno de Node cuando no se proporciona env explícito. Para
SofLIA se propone una lista mínima de variables, almacenamiento propio por usuario
y exclusión de credenciales empresariales innecesarias. El código acepta
AbortSignal, pero eso no demuestra cancelación de todos los efectos remotos.

La CLI exec utiliza InProcessAppServerClient. Su documentación describe canales
tipados internos y JSON en las fronteras externas. También declara una cola local
de eventos sin límite para no bloquear respuestas: un consumidor lento sigue
requiriendo pruebas de memoria y control de volumen.

### Alternativa de integración Rust

Existe una fachada [core-api](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core-api/src/lib.rs) y un
[ejemplo ThreadManager](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/thread-manager-sample/README.md).
Es una ruta real de integración, pero ser público dentro del workspace no equivale
a un compromiso de estabilidad independiente. Para Electron no justifica,
inicialmente, agregar bindings nativos ni mantener un fork.

## 3. Ciclo del agente

En session/turn.rs el turno combina entrada, configuración efectiva, contexto,
solicitudes al modelo y seguimiento de herramientas. Tras una respuesta considera
tanto el seguimiento solicitado por el modelo como entrada pendiente. El ciclo
puede continuar y compactar contexto antes de terminar.

La implicación es que una tarea no debe modelarse como una única petición HTTP.
SofLIA necesita estados propios: pendiente, en ejecución, esperando aprobación,
completada, fallida, cancelada y resultado parcial. Estos nombres son propuesta
de producto, no enums copiados del protocolo.

Compactar tampoco equivale a memoria empresarial. Las fuentes, aprobaciones y
artefactos deben permanecer fuera del resumen de contexto como registros
verificables.

## 4. Multiagentes: funcionamiento y límites reales

### Dos implementaciones

El [registro de features](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/features/src/lib.rs) marca en este commit:

| Feature | Estado declarado | Default del registro |
|---|---|---|
| multi_agent | Stable | true |
| multi_agent_v2 | Stable | false |
| agent_message_board | UnderDevelopment | false |
| multi_agent_mode | Removed | false |
| enable_fanout | Removed | false |

Estos defaults no garantizan exposición en cada combinación de modelo, cliente
y configuración efectiva.

La [implementación V1](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/handlers/multi_agents.rs)
exporta handlers de spawn, send_input, wait, close y resume. La
[implementación V2](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/handlers/multi_agents_v2.rs)
exporta spawn_agent, send_message, followup_task, list_agents, wait_agent e
interrupt_agent.

En V2, [message_tool.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/handlers/multi_agents_v2/message_tool.rs)
comparte el envío, pero distingue mensajes de una tarea que despierta al
destinatario. Esto permite corregir a un agente ocupado sin crear otro y reactivar
uno que ya terminó.

### Identidad, contexto y herencia

[registry.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/registry.rs) mantiene identidad,
rutas del árbol y reservas. [spawn.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/control/spawn.rs)
maneja creación, forks y recuperación.

[child_config.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/child_config.rs) construye la
configuración desde el estado efectivo del padre, aplica selección de rol/modelo
y vuelve a aplicar políticas runtime de aprobación y permisos. Un rol no debe
interpretarse como una identidad empresarial autónoma.

Existen rutas de fork sin historial, historial completo y últimos turnos. Copiar
historial completo puede arrastrar información innecesaria para el especialista.
Propuesta: por defecto pasar un contexto mínimo con referencias, alcance y
resultado esperado; usar forks completos solo cuando la tarea lo justifique.

### Tres recursos diferentes

1. Registro de agentes creados.
2. Agentes residentes en memoria.
3. Turnos de agentes actualmente ejecutándose.

[execution.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/control/execution.rs) cuenta turnos
de subagentes V2 mediante permisos que se liberan al destruirse. El root y V1 no
pasan por ese mismo contador; no significa que V1 carezca de otros límites.

[residency.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/control/residency.rs) gestiona
residencia y descarga de agentes. Un agente conocido no necesariamente permanece
cargado o consume un slot de ejecución continuamente.

SofLIA debe medir esos recursos por separado y mantener su límite adicional sobre
el escritorio físico. Un bloqueo dentro de un runtime de herramientas no
garantiza exclusión entre todos los threads o usuarios.

### Espera e interrupción

[wait.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/handlers/multi_agents_v2/wait.rs)
se suscribe a actividad y limita tiempos de espera. Que termine la espera no
demuestra que el objetivo del especialista esté cumplido.

[interrupt.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/control/interrupt.rs) rechaza
interrumpir al root o a uno mismo desde esta operación y tolera que el runtime
objetivo ya no esté cargado. Interrumpir no revierte una escritura externa.

### Presupuesto compartido

[rollout_budget.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/rollout_budget.rs) mantiene contabilidad
del árbol raíz. Usa unidades suministradas por el backend cuando están presentes
o una combinación ponderada de salida y entrada no cacheada. Hay recordatorios
por thread y detección de agotamiento.

No debe presentarse como un límite monetario exacto ni como garantía de ausencia
de sobrepaso por llamadas concurrentes ya iniciadas. Propuesta: combinar límite
de concurrencia, tiempo, volumen de herramientas y costo estimado por tarea.

## 5. Herramientas: catálogo, ejecución y extensibilidad

### Registro y exposición

[registry.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/registry.rs) separa comportamiento
de ejecución y metadatos de exposición, hooks y telemetría.
[dynamic.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/handlers/dynamic.rs) permite exposición
directa o diferida.

La [búsqueda de herramientas](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/handlers/tool_search_spec.rs)
declara BM25 sobre metadatos diferidos y publica resultados para la siguiente
llamada al modelo. No es búsqueda semántica de documentos.

Aplicación propuesta: indexar solo herramientas ya autorizadas. La búsqueda no
puede ser la única barrera de seguridad; el ejecutor debe validar cada llamada.

### Paralelismo de herramientas

[parallel.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/parallel.rs) consulta si la herramienta
soporta ejecución paralela. Usa un RwLock: acceso compartido para operaciones
paralelizables y exclusivo para las demás.

Esto ofrece una referencia para consultas independientes de SofLIA. Las
mutaciones y el control del escritorio necesitan exclusión por recurso real,
incluyendo llamadas provenientes de threads distintos.

### Aprobaciones y sandbox

[orchestrator.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tools/orchestrator.rs) concentra
aprobaciones, selección de sandbox e intentos para herramientas que utilizan
ToolRuntime. Existen rutas de reintento/escalamiento sujetas a política.

No todas las capacidades se vuelven seguras automáticamente por usar Codex.
Las herramientas de negocio deben exigir permisos, aprobación e idempotencia
en su servidor, independientemente de lo que diga el modelo.

### MCP

[ToolFilter](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/codex-mcp/src/tools.rs) aplica allowlist opcional y
denylist. Sin allowlist, lo no denegado puede estar permitido en esa capa.
Propuesta SofLIA: allowlist explícita por sesión y autorización nuevamente al
ejecutar.

[tool_catalog.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/codex-mcp/src/connection_manager/tool_catalog.rs)
gestiona revisiones de catálogo y visibilidad.
[required.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/codex-mcp/src/connection_manager/required.rs)
valida servidores requeridos, incluyendo tratamiento de arranque diferido con
catálogo cacheado. No debe confundirse disponibilidad de metadatos con salud
de todas las operaciones posteriores.

El MCPManager de SofLIA es un registro interno de toolsets. Hace falta una
frontera MCP auténtica sobre servicios seleccionados, con autenticación del
canal y contexto de actor generado por código confiable.

### Herramientas dinámicas de app-server

El [contrato de thread](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server-protocol/src/protocol/v2/thread.rs)
marca dynamicTools como experimental. El handler registra una respuesta pendiente
por call_id, emite actividad y espera la contestación del cliente.

Es una ruta corta para un prototipo local. No sustituye MCP ni equivale al
contrato function de Agents API. El cliente necesita timeouts, cierre al cancelar
y validación de argumentos antes de llamar nuestros servicios.

## 6. Code Mode, hooks, skills y memoria

### Code Mode

[code-mode-runtime](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/code-mode-runtime/src/session_runtime/mod.rs)
implementa celdas, valores compartidos, seguimiento de tareas y cancelación.
[v8_init.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/code-mode-runtime/src/v8_init.rs) inicializa V8 y
controla su modo JIT.

La feature code_mode figura UnderDevelopment; code_mode_host figura Stable.
No se puede extrapolar la estabilidad de una a todo el subsistema.

Potencial: agrupar consultas y transformar datos antes de devolver resultados al
modelo. Propuesta: posponer extracción directa; un runtime V8 añade superficie
de ejecución y mantenimiento. No ejecutar código generado en renderer ni
conceder Node/shell arbitrario a agentes de negocio.

### Hooks

[hooks/lib.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/hooks/src/lib.rs) enumera doce eventos: PreToolUse,
PermissionRequest, PostToolUse, PreCompact, PostCompact, SessionStart, SessionEnd,
UserPromptSubmit, SubagentStart, SubagentStop, Stop e Interrupt.

Sirven como referencia para auditoría, medición y extensiones de ciclo de vida.
Los runners de comandos constituyen capacidad ejecutable: no permitir que un
catálogo editable de skills de SofLIA instale hooks arbitrarios. Las reglas duras
de autorización deben permanecer en nuestros servicios.

### Skills

[skills/lib.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/skills/src/lib.rs) separa parsing, carga,
metadatos, selección, menciones y dependencias. Se puede aprovechar el formato y
un catálogo curado, manteniendo separados los procedimientos de desarrollo y
runtime.

### Memoria

[memories/README.md](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/memories/README.md) describe extracción por
conversación y consolidación posterior, con reservas de trabajos y exclusión
para consolidación. Es una referencia de coordinación, no un reemplazo directo
de memoria empresarial con RLS, consentimiento, retención y eliminación.

## 7. Persistencia y recuperación

[ThreadStore](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/thread-store/README.md) define historial canónico
append-only por su API y actualizaciones explícitas de metadatos.
LocalThreadStore usa JSONL para historia y SQLite para metadatos consultables
cuando está disponible. LiveThread coordina la persistencia activa.

[AgentGraphStore](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/agent-graph-store/src/store.rs) define relaciones
padre/hijo persistidas, estados de aristas y recorrido estable de descendientes.

Propuesta SofLIA: conservar una relación propia entre tarea de negocio, usuario,
organización y thread/turn de Codex. Consumir el protocolo; no depender
directamente del esquema SQLite interno ni usar sus tablas como base canónica
de reuniones o aprobaciones.

Recuperar una conversación no demuestra que una acción remota se haya aplicado
exactamente una vez. Mantener operationId, registro de resultado e idempotencia
en las escrituras del Hub.

## 8. Seguridad relevante para nuestro Windows

El [README de core](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/README.md) documenta que read-only y
workspace-write heredados permiten lectura amplia del filesystem en Windows.
Las raíces legibles precisas pertenecen a políticas separadas y su soporte
depende del backend. Las políticas no representables se rechazan.

Por ello, “solo lectura” no equivale a “solo puede ver documentos autorizados”.
El piloto debe probar rutas fuera de alcance, credenciales, enlaces y acceso de
red con el binario empaquetado.

El entorno heredado por el SDK también requiere atención: una app Electron
puede tener credenciales de más servicios que el agente necesita. Un proceso
separado ayuda al ciclo de vida, pero por sí solo no es una frontera de permisos.

## 9. Compatibilidad de proveedores

[model-provider-info](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/model-provider-info/src/lib.rs) declara
WireApi::Responses y rechaza wire_api=chat. Existen proveedores y adaptadores
adicionales en el workspace, pero configurar base_url no prueba compatibilidad
con Gemini ni con todo servidor que anuncie compatibilidad OpenAI.

La [prueba del protocolo retirado](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/model-provider-info/src/model_provider_info_tests.rs)
comprueba el rechazo de Chat Completions en esa configuración.

SofLIA debe decidir entre añadir un backend Codex con modelos compatibles,
mantener ambos runtimes o construir/adaptar una capa de proveedor y probar sus
contratos. Recomiendo coexistencia durante el piloto.

## 10. Pruebas y madurez observada

Se inspeccionaron estas pruebas; no se ejecutaron:

| Evidencia | Qué comprueba el código de la prueba |
|---|---|
| [execution_tests.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/control/execution_tests.rs) | Contador V2, liberación y conservación del límite derivado del root |
| [multi_agent_resume.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/tests/suite/multi_agent_resume.rs) | Recuperación en frío de identidad y rol en seguimiento |
| [mcp_subagent_elicitation.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/tests/suite/mcp_subagent_elicitation.rs) | Solicitudes MCP y políticas de aprobación en subagentes |
| [mcp_tool_exposure.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/tests/suite/mcp_tool_exposure.rs) | Catálogos, refresco y exposición diferida |
| [schema_fixtures_tests.rs](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server-protocol/src/schema_fixtures_tests.rs) | Coherencia de esquemas generados y fixtures |

La [estrategia CI](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/.github/workflows/README.md) usa verificación Bazel
en PR y cobertura Cargo/nextest más amplia después del merge. Las suites
contienen mocks y condiciones de omisión: su existencia no acredita resultados
en nuestro Windows ni con nuestros servicios.

Para la integración necesitamos pruebas propias de: cierre del Hub, caída del
proceso, pérdida de conexión, cancelación padre/hijo, resultados parciales,
aprobación vencida, dos organizaciones, cambios de catálogo, herramienta lenta,
presupuesto agotado y duplicación de escrituras.

## 11. Licencia y distribución

La [licencia principal](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/LICENSE) es Apache-2.0; también la declaran el
workspace Rust y el SDK TypeScript. Permite integración comercial y mantener
código propio cerrado, con obligaciones de licencia, avisos e identificación de
modificaciones al redistribuir. No concede uso general de marcas ni acceso a
servicios o modelos.

[NOTICE](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/NOTICE) menciona código Ratatui bajo MIT. Además hay código
vendorizado con condiciones propias: [bubblewrap/COPYING](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/vendor/bubblewrap/COPYING)
contiene GNU Library GPL v2. Esto no cambia la licencia principal de Codex;
sí obliga a identificar los componentes efectivamente distribuidos por plataforma
y cumplir sus licencias. No se ha realizado aquí una auditoría completa de la
cadena de dependencias ni un dictamen sobre un instalador concreto.

Acción propuesta antes de distribuir: fijar versión/binario, inventariar
dependencias incluidas, producir avisos y revisar obligaciones de cada componente.
La evaluación del paquete Windows no sustituye la del paquete Linux.

## 12. Matriz de reutilización para SofLIA

| Componente | Estrategia recomendada | Prioridad |
|---|---|---|
| app-server y esquemas | Integrar proceso con cliente tipado | Alta |
| MCP | Crear adaptador sobre servicios existentes | Alta |
| Multiagentes | Consumir a través del runtime, no copiar handlers | Alta |
| Eventos de tareas | Normalizar a estados de producto | Alta |
| SDK TypeScript | Usar para jobs delimitados | Media |
| Búsqueda diferida | Reutilizar a través del harness; medir calidad | Media |
| Skills | Adoptar formato con catálogo runtime curado | Media |
| Historial | Consultar protocolo y mantener IDs propios | Alta |
| Memoria | Adaptar principios; conservar ownership SofLIA | Media |
| execpolicy | Evaluar para desarrollo, con política por defecto explícita | Media |
| Code Mode | Experimento separado tras el piloto básico | Baja inicial |
| core-api Rust | Solo si se justifica control profundo y mantenimiento | Baja inicial |
| TUI y herramientas Git/shell | Plano de desarrollo | Fuera del runtime empresarial inicial |

## 13. Arquitectura propuesta y contratos pendientes

Flujo propuesto:

Usuario/canal → servicio de tareas SofLIA → adaptador Codex → app-server
→ herramientas MCP SofLIA → servicios de negocio.

Los eventos regresan al servicio de tareas y al renderer por IPC tipado. La
ejecución de una propuesta aprobada vuelve a validar usuario, organización,
herramienta, argumentos, expiración y huella del contrato.

Módulos nuevos sugeridos, aún inexistentes:

- electron/agent-runtime/: interfaz para inicio, seguimiento y cancelación.
- electron/codex-runtime/: proceso, handshake, versionado y traducción de eventos.
- electron/soflia-mcp/: catálogo seleccionado y despacho autorizado.
- src/services/agent-tasks/: wrapper IPC.
- UI de actividad dentro de las superficies actuales, evitando recrear el
  Workflow Hub retirado.

La lista es diseño propuesto, no contrato aprobado. No abrir nuevos canales o
tablas sin OpenSpec y revisión del ownership de persistencia.

La base comprobada de SofLIA incluye
[política de exposición](../../ai-specs/policies/runtime-exposure.md),
[registro](../../ai-specs/agents/registry.yaml),
[ejecutor](../../electron/mcp-manager/execution.ts),
[contratos](../../electron/mcp-manager/tool-contract.ts),
[reuniones](../../electron/meetings/meeting-workflow-service.ts) y
[cola de escritorio](../../electron/desktop-agent/agent-config.ts).

## 14. Prueba de concepto que resolvería las incertidumbres

1. Fijar release publicada y comparar sus esquemas/features con este commit.
2. Iniciar app-server con configuración y almacenamiento aislados.
3. Exponer únicamente tres lecturas: contexto de reunión, tareas del proyecto y
   búsqueda documental. Estos son casos de uso propuestos, no nombres existentes.
4. Ejecutar coordinador con dos especialistas sobre datos sintéticos.
5. Mostrar resultados con fuentes y estado por especialista.
6. Interrumpir y recuperar; comprobar identidad, permisos y ausencia de duplicados.
7. Comparar contra un solo agente sobre el mismo conjunto de casos.
8. Integrar en Meeting Ops solo si el beneficio de calidad o tiempo compensa costo.
9. Añadir escrituras exclusivamente mediante aprobaciones de negocio existentes.

Criterios de evaluación propuestos: exactitud de acuerdos, citas verificables,
ausencia de datos inventados, cobertura de bloqueos, costo por tarea, latencia,
aislamiento y recuperación. Los umbrales se deben fijar con una línea base;
este informe no inventa porcentajes de mejora.

## 15. Límites y próximos datos necesarios

- No se ejecutó el código Rust ni el SDK contra modelos.
- No se verificó acceso de la cuenta a Agents API.
- No se probó la compatibilidad de Gemini con Codex.
- No se midió memoria, latencia ni costo.
- No se validó el sandbox en una instalación empaquetada.
- No se auditó la totalidad de licencias transitivas.
- No se presume que main coincida con una release publicada.
- El informe contiene recomendaciones, no autorización para desplegar ni
  sustituir los agentes actuales.

El resultado de esta investigación es una base de decisión y un mapa de fuentes
para una propuesta OpenSpec posterior.

## 16. Verificación del entregable

- docs:check: aprobado; enlaces locales válidos.
- harness:validate: aprobado.
- Las 60 fuentes externas únicas se comprobaron contra el árbol Git
  del commit fijado mediante git cat-file.
- git diff --check: aprobado para el diff rastreado.
- docs:system:check: falló por el inventario de pruebas desactualizado en
  docs/quality/test-strategy-and-inventory.md, archivo sin cambios en esta tarea.
  El validador espera 477 archivos de prueba, 332 de main y 144 de renderer.
- No se ejecutaron verify:pr, compilación ni pruebas runtime: los cambios de
  SofLIA se limitan a este informe y su entrada en el índice documental.
- En la ampliación del 2026-09-22 se repitieron docs:check y harness:validate,
  ambos aprobados, y la comprobación de fuentes contra Git. No se repitió
  docs:system:check; su resultado anterior se conserva arriba.

## 17. Ampliación: credenciales y entorno de ejecución

La conversión de configuración de shell usa `inherit = All` e
`ignore_default_excludes = true` cuando esos valores no se especifican. El
constructor compartido del entorno permite filtrar nombres como KEY, SECRET y
TOKEN, pero ese filtro genérico solo se aplica cuando se activa mediante la
política correspondiente. Sí elimina siempre una lista explícita de variables
internas no heredables, incluso después de aplicar overrides.

Esto matiza la idea de que Codex elimina automáticamente cualquier secreto del
proceso anfitrión: protege determinadas credenciales internas, pero SofLIA debe
definir su propia frontera. No se comprobó exposición de secretos reales.

Fuentes: [conversión de política](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/config/src/shell_environment_policy.rs),
[construcción y depuración del entorno](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/protocol/src/shell_environment.rs).

Propuesta para SofLIA:

- Iniciar el proceso con una lista explícita de variables necesarias, sin
  propagar por comodidad todo el entorno de Electron.
- Mantener las credenciales de servicios de negocio en sus adaptadores. Las
  herramientas reciben argumentos tipados y devuelven resultados, no secretos.
- Probar con variables señuelo que ningún proceso o herramienta puede leer las
  variables excluidas. Revisar además archivos accesibles: filtrar el entorno
  no impide leer un secreto guardado en disco.
- Para agentes runtime, respetar la prohibición de shell y Git establecida en
  el manual de SofLIA. Estos hallazgos también afectan a procesos auxiliares y
  a una eventual integración separada para desarrollo.

## 18. Ampliación: autorización de subagentes y cambio de usuario

### 18.1 La instrucción delegada no demuestra autorización del usuario

En multiagente V2, `root_user_authorization` obtiene evidencia de la conversación
raíz para la revisión de workers. Reconcilia instrucciones retenidas, identifica
fuentes ausentes y excluye resúmenes o fragmentos contextuales de determinados
caminos de recuperación. También consulta texto de mensajes efectivamente
entregados que el host registró, relevante cuando un hook pudo modificarlo.

Es un patrón reutilizable: conservar por separado la tarea del especialista y
la evidencia de lo que autorizó la persona. Esta función participa en la revisión;
no sustituye permisos deterministas de negocio ni demuestra una garantía universal
para todos los modos de agente.

Fuente: [evidencia raíz para workers](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/agent/control/user_authorization.rs).

Aplicación propuesta: una transcripción puede contener la frase «envía el resumen
a todos». SofLIA debe conservarla como contenido de la reunión hasta que la
cadena de permisos y confirmación aplicable autorice ese envío. Un coordinador
que repita la frase a un worker no debe elevarla a autorización humana.

### 18.2 Cambiar de identidad requiere invalidar trabajo pendiente

`ConnectionRpcGate` verifica si la autenticación de la conexión sigue vigente
antes de admitir trabajo. Cerrar la compuerta impide iniciar handlers en cola;
los que ya comenzaron pueden terminar su limpieza y `shutdown` espera su cierre.
Por tanto, cerrar admisión y abortar efectos ya iniciados son operaciones distintas.

Fuente: [admisión y drenaje RPC](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server/src/connection_rpc_gate.rs).

Propuesta: asociar cada ejecución de SofLIA a usuario, organización y versión de
sesión. En logout o cambio de organización, invalidar nuevas operaciones,
confirmaciones pendientes y resultados tardíos de la sesión anterior. El
adaptador del servicio debe volver a comprobar identidad y permiso antes de
producir un efecto externo. Cambiar la vista del renderer no cumple esa función.

## 19. Ampliación: detener, confirmar y recuperar

### 19.1 Una interrupción tiene un ciclo de vida observable

El handler de `turn/interrupt` comprueba el identificador del turno activo y,
para un turno normal, difiere su respuesta hasta `TurnAborted`. El interrupt de
arranque tiene una ruta distinta porque todavía no hay evento de turno.

En core, la interrupción cancela el token, permite una terminación cooperativa
acotada y después aborta la tarea; ejecuta además limpieza y registro del marcador
de interrupción. `abort_all_tasks` contempla iniciar trabajo pendiente después
de interrumpir. No se debe interpretar su nombre como prueba de que todos los
agentes descendientes y servicios externos quedan detenidos globalmente.

Fuentes: [handler de interrupción](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server/src/request_processors/turn_processor.rs),
[ciclo de tareas](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/core/src/tasks/mod.rs).

Propuesta: distinguir en la UI «deteniendo», «interrumpido» y «resultado externo
pendiente de confirmar». Si el usuario pide detener el trabajo completo, el
adaptador debe gestionar también cola, especialistas y llamadas externas bajo
su responsabilidad. Un correo ya enviado no se revierte al cancelar el turno.

### 19.2 Las confirmaciones también tienen identidad y caducidad

El emisor mantiene callbacks pendientes, permite cancelarlos por thread y tiene
comprobaciones específicas del propietario de solicitudes de verificación.
La documentación advierte además que resolver una elicitation no cancela por sí
solo una llamada independiente de verificación nativa: el host debe cancelarla
y descartar pruebas tardías.

Fuentes: [solicitudes pendientes](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server/src/outgoing_message.rs),
[contrato de verificación](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server/README.md).

Propuesta: ligar una confirmación al usuario, operación, argumentos exactos y
vigencia. Si cambia el destinatario de un envío, la confirmación anterior no debe
aprobar la nueva acción. Si llega después de cancelar, no debe ejecutar nada.

### 19.3 La verificación nativa no es una capacidad genérica garantizada

En el commit revisado, la inicialización activa esta integración experimental
para combinaciones concretas de origen y cliente: TUI embebida o Codex Desktop
local, además de comprobar soporte del dispositivo. SofLIA debe planificar su
propia confirmación de negocio y validar cualquier integración nativa soportada;
no basar el diseño en suplantar el nombre del cliente.

Fuente: [inicialización de capacidades](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server/src/request_processors/initialize_processor.rs).

## 20. Qué reutilizar de estos mecanismos en SofLIA

| Mecanismo observado | Reutilización recomendada | Responsabilidad de SofLIA |
|---|---|---|
| app-server y contratos tipados | Consumir proceso y protocolo fijados a una versión | Adaptador en main y API limitada para renderer |
| Compuerta de conexión | Adoptar el patrón de admisión y drenaje | Identidad y permisos de organización |
| Evidencia de autorización raíz | Adoptar separación entre tarea y autorización | HITL de negocio y comprobaciones deterministas |
| Cancelación y eventos de turno | Traducir a estados visibles del producto | Cancelar colas y reconciliar efectos externos |
| Política de entorno | Configurar explícitamente y verificar | Custodia de secretos propios |
| Serialización de solicitudes | Estudiar separación por recurso | Resolver conflictos de negocio entre agentes |

La cola del app-server distingue ámbitos como thread, proceso, filesystem watch
y OAuth MCP, con accesos exclusivos o de lectura compartida. Es una referencia
útil para diseñar concurrencia, pero no equivale a una transacción distribuida ni
a autorización entre organizaciones.

Fuente: [serialización por ámbito](https://github.com/openai/codex/blob/3fd5160cd6c78f2051bb54359d53f09207171733/codex-rs/app-server/src/request_serialization.rs).

Para evitar duplicados, se propone un registro propio de operaciones de negocio
con identidad, argumentos y resultado reconciliable. Esto es diseño recomendado,
no una garantía de entrega exactamente una vez encontrada en Codex. Un timeout
después de enviar un mensaje requiere consultar el resultado del proveedor antes
de repetir la operación.

## 21. Casos de aceptación propuestos para la integración

Estos casos no se ejecutaron; concretan qué debería demostrar el prototipo.

| Caso | Resultado que debe comprobarse |
|---|---|
| Logout durante una aprobación | La aprobación anterior no permite una escritura |
| Cambio de organización durante un turno | Resultados y operaciones conservan su ámbito original o se invalidan |
| Transcripción solicita enviar información | El contenido no concede autorización al worker |
| Cambio de argumentos tras confirmar | La confirmación deja de ser válida |
| Detener con especialistas y cola pendiente | El alcance acordado de cancelación se cumple sin nuevos efectos |
| Timeout tras escritura externa | Se reconcilia el resultado antes de reintentar |
| Reinicio con confirmación pendiente | No se reutiliza una aprobación caducada |
| Variables señuelo en el proceso padre | Ningún ejecutor excluido puede obtenerlas |
| Dos especialistas modifican el mismo recurso | Se detecta el conflicto o se serializa en el servicio propietario |

El primer caso de uso sigue siendo una reunión: extracción de acuerdos y revisión
de evidencia en paralelo, composición de un borrador y confirmación centralizada
antes de enviar o crear elementos externos. La paralelización aporta valor en
análisis; las escrituras pasan por los servicios y guardas actuales de SofLIA.
