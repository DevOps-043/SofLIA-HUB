# Analisis profundo del sistema de Computer Use de Pulse

Fecha: 2026-03-16

## 1. Resumen ejecutivo

El problema principal no es que el modelo "piense mal" solamente. El problema es sistemico:

1. Pulse tiene dos sistemas distintos de computer use y no una sola arquitectura coherente.
2. El sistema mas avanzado (`desktop-agent-service.ts`) existe, pero hoy esta integrado sobre todo con WhatsApp, no con el chat local del renderer.
3. El camino alterno (`computer-use-handlers.ts`) usa automatizacion muy primitiva: screenshot + OCR + `SendKeys`/`mouse_event`, sin estado estructural robusto.
4. La verificacion actual es debil: compara hashes parciales de screenshots y asume que si la pantalla cambio, la accion fue correcta.
5. No existe una capa browser-native equivalente a Playwright para web. El sistema trata Gmail, formularios y apps web como si fueran pixeles.
6. No existe observabilidad de nivel serio: no hay trazas reproducibles, no hay replay, no hay assertions por objetivo, no hay dataset de fallos, no hay tests del agente.

Conclusion: el sistema actual esta mas cerca de un "vision clicker" experimental que de una plataforma confiable de computer use.

## 2. Como funciona hoy realmente

### 2.1 Dos rutas separadas

- Renderer local:
  - Las tools de `src/services/gemini-tools.ts` exponen file ops, system ops, clipboard y `take_screenshot`, pero no `use_computer`. Ver `src/services/gemini-tools.ts:227`.
  - El bridge del renderer expone `window.computerUse` y `window.desktopAgent` por separado. Ver `electron/preload.ts:248` y `electron/preload.ts:404`.
  - `executeComputerTool()` del renderer solo despacha herramientas primitivas de `computerUse`, no el agente autonomo. Ver `src/services/computer-use-service.ts:98`.

- WhatsApp:
  - La tool `use_computer` de WhatsApp si entra al `DesktopAgentService` y llama `executeTask()`. Ver `electron/whatsapp-tool-executor.ts:293` y `electron/whatsapp-tool-executor.ts:316`.

Resultado: el sistema no tiene una sola semantica de computer use. Tiene una ruta "primitiva" para el producto local y otra "autonoma" para WhatsApp.

### 2.2 Ruta A: `computer-use-handlers.ts`

Esta ruta usa automatizacion directa del OS:

- Clicks y typing con PowerShell / `mouse_event` / `SendKeys`. Ver `electron/computer-use-handlers.ts:45`.
- Busqueda visual por OCR cuando no hay coordenadas y se manda texto. Ver `electron/computer-use-handlers.ts:144` y `electron/computer-use-handlers.ts:694`.
- Captura de pantalla y AXTree del `BrowserWindow` activo solo al tomar screenshot. Ver `electron/computer-use-handlers.ts:625` y `electron/computer-use-handlers.ts:662`.
- Expone IPC `computer:use-computer`, pero el renderer no lo usa de forma integrada. Ver `electron/computer-use-handlers.ts:866`.

Problemas de esta ruta:

- OCR por texto para click es fragil en interfaces densas, apps con iconos, canvas, fuentes chicas o estados dinamicos.
- `SendKeys` depende demasiado del foco correcto.
- No hay nocion fuerte de target semantico, solo coordenada o texto OCR.
- El AXTree se captura pero no hay una capa de razonamiento sistematica que lo explote en el loop de accion.

### 2.3 Ruta B: `desktop-agent-service.ts`

Este es el sistema mas ambicioso:

- Captura screenshots, agrega grid y a veces Set-of-Marks. Ver `electron/desktop-agent-service.ts:173` y `electron/desktop-agent-service.ts:205`.
- Intenta detectar elementos UIA del foreground window via Windows UI Automation. Ver `electron/desktop-agent-service.ts:356`.
- Calcula escalado screenshot->pantalla. Ver `electron/desktop-agent-service.ts:427`.
- Ejecuta un loop de plan -> screenshot -> vision -> accion -> verificacion -> recovery. Ver `electron/desktop-agent-service.ts:753`.
- El modelo responde JSON libre con accion, coordenadas, subGoal, etc. Ver `electron/desktop-agent-service.ts:1223` y `electron/desktop-agent-service.ts:1314`.
- La recuperacion proactiva es otro prompt LLM que propone nuevas acciones. Ver `electron/desktop-agent-service.ts:1041`.

Problemas de esta ruta:

1. Sigue siendo pixel-first.
   - Aunque tenga SoM y UIA, la decision central sigue viniendo de una imagen y JSON libre.

