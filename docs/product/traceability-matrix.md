# Matriz de trazabilidad

Estado: vigente. Actualizado: 2026-08-06.

Esta matriz conecta definiciones de producto con implementacion y evidencia. Una
ruta de pruebas indica cobertura existente del dominio, no garantiza que cada ID
tenga un test unitario exclusivo. La ausencia se declara como brecha.

<!-- evidence: electron/__tests__ -->
<!-- evidence: src/__tests__ -->
<!-- evidence: scripts/quality/run-gate.mjs -->

| Dominio | Reglas | Requisitos | Historias | Decisiones/limites | Implementacion | Evidencia de prueba |
|---|---|---|---|---|---|---|
| Identidad y organizacion | BR-002, BR-003, BR-004 | RF-001, RF-002 | HU-001 | DEC-002 | `src/contexts/auth/`, `src/services/lia-session-exchange.ts`, `database/lia/supabase/functions/` | `src/__tests__/contexts/AuthContext.test.tsx`, `src/__tests__/services/lia-session-exchange-core.test.ts`, `src/__tests__/components/ChatUnavailableState.test.tsx` |
| Chat, carpetas y share | BR-005 | RF-003, RF-004, RF-005 | HU-002, HU-003, HU-004 | LIM-015 | `src/services/chat/`, `folder/`, `share/` | `src/__tests__/chat-*`, `folder-*`, `share-*` |
| IA renderer y computer use | BR-009 | RF-007, RF-008 | HU-005 | DEC-001, LIM-002, LIM-003, LIM-004 | `src/services/gemini-chat/`, `electron/computer-use/` | `src/__tests__/gemini-*`, `electron/__tests__/computer-use-*` |
| IRIS y proyectos | BR-003 | RF-006 | HU-006 | DEC-002 | `src/services/iris-data/`, `electron/iris/` | `src/__tests__/iris-*`, `electron/__tests__/iris-*` |
| Productividad | BR-013, BR-014 | RF-009, RF-010 | HU-007 | LIM-005 | `electron/monitoring/`, `electron/summary-generator.ts` | `electron/__tests__/monitoring-*`, `summary-*` |
| Workspace Google/Microsoft | BR-019 | RF-011, RF-012, RF-013, RF-014 | HU-008, HU-009 | LIM-015 | `electron/calendar/`, `gmail/`, `drive/`, `gchat/` | `electron/__tests__/calendar-*`, `gmail-*`, `drive-*`, `gchat-*` |
| WhatsApp y canales | BR-006, BR-007, BR-008, BR-024, BR-025 | RF-015, RF-016, RF-017, RF-018 | HU-010, HU-011, HU-012 | LIM-011, LIM-012, LIM-016 | `electron/whatsapp/`, `wa-agent/`, `telegram/`, `communication-hub/` | `electron/__tests__/whatsapp-*`, `wa-agent-*`, `communication-hub-*` |
| Reuniones | BR-012 | RF-019, RF-020, RF-021, RF-022 | HU-013, HU-014 | LIM-013, LIM-014 | `electron/meetings/`, `meeting-live/` | `electron/__tests__/meeting-*` |
| Memoria | BR-015 | RF-023, RF-024 | HU-015 | DEC-003, LIM-006 | `electron/memory/`, `knowledge/`, `semantic-indexer/` | `electron/__tests__/memory-*`, `knowledge-*`, `semantic-*` |
| Skills y presentaciones | BR-009 | RF-038, RF-039 | HU-025 | LIM-002 | `src/shared/skills/`, `src/services/skills/`, `electron/skill-workspace/`, `electron/organization-branding/`, `src/components/presentation/` | `electron/__tests__/skill-workspace-paths.test.ts`, `skill-workspace-service.test.ts`, `presentation-protocol.test.ts`, `organization-branding.test.ts`, `wa-skills-catalog.test.ts`, `whatsapp-workflow-presentacion.test.ts`, `src/__tests__/services/skills-turn-catalog.test.ts`, `src/__tests__/components/PresentationWorkspacePanel.test.tsx`, `SkillLibrary.test.tsx` |
| Desktop y procesos | BR-017, BR-018 | RF-025, RF-026, RF-027 | HU-016, HU-017, HU-018 | DEC-008, DEC-009, DEC-010, LIM-007, LIM-008, LIM-009, LIM-010 | `electron/desktop-agent/`, `background-host/`, `remote-node/` | `electron/__tests__/desktop-agent-*`, `background-host-*`, `remote-node-*` |
| Navegador integrado | BR-009, BR-017, BR-018 | RF-037 | HU-024 | DEC-001, DEC-008, DEC-013, DEC-014, LIM-007, LIM-017, LIM-018, LIM-019 | `electron/integrated-browser/`, `src/components/browser/` | `electron/__tests__/integrated-browser-*`, `src/__tests__/components/IntegratedBrowserPanel.test.tsx`, `BrowserReadingModePanel.test.tsx`, `BrowserWorkspaceLayout.test.tsx` |
| Borrado de datos de navegacion | BR-009 | RF-041 | HU-027 | LIM-021 | `electron/integrated-browser/browsing-data.ts`, `src/components/browser/BrowserPrivacyPanel.tsx` | `electron/__tests__/integrated-browser-browsing-data.test.ts`, `electron/__tests__/browser-history-clear-range.test.ts`, `src/__tests__/components/BrowserPrivacyPanel.test.tsx` |
| Contexto de aplicaciones de escritorio | BR-009 | RF-040 | HU-026 | LIM-020 | `electron/desktop-context/`, `electron/desktop-context-handlers.ts`, `src/services/desktop-context-service.ts`, `src/adapters/desktop_ui/chat-ui/app-attachments.ts` | `electron/__tests__/desktop-context-inventory.test.ts`, `electron/__tests__/desktop-context-cascade.test.ts`, `electron/__tests__/desktop-context-handlers.test.ts`, `src/__tests__/services/app-attachments.test.ts`, `src/__tests__/components/AppAttachmentPicker.test.tsx` |
| Tools dinamicas | BR-010, BR-011, BR-027 | RF-028 | HU-019 | DEC-004 | `electron/mcp-manager/`, `dynamic-tool/` | `electron/__tests__/mcp-manager.test.ts`, `dynamic-tool-*` |
| Voz, privacidad y orbe | BR-016 | RF-029, RF-030, RF-034 | HU-020, HU-021 | DEC-005 | `electron/python-runtime-service.ts`, `electron/elevenlabs-tts.ts`, `electron/orb-tts.ts`, `python/`, `src/components/orb/` | `electron/__tests__/python-*`, `voice-*`, `orb-*` |
| Automatizacion y actualizacion | BR-020, BR-021 | RF-031, RF-032, RF-032b, RF-032c, RF-033 | HU-022, HU-023 | LIM-016 | `electron/updater/`, `workspace-automation/`, `passive-skills/`, `proactive/` | `electron/__tests__/updater-*`, `workspace-automation-*`, `passive-skills.test.ts`, `orb-announcements.test.ts` |
| Plataforma Electron | BR-001, BR-026 | RF-035, RF-036 | HU-001 | DEC-001, DEC-004, DEC-011, LIM-001 | `electron/main/`, `preload/`, `src/app/` | `electron/__tests__/preload/`, `main-*`, `src/__tests__/App*` |
| Arnes y entrega | BR-022, BR-023 | RF-036 | HU-023 | DEC-006, DEC-007, DEC-012 | `ai-specs/`, `.agents/`, `openspec/`, `scripts/quality/` | `npm run harness:validate`, `npm run docs:system:check` |

