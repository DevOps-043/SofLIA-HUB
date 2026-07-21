# Reglas de negocio

Estado: vigente. Actualizado: 2026-07-21.

Las reglas siguientes describen controles implementados. `Main` significa que la
regla se aplica en el proceso Electron; `DB` significa constraint/RLS/migracion;
`UI` solo guia la experiencia y nunca se considera autorizacion suficiente.

<!-- evidence: electron/main.ts -->
<!-- evidence: electron/whatsapp/security.ts -->
<!-- evidence: electron/mcp-manager/execution.ts -->
<!-- evidence: database/lia/migrations/sdo-tables.sql -->

<!-- define: BR-001 -->
<!-- define: BR-002 -->
<!-- define: BR-003 -->
<!-- define: BR-004 -->
<!-- define: BR-005 -->
<!-- define: BR-006 -->
<!-- define: BR-007 -->
<!-- define: BR-008 -->
<!-- define: BR-009 -->
<!-- define: BR-010 -->
<!-- define: BR-011 -->
<!-- define: BR-012 -->
<!-- define: BR-013 -->
<!-- define: BR-014 -->
<!-- define: BR-015 -->
<!-- define: BR-016 -->
<!-- define: BR-017 -->
<!-- define: BR-018 -->
<!-- define: BR-019 -->
<!-- define: BR-020 -->
<!-- define: BR-021 -->
<!-- define: BR-022 -->
<!-- define: BR-023 -->
<!-- define: BR-024 -->
<!-- define: BR-025 -->
<!-- define: BR-026 -->
<!-- define: BR-027 -->
<!-- define: BR-028 -->

