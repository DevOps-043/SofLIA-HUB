# Referencia completa del agente de SofLIA Hub

Estado: vigente. Actualizado: 2026-07-28.

Documento **consolidado y autocontenido**: reúne en un solo archivo toda la
información del agente que hoy vive repartida entre el README del proyecto, el
router de agentes, el adaptador de Claude, el resumen normativo de agentes y el
manual extendido del runtime. Sirve para leer, auditar o entregar el
comportamiento completo del agente sin abrir otros archivos.

## Qué consolida

| Parte | Origen | Qué aporta |
|---|---|---|
| A | `README.md` | Qué es el producto, inicio rápido y verificación |
| B | `AGENTS.md`, `CLAUDE.md`, `ai-specs/policies/`, `ai-specs/agents/` | Gobernanza, planos, reglas no negociables, registro de agentes |
| C | `docs/architecture/agents-and-automation.md` | Resumen normativo de agentes y automatización |
| D | `docs/architecture/runtime-agents-manual.md` | Manual exhaustivo del runtime (secciones 1–12) |
| E | — | Trazabilidad y regla de mantenimiento |

> Advertencia de mantenimiento: este archivo **duplica** contenido a propósito.
> La fuente canónica de cada tema sigue siendo el documento de origen listado
> arriba. Si cambias el comportamiento del agente, actualiza primero el documento
> canónico y después regenera esta consolidación; si divergen, gana el canónico.

<!-- evidence: electron/wa-agent/agent-loop.ts -->
<!-- evidence: electron/wa-tools/index.ts -->
<!-- evidence: electron/wa-tools/security.ts -->
<!-- evidence: electron/wa-executor/tool-guards.ts -->
<!-- evidence: electron/whatsapp/access-control.ts -->
<!-- evidence: electron/whatsapp/group-activation.ts -->
<!-- evidence: electron/desktop-agent/agent-config.ts -->
<!-- evidence: electron/desktop-agent/routing.ts -->
<!-- evidence: electron/desktop-agent/task-entrypoint.ts -->
<!-- evidence: electron/desktop-agent/task-outcome.ts -->
<!-- evidence: electron/mcp-manager/execution.ts -->
<!-- evidence: electron/mcp-manager/tool-contract.ts -->
<!-- evidence: electron/meetings/meeting-workflow-service.ts -->
<!-- evidence: electron/security/command-policy.ts -->
<!-- evidence: electron/task-scheduler.ts -->
<!-- evidence: src/services/gemini-chat/agentic-loop.ts -->
<!-- evidence: src/services/gemini-tools/index.ts -->
<!-- evidence: src/hooks/model-selector-options.ts -->
<!-- evidence: ai-specs/agents/registry.yaml -->
<!-- evidence: ai-specs/policies/tool-boundaries.md -->
<!-- evidence: ai-specs/policies/runtime-exposure.md -->

---

# Parte A — Contexto del producto

## A.1 Qué es SofLIA Hub

Aplicación de escritorio Electron para operaciones asistidas por IA: WhatsApp,
Google Workspace, reuniones, monitoreo, memoria, automatización de escritorio y
gestión operativa para equipos hispanohablantes.

SofLIA Hub se opera a través de cuatro identidades de agente que comparten
memoria y políticas: el agente de chat en la ventana, el agente de WhatsApp, el
agente de escritorio (control de computadora) y el agente de reuniones.

La aplicación separa el proceso Electron main del renderer React. No se exponen
APIs nativas directamente: todo pasa por el contrato de cuatro capas de IPC.

## A.2 Inicio rápido

Requisitos: Node.js 20.19 o superior, npm y las variables de entorno del
proyecto.

```powershell
npm install
npm run dev
```

## A.3 Verificación

```powershell
npm run typecheck
npm run test
npm run verify:pr
```

`npm run verify:release` agrega la compilación y el empaquetado; se usa solo
para un candidato a distribución. Las pruebas se ejecutan directamente: la
persistencia local usa `node:sqlite` y ya no hay ABI nativa que intercambiar.

---

# Parte B — Gobernanza del agente

## B.1 Dos planos separados

| Plano | Ubicación | Puede modificar el repo | Puede ejecutar acciones del usuario |
|---|---|---:|---:|
| Desarrollo | `ai-specs/`, `.codex/`, `.claude/`, `.agents/`, OpenSpec | sí, dentro del flujo Git | no, por estar definido como skill |
| Runtime | `electron/wa-agent/`, `desktop-agent/`, meetings, automation | no debe tocar Git por defecto | solo mediante tools, handlers y políticas |

Una instrucción Markdown **no concede permisos**. El registro de desarrollo
declara `development_skills_exposed: []` para cada agente runtime, y el loader
dinámico solo busca directorios runtime configurados.

El plano de desarrollo se gobierna desde `AGENTS.md`; el plano runtime es el
objeto de las partes C y D de este documento. Los planos no comparten permisos:
una skill de desarrollo nunca es una herramienta runtime.

## B.2 Lectura obligatoria para trabajo asistido

1. `docs/standards/base.md`
2. `docs/standards/engineering-practices.md`
3. La guía del área afectada:
   - Electron/IPC: `docs/standards/electron-ipc.md`
   - Base de datos: `docs/standards/database.md`
   - Pruebas: `docs/standards/testing.md`
   - Documentación: `docs/standards/documentation.md`
   - Agentes runtime del producto: `docs/architecture/runtime-agents-manual.md`
4. El cambio activo en `openspec/changes/`, cuando exista.
5. El `SKILL.md` coincidente bajo `ai-specs/skills/`.

`docs/prompt_maestro.md` conserva el alias `@prompt_maestro`, pero las reglas
extensas solo se mantienen en el estándar de ingeniería del punto 2.

## B.3 Reglas no negociables

- Trabajar en cambios pequeños, trazables y verificables.
- No inventar datos, contratos, tablas, canales IPC ni resultados de pruebas.
- Mantener en español UI, prompts, comentarios, documentación y logs.
- Conservar la separación Electron main / preload / renderer.
- Todo canal IPC debe pasar por servicio, handler, allowlist del preload y
  wrapper tipado del renderer.
- Toda operación crítica o destructiva requiere HITL explícito.
- No exponer skills de desarrollo, Git o shell a agentes runtime.
- No modificar secretos, `.env` ni configuraciones locales versionadas.
- Preservar cambios ajenos existentes en el worktree.
- Actualizar especificaciones y documentación junto con el código.

## B.4 Comandos base

```powershell
npm run typecheck
npm run test
npm run harness:validate
npm run verify:pr
```

`npm run verify:release` solo para candidatos a release: incluye empaquetado y
verificaciones más costosas.

## B.5 Estructura del repositorio

- `electron/`: proceso main, preload, integraciones nativas y agentes runtime.
- `src/`: renderer React.
- `python/`: sidecars.
- `database/`: snapshots y migraciones separados por instancia.
- `resources/`: recursos runtime versionados.
- `docs/`: fuente de verdad técnica y operativa.
- `ai-specs/`: agentes, skills, políticas y scripts del Arnés.
- `.agents/`: adaptadores, reglas y workflows de Antigravity.
- `openspec/`: especificaciones vigentes y cambios activos.

## B.6 Adaptadores por herramienta

- **Codex**: adaptadores en `.codex/skills/` y router `codex.md`.
- **Claude**: adaptadores en `.claude/skills/` y router `CLAUDE.md`. El
  adaptador aplica `AGENTS.md`, no almacena permisos ni rutas absolutas, y exige
  leer el manual del runtime antes de tocar el comportamiento de un agente del
  producto.
- **Antigravity**: adaptadores en `.agents/skills/`, regla de workspace en
  `.agents/rules/` y workflows en `.agents/workflows/`.

Cursor y Gemini CLI **no** forman parte del entorno de desarrollo: no se deben
regenerar `.cursor/`, `.gemini/` ni `GEMINI.md`. Las referencias a Gemini dentro
de `src/` o `electron/` corresponden al proveedor de IA del producto, no a una
superficie del Arnés.

## B.7 Registro de agentes

`ai-specs/agents/registry.yaml` separa roles de desarrollo e identidades runtime.

**Desarrollo** (modifican y revisan el repositorio, con sus skills):

| Rol | Skills |
|---|---|
| `spec-analyst` | `enrich-requirement`, `update-project-docs` |
| `electron-engineer` | `electron-ipc-change`, `verify-change` |
| `data-security-engineer` | `supabase-migration`, `adversarial-review` |
| `qa-verifier` | `verify-change`, `adversarial-review` |
| `delivery-maintainer` | `using-git-worktrees`, `update-project-docs`, `prepare-pull-request` |

**Runtime** (identidades del producto, todas con `default_policy: deny` y
`development_skills_exposed: []`):

| Agente | Regla de rol |
|---|---|
| `whatsapp-agent` | Opera únicamente herramientas registradas para la conversación actual. En grupos se bloquean escritura, borrado, shell, portapapeles y control del sistema. En operaciones críticas solicita aprobación inequívoca y conserva trazabilidad. |
| `desktop-agent` | Usa el ciclo percepción, planificación, acción y verificación. Cada acción debe estar limitada a la tarea, ser cancelable y tener criterio de éxito. Solicita HITL antes de acciones destructivas, envíos, credenciales o efectos irreversibles. |
| `meeting-agent` | Extrae información según el Context Pack versionado, conserva fuentes y marca datos ausentes. No inventa participantes, acuerdos o fechas. La distribución de artefactos y cualquier actualización externa requieren las reglas HITL del flujo. |

## B.8 Límites de herramientas

**Desarrollo.** Los agentes de desarrollo pueden leer el repositorio. Solo pueden
modificar el alcance autorizado, deben preservar trabajo ajeno y deben usar
operaciones Git recuperables. Requieren autorización explícita para publicar,
enviar mensajes, desplegar, borrar datos o cambiar sistemas externos.

**Runtime.** Los agentes runtime reciben capacidades declaradas individualmente.
Se deniega por defecto shell, Git, escritura arbitraria, borrado, credenciales y
publicación. Todo argumento se valida y sanea en el proceso main. La interfaz del
modelo **nunca** sustituye la allowlist ni la autorización del usuario.

**Clasificación de riesgo.**

- `read`: lectura local o remota dentro del alcance.
- `write`: mutación reversible; requiere confirmación cuando afecte a terceros.
- `critical`: borrado, ejecución, envío, compra, despliegue o secretos; exige HITL.

## B.9 Exposición segura de una capacidad al runtime

Una skill de desarrollo **no** es una herramienta runtime. Para exponer una
capacidad al producto deben existir, como mínimo:

1. Identificador estable y propietario.
2. Esquema Zod cerrado para entrada y salida.
3. Clasificación de riesgo y regla HITL.
4. Adaptador de ejecución en Electron main.
5. Allowlist por agente y contexto, incluidos grupos de WhatsApp.
6. Sanitización, timeout, cancelación e idempotencia cuando aplique.
7. Auditoría con `trace_id`, actor y resultado sin secretos.
8. Pruebas positivas, negativas y de permisos.

