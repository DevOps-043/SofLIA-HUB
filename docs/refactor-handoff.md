# Refactor Handoff — SofLIA Hub

**Última actualización:** 2026-05-08
**Auditor inicial:** Claude Opus 4.7
**Continuación:** este documento permite que cualquier modelo/desarrollador retome el trabajo donde quedó.

### Actualizacion Codex 2026-05-08

Continuacion enfocada en limpiar completamente la banda de archivos de **100 a 199 lineas**, tomando `docs/prompt_maestro.md` como fuente de verdad y manteniendo el patron validado de modulos pequenos, barrels/fachadas estables y validacion inmediata:

- Banda **100-199** recalculada sobre `.ts/.tsx` dentro de `electron/` y `src/`: queda en **0 archivos**.
- Los ultimos 8 archivos del rango eran pruebas/fixtures; se separaron mocks, setup, fixtures y casos edge en archivos cohesivos bajo 100 lineas.
- En la continuacion previa de esta misma sesion tambien se modularizaron servicios, componentes y tool declarations de main/renderer que estaban en 100-199, preservando exports publicos y cableado existente.
- Los refactors nuevos siguen el criterio de `prompt_maestro`: responsabilidades pequenas, contratos explicitos, sin cambios funcionales intencionales y sin silenciar errores.
- Durante la corrida completa se detecto un desajuste visible de UI en `AuthForm` (`Contrasena`/`Iniciar Sesion`); se corrigio a espanol natural (`Contraseña`/`Iniciar Sesión`) y la suite completa quedo verde.

Estado recalculado actual sobre `.ts/.tsx` dentro de `electron/` y `src/`:

| Rango | Archivos |
|---|---:|
| Menos de 100 | 1585 |
| 100-199 | 0 |
| 200-299 | 10 |
| 300-399 | 0 |
| 400-499 | 17 |
| 500-599 | 0 |
| 600-699 | 0 |
| 700-799 | 15 |
| 800-899 | 0 |
| 900-999 | 0 |
| 1000+ | 0 |

Validacion:
- `npm.cmd exec -- tsc --noEmit --pretty false --incremental false`: **sin errores**.
- `npm.cmd exec -- vitest run ... --maxWorkers=1` sobre los 12 archivos/suites tocados de esta continuacion: **12/12 archivos**, **71/71 tests** pasando.
- `npm.cmd test -- --run`: **44/44 archivos**, **596/596 tests** pasando.

Pendiente inmediato: continuar con la banda **700-799** (15 archivos) y luego **400-499** (17 archivos). El archivo mas grande actual es `src/components/ops/WorkflowHubPanel.tsx` con **799 lineas**. Recalcular antes de tocar porque el worktree sigue teniendo cambios paralelos amplios.

### Actualizacion Codex 2026-05-08

Continuacion enfocada en limpiar la banda de archivos de **300 a 399 lineas**, usando `docs/prompt_maestro.md` como fuente de verdad y preservando contratos publicos con fachadas/barrels delgados:

- Banda **300-399** recalculada sobre `electron/` y `src/`: queda en **0 archivos**.
- Se modularizaron servicios y fachadas de main/renderer: `folder-service`, `computer-use-service`, `batch-file-ops`, `google-executors`, `system-executors`, `drive-service`, `semantic-indexer`, `path-memory-service`, `daily-digest-generator`, `presentation-pdf`, `presentation-workflow`, `meeting-types` y `meeting-context-pack`.
- Se dividieron suites que volvieron a entrar al rango por cambios paralelos: `workflow-hub-service.test.ts`, `whatsapp-agent.test.ts` y `memory-service.test.ts`.
- Se extrajeron controladores de estado de `src/contexts/AuthContext.tsx` y `src/hooks/useChatManager.ts` a modulos cohesivos bajo `src/contexts/auth/` y `src/hooks/chat-manager/`.
- Ajustes de cableado detectados por TypeScript: barrel `UpdateNotification`, props de paneles de updater, firma de mock `nativeImage`, alias `ApiProvider` y tipos auxiliares de pruebas.

Estado recalculado actual sobre `.ts/.tsx` dentro de `electron/` y `src/`:

| Rango | Archivos |
|---|---:|
| Menos de 100 | 1425 |
| 100-199 | 43 |
| 200-299 | 10 |
| 300-399 | 0 |
| 400-499 | 17 |
| 500-599 | 0 |
| 600-699 | 0 |
| 700-799 | 15 |
| 800-899 | 0 |
| 900-999 | 0 |
| 1000+ | 0 |

Validacion:
- `.\\node_modules\\.bin\\tsc.cmd --noEmit --pretty false --incremental false`: **sin errores**.
- `.\\node_modules\\.bin\\vitest.cmd run electron/__tests__/workflow-hub-service.test.ts electron/__tests__/whatsapp-agent.test.ts electron/__tests__/memory-service.test.ts --reporter=dot`: **3/3 archivos**, **49/49 tests** pasando.