2. UIA limitada.
   - Solo inspecciona la ventana en foreground.
   - Filtra un maximo de 40 elementos.
   - Solo busca patrones invoke/value/toggle.
   - Si falla UIA, vuelve a grid. Ver `electron/desktop-agent-service.ts:356`.

3. Verificacion insuficiente.
   - `waitForScreenChange()` y la verificacion post-accion dependen de `quickHash()` sobre los primeros 4000 chars del base64. Ver `electron/desktop-agent-service.ts:668` y `electron/desktop-agent-service.ts:691`.
   - Eso detecta "cambio visual", no "exito semantico".

4. Recovery demasiado dependiente del mismo modelo.
   - Cuando falla, el sistema responde con otro prompt al LLM para "inventar" recuperacion. Ver `electron/desktop-agent-service.ts:1065`.
   - No hay planner/supervisor separado con reglas fuertes ni verificacion externa.

5. Acciones base poco robustas.
   - El typing usa clipboard + paste.
   - Los clicks usan PowerShell / `SetCursorPos` / `mouse_event`.
   - La estrategia de retry es mover `x +/- 5px`. Ver `electron/desktop-agent-service.ts:925`.

6. Multi-agent nominal, no real.
   - Puede encolar varias tareas, pero todas compiten por el mismo mouse/keyboard del host. Ver `electron/desktop-agent-service.ts:753`.
   - No hay aislamiento real por task.

### 2.4 Capacidad semantica ya existente pero no aprovechada

`MonitoringService` ya tiene una API de snapshot semantico con screenshot + AXTree. Ver `electron/monitoring-service.ts:210` y `electron/monitoring-service.ts:438`.

Hoy no esta integrada en el loop principal del desktop agent. Esa es una oportunidad clara de rediseño.

## 3. Causas raiz de la baja usabilidad

### 3.1 Fragmentacion arquitectonica

No hay un "core" unico de computer use. Hay:

- tool bridge del renderer
- handler GUI/OCR
- desktop agent autonomo
- integracion de WhatsApp
- snapshot semantico en monitoring

Eso genera prompts, contratos, retries y observabilidad distintos.

### 3.2 Precision basada en pixeles en escenarios donde deberia haber estructura

Para web moderna, formularios y apps SaaS, un sistema serio usa DOM, accessibility tree, locators o browser-native controls antes de caer a vision. Pulse hace lo contrario.

### 3.3 Falta de verificacion semantica

Cambiar la pantalla no prueba que:

- se hizo click en el elemento correcto
- el form quedo lleno
- el submit fue aceptado
- la tarea avanzo de fase

### 3.4 Falta de instrumentation

No hay:

- trace viewer
- timeline de acciones
- replay reproducible
- diff semantico antes/despues
- dataset de episodios fallidos
- assertions por tarea

Sin eso, el sistema es dificil de depurar y casi imposible de endurecer.

### 3.5 Falta de entorno controlado

El agente opera sobre la maquina real del usuario. Eso mete:

- ventanas inesperadas
- notificaciones
- cambios de foco
- scaling DPI
- layouts variables
- side effects irreversibles

Los sistemas de referencia reducen esto con navegadores propios, contenedores o contextos aislados.

## 4. Que hacen mejor los sistemas de referencia

## 4.1 Playwright

Fuentes:

- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/trace-viewer
- https://playwright.dev/docs/aria-snapshots
- https://github.com/microsoft/playwright-mcp

Lecciones clave:

1. Auto-waiting y actionability.
   - Antes de clickear, Playwright valida unicidad, visibilidad, estabilidad, que reciba eventos y que este habilitado.
   - Pulse hoy no tiene equivalente.

