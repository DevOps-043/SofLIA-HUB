# Estrategia e inventario de pruebas

Estado: vigente. Actualizado: 2026-08-04.

El inventario del cambio contiene 314 archivos de prueba: 247 para main y 67
para renderer. El validador documental recalcula estas cifras; el numero de casos
ejecutados se registra en el reporte de evidencia de cada cambio, no aqui.

<!-- evidence: vitest.config.ts -->
<!-- evidence: electron/__tests__ -->
<!-- evidence: src/__tests__ -->
<!-- evidence: scripts/quality/test-native.mjs -->

## Proyectos Vitest

| Proyecto | Entorno | Include | Setup |
|---|---|---|---|
| `main` | Node | `electron/__tests__/**/*.test.ts` | `test/setup-main.ts`, alias Electron a mock |
| `renderer` | jsdom | `src/__tests__/**/*.test.ts(x)` | `test/setup-renderer.ts` |

Timeout de test y hook: 15 segundos. Los tests que prueban timeouts mayores deben
usar clocks/mocks o justificar override local, no aumentar el global sin evidencia.

## Tipos de evidencia existentes

- Unit: normalizadores, helpers, policies, schema y estados.
- Integration in-process: servicios con SQLite temporal, handlers y dispatchers.
- Renderer: componentes/hooks con Testing Library y jsdom.
- Source/contract: presencia de controles preload, canales, scripts y formatos.
- Build: TypeScript y bundles main/preload/renderer.
- Release: artifacts por OS y smoke de AppImage Linux.

No hay suite E2E empaquetada que automatice Windows/macOS completos ni proveedor
real de WhatsApp/Google/Supabase/Gemini. Dobles locales no sustituyen pruebas de
contrato en entorno autorizado.

## ABI nativa

`npm run test` usa `test-native.mjs`: reconstruye `better-sqlite3` para Node,
ejecuta Vitest y en `finally` lo restaura para Electron. Interrumpir el proceso
puede dejar ABI incorrecta; ejecutar `npm run rebuild:native:electron` antes de
desarrollo/build si aparece `NODE_MODULE_VERSION`.

## Piramide por tipo de cambio

| Cambio | Evidencia minima adicional |
|---|---|
| UI | component/hook + teclado/estados manuales + claro/oscuro |
| IPC | handler, preload allowlist, wrapper y casos canal/payload invalido |
| Tool/agente | schema, autorizacion, HITL, group, timeout, loop y redaccion de error |
| Datos | SQL lint/revision, constraint/RLS, migracion forward, preflight y rollback |
| Integracion | no configurada, exito mock, 401/403, 429, 5xx, timeout y desconexion |
| Release | `verify:release`, recursos empaquetados y artifacts esperados |
| Documentacion/arnes | adapters/harness/docs/OpenSpec/link checks |

## Compuertas

- Durante desarrollo: prueba dirigida con `npx vitest run <archivos>`.
- PR: `npm run verify:pr`.
- Release: `npm run verify:release`.
- `lint:changed` bloquea errores solo en TS/TSX modificados; `lint` global puede
  revelar deuda no atribuible y sigue siendo diagnostico util.

## Casos negativos obligatorios

Autenticacion ausente, org/owner equivocado, input extra, canal no allowlisted,
grupo bloqueado, HITL ausente/falsificado, contrato cambiado, timeout/abort,
respuesta parcial, idempotency replay, DB no disponible, provider rate limit y
rollback. No todos aplican a cada cambio; el Context Pack decide.

## Cobertura y deuda

- La configuracion tiene comando de coverage, pero no umbral global ni por modulo.
- No hay mutation testing, axe, visual regression ni performance budget en CI.
- Tests por inspeccion de source son utiles para invariantes, pero no sustituyen
  ejecutar el comportamiento.
- Nombres legacy AutoDev en tests no demuestran servicio runtime activo.
- Cada reporte debe separar fallo introducido, fallo preexistente y gate no
  ejecutado; nunca convertir warnings en “todo aprobado”.