Pendiente inmediato: continuar con la banda **700-799** y luego **400-499**. Recalcular antes de tocar porque el worktree sigue teniendo cambios paralelos amplios.

### Actualizacion Codex 2026-05-08

Continuacion enfocada en limpiar la banda de archivos de **200 a 299 lineas**, usando `docs/prompt_maestro.md` como fuente de verdad y preservando APIs publicas mediante barrels/fachadas delgadas:

- Banda **200-299** recalculada sobre `electron/` y `src/`: queda en **0 archivos**.
- Se modularizaron fachadas y componentes del tramo: `workflow-hub/types.ts`, `desktop-agent-types.ts`, `meeting-ai/prompts.ts`, `gmail/helpers.ts`, `iris/resolvers.ts`, `agent-task-queue.ts`, `focus-mode-service.ts`, `whatsapp-terminal.ts`, `updater-service.ts`, `workflow-chat-commands.ts`, `iris-executors.ts`, `system-services.ts`, `neural-organizer.ts`, `MarkdownRenderer.tsx`, `mcp-manager.ts`, `business-anomaly-monitor.ts`, `iris/auth.ts`, `passive-workflows.ts`, `summary-generator.ts`, `meeting-detection-store.ts`, `app-meeting-trigger-service.ts`, `daily-briefing-service.ts`, `clipboard-ai-assistant.ts`, `UpdateNotification.tsx`, `UpdatePanel.tsx`, `ToolEditorModal.tsx`, `SummaryCard.tsx`, `CalendarPanel.tsx` y `MonitoringControls.tsx`.
- Todos los modulos nuevos revisados de esta continuacion quedaron **<100 lineas**.
- La distribucion actual de archivos `.ts/.tsx` en `electron/` y `src/` queda: `<100`: **1271**, `100-199`: **69**, `200-299`: **0**, `300-399`: **0**, `400-499`: **13**, `500-799`: **0**, `800-899`: **9**, `900-999`: **5**, `1000+`: **0**.

Validacion:
- `.\\node_modules\\.bin\\tsc.cmd --noEmit --pretty false --incremental false`: **sin errores**.
- `npm.cmd test -- --run`: **39/39 archivos**, **596/596 tests** pasando.
- Primer intento con `npx.cmd --no-update-notifier tsc --noEmit --pretty false --incremental false` fallo por resolucion transitoria de `electron/services/pc-alarm-service.ts`; el archivo existe y la validacion con el binario local de TypeScript paso limpia.

Pendiente inmediato: continuar con los archivos de **800-999 lineas** que siguen concentrando riesgo; antes de cada corte, recalcular la distribucion porque hay muchos cambios paralelos en el worktree.

### Actualizacion Codex 2026-05-08

Continuacion enfocada en limpiar la banda de archivos de **800 a 899 lineas** siguiendo `docs/prompt_maestro.md` como fuente de verdad y el patron de movimiento puro sin cambios funcionales intencionales:

- Banda **800-899** recalculada sobre `electron/` y `src/`: queda en **0 archivos**.
- `electron/whatsapp-agent.ts`: baja a **792 lineas**. Extraidos pre-filtro de seguridad, historial, contexto de memoria, declaraciones de tools, audio, confirmaciones y verificacion bulk labels a `electron/wa-agent/`.
- `src/components/ops/WorkflowHubPanel.tsx`: baja a **799 lineas**. Extraidos grids, secciones de workflows, reglas pasivas, picker de variantes y estados informativos a `src/components/ops/workflow-hub-panel/`.
- `electron/meetings/meeting-ai-service.ts`: baja a **798 lineas**. Extraidos builders de razones, recomendaciones y borradores de mensajes a `electron/meetings/meeting-ai/`.
- `electron/__tests__/computer-use-handlers.test.ts`: baja a **761 lineas**. Extraido setup de mocks a `electron/__tests__/computer-use-handlers.mocks.ts` preservando el orden de hoisting de Vitest.
- `electron/workflow-hub-service.ts`: baja a **794 lineas**. Extraidos mappers de reglas pasivas y persistencia de estado a `electron/workflow-hub/`.
- `electron/desktop-agent-service.ts`: baja a **799 lineas**. Extraidas APIs publicas de screenshot, observacion y runtime vision-step a `electron/desktop-agent/`.
- `src/components/Sidebar.tsx`: baja a **773 lineas**. Extraidos menu contextual de chats e icono Chevron a `src/components/sidebar/`.
- `electron/main.ts`: baja a **797 lineas**. Extraidos pasos de bootstrap, ambiente y resumen WhatsApp a `electron/main/`.
- `electron/browser-web-service.ts`: baja a **790 lineas**. Extraida gestion de perfiles, artefactos y trazas a `electron/browser-web/artifacts.ts`.
- `electron/memory-service.ts`: baja a **792 lineas**. Extraidos tokens cifrados y escritura markdown de memoria a `electron/memory/`.
- Todos los modulos nuevos de esta continuacion quedaron **<100 lineas**.