## Requisitos transversales

| IDs | Aplicacion | Verificacion |
|---|---|---|
| RNF-001, RNF-002, RNF-003, RNF-004, RNF-005 | Preload, ventanas, autorizacion main, RLS y auditoria minimizada | pruebas preload/security/policy + revision adversarial |
| RNF-006, RNF-014, RNF-015, RNF-020 | Tipado, modulos, compuertas y documentacion | `typecheck`, `lint:changed`, validadores, OpenSpec |
| RNF-007, RNF-008, RNF-009, RNF-010, RNF-011, RNF-016 | Fallos parciales, retry/timeout, limites, concurrencia, recovery y status | tests de servicios y casos negativos |
| RNF-012, RNF-013, RNF-017 | Plataformas, ABI nativa y espanol | build por plataforma, script nativo y revision |
| RNF-018 | Teclado, semantica, contraste y movimiento | pruebas renderer existentes + QA manual; auditoria formal aun no automatizada |
| RNF-019 | Constraints, indices, RLS e instancia correcta | revision SQL, migracion dirigida y auditoria DB |

## Brechas conocidas de trazabilidad

- No existe E2E empaquetado que recorra las 25 historias en los tres sistemas
  operativos; CI combina unit/integration y smoke de Linux release.
- Accesibilidad no tiene auditoria automatizada axe ni objetivo WCAG versionado.
- Snapshots Supabase no prueban politicas activas de produccion; se requiere
  auditoria remota autorizada.
- Proveedores externos necesitan credenciales y entornos reales para una prueba
  de contrato completa; los tests locales usan dobles donde corresponde.
