# Requisitos no funcionales

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: tsconfig.json -->
<!-- evidence: scripts/quality/run-gate.mjs -->

<!-- define: RNF-001 -->
<!-- define: RNF-002 -->
<!-- define: RNF-003 -->
<!-- define: RNF-004 -->
<!-- define: RNF-005 -->
<!-- define: RNF-006 -->
<!-- define: RNF-007 -->
<!-- define: RNF-008 -->
<!-- define: RNF-009 -->
<!-- define: RNF-010 -->
<!-- define: RNF-011 -->
<!-- define: RNF-012 -->
<!-- define: RNF-013 -->
<!-- define: RNF-014 -->
<!-- define: RNF-015 -->
<!-- define: RNF-016 -->
<!-- define: RNF-017 -->
<!-- define: RNF-018 -->
<!-- define: RNF-019 -->
<!-- define: RNF-020 -->

| ID | Categoria | Requisito medible | Evidencia / compuerta |
|---|---|---|---|
| RNF-001 | Seguridad IPC | Todo canal renderer-main debe estar en `ALLOWED_IPC_CHANNELS`; una cadena no permitida debe lanzar error antes de usar `ipcRenderer`. | `electron/preload/channels.ts`, `electron/preload/safe-ipc.ts` |
| RNF-002 | Seguridad de payload | IPC debe rechazar funciones, profundidad >20, arrays >1000 y objetos >200 claves, y eliminar `__proto__`, `prototype` y `constructor`. | `electron/preload/safe-ipc.ts`, pruebas preload |
| RNF-003 | Aislamiento Electron | `contextIsolation` y CSP deben permanecer activos; renderer no obtiene Node ni Electron directo. | `electron/preload/security.ts`, `electron/main/window-controller.ts` |
| RNF-004 | Autorizacion | Ocultar UI no autoriza: main/DB deben validar actor, organizacion, rol, capability y HITL. | `electron/communication-hub/authorization.ts`, SQL RLS |
| RNF-005 | Privacidad | Logs/auditoria no deben incluir tokens, argumentos/resultados sensibles o contenido completo innecesario. | `electron/mcp-manager/execution.ts`, `electron/mcp-manager/types.ts` |
| RNF-006 | Tipado | Renderer y main deben aprobar TypeScript estricto con `npm run typecheck`. | `tsconfig.json`, `tsconfig.node.json`, `package.json` |
| RNF-007 | Confiabilidad bootstrap | El fallo de un servicio opcional se captura, contextualiza y no cancela inicializaciones independientes. | `electron/main/bootstrap-steps.ts`, `electron/main/startup.ts` |
| RNF-008 | Resiliencia remota | Lecturas Supabase usan timeout 25 s, hasta 2 reintentos idempotentes y backoff base 250 ms solo para statuses reintentables. | `src/shared/supabase-http.ts` |
| RNF-009 | Acotamiento | Loops de agente, busquedas, payloads, archivos, historial y procesos deben tener limites/timeout explicitos. | `docs/architecture/runtime-parameters.md` |
| RNF-010 | Concurrencia | Recursos fisicos compartidos deben serializarse; Desktop Agent visual admite una tarea activa y una cola con timeout. | `electron/desktop-agent/agent-config.ts`, `electron/desktop-agent/service-tasks.ts` |
| RNF-011 | Recuperacion | Config local invalida debe usar defaults seguros; operaciones reversibles deben conservar rollback o undo cuando exista. | `electron/desktop-agent/agent-config.ts`, `electron/computer-use/batch-file-ops/undo-last-file-operation.ts` |
| RNF-012 | Portabilidad | El producto debe compilar/empaquetar para Windows, macOS y Linux con recursos Python y context packs declarados. | `electron-builder.json5`, `.github/workflows/release.yml` |
| RNF-013 | Compatibilidad nativa | `better-sqlite3` debe reconstruirse para Node al probar y para Electron al empaquetar. | `scripts/quality/test-native.mjs`, `package.json` |
| RNF-014 | Mantenibilidad | Nuevas capacidades Electron deben respetar servicio -> handler -> preload -> wrapper; no agregar facades raiz sin motivo de migracion. | `docs/standards/electron-ipc.md`, `docs/architecture/module-map.md` |
| RNF-015 | Verificabilidad | Un PR debe aprobar adaptadores, arnes, docs, OpenSpec, tipos, lint incremental y pruebas; release agrega build/empaquetado. | `scripts/quality/run-gate.mjs` |
| RNF-016 | Observabilidad | Servicios deben exponer status/diagnosticos y errores contextualizados; auditorias deben incluir `traceId` cuando el flujo lo provee. | handlers `*:get-status`, `electron/dynamic-tool/types.ts` |
| RNF-017 | Localizacion | UI, prompts, logs, comentarios y documentacion mantenida por el equipo deben estar en espanol. | `AGENTS.md`, componentes y prompts |
| RNF-018 | Accesibilidad | Controles nuevos deben ser teclado-operables, tener nombre accesible, foco visible y no depender solo del color; la verificacion manual sigue siendo obligatoria. | `docs/ux/accessibility.md`, `src/components/ui/` |
| RNF-019 | Integridad de datos | Migraciones deben ser idempotentes cuando sea posible, declarar constraints/indices/RLS y separar instancia destino. | `docs/standards/database.md`, `database/` |
| RNF-020 | Fuente de verdad | Requisitos, decisiones y contratos deben actualizarse con el codigo; material reemplazado se mueve a `docs/archive/`. | `docs/standards/documentation.md`, `scripts/quality/validate-system-docs.mjs` |

## Objetivos sin garantia contractual

El repositorio no define SLO de disponibilidad, latencia p95, RPO/RTO cuantitativo,
WCAG objetivo formal ni presupuesto mensual de IA. No se inventan. Los limites
implementados se documentan, y formalizar esos objetivos requiere una decision de
producto/operaciones independiente.
