## 1. Catálogo de modelos

- [x] 1.1 Actualizar `MODELS` (`src/config.ts`): `FALLBACK`/`TRANSCRIPTION`/`MAPS` → `gemini-3.5-flash-lite`; `PRIMARY` sin cambios (`gemini-3.5-flash`).
- [x] 1.2 Actualizar `src/hooks/model-selector-options.ts`: opción Lite → `gemini-3.5-flash-lite`; agregar opción `gemini-3.6-flash` ("Pulse Next", no default).
- [x] 1.3 Migrar referencias a `gemini-3.1-flash-lite` verificadas: `gemini-grounding-config.ts`, `flow-service/constants.ts`, `electron/{browser-web,presentation-workflow,wa-agent,windows-uia,llm-task-service}` y su test. NOTA: `electron/daily-briefing/gemini.ts` y `electron/url-summarizer-workflow.ts` conservan el ID viejo porque tocarlos aflora deuda `any` preexistente ajena al cambio (seguimiento aparte).

## 2. Verificación y documentación

- [x] 2.1 `npm run typecheck` OK y pruebas dirigidas (gemini-chat + whatsapp-agent): 51/51.
- [x] 2.2 Default confirmado: `MODELS.PRIMARY = gemini-3.5-flash` sin cambios.
- [~] 2.3 `docs/architecture/runtime-parameters.md`: la sección Desktop Agent documenta el modelo CU (`gemini-3.5-flash`), no el catálogo del chat; sin cambios necesarios (verificado).
- [~] 2.4 `lint:changed` OK; `npm run verify:pr` pendiente de correr.