Validacion:
- `npx.cmd --no-update-notifier tsc --noEmit --pretty false --incremental false`: **sin errores**. El comando conserva warnings de npm por flags reenviadas por `npx`, pero TypeScript sale en verde.
- `npx.cmd --no-update-notifier vitest run electron/__tests__/computer-use-handlers.test.ts electron/__tests__/desktop-agent-service.test.ts electron/__tests__/workflow-hub-service.test.ts electron/__tests__/whatsapp-agent.test.ts electron/__tests__/memory-service.test.ts --maxWorkers=1`: **5/5 archivos**, **177/177 tests** pasando.
- `git diff --check`: **sin errores de whitespace**; solo warnings esperados de normalizacion LF->CRLF del worktree.

Estado recalculado actual sobre `.ts/.tsx` dentro de `electron/` y `src/`:

| Rango | Archivos |
|---|---:|
| Menos de 100 | 1356 |
| 100-199 | 51 |
| 200-299 | 10 |
| 300-399 | 3 |
| 400-499 | 17 |
| 500-599 | 0 |
| 600-699 | 0 |
| 700-799 | 15 |
| 800-899 | 0 |
| 900-999 | 0 |
| 1000+ | 0 |

Pendiente inmediato: continuar con la banda **700-799**, donde quedan 15 archivos; los mas altos son `electron/desktop-agent-service.ts`, `src/components/ops/WorkflowHubPanel.tsx`, `electron/app-chat-service.ts`, `electron/meetings/meeting-ai-service.ts`, `electron/main.ts`, `electron/computer-use-handlers.ts`, `electron/workflow-hub-service.ts`, `electron/whatsapp-agent.ts`, `electron/memory-service.ts` y `electron/browser-web-service.ts`.

### Actualizacion Codex 2026-05-08

Continuacion enfocada en limpiar la banda de archivos de **600 a 699 lineas** siguiendo `docs/prompt_maestro.md` y el patron de refactor validado:

- Banda **600-699** recalculada sobre `electron/` y `src/`: queda en **0 archivos**.
- `electron/meetings/meeting-store.ts`: baja a **55 lineas**. Extraidas operaciones y mappers a `electron/meetings/meeting-store/`; todos los modulos nuevos quedan <=100 lineas.
- `electron/gchat-service.ts`: baja a **86 lineas**. Extraidas operaciones de espacios, mensajes, resolucion y utilidades a `electron/gchat/`; contratos en `electron/gchat/types.ts`.
- `electron/workspace-automation-service.ts`: baja a **64 lineas**. Extraidas operaciones a `electron/workspace-automation/service/`; los metodos grandes se dividieron por builders/ejecutores de acciones, todos <=100 lineas.
- `electron/preload.ts`: baja a **35 lineas**. Separadas allowlists IPC, CSP, runtime config, safe IPC y bridges por dominio en `electron/preload/`; ningun modulo nuevo supera 57 lineas.
- `src/components/FlowMode.tsx`: baja de la banda 600-699 a **550 lineas**. Extraida vista a `src/components/flow-mode/` con componentes presentacionales <=65 lineas.
- `electron/__tests__/desktop-agent-service.test.ts`: baja fuera de la banda; extraidos tests de config a `electron/__tests__/desktop-agent-config.test.ts`.
- `electron/__tests__/whatsapp-agent.test.ts`: baja fuera de la banda; extraidos escenarios de setters y retry a `electron/__tests__/whatsapp-agent/`.
- `src/components/meetings/MeetingOpsPanel.tsx`: aparecio en la banda durante el recalculo por cambios paralelos y tambien se bajo a **582 lineas** extrayendo header/alerts y formulario de creacion.
- Ajuste de barrel autorreferente en `electron/whatsapp-prompts.ts`: ahora reexporta desde `./whatsapp-prompts/index`.

QA de esta continuacion:

- `vitest run electron/__tests__/desktop-agent-service.test.ts electron/__tests__/desktop-agent-config.test.ts electron/__tests__/whatsapp-agent.test.ts --reporter=dot`: **3/3 archivos**, **79/79 tests** pasando.
- `tsc --noEmit --pretty false --incremental false`: no reporta errores en los archivos tocados al filtrar por rutas de esta continuacion. La corrida global queda bloqueada por declaraciones globales previas/externas en `window.calendar` y `window.whatsApp` (`src/components/connections-panel/window-connections.ts`, `src/components/monitoring/CalendarPanel.tsx`, `src/components/whatsapp-setup/types.ts`, `src/components/WhatsAppSetup.tsx`).

### Actualizacion Codex 2026-05-08

Continuacion enfocada en el rango 400-499 lineas, siguiendo `docs/prompt_maestro.md` y el patron de refactor de movimiento puro:

- `electron/computer-use/app-resolver.ts`: baja de 564 a **4 lineas**. Separados tipos, aliases, scoring, variantes de busqueda, roots, fuentes `where`/registry/filesystem, resolver, foco de ventana y launcher en `electron/computer-use/app-resolver/`.
- `electron/document-designer.ts`: baja de 541 a **2 lineas**. Separados parser inline, parser de tablas, builders de bloques, parser de contenido, portada, shell DOCX y API publica en `electron/document-designer/`.
- `electron/remote-node-service.ts`: baja de 562 a **1 linea**. Separados estado persistido, registry de nodos, cliente HTTP remoto, host HTTP, rutas y servicio en `electron/remote-node/`.
- `src/components/SettingsModal.tsx`: baja de 527 a **76 lineas**. Separados hooks de formulario/proactividad/autoguardado y subcomponentes visuales en `src/components/settings-modal/`.
- `src/components/ConnectionsPanel.tsx`: baja de 470 a **46 lineas**. Separados hooks por integracion y secciones WhatsApp/Telegram/Google en `src/components/connections-panel/`.
- `src/services/live-api.ts`: baja de 537 a **3 lineas**. Separados runtime Live, socket handlers, lifecycle, playback de audio, captura de microfono y setup message en `src/services/live-api/`.
- `electron/proactive-service.ts`: baja de 524 a **77 lineas**. Separados config, collectors, chequeo de sistema, composicion IA/fallback, tick runner y trigger manual en `electron/proactive/`.
- `electron/telegram-service.ts`: baja de 538 a **8 lineas**. Separados tipos, estado, status, API, chats recientes, mensajes, comandos, polling y servicio en `electron/telegram/`.
- `electron/background-process-service.ts`: baja de 476 a **12 lineas**. Separados runtime, persistencia de sesiones, vista/refresh, launch de aplicaciones, terminal visible, comando background y administracion de sesiones en `electron/background-process/`.

Todos los modulos nuevos de esta continuacion quedaron **<100 lineas**.

Validacion:
- `tsc` global esta bloqueado por cambios previos/no relacionados en el worktree: `electron/dynamic-tool/toolset-installer.ts(46,1)` espera `}`; otra corrida via `npx` tambien se detuvo en `electron/whatsapp-agent.ts` con error sintactico al EOF.
- Validacion acotada de los archivos tocados encontro inicialmente declaraciones faltantes para `window.whatsApp`/`window.calendar`; se corrigio con `src/components/connections-panel/window-connections.ts`.
- La validacion acotada posterior ya no reporta errores en los modulos tocados; queda bloqueada por deuda previa en `electron/iris/operations-read.ts`, `electron/iris/operations-write.ts` y `src/config.ts` al compilar fuera del tsconfig completo.

Estado recalculado sobre `.ts/.tsx` dentro de `electron/` y `src/` con la metrica local actual:

| Rango | Archivos |
|---|---:|
| Menos de 100 | 1148 |
| 100-199 | 73 |
| 200-299 | 18 |
| 300-399 | 1 |
| 400-499 | 20 |
| 500-599 | 0 |
| 600-699 | 0 |
| 700-799 | 15 |
| 800-999 | 0 |
| 1000+ | 0 |

Pendiente inmediato: continuar con `src/App.tsx`, `electron/monitoring-service.ts`, `src/components/ProjectHub.tsx`, `src/hooks/useChatManager.ts`, `src/components/FlowMode.tsx`, `src/components/WhatsAppSetup.tsx`, `src/contexts/AuthContext.tsx`, `electron/whatsapp-remote-hub.ts`, `electron/iris/operations-write.ts`, `electron/knowledge-service.ts`, `electron/meetings/meeting-passive-detection-service.ts`, `electron/whatsapp-workflow-meetings.ts` y los tests que siguen en 400-499.

### Actualizacion Codex 2026-05-07

Continuacion aplicada siguiendo `docs/prompt_maestro.md` como fuente de verdad:

- `electron/desktop-agent-service.ts`: baja de 2,513 a **847 lineas**. Extraidos captura/layout/overlays/zoom, mapeo de coordenadas, action executor, backends browser/UIA, observacion, recuperacion, cola de tareas, ciclo de vida de tareas, estado legacy y helpers de loop a `electron/desktop-agent/` (**59 modulos**, todos <=100 lineas).
- `electron/main.ts`: baja de 1,083 a **843 lineas**. Extraidos foco nativo de modo voz a `electron/flow-window/native-window-target.ts` y handlers de captura a `electron/main/screen-capture-handlers.ts`.
- `electron/memory-service.ts`: baja de 1,141 a **837 lineas**. Extraidos constantes, schema SQLite, math helpers, loader de DB y formatter de contexto a `electron/memory/`.
- `electron/whatsapp-agent.ts`: baja de 1,078 a **894 lineas**. Extraidos preparacion de media y transcripcion de audio a `electron/wa-agent/`.
- `src/adapters/desktop_ui/ChatUI.tsx`: baja de 1,072 a **913 lineas**. Extraidos banner read-only, empty state, modal de zoom e indicador de tool-call a `src/adapters/desktop_ui/chat-ui/`.
- `src/components/ops/WorkflowHubPanel.tsx`: baja de 1,025 a **927 lineas**. Extraidos tipos, formatters y componentes base a `src/components/ops/workflow-hub-panel/`.
- QA de esta continuacion: `npx.cmd --no-update-notifier tsc --noEmit --pretty false --incremental false` limpio y `npx.cmd --no-update-notifier vitest run` con **35/35 suites** y **598/598 tests** pasando. Suite afectada verificada aislada: `electron/__tests__/desktop-agent-service.test.ts` (**55/55**).