El registro documental vive en `ai-specs/agents/registry.yaml`. El primer
registro ejecutable por dominio vive en `electron/mcp-manager/` para plugins
dinámicos. Nunca debe cargarse `ai-specs/skills/` directamente ni convertir
instrucciones Markdown en permisos.

---

# Parte C — Resumen normativo

## C.1 Loops de producto

**Chat renderer.** `src/services/gemini-chat/` construye historial e instrucción,
llama a Gemini, procesa stream y function calls, despacha tools de Workspace,
computer y project, y aplica timeout, retry y circuit breaker. El renderer
solicita acciones nativas al main; no las ejecuta directamente.

**WhatsApp Agent.** `electron/wa-agent/agent-loop.ts` ejecuta hasta 25
iteraciones. El contexto incluye remitente, grupo, owner de memoria, herramientas
declarables y evidencia. El loop guard detecta llamadas repetidas (warning 3,
crítico 5); los polls conocidos no cuentan igual. Las declaraciones de grupo se
filtran antes de llegar al modelo y el executor vuelve a validar.

**Desktop Agent.** La ruta selecciona backend determinista, browser, desktop
visual o UIA. El agente: prepara contexto de apps y ventanas y un plan
jerárquico; captura monitor o ventana y fusiona elementos UIA, OCR y visual;
propone una acción tipada; ejecuta mediante input backend; verifica el cambio
visual y detecta atasco o fallo; resume historial y replanifica hasta completar,
abortar o agotar presupuesto. La concurrencia visual es 1. Browser y nodos pueden
tener estado separado, pero `executeParallel` no autoriza dos tareas a compartir
mouse y teclado sin cola.

**Reuniones.** Los servicios de IA extraen propuestas y artefactos; review
y sync son servicios separados. La aprobación humana es un estado de negocio
persistido, no una frase interpretada por el modelo.

**Workspace Automation y Skills pasivas.** Automation administra templates, runs
y sus aprobaciones. El Workflow Hub se retiro al unificarse con las Skills; lo
que componia vive ahora en `electron/meetings/` (reuniones), `electron/passive-skills/`
(programaciones) y el catalogo `public.system_skills` (capacidades de negocio).
La descripcion siguiente se conserva como contexto historico: Calendar, Google Chat, scheduler,
automation y meetings en casos y variantes. Las skills aprendidas ejecutables de
memoria solo llaman templates registrados por este servicio.

## C.2 Herramientas estáticas y dinámicas

| Tipo | Registro | Validación | Seguridad |
|---|---|---|---|
| Estática WhatsApp | declaraciones y dispatcher versionados | schema del proveedor + handlers | capability, grupo, confirmación y guards por tool |
| Computer use | mapping IPC / tool dispatch | argumentos por handler | command policy, paths, confirmación, timeout |
| Dinámica | `MCPManager` + archivos toolset | Zod compila JSON Schema cerrado de entrada y salida | owner, risk, allowedAgents, HITL, groups, timeout, audit, fingerprint |

Home Assistant es el toolset dinámico builtin migrado. Los plugins legacy sin
contrato completo no se cargan. El timeout es cooperativo: la I/O que respeta
`AbortSignal` termina; el código síncrono que bloquea el event loop sigue siendo
riesgo residual.

## C.3 Arnés de desarrollo adaptado

- `AGENTS.md`: router pequeño y normas no negociables.
- `ai-specs/agents`: roles; `skills`: procedimientos; `policies`: fronteras.
- `.agents/skills`: wrappers Antigravity generados.
- `.agents/rules`: regla de workspace.
- `.agents/workflows`: propuesta, aplicación, verificación y archivo.
- `openspec/changes`: estado durable del cambio.
- `scripts/quality/run-gate.mjs`: feedback ejecutable.

## C.4 Capacidades ausentes o legacy

AutoDev no está en el bootstrap actual y no existe servicio fuente activo; los
textos y tests que lo mencionan son deuda legacy. Tampoco hay un orquestador de
agentes de desarrollo dentro del ejecutable: Antigravity, Codex y Claude operan
fuera del producto, sobre Git y OpenSpec.

---

# Parte D — Manual exhaustivo del runtime

Alcance: el **plano runtime** (los agentes embebidos en el producto). Las
referencias internas de esta parte (`§3.7`, `§4.9`, …) apuntan a las secciones
numeradas de esta misma parte.

---

## 1. Qué es "el agente"

SofLIA Hub no tiene un agente único: tiene **cuatro identidades runtime** que
comparten memoria, servicios y políticas, pero difieren en canal de entrada,
catálogo de herramientas y nivel de riesgo autorizado.

| Identidad | Canal de entrada | Dónde corre el loop | Registrada como |
|---|---|---|---|
| Agente de chat | Ventana de la app (chat, orbe) | Renderer (`src/services/gemini-chat/`) | superficie de producto |
| Agente de WhatsApp | Mensajes de WhatsApp (DM y grupo) | Electron main (`electron/wa-agent/`) | `whatsapp-agent` |
| Agente de escritorio | Herramienta `use_computer` de otro agente, o IPC de la UI | Electron main (`electron/desktop-agent/`) | `desktop-agent` |
| Agente de reuniones | Transcripciones, Drive, Gmail, Calendar, captura en vivo | Electron main (`electron/meetings/`) | `meeting-agent` |

Los tres identificadores runtime (`whatsapp-agent`, `desktop-agent`,
`meeting-agent`) están declarados en `ai-specs/agents/registry.yaml` con
`default_policy: deny` y `development_skills_exposed: []`, y son exactamente el
`enum` que valida el ejecutor de herramientas dinámicas. Ningún archivo Markdown
concede permisos: los permisos viven en código, allowlists y política.

### 1.1 Cadena de autoridad

Toda acción del agente atraviesa la misma cadena, sin atajos:

```
mensaje del usuario
  → prefiltro de seguridad (inyección de prompts, temas prohibidos)
  → construcción de contexto (memoria, personalización, permisos, estado)
  → declaración de herramientas VISIBLES para ese remitente y canal
  → modelo (Gemini) elige texto o function calls
  → guardas de intención / evidencia / bucle
  → guardas de ejecución (canal, permiso, ruta protegida, confirmación humana)
  → adaptador en Electron main (servicio real)
  → respuesta tipada + historial + auditoría
```

El modelo nunca ejecuta nada por sí mismo: propone llamadas y el proceso main
decide si se ejecutan. Que una herramienta esté *declarada* no implica que esté
*permitida*, y que esté permitida no implica que se ejecute sin confirmación.

---

## 2. Agente de chat (renderer)

Fuente: `src/services/gemini-chat/`, `src/services/gemini-tools/`,
`src/hooks/useChatProcessor.ts`, `src/adapters/desktop_ui/chat-ui/`.

### 2.1 Loop agéntico

`runAgenticLoop` (`src/services/gemini-chat/agentic-loop.ts`):

1. Envía el mensaje inicial con `withGeminiModelCall` (timeout, reintento y
   circuit breaker en `resilience.ts`).
2. Itera hasta **10 veces**. En cada vuelta:
   - acumula imágenes `inlineData` que emite la ejecución de código
     (gráficas de matplotlib) para adjuntarlas al mensaje final;
   - filtra las `functionCall` del candidato;
   - si no hay ninguna, devuelve el texto final con sus fuentes;
   - si hay, ejecuta cada una y reenvía las respuestas al modelo.
3. Si se agotan las 10 iteraciones responde
   `"He ejecutado las acciones solicitadas..."` en vez de seguir gastando.

Cancelación: el `AbortSignal` del usuario se propaga al SDK; abortar devuelve un
`stoppedStreamResult` con las llamadas ya hechas, no un error.

### 2.2 Presupuesto de tiempo por herramienta

El timeout genérico de herramienta es corto, pero las tareas de computer use
tardan minutos. `LONG_RUNNING_TOOL_TIMEOUTS_MS` eleva a **15 minutos**
`use_computer` y `use_computer_on_node`. Si aun así expira `use_computer`, el
chat llama `window.desktopAgent.abort()` para no dejar un agente zombi
ejecutando acciones a espaldas del usuario.

### 2.3 Modelos y razonamiento

`src/hooks/model-selector-options.ts` expone el catálogo conversacional:

| Nombre en la UI | Modelo | Modos de razonamiento |
|---|---|---|
| SofLIA | `gemini-3.6-flash` | Bajo / Medio / Alto |
| SofLIA Max | `gpt-5.6-terra` | Bajo / Medio / Alto / Muy alto / Maximo |
| SofLIA Pro | `gpt-5.6-luna` | Bajo / Medio / Alto / Muy alto / Maximo |
| SofLIA Lite | `gemini-3.5-flash-lite` | Bajo / Medio / Alto |

SofLIA usa `gemini-3.6-flash` por defecto. El modelo elegido determina el
proveedor del turno: SofLIA y Lite usan Google; Max y Pro usan OpenAI. La
selección y el nivel se conservan por modelo en preferencias locales. El modo
“Rápido” no se expone; preferencias antiguas `minimal` o `none` se migran a
`low`. Una solicitud que necesita Computer Use conserva el modelo y esfuerzo
seleccionados como orquestador. `use_computer` delega únicamente la percepción
y actuación al `gemini-3.6-flash` fijo de main; los fallos se reportan sin
sustituir silenciosamente ninguno de los dos proveedores.

`buildGenerationConfig` fija `maxOutputTokens: 16384` y envía
`thinkingConfig.thinkingLevel` a Gemini. OpenAI usa Responses API y envía el
nivel como `reasoning.effort`. En modelos que lo
soportan (`supportsCodeExecutionCombo`), se agrega `{ codeExecution: {} }` a las
herramientas: los cálculos salen de Python real, no de aritmética "de memoria".

### 2.4 Composición de herramientas

`buildModelTools` arma el set según contexto:

- con computer use habilitado: `COMPUTER_USE_TOOLS`, `PROJECT_HUB_TOOLS`,
  `NATIVE_AI_TOOLS`;
- sin computer use: solo `PROJECT_HUB_TOOLS` y `NATIVE_AI_TOOLS`;
- si existe el navegador integrado: `INTEGRATED_BROWSER_TOOLS` se agrega con la
  lectura, la navegación y el controlador determinista (clic, escritura, scroll
  y retroceso), independientemente de Computer Use;
- `GOOGLE_WORKSPACE_TOOLS` se agrega únicamente si el bridge `window.calendar`
  existe (Google conectado);
- `codeExecution` si el modelo lo permite.

OpenAI recibe `web_search` hospedado con `tool_choice: auto` cuando la intención
requiere investigación pública. Gemini conserva primero el modelo elegido por
el usuario y usa Google Search/URL Context; los fallbacks sólo se intentan
después. Computer Use queda reservado para percepción o actuación visual.

El dispatcher (`tool-dispatch.ts`) rechaza cualquier nombre desconocido
(`isKnownGeminiTool`) antes de intentar ejecutarlo.

