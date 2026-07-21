# Decisiones, limites y parametros de producto

Estado: vigente. Actualizado: 2026-07-21.

`Confirmada` significa que el codigo/comentario o una especificacion explica el
motivo. `Inferida` describe la consecuencia tecnica observable, no una memoria
historica. `No documentada` evita inventar el porqué.

<!-- evidence: electron/desktop-agent/agent-config.ts -->
<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: src/config.ts -->

<!-- define: DEC-001 -->
<!-- define: DEC-002 -->
<!-- define: DEC-003 -->
<!-- define: DEC-004 -->
<!-- define: DEC-005 -->
<!-- define: DEC-006 -->
<!-- define: DEC-007 -->
<!-- define: DEC-008 -->
<!-- define: DEC-009 -->
<!-- define: DEC-010 -->
<!-- define: DEC-011 -->
<!-- define: DEC-012 -->
<!-- define: LIM-001 -->
<!-- define: LIM-002 -->
<!-- define: LIM-003 -->
<!-- define: LIM-004 -->
<!-- define: LIM-005 -->
<!-- define: LIM-006 -->
<!-- define: LIM-007 -->
<!-- define: LIM-008 -->
<!-- define: LIM-009 -->
<!-- define: LIM-010 -->
<!-- define: LIM-011 -->
<!-- define: LIM-012 -->
<!-- define: LIM-013 -->
<!-- define: LIM-014 -->
<!-- define: LIM-015 -->
<!-- define: LIM-016 -->

## Decisiones arquitectonicas vigentes

| ID | Decision | Motivo y estado | Evidencia |
|---|---|---|---|
| DEC-001 | Aplicacion desktop Electron con renderer React. | **Inferida:** necesita filesystem, captura, procesos, voz, tray y control de UI que un navegador aislado no ofrece. No existe ADR historico. | `electron/main.ts`, `src/main.tsx` |
| DEC-002 | Separar SOFIA, Lia e IRIS en tres clientes Supabase. | **Confirmada por comentarios/config:** identidad/organizacion, operacion Hub y proyectos/issues tienen autoridades distintas. | `src/config.ts`, `database/README.md` |
| DEC-003 | Usar SQLite local para memoria, pensamientos e indice semantico. | **Inferida:** baja latencia/offline y datos ligados al host; no hay ADR de retencion/sync. | `electron/memory/schema.ts`, `electron/thought-logger/database.ts`, `electron/semantic-indexer/database.ts` |
| DEC-004 | IPC por allowlist y payload sanitizado. | **Confirmada:** preload lanza `Security Violation` para canal/payload no permitido y ventanas usan sandbox/context isolation. | `electron/preload/safe-ipc.ts`, `electron/main/window-controller.ts` |
| DEC-005 | Separar sidecar de voz y sidecar de documentos/privacidad. | **Confirmada por builder:** un fallo leyendo documentos no debe tumbar escucha pasiva. | `electron-builder.json5` |
| DEC-006 | `ai-specs/` es canonico y Codex/Claude/Antigravity reciben adaptadores. | **Confirmada:** evita drift y coincide con las herramientas reales del equipo. | `ai-specs/README.md`, `scripts/ai/sync-agent-adapters.mjs` |
| DEC-007 | Antigravity reemplaza adaptadores Cursor/Gemini CLI; Gemini sigue como proveedor runtime. | **Confirmada en este cambio:** la superficie de desarrollo y el proveedor de producto son conceptos distintos. | `openspec/changes/adapt-harness-and-document-system/design.md`, `src/config.ts` |
| DEC-008 | Desktop Agent visual tiene concurrencia 1. | **Confirmada por comentario:** hay un mouse/teclado y estado de paso compartidos; concurrencia corromperia ejecuciones. | `electron/desktop-agent/agent-config.ts` |
| DEC-009 | Computer Use nativo inicia en `legacy` y se habilita por config. | **Confirmada por comentario:** mantener rollback hasta validarlo en la maquina. | `electron/desktop-agent/agent-config.ts` |
| DEC-010 | Captura default `active-monitor`, con layout binding y sin fallback de escala legacy. | **Inferida:** reduce superficie/costo y evita coordenadas ambiguas; el motivo completo no esta registrado. | `electron/desktop-agent/agent-config.ts` |
| DEC-011 | Inicializacion de subsistemas con pasos opcionales aislados. | **Inferida:** maximiza arranque parcial cuando una integracion falla. | `electron/main/bootstrap-steps.ts`, `electron/main/startup.ts` |
| DEC-012 | Lint de PR es incremental mientras existe deuda historica. | **Confirmada en el plan del arnes:** bloquear deuda nueva sin fingir que la base esta limpia. | `scripts/quality/lint-changed.mjs`, `docs/reports/harness-baseline-2026-07-21.md` |