Linea base actual recalculada sobre `.ts/.tsx` dentro de `electron/` y `src/`: **415 archivos fuente**, **79,570 lineas**, **48.9% <=100 lineas**, **10.1% >500 lineas**, **0 archivos >1000 lineas**.

---

## 1. Estado inicial vs. actual

> Nota: la medicion actual se recalculo sobre archivos `.ts/.tsx` de `electron/` y `src/`. Incluye tests porque tambien son superficie mantenible.

| Metrica | Inicial | **Actual** | Delta |
|---|---|---|---|
| Total archivos fuente | 205 | **415** | +210 (modulos nuevos + tests existentes medidos) |
| Total lineas de codigo | 66,469 | **79,570** | +13,101 (medicion ampliada + modulos nuevos) |
| Bien modularizados (<=100 lineas) | 30.2% | **48.9%** | **+18.7 pts** |
| Monoliticos (>500 lineas) | 20.0% | **10.1%** | **-9.9 pts** |
| **Criticos (>1000 lineas)** | **13** | **0** | **-13 archivos** |
| Tests pasando | 585/586 | **598/598** | suite completa verde |
| Test suites | 33/35 | **35/35** | suite completa verde |
| **Deuda tecnica estimada** | **43.7%** | **~18%** | **-25.7 pts** |

---

## 2. Evaluación de deuda usando `docs/prompt_maestro.md`

Aplicando los 10 ejes de calidad del prompt_maestro como evaluación inicial:

| Dimensión | Inicial | Actual | Notas |
|---|---|---|---|
| Correctitud funcional | 85% | 85% | tests verdes durante todo el refactor |
| Seguridad | 55% | 55% | sin cambios — bugs encontrados pendientes (ver §6) |
| Legibilidad | 70% | ~82% | menos archivos criticos, responsabilidades mas visibles |
| Mantenibilidad | 45% | **~70%** | bajada de acoplamiento, archivos focalizados |
| **Modularidad** | **30%** | **~67%** | 0 archivos criticos >1000 y casi mitad de archivos <=100 lineas |
| Escalabilidad | 50% | 50% | sin cambios estructurales |
| Performance | 60% | 60% | sin cambios |
| Testabilidad | 45% | 56% | helpers ahora aislados, testeables; suite completa verde |
| Observabilidad | 25% | 25% | infra creada (logger/correlation/result) pero sin migrar |
| Documentación | 55% | 70% | docs/refactor-pattern.md + este handoff |

---

## 3. Trabajo completado (9 fases)

### Fase 0 — Bug fixing
- **Sincronización chat multi-máquina**: arreglado el `recoverPendingMessagesFromCache` que causaba que escrituras en una máquina no aparecieran en otra. Ver commit/diff de `src/services/chat-service.ts`.
- **UI badges "Compartido"** reemplazados por iconos en `Sidebar.tsx`.

### Fase 1 — Foundation (infraestructura base)
Creados en `electron/utils/`:
- **`logger.ts`** — pino structured logger con redaction de secretos y correlation ID inyectado automáticamente.
- **`correlation.ts`** — `AsyncLocalStorage` para correlation IDs end-to-end.
- **`result.ts`** — `Result<T, E>` + 7 clases de error tipado (`AppError`, `ValidationError`, `NotFoundError`, etc.) + `fromPromise()` + `toAppError()`.

**No migrados aún** — esperando que se migre el código existente a usarlas.

### Fases 1-10 - Refactores estructurales

Archivos que salieron del umbral critico o fueron reducidos de forma significativa:

| Archivo | Antes | Actual | Estado | Estrategia |
|---|---:|---:|---|---|
| `src/services/chat-service.ts` | 938 | 21 | modularizado | 11 modulos en `src/services/chat/` |
| `electron/iris-data-main.ts` | 1,410 | 45 | fuera de critico | 16 modulos en `electron/iris/` |
| `electron/gmail-service.ts` | 1,133 | 19 | fuera de critico | 7 modulos en `electron/gmail/` |
| `electron/whatsapp-tools.ts` | 1,543 | 15 | fuera de critico | 12 modulos en `electron/wa-tools/` |
| `electron/whatsapp-tool-executor.ts` | 1,482 | 257 | fuera de critico | handlers en `electron/wa-executor/handlers/` |
| `electron/workflow-hub-service.ts` | 1,279 | 865 | fuera de critico | types, definitions, normalizers y preset-resolvers |
| `electron/meetings/meeting-ai-service.ts` | 1,224 | 877 | fuera de critico | helpers puros + prompts en `electron/meetings/meeting-ai/` |
| `electron/slide-designer.ts` | 1,013 | eliminado | eliminado | dead code no importado |
| `electron/computer-use-handlers.ts` | 1,352 | 915 | fuera de critico | filesystem-handlers + app-resolver en `electron/computer-use/` |
| `electron/workspace-automation-service.ts` | 1,309 | 690 | fuera de critico | handlers por template y helpers puros |
| `electron/browser-web-service.ts` | 1,142 | 838 | fuera de critico | parser, prompts, normalizers, verifiers y action executor |
| `electron/main.ts` | 1,083 | 843 | fuera de critico | foco nativo y handlers de captura extraidos |
| `electron/memory-service.ts` | 1,141 | 837 | fuera de critico | constants/schema/math/database/context formatter |
| `electron/whatsapp-agent.ts` | 1,509 | 894 | fuera de critico | comandos, workflows, media y audio en `electron/wa-agent/` |
| `src/adapters/desktop_ui/ChatUI.tsx` | 1,043 | 913 | fuera de critico | tipos, constantes, helper de imagenes y subcomponentes |
| `src/components/ops/WorkflowHubPanel.tsx` | 1,025 | 927 | fuera de critico | tipos, formatters y componentes base |
| `electron/desktop-agent-service.ts` | 2,527 | 847 | fuera de critico | 59 modulos en `electron/desktop-agent/`; falta bajar de 500 |

---

## 4. Patrón de refactor validado

Documentado en `docs/refactor-pattern.md`. **Reglas no negociables:**

1. **No cambiar la API pública** durante el refactor — el archivo histórico se convierte en barrel re-export.
2. **Tests verdes en cada commit** — si algo se rompe, abortar.
3. **Una responsabilidad por módulo nuevo** — si dudas, dividir.
4. **Sin lógica nueva durante el refactor** — solo mover código.
5. **Ningún módulo nuevo > 300 líneas** — si pasa, falta otra subdivisión.

### Estructura objetivo por servicio:

```
servicio/
├── types.ts          # contratos puros (interfaces, types, constantes)
├── constants.ts      # valores estáticos
├── normalizers.ts    # funciones puras de transformación
├── helpers.ts        # otros helpers puros
├── cache.ts          # acceso a storage local
├── remote.ts         # único punto que conoce Supabase / API externa
├── operations.ts     # API pública: orquesta capas
└── index.ts          # barrel: re-exporta SOLO lo público
```

### Flujo paso a paso (replicable):

```bash
# 1. Mapear exports actuales
grep -nE '^export (function|const|interface|type|async function)' archivo.ts

# 2. Mapear imports externos
grep -rn "from.*archivo-service" src/ electron/

# 3. Clasificar funciones en capas (ver tabla abajo)
# 4. Crear módulos en orden: types → helpers → operations
# 5. Reemplazar archivo original por barrel
# 6. Validar
npx tsc --noEmit --incremental false # sin errores
npx vitest run --maxWorkers=1        # mismo pass rate
```

### Tabla de clasificación de funciones:

| Función hace... | Va a |
|---|---|
| Solo transforma datos sin IO | `normalize.ts` o `helpers.ts` |
| Lee/escribe `localStorage` | `cache.ts` |
| Habla con Supabase/API | `remote.ts` |
| Mezcla local + remoto | `builders.ts` |
| Encola cambios pendientes | `pending-state.ts` |
| Ejecuta el sync | `sync.ts` |
| Es endpoint público | `operations.ts` |

---

## 5. Archivos criticos restantes (0)

### Prioridad recomendada

| Prioridad | Archivo | Lineas | Estado | Siguiente extraccion segura |
|---|---:|---:|---|---|
| 1 | `src/services/gemini-tools.ts` | 948 | mayor no critico | dividir tools por dominio y contratos de tool schema |
| 2 | `src/components/ops/AutomationOpsPanel.tsx` | 938 | mayor no critico | separar estado, filtros y subcomponentes |
| 3 | `src/adapters/desktop_ui/ChatUI.tsx` | 913 | mayor no critico | seguir separando estado de render y subcomponentes |
| 4 | `electron/whatsapp-agent.ts` | 894 | mayor no critico | separar runtime del loop agentico, despacho de comandos y builders de respuesta |
| 5 | `electron/desktop-agent-service.ts` | 847 | mayor no critico | separar API publica de controles; objetivo siguiente <500 |

Archivos cercanos al umbral que conviene vigilar antes de iniciar la fase "todo <100 lineas": `src/services/gemini-tools.ts` (948), `src/components/ops/AutomationOpsPanel.tsx` (938), `src/adapters/desktop_ui/ChatUI.tsx` (913), `electron/whatsapp-agent.ts` (894), `src/components/ops/WorkflowHubPanel.tsx` (889), `electron/meetings/meeting-ai-service.ts` (877), `electron/__tests__/computer-use-handlers.test.ts` (874), `electron/workflow-hub-service.ts` (865), `electron/desktop-agent-service.ts` (847), `src/components/Sidebar.tsx` (844), `electron/main.ts` (843) y `electron/browser-web-service.ts` (838).