### 2.5 Catálogo del agente de chat

**84 declaraciones** repartidas en diez módulos de `src/services/gemini-tools/`.

**Navegador integrado determinista** (`integrated-browser-tools.ts`)

| Herramienta | Qué hace |
|---|---|
| `read_browser_dom` | Lee el DOM saneado y acotado de la pestaña activa sin captura base64 ni Computer Use. Cada control expone un `ref` reutilizable por el controlador. |
| `navigate_integrated_browser` | Abre una URL HTTP(S) o consulta en la pestaña activa y devuelve su DOM saneado, conservando la sesión. |
| `click_browser_element` | Hace clic real sobre el control identificado por su `ref` y devuelve el DOM posterior. Un control irreversible exige confirmación explícita del usuario. |
| `type_in_browser_element` | Reemplaza el contenido de un campo editable por su `ref` y opcionalmente envía con Enter. |
| `scroll_integrated_browser` | Desplaza la pestaña activa para revelar contenido fuera del área visible. |
| `go_back_integrated_browser` | Vuelve a la página anterior y devuelve el DOM resultante. |

**Automatización de computadora** (`computer-automation-tools.ts`)

| Herramienta | Qué hace |
|---|---|
| `use_computer` | Observa o ejecuta una tarea autónoma en backend `browser`, `uia` o `desktop`; `browser` reutiliza la vista y sesión visibles, y `uia` puede escalar a `desktop` si no verifica el cambio. Devuelve `outcome`/`estado`. |
| `list_browser_profiles` | Lista perfiles persistentes de `browser_web`. |
| `reset_browser_profile` | Borra un perfil persistente. |

**Archivos y documentos** (`computer-file-tools.ts`)

`list_directory`, `read_file` (texto, PDF, `.xlsx`, `.pptx`, `.docx` a Markdown
con tablas), `write_file`, `create_word_document` (portada y formato; inyecta
automáticamente las gráficas generadas en la conversación), `create_directory`,
`move_item`, `copy_item`, `delete_item` (papelera, requiere confirmación),
`get_file_info`, `search_files`, `list_directory_summary`, `organize_files`,
`batch_move_files`, `undo_last_file_operation`.

**Procesos, sistema y correo local** (`computer-process-tools.ts`)

`execute_command` (requiere confirmación), `open_application`, `open_url` (solo
abre: no interactúa), `run_background_command`, `list_process_sessions`,
`poll_process_session`, `kill_process_session`, `get_background_host_status`,
`repair_background_host`, `get_system_info`, `clipboard_read`, `clipboard_write`,
`take_screenshot` (multi-monitor: sin argumentos captura el monitor del cursor y
devuelve `available_displays`), `configure_email`, `get_email_config`,
`send_email` (requiere confirmación).

**Google Workspace** (`gmail-tools.ts`, `google-calendar-tools.ts`,
`drive-tools.ts`)

Gmail: `gmail_get_messages`, `gmail_read_message`, `gmail_send`,
`gmail_get_labels`, `gmail_create_label`, `gmail_delete_label`,
`gmail_preview_organization` (plan determinista sin modificar correos),
`gmail_apply_organization_plan`, `gmail_undo_organization_plan`,
`gmail_modify_labels`, `gmail_batch_empty_label`, `gmail_empty_all_labels`.
Calendar: `google_calendar_get_events`, `google_calendar_create`,
`google_calendar_delete`, `google_calendar_get_connections`.
Drive: `drive_list_files`, `drive_search`, `drive_download`, `drive_upload`,
`drive_create_folder`.

**Project Hub / IRIS** (`project-hub-tools.ts`)

`get_iris_teams`, `get_iris_projects`, `get_iris_team_members`,
`create_iris_project`, `delete_iris_project`, `create_iris_issue`,
`get_iris_statuses`, `get_iris_priorities`, `get_current_user_id`.

**Nodos remotos** (`remote-node-tools.ts`)

`get_remote_node_host_status`, `configure_remote_node_host`, `list_remote_nodes`,
`register_remote_node`, `remove_remote_node`, `test_remote_node`,
`open_application_on_node`, `run_background_command_on_node`,
`take_screenshot_on_node`, `use_computer_on_node`,
`list_remote_node_process_sessions`, `poll_remote_node_process_session`,
`kill_remote_node_process_session`.

**Nativas de IA** (`native-tools.ts`)

`generate_image`, `whatsapp_send_file`.

### 2.6 Modos de la interfaz de chat

`useChatTools` conmuta modos exclusivos entre sí:

- `attach_file`: adjunta archivos al mensaje.
- `image_gen`: generación de imagen (desactiva el optimizador).
- `prompt_opt`: optimizador de prompt con destino `chatgpt | claude | gemini`
  (desactiva la generación de imagen).
- `create_prompt` / `my_tools`: guardar y reutilizar herramientas del usuario
  (prompts parametrizados de `tools-service`).

La personalización (`nickname`, `occupation`, `tone`, `instructions`) y el
`sofiaUserId` para la memoria unificada entran por `UseChatProcessorParams`.

---

## 3. Agente de WhatsApp

Fuente: `electron/whatsapp-agent.ts` (orquestador), `electron/wa-agent/` (loop y
contexto), `electron/wa-tools/` (declaraciones), `electron/wa-executor/`
(guardas y despacho), `electron/whatsapp/` (transporte y permisos).

Es el agente con mayor superficie: opera la computadora del usuario desde un
canal externo, así que también es el que más capas de contención tiene.

### 3.1 Activación

En **DM** responde siempre. En **grupo** solo si (`shouldRespondInGroup`):

- se le menciona (`mentionedJid` contiene el número del bot), o
- el texto empieza con el prefijo configurado (`groupPrefix`, por defecto
  `/soflia`), o
- el texto contiene la palabra `soflia` (patrón `\bsoflia\b`), o
- el mensaje es *reply* a un mensaje del bot (también para media).

### 3.2 Ruta de un mensaje de texto

`handleWhatsAppTextMessage` resuelve en este orden y **corta en el primer match**:

1. **Workflow conversacional activo**: si `MeetingWorkflowManager` o
   `WorkflowManager` (presentaciones) tienen la sesión abierta, el texto va a
   ese workflow y no al agente.
2. **Confirmación pendiente**: si hay una confirmación abierta para ese remitente,
   el texto se interpreta como respuesta. Se acepta `si`, `yes`, `confirmar`,
   `confirmo` (normalizado sin acentos); cualquier otra cosa cancela.
3. **Comando slash** (`/...`): se despacha al dispatcher de comandos.
4. **Workflow pasivo**: frases del tipo "todos los lunes revisa mi correo" se
   convierten en una regla persistente sin llegar al modelo (solo en DM).
5. **Loop del agente**.

Ante error del loop, si `shouldResetConversationAfterAgentError` lo indica se
borra el historial de esa sesión y se avisa; si no, se responde con un mensaje
de error legible.

`sessionKey` = `senderNumber` en DM y `group:<jid>:<senderNumber>` en grupo: en
grupos cada participante tiene su propio hilo.

### 3.3 Audio y media

- **Audio**: `handleWhatsAppAudioMessage` transcribe con Gemini y reinyecta el
  texto por la ruta normal.
- **Media**: `handleWhatsAppMediaMessage` prepara partes `inlineData` (tope de
  15 MiB, `wa-agent/media-preparation.ts`) y las antepone al mensaje.

### 3.4 Prefiltro de seguridad

`getSensitiveRequestBlockResponse` corre **antes** de construir el prompt y
antes de tocar el modelo. Combina `detectPromptInjection` con 17 patrones
propios que cubren: pedir el system prompt o las instrucciones internas,
ingeniería inversa, enumerar herramientas o capacidades técnicas,
autoprogramarse, pedir el código fuente o `dist-electron`/`main.js`,
desempaquetar `asar`, buscar `api_key`/`supabase`/credenciales, análisis forense
de la arquitectura, backdoors, jailbreak clásico ("ahora eres", "ignora tus
instrucciones", "modo DAN"), pedir un cuerpo o hardware, y "tomar conciencia".

Al bloquear se registra un warning con el remitente y el motivo, y se responde
que las instrucciones internas y el código son confidenciales, ofreciendo ayuda
con el objetivo real.

### 3.5 Construcción del contexto

`buildWhatsAppAgentPromptContext` compone el system prompt por capas:

1. **Owner de memoria** (`resolveWhatsAppOwnerKey`): en DM con número ligado a
   SOFIA usa `user:<id>` y comparte memoria con chat y escritorio; en grupo o
   sin ligar, el alcance es por teléfono.
2. **Contexto de memoria** (`buildWhatsAppPromptMemoryContext`): historial,
   conocimiento, lecciones y procedimientos guardados.
3. Persiste el mensaje del usuario (`memory.saveMessage`) con `ownerKey`,
   `sessionKey` y `groupJid` cuando aplica.
4. **Personalización activa** del perfil (nombre visible del agente, tono,
   trato) resuelta por remitente y por grupo.
5. **Prompt de acceso**: qué permisos tiene ese número.
6. **Estado de Google**: si no hay conexión activa se prohíbe explícitamente
   simular Gmail/Calendar/Drive usando `use_computer`, `execute_command`,
   `open_application` u `open_url`; debe pedir que se conecte desde la app.
7. **Contexto de grupo**: reglas de activación, concisión, prohibición de
   acciones destructivas y el búfer de historial pasivo del grupo.
8. **Sesión IRIS**: si el número está registrado hace auto-auth; inyecta usuario,
   equipos y, cuando el mensaje lo requiere (`needsIrisData`), el contexto de
   proyectos y tareas. Si IRIS está disponible pero sin sesión, explica cómo
   autenticarse.
9. **Directiva de evidencia** (§3.8) cuando la clasificación no es `none`.

### 3.6 Selección de modelo

`WA_MODEL` es `gemini-3.6-flash`. No se aceptan overrides ni fallbacks de
modelo: un error de disponibilidad se reporta sin degradar silenciosamente.

`generationConfig`: `maxOutputTokens: 4096`. El historial persistido se limita a
30 mensajes al cargar y `MAX_HISTORY` es 20. Si el historial está corrupto, se
reinicia la sesión en vez de fallar.

### 3.7 Visibilidad de herramientas

`buildWhatsAppToolDeclarations` **no declara todo el catálogo**: filtra tool por
tool según el remitente y el canal.

- Si hay Communication Hub y el principal no es `legacy`, decide
  `authorizeChannelTool` (proveedor, canal `dm`/`group`, tool, grupo).
- Si no, decide `getWhatsAppToolAccessError` con el mapa de permisos y
  `GROUP_BLOCKED_TOOLS`.
- Las herramientas dinámicas solo se agregan si ese remitente podría instalar
  toolsets (`install_dynamic_toolset` autorizado); luego se deduplican por
  nombre contra las estáticas.

Un remitente sin permiso **no ve** la herramienta: no puede pedirla ni
alucinarla como disponible.

#### Permisos por número

`electron/whatsapp/access-control.ts` define 11 permisos:

`files_read`, `files_write`, `screen_view`, `computer_control`, `shell`,
`clipboard`, `google_workspace`, `messaging`, `system_control`, `automation`,
`remote_nodes`.

Cada herramienta se mapea a uno (`TOOL_PERMISSION_MAP`), con reglas de respaldo
por prefijo: `gmail_*`, `google_calendar_*`, `drive_*`, `gchat_*` →
`google_workspace`; `*_on_node` o que contenga `remote_node` → `remote_nodes`.
El **número maestro** recibe todos los permisos salvo que `masterPermissions`
esté definido explícitamente; los demás contactos reciben solo lo listado en
`contactPermissions`. Si no hay número maestro configurado, el filtro por
permisos no aplica (modo abierto de instalación inicial).

### 3.8 El loop agéntico

`runWhatsAppAgentLoop` itera **hasta 25 veces**. Por iteración:

**a) Respuesta vacía o malformada.** Con `MALFORMED_FUNCTION_CALL` se reintenta
pidiendo el nombre exacto de la herramienta; a partir de la iteración 3 se
fuerza una respuesta solo-texto y se pide al usuario reformular.