2. Locators semanticos.
   - `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `getByTestId`.
   - Eso desacopla la accion de la coordenada exacta.

3. DOM vivo y re-resolucion.
   - El locator se resuelve cada vez antes de actuar, asi sobrevive a re-renders.

4. Observabilidad seria.
   - Trace Viewer muestra locator usado, tiempo, logs, red, errores y codigo fuente.

5. Accesibilidad como contrato.
   - Aria snapshots permiten validar estructura accesible, no solo pixeles.

6. MCP para agentes.
   - Microsoft describe Playwright MCP como fast/lightweight, con accessibility snapshots y aplicacion determinista.
   - Esa es exactamente la direccion correcta para tareas web.

## 4.2 Claude Computer Use

Fuentes:

- https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- https://claude.com/plugins/playwright

Lecciones clave:

1. Arquitectura explicita de agent loop.
   - Anthropic documenta claramente: tool_use -> tu app ejecuta -> tool_result -> siguiente iteracion.

2. Entorno sandboxed.
   - Recomienda VM/container, display virtual, apps preinstaladas y loop controlado.

3. Coordenadas y resolucion tratadas como problema de implementacion.
   - Documentan de forma explicita el error de downsampling y coordinate scaling.

4. Acciones mas finas.
   - `scroll`, `left_click_drag`, `left_mouse_down`, `left_mouse_up`, `hold_key`, `wait`, `zoom`.

5. Prompting operacional.
   - Recomiendan meter tips explicitos en system prompt cuando se repiten fallos.

6. Seguridad operacional.
   - Clasificadores de prompt injection y confirmacion humana antes de seguir si detectan riesgo.

7. Para browser de precision, incluso Anthropic empuja Playwright MCP.
   - Su plugin oficial de Playwright dice que opera con accessibility data en lugar de screenshots para interacciones deterministas y confiables.

## 4.3 OpenAI Operator / Atlas

Fuentes:

- https://openai.com/index/introducing-operator/
- https://openai.com/index/operator-system-card/
- https://openai.com/index/introducing-chatgpt-atlas/
- https://openai.com/index/building-chatgpt-atlas/

Lecciones clave:

1. Reconocen limites reales.
   - OpenAI dice que CUA funciona mejor en tareas cortas y repetibles y que no es muy confiable en OS general.

2. Handoffs y supervision.
   - `takeover mode`, confirmaciones, watch mode, handback al usuario cuando se atasca.

3. Browser propio e integrado.
   - Atlas no automatiza un navegador ajeno: integra Chromium como capa controlada.

4. Inyeccion de input por renderer, no por capa privilegiada.
   - Esto evita efectos colaterales del browser chrome que no corresponden al contenido web.

5. Contextos aislados.
   - Atlas usa `StoragePartition` para sesiones efimeras y separadas.

6. Manejo de popups fuera de bounds.
   - OpenAI documenta que recompone dropdowns/popups en una sola imagen para que el modelo vea el contexto completo.

Eso es importante: los equipos serios no solo "toman screenshot". Controlan la geometria, el pipeline de input y el aislamiento del browser.

## 4.4 Perplexity Comet

Fuentes:

- https://comet-help.perplexity.ai/en/articles/11583798-what-is-comet-s-browser-engine
- https://comet-help.perplexity.ai/en/articles/12658082-control-what-comet-assistant-can-use
- https://www.perplexity.ai/help-center/en/articles/13529668-comet-policies-and-controls
- https://www.perplexity.ai/help-center/en/articles/13531931-my-organization-has-restricted-comet

Lo que si es publico y util:

1. Comet es browser-native sobre Chromium.
2. El asistente puede navegar e interactuar con sitios.
3. Hay controles por dominio: `Read Only`, `No Access`, aprobacion por accion.
4. Mantienen browsing data local por defecto y solo envian contexto minimo cuando hace falta.
5. Heredan +500 browser policies de Chromium.

Inferencia razonable:

- Al ser un browser AI-native basado en Chromium y con controles por dominio/permiso, Comet juega en una categoria estructural muy distinta a un desktop clicker sobre apps arbitrarias. Perplexity no publica un paper tecnico detallado del motor de interaccion, asi que no conviene inventar mas alla de esto.

## 5. Comparativa directa contra Pulse

| Dimension | Pulse hoy | Playwright / MCP | Claude CU | Atlas / Comet |
|---|---|---|---|---|
| Unidad arquitectonica | Fragmentada | Unificada para browser | Agent loop definido | Browser-native |
| Precision web | Pixel + OCR | DOM + accessibility + locators | Vision; para browser empujan Playwright | Browser integrado |
| Esperas / actionability | Minimas | Muy fuertes | Deben implementarse | Integradas en producto |
| Verificacion | Hash parcial de screenshot | Assertions + DOM + traces | Tool loop + prompting + HITL | Handoffs, supervision, guardrails |
| Observabilidad | Baja | Trace viewer, logs, network | Loop explicito y herramientas | Arquitectura propia + controles |
| Aislamiento | Maquina real | Browser controlado | VM/container recomendado | Browser/profile/session isolation |
| Reintentos | `x +/- 5px`, reprompt | Deterministas por locator | Tool loop con mejores acciones | Producto integrado |

## 6. Lo que hay que hacer para que Pulse sea util de verdad

## 6.1 Principio rector

No intentar resolver todo con un solo agente vision-first.

La arquitectura correcta es:

1. Browser-native first para web
2. Accessibility/UIA second para apps nativas instrumentables
3. Vision fallback third para canvas, RDP, apps legacy y casos no estructurados

## 6.2 Nueva arquitectura objetivo

### Capa 1: Task Planner / Supervisor

Responsabilidad:

- convertir la intencion del usuario en plan
- escoger el backend correcto:
  - `browser_web`
  - `windows_uia`
  - `vision_desktop`
- definir criterios de exito verificables
- manejar HITL y aprobaciones

No debe hacer clicks directamente.

### Capa 2: Backends especializados

#### A. `browser_web` (nuevo, prioridad maxima)

Base recomendada:

- Playwright
- o Playwright MCP si quieren compatibilidad con agentes externos

Capacidades:

- locators por role/label/text/testid
- formularios
- tabs
- network introspection
- screenshots solo como debug, no como primitive principal
- assertions semanticas
- tracing

Objetivo:

- Gmail web
- Google Calendar web
- CRM web
- dashboards
- formularios
- booking
- tareas SaaS repetibles

#### B. `windows_uia` (rediseñar)

Base:

- Windows UI Automation real, no solo lista parcial de 40 elementos

Capacidades:

- tree completo del foreground window
- roles/patrones mas ricos
- focused element
- enabled/disabled
- invoke/select/expand/collapse/value
- bounds verificados

Objetivo:

- apps nativas de Windows
- dialogs
- file pickers
- instaladores
- Office desktop

#### C. `vision_desktop` (dejar como fallback)

Usar solo cuando:

- no haya DOM
- no haya UIA util
- haya canvas/video/remote session/game

Y aun asi debe tener:

- zoom real
- detector de elementos candidateados
- verificacion semantica por OCR/estado
- replay y snapshot before/after

## 6.3 Cambios tecnicos concretos en Pulse

### P0

1. Unificar la entrada.
   - Crear un `ComputerUseOrchestrator` unico.
   - Renderer y WhatsApp deben usar el mismo core.

2. Separar herramientas primitivas de agentes.
   - `computerUse` no debe ser el pseudo-core.
   - Debe quedar como `low-level primitives`.

3. Integrar un backend `browser_web` con Playwright.
   - Este es el mayor salto en usabilidad real.

4. Definir contrato de verificacion por paso.
   - Cada accion debe tener:
     - precondition
     - action
     - expected observation
     - timeout
     - fallback

5. Trazabilidad completa.
   - screenshot before/after
   - target seleccionado
   - razon de seleccion
   - resultado
   - tiempo
   - error

### P1

1. Rehacer `windows_uia`.
   - Mejor extractor
   - mas patrones
   - relation graph
   - mapa estable de elementos

2. Reusar `getSemanticSnapshot()` de monitoring.
   - No dejarlo muerto.

3. Sustituir hash de screenshot por verificaciones mejores.
   - OCR focal
   - accessibility diff
   - focused element diff
   - DOM/UIA assertions

4. Hacer dataset interno de fallos.
   - "task, app, step, screenshot before, action, screenshot after, outcome"

### P2

1. Policy engine por dominio/app.
   - `read_only`, `requires_approval`, `blocked`, `allow_background`.

2. Contextos aislados.
   - browser profiles efimeros
   - sandboxes de ejecucion
   - sesion separada por task

3. Evaluacion automatica.
   - benchmark interno por 20-50 tareas reales
   - tasa de exito por dominio/app/backend

## 7. Red flags especificas del codigo actual

1. `quickHash()` usa solo un sample del base64. Ver `electron/desktop-agent-service.ts:691`.
2. `retry` corrige coordenadas moviendo 5px. Ver `electron/desktop-agent-service.ts:925`.
3. `type` depende de clipboard paste. Ver `electron/desktop-agent-service.ts:1573`.
4. `computer-use-handlers.ts` sigue usando OCR para encontrar targets por texto. Ver `electron/computer-use-handlers.ts:694`.
5. `window.computerUse` y `window.desktopAgent` estan separados sin orquestador comun. Ver `electron/preload.ts:248` y `electron/preload.ts:404`.
6. No hay tests dedicados del computer use.
7. No hay Playwright ni backend browser-native instalado en dependencias. Ver `package.json:16`.

## 8. Recomendacion final

Si el objetivo es "que cualquier caso de uso se cumpla a cabalidad sin errores", no conviene seguir iterando el sistema actual solo con mejor prompt.

La ruta correcta es:

1. Mantener `desktop-agent-service.ts` como fallback experimental de vision.
2. Construir ya un backend `browser_web` con Playwright para todos los workflows web.
3. Rehacer el backend Windows sobre UI Automation real y verificable.
4. Crear un orquestador unico con trazas, assertions y aprobaciones.
5. Medir por benchmark interno, no por percepcion subjetiva.

Sin eso, cualquier mejora sera incremental pero el sistema seguira siendo poco confiable.

## 9. Siguiente paso recomendado

Siguiente entregable tecnico sugerido:

- disenar e implementar un RFC llamado `computer-use-v3`
- incluir:
  - arquitectura por capas
  - contratos de backend
  - esquema de trace
  - politica de aprobaciones
  - benchmark de aceptacion
  - fase 1 con Playwright para browser tasks