### Estado de modulos recien extraidos

- `electron/desktop-agent/`: 59 modulos. Todos quedan <=100 lineas; cubren types, routing, prompts, recovery, status snapshot, captura/layout/overlays/zoom, snapping de coordenadas, controles mouse/teclado/ventana, forwarding, observacion, cola de tareas y runtime de planning/historial/fases.
- `electron/browser-web/`: `action-parser.ts`, `action-executor.ts`, `expectations.ts`, `normalizers.ts`, `prompts.ts`, `verifiers.ts`, `types.ts`.
- `electron/memory/`: `constants.ts`, `database.ts`, `math.ts`, `schema.ts`, `context-formatter.ts`.
- `electron/main/` y `electron/flow-window/`: handlers de captura y foco nativo del modo voz.
- `src/adapters/desktop_ui/chat-ui/` y `src/components/ops/workflow-hub-panel/`: subcomponentes, tipos y formatters.
- Todos los modulos nuevos de esta continuacion quedaron por debajo de 100 lineas.

### Riesgo y estrategia

- No tocar todavia el loop principal de Desktop Agent sin tests dedicados de Perception/Planning/Action.
- Mantener los refactores como movimientos puros: builders, normalizers, DTO builders, action executors y helpers sin cambiar contratos publicos.
- Ya no hay archivos criticos >1000. Priorizar ahora los mayores no criticos y bajar `desktop-agent-service.ts` bajo 500 en un corte dedicado.

---

## 6. Hallazgos pendientes (deuda técnica documentada)

Encontrados durante el análisis inicial. NO arreglados todavía:

### Severidad CRÍTICA
- **C-1** `electron/main.ts` (843 lineas) — ya salio del umbral critico, pero sigue concentrando bootstrap y wiring. Necesita ServiceRegistry + EventBridge + BootstrapOrchestrator.
- **C-2** `gemini-chat.ts` agentic loop sin timeout ni circuit breaker. Si Gemini API responde lento, chat se congela 50+ segundos.

### Severidad ALTA
- **A-1 (Seguridad)** `electron/monitoring-service.ts` línea ~229 — guardrail de prompt injection basado en regex eludible (solo español, lista negra).
- **A-2** `electron/main.ts` — variables globales sin sincronizacion (`win`, `currentGeminiApiKey`, `waAgent`).
- **A-3** `electron/memory-service.ts` — `embeddingCache: Map` sin límite. Crece sin bound durante meses → leak de RAM.
- **A-4 (Seguridad)** `src/services/gemini-chat.ts` ~517 — emails de Gmail tool no se validan, posible header injection.

### Severidad MEDIA
- **M-2** Patrón duplicado `if (!service) return JSON.stringify({error})` repetido 20+ veces en `gemini-chat.ts`.
- **M-3** `any` en puntos críticos del sistema (main.ts events, gemini-chat config).
- **M-4** **Sin logging estructurado ni correlation IDs en producción** — la infra está creada (`electron/utils/logger.ts`) pero nadie la usa todavía.
- **M-5** `electron/memory-service.ts` `loadChunksFromDB` sin paginación (LIMIT 5000 hardcoded).

---

## 7. Trabajo recomendado para continuacion

### Inmediato (1-2 sesiones)
1. Continuar `desktop-agent-service.ts` hasta <500 lineas separando runtime del loop principal, API publica de controles y estado de tareas; mantener tests dedicados del Desktop Agent.
2. Agregar tests especificos para los modulos nuevos de `desktop-agent/`, especialmente controles mouse/teclado/ventana y runtime de planning.
3. Vigilar archivos 900-1000 lineas para evitar regresiones por crecimiento (`whatsapp-agent.ts`, `computer-use-handlers.test.ts`, `AutomationOpsPanel.tsx`, `ChatUI.tsx`, `memory-service.ts`, `main.ts`, `meeting-ai-service.ts`, `gemini-tools.ts`, `desktop-agent-service.ts`, `browser-web-service.ts`, `workflow-hub-service.ts`, `WorkflowHubPanel.tsx`).

### Corto plazo (2-3 sesiones)
4. Refactorizar `memory-service.ts` con paginacion de chunks, cache LRU y builders de facts.
5. Continuar adelgazando `electron/main.ts` con ServiceRegistry/EventBridge aunque ya salio del umbral critico.
6. Migrar logs de servicios refactorizados a `electron/utils/logger.ts` con correlation IDs.

### Medio plazo (4-6 sesiones)
7. Separar Desktop Agent en Perception/Planning/Action despues de tener tests de integracion.
8. Arreglar bug de seguridad en `monitoring-service.ts` (guardrail regex eludible).
9. Reemplazar `try/catch + return false` por `Result<T, AppError>` en operaciones criticas.

---

## 8. Estructura de paquetes refactorizados

Todos siguen el patron `dominio/{types,constants,operations,index}.ts` cuando aplica:

```text
electron/
  chat/                       (11 modulos) - chat persistence
  iris/                       (16 modulos) - IRIS data layer
  gmail/                      (7 modulos)  - Gmail service
  wa-tools/                   (12 modulos) - WhatsApp tool declarations
  wa-executor/                (3 modulos)  - security, confirmations, types
    handlers/                 (7 modulos)  - tool dispatch handlers
  wa-agent/                   (10 modulos) - WhatsApp agent helpers, media y audio
  meetings/meeting-ai/        (5 modulos)  - meeting AI extraction
  workflow-hub/               (4 modulos)  - workflow hub orchestration
  workspace-automation/       (12 modulos) - types, templates, schemas, helpers, handlers
  browser-web/                (8 modulos)  - types, constants, prompts, parser, normalizers, expectations, verifiers, action-executor
  desktop-agent/              (59 modulos) - captura, coordenadas, backends, controles, observacion, recovery, planning y loop helpers
  memory/                     (5 modulos)  - constants, schema, database, math, context formatter
  main/                       (1 modulo)   - screen capture IPC handlers
  flow-window/                (1 modulo)   - native focus target for voice mode
  computer-use/               (3 modulos)  - fs, app-resolver, batch-ops
src/adapters/desktop_ui/chat-ui/
  tool-display-names.ts       - nombres de tools
  types.ts                    - contratos de ChatUI
  image-files.ts              - lectura de imagenes
  ReadOnlyBanner.tsx          - estado read-only
  EmptyChatState.tsx          - estado vacio
  ImageZoomModal.tsx          - modal de zoom
  ChatLoadingIndicator.tsx    - indicador de tool-call
src/components/ops/workflow-hub-panel/
  types.ts                    - contratos del panel
  formatters.ts               - formateadores y cron helpers
  components.tsx              - componentes base
utils/
  logger.ts                   - pino structured
  correlation.ts              - AsyncLocalStorage
  result.ts                   - Result<T,E> + AppError
```

---

## 9. Comandos clave para retomar el trabajo

```bash
# Verificar baseline
npx tsc --noEmit --incremental false
npx vitest run --maxWorkers=1

# Stats actuales
# (En PowerShell desde la raíz del proyecto)
$allFiles = Get-ChildItem -Path electron, src -Recurse -Include "*.ts","*.tsx" | Where-Object { $_.FullName -notmatch '__tests__' }
$allFiles | ForEach-Object {
  $l = (Get-Content $_.FullName | Measure-Object -Line).Lines
  [PSCustomObject]@{ File = $_.FullName.Replace((Get-Location).Path + '\', ''); Lines = $l }
} | Where-Object { $_.Lines -gt 1000 } | Sort-Object Lines -Descending | Format-Table -AutoSize
```

### Workflow recomendado por refactor:

```bash
# 1. Crear módulo nuevo
# (escribir archivo en dominio/<modulo>.ts)

# 2. Si es PowerShell line-replacement (recomendado para evitar problemas con caracteres unicode):
# powershell -Command "$lines = [System.IO.File]::ReadAllLines('archivo.ts', [System.Text.Encoding]::UTF8); ..."

# 3. Validar incrementalmente
npx tsc --noEmit --incremental false # debe estar limpio
npx vitest run --maxWorkers=1        # debe seguir 598 passing

# 4. Si pasa, commit:
git add -A
git commit -m "refactor(<dominio>): extract <X> to <modulo>.ts"
```

---

## 10. Reglas críticas (NO violar)

- **Nunca cambiar la API pública** (mantener barrel re-export).
- **Nunca eliminar líneas sin verificar que no se usan en otros archivos** (`grep -rn` primero).
- **Nunca tocar archivos críticos sin tests** sin advertir explícitamente al usuario.
- **Nunca commitear con tests rojos** que estaban verdes antes; la suite completa esta verde.
- **Siempre validar** TS + tests después de cada extracción significativa.
- **Siempre preservar** la firma de funciones exportadas (cambiar `Record<string, unknown>` a `Record<string, any>` si causa errores TS en consumidores).

---

## 11. Cómo medir progreso continuo

Cada sesión debe reportar:
1. ¿Qué archivos críticos se eliminaron de la lista? (target: −1 a −2 por sesión)
2. ¿Cuántos tests pasaron/fallaron antes y después? (target: idéntico)
3. ¿Cuántas líneas se movieron a módulos cohesivos? (target: −300 a −800 por sesión)
4. ¿Algún hallazgo nuevo de deuda técnica descubierto?

**Baseline a mantener**: 598/598 tests passing, TS sin errores nuevos, 0 imports rotos.

---

**Si llegas aqui leyendo y vas a continuar**: la lista critica actual tiene 0 archivos >1000. Para progreso rapido, baja primero `src/services/gemini-tools.ts`, `src/components/ops/AutomationOpsPanel.tsx` o `src/adapters/desktop_ui/ChatUI.tsx`; para impacto profundo, sigue con `electron/desktop-agent-service.ts` hasta <500 manteniendo `electron/__tests__/desktop-agent-service.test.ts` verde.