**b) Sin function calls** → `handleTextOnlyAgentResponse` decide si el turno
terminó o si debe insistir.

**c) Con function calls**, en este orden:

1. **Guarda de intención** (`guardUnrequestedOperationalTools`): si el mensaje
   del usuario **no** pide una acción (`detectActionRequest` es falso) y el
   modelo intenta usar herramientas operativas — computadora, navegador, chats
   internos, archivos, Google Workspace, IRIS, procesos — se bloquean. La
   detección usa una lista explícita de 62 nombres más patrones
   (`^(create|write|delete|move|copy|open|run|execute|kill|lock|shutdown|...)_`,
   `^(app_chat|drive|gmail|google_calendar|gchat|iris)_`, `^whatsapp_(send|update)`).
   La primera vez devuelve un "ERROR DE INTENCION" al modelo; a la segunda corta
   el turno con un mensaje al usuario. Esto es lo que impide que un "hola" o un
   sticker terminen abriendo el explorador de archivos.

2. **Orden de evidencia** (`enforceEvidenceOrder`): la solicitud se clasifica en
   `none | local | local_visual | remote | local_then_remote |
   local_visual_then_remote`. Si el usuario pidió validación local y el modelo
   solo intenta herramientas remotas, se le devuelve un error pidiendo
   inspeccionar primero la app o la computadora. Si pidió revisión visual y el
   modelo intenta resolverlo sin captura, se le exige `use_computer` o
   screenshot. Web, shell o Git **no sustituyen** una inspección visual.

3. **Loop guard por firma** (`guardRepeatedToolSignature`): se calcula una firma
   estable (`stableJson`) de nombres + argumentos. En la repetición **3**
   (`LOOP_GUARD_REPEAT_THRESHOLD`) se cuenta una intervención y se ordena al
   modelo cambiar de estrategia; se corta el turno con "La tarea entro en un
   ciclo sin avance" al llegar a **5** repeticiones
   (`LOOP_GUARD_CRITICAL_THRESHOLD`) o a la segunda intervención.

4. **Ejecución** (`executeToolsAndTrackEvidence`) → §3.9.

5. **Fallo repetido**: si la misma firma de llamada produce la misma firma de
   respuesta fallida **2 veces**, se ordena cambiar de estrategia; a la segunda
   intervención (o al llegar al umbral 3) se corta con
   "La tarea quedo bloqueada por fallos repetidos" incluyendo el último error.

6. **Polling sin progreso** (`isPollLikeNoProgress` + `handlePollNoProgress`):
   cuando **todas** las herramientas de la vuelta son de consulta de estado
   (`POLL_LIKE_TOOLS`: `poll_process_session`, `list_process_sessions`,
   `list_active_tasks`, `autodev_status`, `get_background_host_status`) y llevan
   3 respuestas idénticas, se trata como espera y no como fallo: primero se pide
   cambiar de estrategia o informar el estado, y a la segunda intervención se
   responde que hace falta más tiempo, otra estrategia o intervención humana.

7. **Verificación de etiquetas masivas** de Gmail: si hubo operaciones en lote,
   se consulta el estado real y se anexa a las respuestas antes de devolverlas
   al modelo.

Si se agotan las 25 iteraciones responde "He completado las acciones
solicitadas."

### 3.9 Ejecución de herramientas: las guardas duras

`evaluateToolGuards` corre **por cada llamada**, antes del despacho:

1. `BLOCKED_TOOLS_WA` — bloqueo global. Hoy está **vacío**: no hay herramienta
   prohibida por diseño en este nivel; la contención real está en los niveles
   siguientes.
2. **Communication Hub**: `authorizeTool` con proveedor, remitente, canal, tool,
   si es grupo y el `node_id` destino cuando aplica. Si niega, se devuelve el
   motivo como resultado de la herramienta.
3. **Permisos del número** (`getWhatsAppToolAccessError`) y bloqueo por grupo
   (`GROUP_BLOCKED_TOOLS`).
4. **Rutas autoprotegidas** (`detectProtectedPathAccess`): se inspecciona el
   valor de todos los argumentos string contra patrones de `soflia-hub`,
   `dist-electron`, `app.asar`, `whatsapp-agent`, `desktop-agent`, `main*.js`,
   `electron/*.ts|js`, `src/*.tsx?|jsx?`, `.env`, `supabase`, `api key`. Es la
   defensa contra "lee tu propio prompt o tus keys con `read_file`". Las tools
   de chat interno (`app_chat_*`) están exentas porque legítimamente mencionan
   "soflia" en el contenido de una conversación.
5. **Confirmación humana** (`CONFIRM_TOOLS_WA`): se envía un mensaje
   "*Confirmacion requerida*" con la descripción de la acción; el usuario debe
   responder **SI**. Timeout de **60 segundos**, tras el cual se cancela y se
   avisa. `skipConfirmations` (tareas programadas) omite este paso.

Después de ejecutar, cada resultado se registra en el historial del servicio
(`recordHistory` con `kind: 'tool'`, nombres, resumen y `toolSignature`) y
alimenta el rastreo de evidencia.

### 3.10 Herramientas que exigen confirmación

`CONFIRM_TOOLS_WA` (37 herramientas):

`delete_item`, `send_email`, `execute_command`, `open_application`,
`kill_process`, `lock_session`, `shutdown_computer`, `restart_computer`,
`sleep_computer`, `toggle_wifi`, `run_in_terminal`, `run_claude_code`,
`run_background_command`, `kill_process_session`, `repair_background_host`,
`configure_remote_node_host`, `register_remote_node`, `remove_remote_node`,
`open_application_on_node`, `run_background_command_on_node`,
`take_screenshot_on_node`, `use_computer_on_node`,
`kill_remote_node_process_session`, `reset_browser_profile`,
`install_dynamic_toolset`, `uninstall_dynamic_toolset`,
`install_home_assistant_toolset`, `whatsapp_send_to_contact`, `gmail_send`,
`gmail_trash`, `gmail_apply_organization_plan`, `gmail_undo_organization_plan`,
`google_calendar_delete`, `gchat_send_message`, `organize_files`,
`batch_move_files`, `undo_last_file_operation`.

### 3.11 Herramientas bloqueadas en grupos

`GROUP_BLOCKED_TOOLS` (42 herramientas) impide que cualquier miembro de un grupo
controle la máquina del anfitrión. Cubre todo el control de sistema y terminal
(`execute_command`, `open_application`, `kill_process`, `lock_session`,
`shutdown_computer`, `restart_computer`, `sleep_computer`, `toggle_wifi`,
`contextual_control`, `run_in_terminal`, `run_claude_code`,
`run_background_command`, `kill_process_session`, `repair_background_host`),
todos los nodos remotos, la gestión de toolsets dinámicos, `use_computer`,
escritura y borrado de archivos (`delete_item`, `write_file`, `move_item`,
`organize_files`, `batch_move_files`, `undo_last_file_operation`), el
portapapeles (`clipboard_read`, `clipboard_write`), los planes de organización
de Gmail y **todo** el chat interno de la app (`app_chat_*`).

En grupo quedan disponibles: búsqueda web, lectura de páginas, consultas IRIS,
creación de documentos y envío de archivos.

### 3.12 Catálogo completo de herramientas de WhatsApp

**133 herramientas** declaradas en 11 dominios. Orden de concatenación en
`WA_TOOL_DECLARATIONS`: filesystem, comunicación, memoria, perfil, computadora,
nodos remotos, sistema, extensibilidad, IRIS, Google, automatización.
El catálogo efectivo de una conversación es siempre un subconjunto: depende de
los permisos del remitente y de si el canal es DM o grupo (§3.7).

#### Sistema de archivos

| Herramienta | Qué hace |
|---|---|
| `list_directory` | Lista archivos y carpetas de un directorio. |
| `read_file` | Lee texto plano, PDF, `.xlsx`, `.pptx` y `.docx`; convierte a Markdown incluyendo tablas estructuradas. |
| `write_file` | Crea o sobrescribe un archivo de texto. |
| `create_directory` | Crea una carpeta. |
| `move_item` | Mueve o renombra. |
| `copy_item` | Copia archivo o carpeta. |
| `delete_item` | Envía a la papelera. Requiere confirmación. |
| `get_file_info` | Tamaño, fechas y tipo. |
| `search_files` | Busca por nombre dentro de un directorio. |
| `organize_files` | Organiza en subcarpetas por extensión, tipo, fecha o reglas; admite `dry_run`. |
| `batch_move_files` | Mueve en lote por extensión o patrón, opcionalmente recursivo. |
| `list_directory_summary` | Resume un directorio grande antes de organizarlo. |
| `undo_last_file_operation` | Revierte una organización o movimiento masivo. |
| `clipboard_read` / `clipboard_write` | Lee y escribe el portapapeles. |
| `smart_find_file` | Busca un archivo por nombre en toda la computadora usando ubicaciones comunes. |

#### Comunicación y web

| Herramienta | Qué hace |
|---|---|
| `app_chat_list_conversations` | Lista conversaciones internas del Hub accesibles al usuario. |
| `app_chat_get_context` | Lee mensajes recientes de una conversación interna. |
| `app_chat_append_note` | Agrega una nota a una conversación interna. |
| `app_chat_list_assets` | Lista archivos asociados a una conversación interna. |
| `app_chat_send_asset` | Recupera un archivo del chat interno y lo envía por WhatsApp. |
| `get_email_config` / `configure_email` | Verifica y configura SMTP (detecta el servidor automáticamente). |
| `send_email` | Envía correo con adjuntos. Requiere confirmación. |
| `whatsapp_send_file` | Envía un archivo local al usuario por WhatsApp. |
| `save_whatsapp_file` | Guarda en disco un archivo recibido por WhatsApp. |
| `take_screenshot_and_send` | Captura todos los monitores y los envía por WhatsApp. |
| `whatsapp_send_to_contact` | Envía mensaje o archivo a otro número. Requiere confirmación. |
| `open_file_on_computer` | Abre un archivo con su app predeterminada. |
| `open_url` | Abre una URL en el navegador predeterminado. **Solo abre**: no interactúa. |
| `web_search` | Búsqueda en internet. |
| `read_webpage` | Extrae el texto de una página. |

