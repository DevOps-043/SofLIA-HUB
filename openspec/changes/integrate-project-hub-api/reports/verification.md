# Verificación

Estado: implementación local terminada; despliegue y pruebas con infraestructura real pendientes de autorización.

## Matriz mínima

- Autenticación: exchange válido, token inválido, refresh y logout.
- Permisos: workspace correcto, cruce de workspace, viewer y miembro removido.
- Idempotencia: repetición secuencial y concurrente de importación.
- IPC: éxito, payload inválido, sender no autorizado y caída de API.
- Privacidad: URL saneada, esquema prohibido, límite de DOM y archivo inválido.

## Evidencia ejecutada

### Project Hub

- `npm run build --workspace=apps/web`: pasa. Next compila y tipa todas las rutas `/api/v1`, incluidos meeting imports y el worker del outbox.
- `npm run test --workspace=apps/web`: pasan 61 archivos y 417 pruebas.
- Incluye negativos dirigidos para esquema/URL, magic bytes, adaptadores `/api/ext`, secreto del worker, aprobación humana, ausencia/reutilización de `Idempotency-Key` y delegación del RPC transaccional.

### SofLIA-HUB

- `npm run build:app`: pasa para renderer, Electron main y preload. Solo reporta advertencias de tamaño/dynamic import ya observables en el bundle general.
- `npm run typecheck`: pasa.
- `npm run lint:changed`: pasa; 73 archivos revisados sin deuda nueva.
- `npm run openspec:validate`: pasan 25 cambios estrictos.
- `npm run harness:validate`: pasa; 25 rutas y 9 skills canónicas.
- `npm run docs:check`: pasa; 240 archivos Markdown.
- `npm run docs:system:check`: pasa; 28 documentos, 150 IDs, 360 canales IPC y 394 archivos de prueba.
- Pruebas dirigidas Project Hub/auth: pasan 3 archivos y 20 pruebas (IPC, sender, payload, exchange, identidad federada y logout).
- La prueba aislada `PresentationPlayerApp.test.tsx` pasa 3/3 y `integrated-browser-service.test.ts` pasa dentro de su corrida aislada.

### Gate completo

`npm run verify:pr` pasa adaptadores, harness, supply chain, documentación, seed de skills, OpenSpec, TypeScript y lint. En la suite global queda un fallo reproducible ajeno a Project Hub:

- `electron/__tests__/whatsapp-workflow-presentacion.test.ts`, caso `WA-160`: el mock espera escribir `index.html`, pero la implementación actual escribe el contenido HTML en `deck.json`. Ese flujo ya estaba modificado en el worktree y no se alteró para este cambio.

La corrida global también mostró de forma intermitente un timeout de permisos del navegador y otro de presentación; ambos pasan aislados. La suite global quedó esperando workers y se interrumpió después de documentar los fallos. No se oculta este negativo ni se atribuye a la implementación de Project Hub.

## Cobertura pendiente de infraestructura

- No se ejecutó `024_project_hub_api_v1.sql` ni `project-hub-federation.sql`: requieren respaldo, revisión y autorización explícita.
- Por lo anterior, quedan pendientes las pruebas reales de RLS entre workspaces, carrera concurrente del RPC idempotente, storage privado, entrega HMAC/outbox y revocación efectiva de `folder_shares`.
- También quedan pendientes E2E empaquetados con SOFIA, Lia, Project Hub, Drive y navegador con sesiones reales, además de la prueba de carga del escenario de 800 usuarios.
- El SQL se revisó de forma estática y las aplicaciones compilan contra sus contratos; no había `psql` para validar/aplicar la migración ni `deno` para comprobar la Edge Function localmente.

## Riesgo residual y rollout

- Mantener apagados `PROJECT_HUB_API_V1`, `PROJECT_HUB_UNIFIED_UI`, `MEETING_PROJECT_SYNC_V2` y `BROWSER_COLLECTIONS` hasta aplicar ambas migraciones y configurar secretos.
- Configurar `PROJECT_HUB_API_URL`, `LIA_PROJECT_HUB_OUTBOX_URL`, `LIA_PROJECT_HUB_OUTBOX_HMAC_SECRET`, `PROJECT_HUB_OUTBOX_WORKER_KEY` y el mismo HMAC en Lia.
- Activar primero en una organización piloto, observar errores/latencia, lag y reintentos del outbox, y después ampliar. El rollback consiste en apagar flags; las migraciones son aditivas.