## Limites funcionales y de seguridad

| ID | Parametro actual | Valor | Motivo documentado | Fuente |
|---|---|---:|---|---|
| LIM-001 | Profundidad/array/claves de payload IPC | 20 / 1000 / 200 | **Inferida:** limitar abuso de memoria/prototipos; cifra exacta no documentada. | `electron/preload/safe-ipc.ts` |
| LIM-002 | Lectura maxima de archivo / resultados / profundidad de busqueda | 1 MiB / 200 / 8 | **Inferida:** evitar cargar main y contexto con arboles/archivos ilimitados. | `electron/computer-use/filesystem-handlers/constants.ts` |
| LIM-003 | Comando foreground y longitud de comando | 30 s / 4000 caracteres | **Inferida:** impedir bloqueo y payload arbitrariamente grande. | `electron/computer-use/command-tool.ts`, `electron/security/command-policy.ts` |
| LIM-004 | Email | 20 destinatarios, asunto 300, cuerpo 200000, 10 adjuntos | **Inferida:** acotar abuso/payload; cifras no justificadas en ADR. | `electron/computer-use/email-security.ts` |
| LIM-005 | Monitoreo default | 30 s entre capturas; idle a 120 s; screenshot on; OCR/semantic off | **No documentada:** son defaults de implementacion configurables. | `electron/monitoring/service-state.ts` |
| LIM-006 | Contexto de memoria | 30 mensajes; budgets 3000/2500/1800/1500; resumen desde 15 | **Inferida:** balancear recencia y costo de contexto; cifras sin ADR. | `electron/memory/constants.ts` |
| LIM-007 | Desktop Agent | max 60 pasos por config, total 500, default budget 40, cola 60 s | **Confirmada parcialmente:** pasos/cola acotan control autonomo; valores exactos no tienen ADR. | `electron/desktop-agent/agent-config.ts` |
| LIM-008 | Recuperacion Desktop Agent | 3 fallos consecutivos, stuck 4, 2 reintentos/accion | **Inferida:** detectar loops temprano sin abortar un fallo aislado. | `electron/desktop-agent/agent-config.ts` |
| LIM-009 | Historial Desktop Agent | resumen cada 15 pasos; 8 pasos raw; reporte cada 25 | **Inferida:** contener contexto conservando detalle reciente. | `electron/desktop-agent/agent-config.ts` |
| LIM-010 | Elementos visuales | max 60; NMS IoU .45; score .10; omitir visual con UIA >=40 | **Confirmada por comentarios:** filtrar ruido/costo de OmniParser y conservar controles prominentes. | `electron/desktop-agent/agent-config.ts` |
| LIM-011 | Agente WhatsApp | 25 iteraciones; historial 20; warning repeticion 3; abort critico 5 | **Inferida:** evitar loops/costo sin cortar polling legitimo excluido. | `electron/wa-agent/agent-loop.ts`, `electron/wa-agent/constants.ts` |
| LIM-012 | Media inline WhatsApp | 15 MiB | **Inferida:** contener payload multimodal; razon exacta no documentada. | `electron/wa-agent/media-preparation.ts` |
| LIM-013 | Captura de meeting live | default 75 s, minimo 15 s, chunk base64 max 1,000,000 | **Inferida:** balance costo visual y progreso; cifras sin ADR. | `electron/meeting-live/meeting-live-service.ts` |
| LIM-014 | Fuente para IA de reuniones | 16000 caracteres; low confidence <0.65 | **Inferida:** contener contexto y pedir revision en incertidumbre; umbral exacto sin ADR. | `electron/meetings/meeting-ai/constants.ts` |
| LIM-015 | Supabase renderer | timeout 25 s; 2 reintentos read; base 250 ms | **Confirmada en comentarios:** solo lecturas idempotentes reintentan. | `src/shared/supabase-http.ts` |
| LIM-016 | Auditoria Communication Hub / updater | 500 eventos / check cada 4 h | **Inferida:** acotar disco y evitar polling excesivo; cifras exactas sin ADR. | `electron/communication-hub/state.ts`, `electron/updater/constants.ts` |

## Parametros configurables

Desktop Agent, monitoreo, proactive, voz, canales y settings guardan overrides en
`userData` o Supabase. Los valores de esta pagina son defaults de codigo, no una
promesa de que todos los hosts los mantengan. La lista tecnica ampliada esta en
[parametros runtime](../architecture/runtime-parameters.md).
