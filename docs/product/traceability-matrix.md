# Matriz de trazabilidad

Estado: vigente. Actualizado: 2026-08-04.

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
| Productividad | BR-014, BR-015 | RF-009, RF-010 | HU-007 | LIM-005 | `electron/monitoring/`, `electron/summary-generator.ts` | `electron/__tests__/monitoring-*`, `summary-*` |
| Workspace Google/Microsoft | BR-020 | RF-011, RF-012, RF-013, RF-014 | HU-008, HU-009 | LIM-015 | `electron/calendar/`, `gmail/`, `drive/`, `gchat/` | `electron/__tests__/calendar-*`, `gmail-*`, `drive-*`, `gchat-*` |
| WhatsApp y canales | BR-006, BR-007, BR-008, BR-025, BR-026 | RF-015, RF-016, RF-017, RF-018 | HU-010, HU-011, HU-012 | LIM-011, LIM-012, LIM-016 | `electron/whatsapp/`, `wa-agent/`, `telegram/`, `communication-hub/` | `electron/__tests__/whatsapp-*`, `wa-agent-*`, `communication-hub-*` |
| Reuniones | BR-012 | RF-019, RF-020, RF-021, RF-022 | HU-013, HU-014 | LIM-013, LIM-014 | `electron/meetings/`, `meeting-live/` | `electron/__tests__/meeting-*` |
| SDO | BR-013 | RF-023, RF-024 | HU-015 | DEC-002 | `electron/sdo/`, `database/lia/migrations/sdo-*` | `electron/__tests__/sdo-*` |
| Memoria | BR-016 | RF-025, RF-026 | HU-016 | DEC-003, LIM-006 | `electron/memory/`, `knowledge/`, `semantic-indexer/` | `electron/__tests__/memory-*`, `knowledge-*`, `semantic-*` |
| Desktop y procesos | BR-018, BR-019 | RF-027, RF-028, RF-029 | HU-017, HU-018, HU-019 | DEC-008, DEC-009, DEC-010, LIM-007, LIM-008, LIM-009, LIM-010 | `electron/desktop-agent/`, `background-host/`, `remote-node/` | `electron/__tests__/desktop-agent-*`, `background-host-*`, `remote-node-*` |
| Navegador integrado | BR-009, BR-018, BR-019 | RF-039 | HU-025 | DEC-001, DEC-008, DEC-013, LIM-007, LIM-017 | `electron/integrated-browser/`, `src/components/browser/` | `electron/__tests__/integrated-browser-*`, `src/__tests__/components/IntegratedBrowserPanel.test.tsx` |
| Tools dinamicas | BR-010, BR-011, BR-028 | RF-030 | HU-020 | DEC-004 | `electron/mcp-manager/`, `dynamic-tool/` | `electron/__tests__/mcp-manager.test.ts`, `dynamic-tool-*` |
| Voz, privacidad y orbe | BR-017 | RF-031, RF-032, RF-036 | HU-021, HU-022 | DEC-005 | `electron/python-runtime-service.ts`, `python/`, `src/components/orb/` | `electron/__tests__/python-*`, `voice-*`, `orb-*` |
| Automatizacion y actualizacion | BR-021, BR-022 | RF-033, RF-034, RF-035 | HU-023, HU-024 | LIM-016 | `electron/updater/`, `workspace-automation/`, `workflow-hub/`, `proactive/` | `electron/__tests__/updater-*`, `workspace-automation-*`, `workflow-hub-*` |
| Plataforma Electron | BR-001, BR-027 | RF-037, RF-038 | HU-001 | DEC-001, DEC-004, DEC-011, LIM-001 | `electron/main/`, `preload/`, `src/app/` | `electron/__tests__/preload/`, `main-*`, `src/__tests__/App*` |
| Arnes y entrega | BR-023, BR-024 | RF-038 | HU-024 | DEC-006, DEC-007, DEC-012 | `ai-specs/`, `.agents/`, `openspec/`, `scripts/quality/` | `npm run harness:validate`, `npm run docs:system:check` |

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