| ID | Regla obligatoria | Aplicacion | Evidencia principal |
|---|---|---|---|
| BR-001 | Solo una instancia de SofLIA Hub puede poseer el runtime; una segunda instancia sale sin inicializar servicios. | Main | `electron/main.ts` |
| BR-002 | La identidad principal proviene de SOFIA; Lia se resuelve como perfil operativo y no sustituye la autenticacion principal. | Renderer + DB | `src/contexts/auth/`, `src/lib/sofia-client.ts` |
| BR-003 | Organizaciones y equipos visibles deben pertenecer a la organizacion activa; los IDs de equipo delimitan consultas IRIS. | Renderer + DB | `src/app/AppContent.tsx`, `src/services/iris-data/` |
| BR-004 | Si Lia no puede resolverse, la aplicacion puede entrar en estado degradado y debe informar que las capacidades dependientes no estan disponibles. | UI + renderer | `src/contexts/auth/lia-status-message.ts`, `src/app/AppNotices.tsx` |
| BR-005 | Una conversacion solo ofrece compartir cuando `can_share` es verdadero y existe organizacion activa; el backend de share debe volver a validar acceso. | UI + renderer service | `src/app/AppWorkspace.tsx`, `src/services/share/access.ts` |
| BR-006 | Una allowlist WhatsApp no vacia restringe DMs a numeros normalizados autorizados; la comparacion tolera prefijos solo con al menos diez digitos. | Main | `electron/whatsapp/security.ts`, `electron/whatsapp/phone-utils.ts` |
| BR-007 | Los grupos WhatsApp siguen politica `disabled`, `allowlist` u `open` y activacion `mention` o `always`; una lista de grupos configurada tambien filtra el JID. | Main | `electron/whatsapp/personalization.ts`, `electron/whatsapp/message-events.ts` |
| BR-008 | Herramientas peligrosas de filesystem, shell, portapapeles y sistema permanecen fuera de las declaraciones disponibles en grupos. | Main | `electron/whatsapp-tools.ts`, `electron/wa-agent/tool-declarations.ts` |
| BR-009 | Una operacion critica o destructiva requiere una confirmacion humana contextual antes de ejecutarse; el texto del modelo no acredita aprobacion. | Main | `electron/wa-agent/tool-confirmation.ts`, `electron/whatsapp-remote-hub/command-approval.ts` |
| BR-010 | Una herramienta dinamica ejecutable se rechaza si no declara schemas cerrados, owner, riesgo, agentes, HITL, grupos, timeout y auditoria. | Main | `electron/mcp-manager/tool-contract.ts`, `electron/mcp-manager/tool-loader.ts` |
| BR-011 | La aprobacion de una herramienta dinamica se liga a la huella de su contrato; un hot reload invalida la aprobacion anterior. | Main | `electron/mcp-manager/execution.ts`, `electron/dynamic-tool/types.ts` |
| BR-012 | Los assets y acciones de reuniones no se consideran aprobados ni se sincronizan hasta una decision humana persistida. | Main + DB | `electron/meetings/meeting-review-service.ts`, `database/lia/migrations/meeting-ops-tables.sql` |
| BR-013 | Los eventos `sdo_audit_events` son append-only: update y delete deben fallar. | DB | `database/lia/migrations/sdo-tables.sql` |
| BR-014 | Monitoreo clasifica una captura como idle cuando el tiempo inactivo alcanza el umbral configurado; por defecto son 120 segundos. | Main | `electron/monitoring/service-state.ts`, `electron/monitoring/capture-snapshot.ts` |
| BR-015 | Si una captura solo se tomo para analisis semantico y el usuario no habilito guardar screenshots, el archivo transitorio se elimina. | Main | `electron/monitoring/capture-snapshot.ts`, `electron/monitoring/capture-loop.ts` |
| BR-016 | Memoria y skills aprendidas se segmentan por `owner_key`/sesion; un grupo, telefono o usuario no debe heredar memoria de otro owner. | Main + SQLite | `electron/memory/schema.ts`, `electron/wa-agent/whatsapp-owner.ts` |
| BR-017 | Credenciales y preferencias locales viven en variables de entorno o `userData`; no se versionan ni se documentan sus valores. | Build + Main | `.gitignore`, `electron/main/environment.ts` |
| BR-018 | El backend visual de escritorio ejecuta una sola tarea activa porque comparte mouse, teclado, historial y layout; las demas esperan en cola. | Main | `electron/desktop-agent/agent-config.ts`, `electron/desktop-agent/service-tasks.ts` |
| BR-019 | Toda tarea de Desktop Agent tiene presupuesto de pasos, tope total, abort y timeout de cola; agotar presupuesto devuelve resultado acotado. | Main | `electron/desktop-agent/task-budget.ts`, `electron/desktop-agent/task-execution-runtime.ts` |
| BR-020 | Gmail, Drive y Google Chat reutilizan la autenticacion administrada por CalendarService en vez de mantener tokens independientes. | Main | `electron/main/service-factory.ts`, `electron/calendar/` |
| BR-021 | El pipeline de release no crea un release si ya existe el tag de la version declarada en `package.json`. | CI | `.github/workflows/release.yml` |
| BR-022 | El actualizador consulta en segundo plano cada cuatro horas y solo instala cuando el usuario/flujo invoca la operacion. | Main + UI | `electron/updater/constants.ts`, `electron/updater/` |
| BR-023 | Cada SQL ejecutable pertenece a `database/<instancia>/migrations`; los snapshots son informativos y no se ejecutan como migracion. | Repositorio | `database/README.md`, `docs/standards/database.md` |
| BR-024 | Las skills del arnes de desarrollo nunca se descubren como herramientas runtime. | Arnes + Main | `ai-specs/agents/registry.yaml`, `ai-specs/policies/runtime-exposure.md` |
| BR-025 | Enviar o programar mensajes exige principal resuelto, scope y capability de canal; la UI no puede autoasignar permisos. | Main | `electron/communication-hub/authorization.ts`, `electron/communication-hub/types.ts` |
| BR-026 | El estado local del Communication Hub conserva como maximo 500 eventos de auditoria para acotar crecimiento del JSON. | Main | `electron/communication-hub/state.ts` |
| BR-027 | El bootstrap aisla servicios opcionales: un fallo se registra y no debe impedir que los subsistemas independientes sigan inicializando. | Main | `electron/main/bootstrap-steps.ts`, `electron/main/startup.ts` |
| BR-028 | Errores y auditorias de herramientas no deben serializar argumentos, resultados, tokens, identidad personal ni rutas absolutas. | Main | `electron/mcp-manager/execution.ts`, `electron/mcp-manager/types.ts` |

## Precedencia

Cuando UI, prompt y servicio difieren, prevalecen en este orden: constraint/RLS de
datos, autorizacion/validacion main, allowlist preload, wrapper renderer y por
ultimo presentacion UI. Un prompt nunca eleva privilegios.