#### Memoria y conocimiento

| Herramienta | Qué hace |
|---|---|
| `search_clipboard_history` | Busca en el historial reciente del portapapeles. |
| `semantic_file_search` | Busca archivos por contenido o descripción natural (FTS5). |
| `knowledge_save` | Guarda información en la base de conocimiento persistente. |
| `knowledge_update_user` | Actualiza el perfil del usuario (preferencias, contexto laboral). |
| `knowledge_search` | Busca en toda la base de conocimiento. |
| `knowledge_log` | Registra un evento en el log diario. |
| `knowledge_read` | Lee un archivo de conocimiento específico. |
| `save_lesson` | Guarda una lección aprendida para no repetir un error. |
| `recall_memories` | Consulta las lecciones previas. |
| `run_saved_procedure` | Ejecuta un procedimiento guardado, **solo** con confirmación explícita del usuario. |

#### Perfil

`whatsapp_update_profile`: persiste la personalización del agente para el
remitente actual (nombre, tono, trato, contexto, instrucciones).

#### Computadora

`use_computer`, `list_browser_profiles`, `reset_browser_profile` (§4).

#### Nodos remotos

| Herramienta | Qué hace |
|---|---|
| `get_remote_node_host_status` | Estado del host de nodo remoto de esta instancia. |
| `configure_remote_node_host` | Configura el host. Requiere confirmación. |
| `list_remote_nodes` | Lista nodos registrados. |
| `register_remote_node` / `remove_remote_node` | Alta y baja de nodos. Requieren confirmación. |
| `test_remote_node` | Prueba conectividad y capacidades. |
| `open_application_on_node` | Abre una app en un nodo. Requiere confirmación. |
| `run_background_command_on_node` | Comando en segundo plano remoto; devuelve `session_id`. Requiere confirmación. |
| `take_screenshot_on_node` | Captura la pantalla del nodo. Requiere confirmación. |
| `use_computer_on_node` | Ejecuta una tarea de automatización en el nodo. Requiere confirmación. |
| `list_remote_node_process_sessions` | Sesiones activas del nodo. |
| `poll_remote_node_process_session` | Estado de una sesión remota. |
| `kill_remote_node_process_session` | Termina una sesión remota. Requiere confirmación. |

#### Sistema

| Herramienta | Qué hace |
|---|---|
| `get_background_host_status` | Estado del host en segundo plano: login item, `schtasks`/Startup en Windows, XDG Autostart en Linux, modo de instalación. |
| `repair_background_host` | Reaplica esa configuración. Requiere confirmación. |
| `set_volume` | Sube, baja o silencia el volumen. |
| `contextual_control` | Ajusta volumen, brillo, plan de energía y notificaciones en un paso; acepta presets ("modo reunión"). |
| `toggle_wifi` | Activa o desactiva Wi-Fi. Requiere confirmación. |
| `execute_command` | Comando en PowerShell/bash. Timeout 30 s. Requiere confirmación. |
| `run_in_terminal` | Sesión administrada, visible u oculta; devuelve `session_id`. |
| `run_claude_code` | Lanza el CLI `claude` en sesión oculta administrada. Requiere confirmación. |
| `run_background_command` | Comando oculto con captura de stdout/stderr. Requiere confirmación. |
| `list_process_sessions` / `poll_process_session` | Inventario y seguimiento de sesiones administradas (estado, pid, salida reciente). |
| `kill_process_session` | Termina una sesión administrada. Requiere confirmación. |
| `lock_session` | Bloquea la sesión del sistema. Requiere confirmación. |
| `shutdown_computer` / `restart_computer` | Programados con 60 s de gracia para poder cancelar. Requieren confirmación. |
| `sleep_computer` | Suspende el equipo. Requiere confirmación. |
| `cancel_shutdown` | Cancela un apagado o reinicio programado. |
| `get_system_info` | SO, CPU, RAM, disco y rutas de escritorio/documentos/descargas. |
| `list_processes` | Procesos activos con PID, CPU y memoria. |
| `kill_process` | Cierra un proceso por nombre o PID. Requiere confirmación. |
| `open_application` | Abre app o archivo; en Windows resuelve ejecutables instalados, accesos directos y alias. |

#### Extensibilidad

`list_dynamic_tools`, `list_installable_toolsets`, `list_installed_toolsets`,
`doctor_dynamic_toolsets`, `install_dynamic_toolset`, `uninstall_dynamic_toolset`,
`install_home_assistant_toolset` (§6), más `create_document` (documentos
profesionales; `type:"pptx"` genera presentación con diseño premium exportada a
PDF a partir de `slides_json`).

#### IRIS / Project Hub

`iris_login`, `iris_logout`, `iris_get_projects`, `iris_create_project`,
`iris_update_project_status`, `iris_get_my_tasks`, `iris_get_issues`,
`iris_create_task`, `iris_update_task_status`, `iris_get_teams`,
`iris_get_team_members`, `iris_get_statuses`.

#### Google Workspace

Calendar: `google_calendar_create`, `google_calendar_get_events`,
`google_calendar_delete`.
Drive: `drive_list_files`, `drive_search`, `drive_download`, `drive_upload`,
`drive_create_folder`.
Chat: `gchat_list_spaces`, `gchat_get_messages`, `gchat_send_message`,
`gchat_add_reaction`, `gchat_get_members`.
Gmail: `gmail_send`, `gmail_get_messages`, `gmail_read_message`, `gmail_trash`,
`gmail_get_labels`, `gmail_create_label`, `gmail_preview_organization`,
`gmail_apply_organization_plan`, `gmail_undo_organization_plan`,
`gmail_modify_labels`, `gmail_delete_label`, `gmail_batch_empty_label`,
`gmail_empty_all_labels`.

#### Automatización

| Herramienta | Qué hace |
|---|---|
| `task_scheduler` | Programa una tarea que el propio agente ejecutará según una expresión cron. |
| `list_scheduled_tasks` / `delete_scheduled_task` | Inventario y baja de tareas programadas. |
| `list_active_tasks` / `cancel_background_task` | Tareas en segundo plano activas y su cancelación. |
| `neural_organizer_status` / `neural_organizer_toggle` | Organizador neuronal de descargas (IA + OCR). |


### 3.13 Comandos slash

Dispatcher: `wa-agent/chat-commands.ts` + `chat-commands/workflow-router.ts`.

| Comando | Efecto |
|---|---|
| `/status` | Estado de la sesión (modo y tamaño de historial). |
| `/reset`, `/new` | Borra el historial y el contexto de sesión. |
| `/activation` | Configura las reglas de activación. |
| `/perfil`, `/personalizar`, `/personalizacion` | Personalización del agente para ese remitente. |
| `/permisos`, `/permisoswa` | Consulta y gestión de permisos por número. |
| `/presentacion`, `/presentación` | Inicia el workflow conversacional de presentaciones. |
| `/help` | Ayuda contextual (difiere en grupo). |
| `/reunion`, `/reunión` | Workflow de reuniones. |
| `/correo`, `/correos` | Revisión de correo. |
| `/agenda` | Agenda del día. |
| `/seguimiento`, `/correoseguimiento` | Seguimiento de correos. |
| `/prepreunion`, `/reunionprep` | Preparación de reunión. |
| `/driveproyecto` | Workflow de proyecto en Drive. |
| `/chatdirectivo`, `/actualizacionchat` | Actualización al equipo por Google Chat. |
| `/computadora`, `/pc`, `/escritorio` | Workflow de computadora. |
| `/flujos`, `/misflujos` | Catálogo de workflows. |
| `/pendientes` | Casos de workflow pendientes de decisión. |
| `/aprobar`, `/autorizar` | Aprueba un caso pendiente. |
| `/rechazar`, `/noautorizar` | Rechaza un caso pendiente. |
| `/crearflujo` | Deshabilitado: responde que las variantes se guardan desde la app. |
| `/usarflujo`, `/ejecutarflujo` | Deshabilitado: redirige a los comandos de negocio o a las variantes guardadas. |

### 3.14 Workflows pasivos y tareas programadas

**Workflows pasivos** (`wa-agent/passive-workflows/`): solo en DM. Una frase
como "todos los lunes a las 8 revisa mi correo" se interpreta
(`parsePassiveWorkflowIntent` con extracción de hora y cron), se guarda como
regla de Skill pasiva con `source: 'chat'` y sus canales de entrega,
y se confirma al usuario. No vuelve a requerir el comando.

**TaskScheduler** (`electron/task-scheduler.ts`): jobs `node-cron` persistidos en
`userData/scheduler-state.json`. Valida la expresión cron antes de aceptarla,
soporta `runOnce` con `scheduledFor` (verifica el minuto exacto y purga tareas
vencidas más de 60 s), y emite `task-triggered`. El disparo entra al agente por
`handleScheduledWhatsAppTask` con `skipConfirmations`, porque el usuario ya
autorizó la tarea al programarla.

**ProactiveService** (`electron/proactive-service.ts`): tick por intervalo
configurable (`checkIntervalMinutes`), con horas de notificación permitidas y
control de duplicados por hora y por día. Primer tick a los 5 s del arranque.
Se puede disparar manualmente con `triggerNow`.

---

## 4. Agente de escritorio

Fuente: `electron/desktop-agent/` (más de 100 módulos), handlers en
`electron/desktop-agent-handlers/`. Documento hermano con el detalle de
ingeniería: [Desktop Agent](desktop-agent.md).

Permite a un modelo operar la computadora como lo haría una persona: abrir
aplicaciones, encontrar y clickear controles, escribir, arrastrar y verificar
que la pantalla cambió.

### 4.1 Principios

- **Determinista antes que visión**: si existe una API del sistema (lanzar app,
  abrir URL, enfocar ventana, leer el árbol de accesibilidad) se usa esa. El
  click estimado por visión es el último recurso.
- **Medir, no adivinar**: la posición de un control se mide con la fuente más
  confiable disponible (accesibilidad → OCR), no se estima sobre una captura
  reducida.
- **Coordenadas físicas de punta a punta**, sin reconversiones.
- **Humano, no robótico**: trayectorias suaves de mouse y micro-retardos al
  teclear.
- **Config-driven con rollback**: cada capacidad nueva tiene un flag.

### 4.2 Ruteo de backend

`executeDesktopAgentTaskEntrypoint` elige entre cuatro caminos:

1. **Browser (Playwright)** si `backend: 'browser'` o si el texto de la tarea
   contiene señales web (`https?://`, `www.`, Gmail, Google Calendar/Drive/Docs,
   LinkedIn, Notion, Salesforce, HubSpot, ChatGPT, "sitio web", "navegador",
   "chrome", "edge", "formulario web", "portal web"). Con el cerebro Computer Use
   habilitado para browser se intenta primero y, si no resuelve, cae al browser
   legacy.
2. **Windows UIA** si `backend: 'uia'` o si la tarea menciona superficies nativas
   instrumentables (explorador de archivos, bloc de notas, calculadora, Paint,
   Word, Excel, PowerPoint, Outlook, configuración de Windows, panel de control,
   administrador de tareas, diálogos "guardar como"/"abrir archivo", Office,
   WinRAR, 7-Zip, menú inicio). Si UIA falla y recomienda fallback, se hace
   **handoff automático a desktop visual** emitiendo `task-fallback` con el
   motivo, la categoría de fallo y las rutas de reporte y traza.
3. **Navegador real del usuario**: `use_real_browser: true` o frases que denotan
   dependencia de sesiones o contraseñas reales ("mi cuenta", "ya estoy
   logueado", "mis contraseñas", "navegador predeterminado", "mi perfil de
   Chrome"…). El perfil automatizado de Playwright está vacío, así que estas
   tareas van al **backend visual** con instrucción explícita de abrir sitios con
   `open_url` y no usar el navegador automatizado.
4. **Desktop visual** en cualquier otro caso.

`keywordRoutingEnabled: false` desactiva las heurísticas y deja la decisión al
backend explícito del llamador o al planner estratégico. Un `backend` explícito
gana sobre la heurística, pero nunca sobre `useRealBrowser`.

### 4.3 Ciclo percepción → planificación → acción → verificación

```
Tarea en lenguaje natural
  → Contexto de entorno: ventanas abiertas, ventana activa, monitores, apps instaladas
  → Planeación estratégica: fases + presupuesto de pasos
  → por paso:
       Percepción   captura (estrategia configurada) → layout inmutable
       Decisión     el modelo elige UNA acción tipada
       Acción       determinista | click por texto medido | click x,y
       Verificación ¿cambió la pantalla? ¿está atascado?
  → Outcome estructurado
```

Con `hierarchicalPlanningEnabled` el plan se divide en fases y se emite
`phase-completed`. El historial se resume cada `summarizeEveryNSteps` (15) y se
conservan `maxRawHistorySteps` (8) pasos crudos.

### 4.4 Acciones disponibles para el modelo

`DESKTOP_ACTIONS` (`action-types.ts`), validadas contra la unión antes de
ejecutarse:

- **Mouse**: `click`, `double_click`, `right_click`, `drag`, `mouse_down`,
  `mouse_up`, `mouse_move`.
- **Teclado**: `type`, `key`.
- **Navegación visual**: `scroll`, `zoom`.
- **Elementos**: `click_element`, `type_in_element`, `click_element_by_name`
  (texto visible + coordenada de pista).
- **Ventanas**: `focus_window`, `minimize_window`, `maximize_window`,
  `restore_window`, `close_window`.
- **Deterministas**: `open_application`, `open_url`.
- **Espera**: `wait`, `wait_for_change`, `wait_for_window`.
- **Terminación**: `done`, `fail`.

Cada acción lleva `message` obligatorio y campos opcionales (`x`, `y`, `x2`,
`y2`, `text`, `key`, `direction`, `amount`, `windowTitle`, `appName`, `url`,
`elementName`, `subGoal`, `confidence`, `zoomX/Y/Radius`, `elementId`).

### 4.5 Localización de elementos: medir en vez de adivinar

`element-locator/` resuelve `click_element_by_name` con una cadena de
proveedores:

- **UIA** (accesibilidad nativa de Windows) vía worker persistente: exacto y
  semántico.
- **OCR** (tesseract) con captura dedicada de mayor resolución
  (`ocrCaptureEdge` 1600) y `user_defined_dpi: '96'`: universal, funciona en
  Chromium, Java, juegos y terminales.

`text-matching.ts` es tolerante a acentos, mayúsculas, espacios y puntuación,
con guardas contra fragmentos triviales. `candidate-selection.ts` desambigua
espacialmente: cuando el mismo texto aparece varias veces, manda el score de
texto y, ante empate, gana el candidato más cercano a la pista de coordenada que
dio el modelo. El modelo apunta grosso modo; el locator mide fino.

`element-source/` compone la fuente de marcas del Set-of-Marks fusionando **UIA
+ OCR + parser visual** (`composite-element-source.ts`), con deduplicación por
IoU (`elementDedupIouThreshold` 0.6) y tope `maxDetectedElements` (60).

`visual-parser/` es un detector ONNX (estilo OmniParser) que encuentra regiones
clickeables sin depender de texto. Se omite cuando UIA ya es rica
(`visualSkipWhenUiaRich` 40 elementos) porque cuesta 1–2 s por paso; su umbral
de score es 0.10 y la NMS usa IoU 0.45.

### 4.6 Infraestructura nativa

**Worker PowerShell persistente** (`native-worker/`): un único proceso de larga
vida que recibe su script por STDIN (evitando el límite de 8191 caracteres de la
línea de comandos de Windows), compila los ensamblados UIA/user32 una sola vez y
atiende peticiones JSON línea por línea con el centinela `##SOFLIA##`. Correlaciona
por `id`, aplica timeout por petición y reinicia con backoff ante caída.
**Despertar de accesibilidad**: si llegan menos de `uiaSparseThreshold` (8)
elementos, espera `uiaWakeDelayMs` (1200 ms) y reconsulta, porque Chromium y Java
construyen su árbol de forma perezosa.

**InputDriver** (`input-driver/`): backend `nut.js` in-process y multiplataforma,
con movimiento humano por curva Bézier cúbica, jitter acotado y duración
proporcional a la distancia (ley de Fitts), y tecleo con micro-retardos. Si
`nut.js` no carga, cae automáticamente al backend legacy (PowerShell/xdotool):
el agente nunca queda sin control de entrada.

**Pipeline de coordenadas**: captura por estrategia (`active-monitor` por
defecto), resolución adaptativa que garantiza `renderScale ≥ minRenderScale`
(0.5) acotada por `maxScreenshotEdge` (1568), **layout inmutable por paso**
(solo la captura de propósito `decision` fija el layout contra el que se
resuelven las coordenadas) y conversión correcta DIP ↔ físico. `coordinate-selftest.ts`
mueve el cursor a puntos conocidos por monitor y verifica con `GetCursorPos`
(tolerancia ±2 px); se autoejecuta al cambiar la topología de monitores.

### 4.7 Cerebro Gemini Computer Use

`gemini-cu/` implementa la Computer Use API nativa de Gemini, con drivers para
escritorio (nut.js), navegador integrado (`WebContentsView`) y Playwright
aislado, mas mapeo de acciones propio. Se controla con:

El chat trata referencias deícticas como “lo que estoy viendo”, “esta página” o
“aquí”, y relaciones como “el repositorio que me mandó Ernesto”, como solicitudes
de percepción. Si el navegador integrado está visible, el renderer solicita una
observación puntual reciente de la pestaña enfocada mediante
`integrated-browser:get-observation` y adjunta captura + DOM al turno multimodal.
Si el contenido solicitado está detrás de un enlace visible, el orquestador usa
primero búsqueda web o URL Context; puede refrescar `read_browser_dom` o abrir un
destino conocido con `navigate_integrated_browser` en la misma sesión. Los clics,
la escritura, el desplazamiento y el retroceso se resuelven con el controlador
determinista por `ref`; el ciclo leer -> clic -> volver recorre listas completas
sin actuador visual. `use_computer` con backend `browser` queda como escalón
siguiente para lo que ese controlador no cubra y conserva la misma URL, cookies
y sesión. Si la vista no está visible o la captura falla,
el chat no presenta una observación
inventada. Este contrato ofrece capturas actuales e iterativas, no una
transmisión continua de video.

El navegador puede mantener hasta 500 pestañas lógicas, con un máximo de ocho
`WebContentsView` vivas y dos visibles en composición dividida o superpuesta.
`activeTabId` sigue el foco; captura, tamaño del viewport,
eventos de entrada y credenciales se resuelven exclusivamente contra esa pestaña.
Los popups HTTP(S) crean otra pestaña interna y nunca cambian al navegador externo.

El chat compacto reserva un inset izquierdo o derecho y mantiene el
`WebContentsView` visible; no estaciona la vista ni solicita PNG periódicos. Si
Computer Use no puede iniciar o capturar esa vista, la tarea termina como
`fallida` y no se reintenta mediante desktop ni el navegador predeterminado.
El panel mide el inicio del contenido y comienza debajo de la barra superior.

- `computerUseEngine`: `'gemini'` o `'legacy'` (default `'gemini'`);
- `computerUseModel`: `gemini-3.6-flash` (único; sin fallback de modelo);
- `computerUseDesktopEnabled` / `computerUseBrowserEnabled`: `true`;
- `computerUsePromptInjectionDetection`: `true` (detección de inyección en la
  captura).

### 4.8 Ciclo de vida, cola y contrato de finalización

- **Single-instance**: `maxConcurrentAgents: 1`. El escritorio visual tiene un
  mouse y un teclado, y el estado del paso vive en el servicio; dos tareas
  concurrentes se corrompen mutuamente.
- **Cola con expiración y cancelación**: las tareas adicionales se encolan
  emitiendo `task-queued`. Expiran a `queueTimeoutMs` (60 s) emitiendo
  `task-queue-timeout`, y respetan `AbortSignal` — una tarea abandonada nunca se
  ejecuta minutos después a espaldas del usuario.
- **Presupuesto de pasos**: `maxSteps` 120 es el tope duro,
  `defaultStepBudget` 60 el default y `maxTotalSteps` 500 el acumulado; las
  tareas del navegador integrado reciben un mínimo de 90 y terminan antes al
  completar.
- **Outcome estructurado** (`task-outcome.ts`): `completada`, `fallida`,
  `cancelada`, `presupuesto_agotado`, `cola_expirada`, con `pasosEjecutados`,
  `duracionMs` y `ultimaVentana`.

**Regla de honestidad**: el agente conversacional solo afirma éxito con
`estado === 'completada'`. La respuesta de `use_computer` incluye además
`pasos_ejecutados`, `duracion_ms`, `ultima_ventana`, `current_backend`,
`current_url`, `current_browser_profile`, `last_verification`, `trace_path`,
`report_path` y `screenshot_path`. Mientras corre, WhatsApp recibe progreso cada
`progressReportEveryNSteps` (25) pasos y un aviso al completar cada fase.

### 4.9 Configuración completa

`electron/desktop-agent/agent-config.ts`, persistida en
`userData/desktop-agent-config.json`.

| Flag | Default | Controla |
|---|---|---|
| `maxSteps` | 120 | Tope duro de pasos |
| `defaultStepBudget` | 60 | Presupuesto por defecto; 90 mínimo en navegador integrado |
| `maxTotalSteps` | 500 | Pasos acumulados |
| `screenshotWidth` / `screenshotHeight` | 1024 / 768 | Tamaño base de captura |
| `defaultActionDelay` | 300 ms | Espera entre acciones |
| `waitForChangeTimeout` / `waitForChangeInterval` | 8000 / 500 ms | Verificación de cambio |
| `continuousObservationInterval` | 2000 ms | Observación continua |
| `planningEnabled` | true | Planeación estratégica |
| `hierarchicalPlanningEnabled` | true | Plan por fases |
| `memoryWindowSize` | 10 | Ventana de memoria del paso |
| `model` / `fallbackModel` | `gemini-3.6-flash` / `gemini-3.6-flash` | Modelo único de visión |
| `proactiveModel` | `gemini-3.6-flash` | Modelo proactivo |
| `maxConsecutiveFailures` | 3 | Fallos seguidos tolerados |
| `stuckDetectionThreshold` | 4 | Detección de atasco |
| `autoRecoverFromDialogs` | true | Recuperación ante diálogos |
| `replanOnStuck` | true | Replanificar si se atasca |
| `maxRetryPerAction` | 2 | Reintentos por acción |
| `maxConcurrentAgents` | 1 | Serialización de tareas visuales |
| `queueTimeoutMs` | 60000 | Expiración en cola |
| `gridEnabled` / `gridStep` | true / 100 | Rejilla de referencia |
| `zoomEnabled` / `zoomResolution` | true / 512 | Zoom de inspección |
| `verificationEnabled` | true | Verificación tras acción |
| `summarizeEveryNSteps` / `maxRawHistorySteps` | 15 / 8 | Resumen de historial |
| `progressReportEveryNSteps` | 25 | Reporte de progreso |
| `somEnabled` / `somFallbackToGrid` | true / true | Set-of-Marks |
| `focusedCaptureEnabled` / `focusedCapturePadding` | true / 24 | Captura enfocada |
| `deterministicFirstEnabled` | true | Preferir acciones deterministas |
| `environmentContextEnabled` | true | Contexto de entorno en el prompt |
| `environmentRefreshEveryNSteps` | 5 | Refresco del contexto |
| `installedAppsIndexTtlMs` | 6 h | TTL del índice de apps |
| `captureStrategy` | `active-monitor` | Estrategia de captura |
| `minRenderScale` / `maxScreenshotEdge` | 0.5 / 1568 | Resolución adaptativa |
| `layoutBindingEnabled` | true | Layout inmutable por paso |
| `legacyScaleFallbackEnabled` | false | Escalado legacy |
| `keywordRoutingEnabled` | true | Heurísticas de ruteo |
| `inputBackend` | `nut` | Backend de entrada |
| `humanMotionEnabled` / `humanTypingEnabled` | true / true | Movimiento y tecleo humanos |
| `uiaWorkerEnabled` | true | Accesibilidad UIA |
| `uiaSparseThreshold` / `uiaWakeDelayMs` | 8 / 1200 | Despertar de accesibilidad |
| `ocrCaptureEdge` | 1600 | Captura dedicada para OCR |
| `elementSourceEnabled` / `ocrElementsEnabled` / `visualParserEnabled` | true | Fuentes de elementos |
| `maxDetectedElements` / `elementDedupIouThreshold` | 60 / 0.6 | Volumen y dedup |
| `sufficientElementCount` / `visualSkipWhenUiaRich` | 12 / 40 | Omisión de OCR y de parser visual |
| `visualScoreThreshold` / `visualNmsIou` | 0.10 / 0.45 | Detector visual |
| `computerUseEngine` / `computerUseModel` | `gemini` / registro recomendado | Cerebro Computer Use |
| `computerUseDesktopEnabled` / `computerUseBrowserEnabled` | true / true | CU por backend |
| `computerUsePromptInjectionDetection` | true | Detección de inyección en captura |

**Rollback a conducta previa**:
`{ inputBackend: 'legacy', humanMotionEnabled: false, uiaWorkerEnabled: false,
captureStrategy: 'all-monitors', layoutBindingEnabled: false,
legacyScaleFallbackEnabled: true, deterministicFirstEnabled: false }`.

Las configuraciones guardadas antes de `captureStrategy` se migran desde
`focusedCaptureEnabled` sin cambiar el comportamiento elegido.

---

## 5. Agente de reuniones

Fuente: `electron/meetings/`, `electron/meeting-live/`.

### 5.1 Extracción gobernada por Context Pack

`MeetingAIService.extractMeetingAsset` carga un **Context Pack versionado**
(`context-pack/`) que define los tipos de reunión y qué se extrae de cada uno.
El resultado pasa por `normalizeMeetingAnalysisResult` y luego por
`buildMeetingAssetPayload`, y se devuelve con la confianza del tipo detectado.
Sin API key, el servicio degrada de forma controlada en vez de inventar.

Regla del rol (`ai-specs/agents/runtime/meeting-agent.md`): conserva fuentes,
marca datos ausentes y **no inventa** participantes, acuerdos ni fechas.

### 5.2 Flujo de un run

`MeetingWorkflowService` coordina store, fuentes, IA, revisión, sincronización y
asignación:

1. **Creación**: `createManualRun` (texto pegado) o `createDriveRun` (archivo de
   Drive por id o URL). La fuente se prepara antes de la extracción.
2. **Procesamiento**: `processPreparedMeetingRun` genera el asset y las acciones
   propuestas con un `traceId` propio, resolviendo responsables reales contra los
   miembros del equipo (`getTeamMembersDetailed`).
3. **Revisión**: `listRuns`, `getRunDetail`, `getFollowups` para inspeccionar.
   `updateAction` permite editar el borrador de una acción.
4. **Aprobación humana**: `approveAsset`, `approveActions` (total o por
   `actionIds`), `rejectAction`. La aprobación es **estado de negocio
   persistido**, no una frase interpretada por el modelo.
5. **Sincronización**: `syncApprovedActions` envía a destino solo lo aprobado.

### 5.3 Detección pasiva

`meeting-passive-detection-*` escanea Calendar, Drive y Gmail buscando material
de reuniones sin intervención del usuario, con procesador, notificador y store
propios (`meeting-detection-store/`). El objetivo es proponer runs, no crearlos
de forma opaca.

### 5.4 Reunión en vivo

`meeting-live/` cubre detección de reunión activa (`meeting-detector.ts`),
construcción incremental de transcripción (`transcript-builder.ts`), modelo de
hablantes (`speaker-model.ts`) y resolución de nombres de participantes
(`participant-names.ts`). La UI vive en `src/components/orb/MeetingLivePanel.tsx`
y `useMeetingLive.ts`.

---

## 6. Herramientas dinámicas (MCP)

Fuente: `electron/mcp-manager/`, `electron/dynamic-tool/`,
`electron/dynamic-tool-service.ts`. Documento hermano:
[Herramientas dinámicas runtime](runtime-dynamic-tools.md).

Es el mecanismo para agregar capacidades **en caliente** sin recompilar, con
contrato cerrado y política obligatoria.

### 6.1 Descubrimiento

`MCPManager` descubre `.json`, `.js` y `.ts` **solo** en los directorios
configurados por `DynamicToolService` (workspace y `userData/toolsets/`). No
examina `ai-specs/`, ni adaptadores de IDE, ni skills de desarrollo. Un watcher
recarga los contratos al cambiar.

### 6.2 Contrato obligatorio

`parseToolContract` valida con Zod:

| Campo | Regla |
|---|---|
| `name` | `^[a-z][a-z0-9_-]{2,63}$` |
| `description` | 8 a 1000 caracteres |
| `inputSchema` | objeto cerrado, `additionalProperties: false`, **sin nodos opacos** |
| `outputSchema` | objeto cerrado; un nodo `{}` es opaco explícito, solo para respuestas de APIs externas |
| `runtime.owner` | `^[a-z][a-z0-9-]{2,63}$` |
| `runtime.risk` | `read` \| `write` \| `critical` |
| `runtime.allowedAgents` | subconjunto no vacío de `whatsapp-agent`, `desktop-agent`, `meeting-agent` |
| `runtime.hitl` | `never` \| `required` |
| `runtime.allowInGroups` | booleano |
| `runtime.timeoutMs` | entero entre 100 y 60 000 |
| `runtime.audit` | literal `true` |

Reglas cruzadas: **`write` y `critical` exigen `hitl: 'required'` y no pueden
habilitarse en grupos**. Un plugin ejecutable sin `outputSchema` o sin `runtime`
se rechaza al cargar (no se degrada el parser para "recuperarlo": se corrige el
contrato).

Ejemplo de contrato válido:

```js
export default {
  name: 'inventory_get_item',
  description: 'Consulta un artículo autorizado del inventario.',
  inputSchema: {
    type: 'object',
    properties: { item_id: { type: 'string', minLength: 1 } },
    required: ['item_id'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: { success: { type: 'boolean' }, item: {} },
    required: ['success', 'item'],
    additionalProperties: false,
  },
  runtime: {
    owner: 'inventory-platform',
    risk: 'read',
    allowedAgents: ['whatsapp-agent'],
    hitl: 'never',
    allowInGroups: false,
    timeoutMs: 10000,
    audit: true,
  },
  async handler(args, context) {
    const response = await fetch(`https://inventory.invalid/items/${encodeURIComponent(args.item_id)}`, {
      signal: context.signal,
    });
    return { success: response.ok, item: await response.json() };
  },
};
```

### 6.3 Ejecución

`executeRegisteredTool` aplica, en orden:

1. La herramienta existe y tiene handler (`tool_not_found`, `handler_missing`).
2. El contexto de ejecución valida contra un esquema estricto:
   `agentId` y `channel` del enum, `isGroup`, `approvedByHuman`, `traceId` UUID,
   `contractFingerprint` SHA-256 en hex y `actorRef` con formato
   `^[a-z]+:[a-f0-9]{16}$` (`invalid_execution_context`).
3. **Política**: la huella del contrato debe coincidir con la del preflight
   (`contract_changed` si el watcher recargó el contrato entre medias); el agente
   debe estar en `allowedAgents` (`agent_denied`); en grupo debe existir
   `allowInGroups` (`group_denied`); con `hitl: 'required'` debe haber
   `approvedByHuman` (`approval_required`).
4. **Entrada** validada contra el JSON Schema compilado (`input_invalid`).
5. **Handler** con `AbortController` y timeout propio (`timeout`).
6. **Salida** validada igual que la entrada (`output_invalid`).
7. **Auditoría** siempre, con éxito o error.

Desde WhatsApp, el `actorRef` es `wa:<sha256(telefono).slice(0,16)>`: seudónimo
estable, nunca el número.

### 6.4 Auditoría

El evento `runtime_tool_execution` contiene únicamente: `traceId`, nombre,
propietario, riesgo, agente, `actorRef` seudónimo, resultado, duración y código
de error. **Nunca** argumentos, resultado del handler, teléfono, token, `jid` ni
ruta local del plugin. El inventario y el doctor tampoco devuelven rutas
absolutas; instalación y desinstalación solo devuelven nombres de archivo.

### 6.5 Gestión y migración

`install_dynamic_toolset`, `uninstall_dynamic_toolset`,
`install_home_assistant_toolset` (atajo del builtin migrado),
`list_installable_toolsets`, `list_installed_toolsets`, `list_dynamic_tools` y
`doctor_dynamic_toolsets` (archivos presentes, tools realmente cargadas y
variables de entorno faltantes). Un toolset administrado que no carga todas sus
herramientas aparece como `degraded`. Reinstalar un builtin regenera sus
archivos con el contrato vigente.

Para migrar un plugin legacy: cerrar el esquema de entrada; declarar y cerrar el
de salida; asignar propietario y riesgo reales; limitar `allowedAgents` al
consumidor necesario; exigir HITL para escritura o crítico y deshabilitar
grupos; propagar `context.signal` a la I/O cancelable; y ejecutar las pruebas de
contrato más `doctor_dynamic_toolsets`.

**Rollback**: revertir el código y reinstalar la versión anterior del toolset
restaura el loader previo. No hay tablas ni estado remoto que migrar. No se
recomienda relajar el parser para recuperar un plugin: debe corregirse su
contrato.

---

## 7. Seguridad transversal

| Control | Dónde | Qué impide |
|---|---|---|
| Prefiltro de temas sensibles | `wa-agent/security-prefilter.ts` | Extracción del system prompt, del código, de claves; jailbreak |
| Detector de inyección de prompts | `security/prompt-injection-detector.ts` | Instrucciones hostiles embebidas en el mensaje |
| Rutas autoprotegidas | `wa-executor/security.ts` | Que el agente lea su propio código, `.env` o credenciales vía herramientas de archivo |
| Política de comandos | `security/command-policy.ts` | `format`/`diskpart`/`bcdedit`, borrado seguro de disco, cambios de privilegios y registro, apagados encubiertos, matar `explorer.exe`, borrado recursivo de unidad o raíz, `mkfs`/`dd`, fork bomb, `Invoke-Expression`, payloads base64 ofuscados, descarga-y-ejecución encadenada y exfiltración de secretos. Tope de 4000 caracteres y sin caracteres de control |
| Allowlist por permiso y número | `whatsapp/access-control.ts` | Que un contacto no autorizado vea o use una capacidad |
| Bloqueo por grupo | `wa-tools/security.ts` | Que un miembro de grupo controle la máquina anfitriona |
| Confirmación humana | `wa-agent/tool-confirmation.ts` | Acciones destructivas o de envío sin "SI" explícito (60 s de ventana) |
| Guarda de intención | `wa-agent/tool-intent-guard.ts` | Acciones operativas no solicitadas |
| Política de herramientas dinámicas | `mcp-manager/execution.ts` | Ejecución fuera del agente, canal, riesgo o aprobación declarados |
| Contrato de finalización | `desktop-agent/task-outcome.ts` | Que el agente afirme éxito sin haberlo logrado |

Regla base de `ai-specs/policies/tool-boundaries.md`: los agentes runtime
reciben capacidades **declaradas individualmente**; se deniega por defecto shell,
Git, escritura arbitraria, borrado, credenciales y publicación; todo argumento se
valida y sanea en el proceso main; y la interfaz del modelo **nunca** sustituye
la allowlist ni la autorización del usuario.

---

## 8. Límites numéricos de referencia

| Parámetro | Valor | Fuente |
|---|---:|---|
| Iteraciones del loop de WhatsApp | 25 | `wa-agent/agent-loop.ts` |
| Iteraciones del loop de chat | 10 | `gemini-chat/agentic-loop.ts` |
| Loop guard: warning / crítico | 3 / 5 | `wa-agent/constants.ts` |
| Historial de WhatsApp en memoria / al cargar | 20 / 30 | `wa-agent/constants.ts`, `agent-loop-setup.ts` |
| `maxOutputTokens` WhatsApp / chat | 4096 / 16384 | `agent-loop-setup.ts`, `model-config.ts` |
| Timeout de confirmación por WhatsApp | 60 s | `wa-agent/tool-confirmation.ts` |
| Timeout de `use_computer` desde el chat | 15 min | `gemini-chat/agentic-loop.ts` |
| Timeout de `execute_command` | 30 s | `computer-use/command-tool.ts` |
| Media inline de WhatsApp | 15 MiB | `wa-agent/media-preparation.ts` |
| Pasos del agente de escritorio (tope / default / total) | 60 / 40 / 500 | `desktop-agent/agent-config.ts` |
| Tareas visuales concurrentes | 1 | `desktop-agent/agent-config.ts` |
| Expiración en cola de escritorio | 60 s | `desktop-agent/agent-config.ts` |
| Timeout de herramienta dinámica | 100 ms – 60 s | `mcp-manager/tool-contract.ts` |
| Longitud máxima de comando | 4000 caracteres | `security/command-policy.ts` |
| Gracia de apagado/reinicio | 60 s | `wa-tools/system/power.ts` |

Inventario más amplio de defaults operativos:
[Parametros runtime](runtime-parameters.md).

---

## 9. Cómo extender el agente

### 9.1 Agregar una herramienta estática de WhatsApp

1. Declara la herramienta en el módulo de dominio de `electron/wa-tools/`
   (los arrays se concatenan solos en `index.ts`).
2. Si es destructiva o envía algo, agrégala a `CONFIRM_TOOLS_WA`.
3. Si no debe existir en grupos, agrégala a `GROUP_BLOCKED_TOOLS`.
4. Mapea su permiso en `TOOL_PERMISSION_MAP` (`whatsapp/access-control.ts`).
5. Implementa el handler en `electron/wa-executor/handlers/` y regístralo en
   `tool-dispatch.ts`.
6. Si es operativa, considera incluirla en `OPERATIONAL_TOOL_NAMES` de la guarda
   de intención.
7. Pruebas positivas, negativas y de permisos.

### 9.2 Agregar una herramienta dinámica

Sigue el contrato de §6.2, declara `owner` y `risk` reales, limita
`allowedAgents` al consumidor necesario, exige HITL para `write`/`critical`,
propaga `context.signal` a toda I/O cancelable y valida con
`doctor_dynamic_toolsets`.

### 9.3 Agregar una capacidad nativa nueva

Requisitos mínimos de `ai-specs/policies/runtime-exposure.md` (ver §B.9):
identificador estable y propietario; esquema Zod cerrado de entrada y salida;
clasificación de riesgo y regla HITL; adaptador en Electron main; allowlist por
agente y contexto incluidos grupos; sanitización, timeout, cancelación e
idempotencia cuando aplique; auditoría con `trace_id`, actor y resultado sin
secretos; y pruebas positivas, negativas y de permisos.

Todo canal IPC nuevo debe pasar por servicio, handler, allowlist del preload y
wrapper tipado del renderer — ver [Normas de Electron e IPC](../standards/electron-ipc.md).

---

## 10. Verificación

```powershell
npm run typecheck
npm run test:main        # agentes, guardas, coordenadas, worker, locator
npm run test:renderer    # loop de chat y despacho de herramientas
npm run verify:pr
```

Comprobaciones específicas del agente de escritorio:

- Calibración en hardware real desde DevTools del renderer:
  `await window.desktopAgent.runCalibration()` (criterio ±2 px por monitor).
- E2E manual: una orden como "Abre Minecraft y ejecútalo"; en el log deben verse
  el backend de entrada, `open_application ... via indice`,
  `click_element_by_name "..." via uia|ocr en fisico (x, y)` y `outcome.estado`.
- Rollback rápido: editar `userData/desktop-agent-config.json` con los flags
  legacy de §4.9.

---

## 11. Limitaciones conocidas

- **Apps opacas**: si una aplicación no expone árbol de accesibilidad y su texto
  no es legible por OCR (canvas, íconos sin texto), la única vía es el click por
  coordenadas de visión, que es imperfecto. El parser visual ONNX mitiga pero no
  elimina el problema.
- **macOS y Linux**: el diseño es multiplataforma (nut.js, OCR, xdotool en el
  backend legacy), pero el worker UIA es específico de Windows. Los equivalentes
  — AX en macOS y AT-SPI en Linux — están pendientes como proveedores adicionales
  del `element-locator`.
- **Timeout cooperativo de herramientas dinámicas**: la I/O que respeta
  `AbortSignal` se cancela; el código síncrono que bloquea el event loop sigue
  siendo un riesgo residual.
- **`BLOCKED_TOOLS_WA` vacío**: no hay bloqueo global de herramientas por
  WhatsApp; la contención depende de permisos, bloqueo por grupo, rutas
  protegidas y confirmación. Es una decisión de producto, no un olvido.
- **Texto de `/status` desactualizado**: reporta un modelo fijo distinto de
  `WA_MODEL`.
- **AutoDev no existe** en el bootstrap actual: los textos y pruebas que lo
  mencionan son deuda legacy. No hay orquestador de agentes de desarrollo dentro
  del ejecutable.

---

# Parte E — Trazabilidad y mantenimiento

## E.1 Correspondencia entre partes y documentos canónicos

| Sección de este archivo | Documento canónico |
|---|---|
| A.1 – A.3 | `README.md` |
| B.1 – B.6 | `AGENTS.md`, `CLAUDE.md`, `ai-specs/README.md` |
| B.7 | `ai-specs/agents/registry.yaml`, `ai-specs/agents/runtime/*.md` |
| B.8 | `ai-specs/policies/tool-boundaries.md` |
| B.9 | `ai-specs/policies/runtime-exposure.md` |
| C.1 – C.4 | `docs/architecture/agents-and-automation.md` |
| D.1 – D.11 | `docs/architecture/runtime-agents-manual.md` |
| D.4 (detalle de ingeniería) | `docs/architecture/desktop-agent.md` |
| D.6 (contrato MCP) | `docs/architecture/runtime-dynamic-tools.md` |
| D.8 (defaults ampliados) | `docs/architecture/runtime-parameters.md` |

## E.2 Regla de mantenimiento

Toda funcionalidad que cambie contratos, datos, IPC o comportamiento visible del
agente debe actualizar el documento canónico correspondiente **en el mismo
cambio**, y después reflejarlo aquí. Verificación aplicable:

```powershell
npm run docs:check
npm run docs:system:check
npm run harness:validate
```

## E.3 Documentos relacionados

- [Agentes y automatizacion](agents-and-automation.md) — resumen normativo.
- [Manual del agente runtime](runtime-agents-manual.md) — fuente de la parte D.
- [Desktop Agent](desktop-agent.md) — ingeniería del control de computadora.
- [Herramientas dinámicas runtime](runtime-dynamic-tools.md) — contrato MCP.
- [IPC e integraciones](ipc-and-integrations.md) — canales y contratos.
- [Parametros runtime](runtime-parameters.md) — defaults y topes.
- [Seguridad y privacidad](../security/security-and-privacy.md).
- [Mapa de modulos](module-map.md).
